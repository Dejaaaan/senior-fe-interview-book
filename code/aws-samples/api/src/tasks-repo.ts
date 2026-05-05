import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type Task = {
  id: string;
  title: string;
  priority: "low" | "med" | "high";
  done: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
};

type ListOpts = { status: "all" | "done" | "todo"; limit: number; cursor?: string };

export class TasksRepo {
  constructor(private readonly tableName: string) {}

  private pk(userId: string) {
    return `USER#${userId}`;
  }
  private sk(taskId: string) {
    return `TASK#${taskId}`;
  }
  private gsi1Sk(done: boolean, createdAt: string) {
    return `STATUS#${done ? "done" : "todo"}#${createdAt}`;
  }

  async list(userId: string, opts: ListOpts) {
    const useGsi = opts.status !== "all";
    const params = useGsi
      ? {
          IndexName: "GSI1",
          KeyConditionExpression: "PK = :pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": this.pk(userId),
            ":prefix": `STATUS#${opts.status === "done" ? "done" : "todo"}#`,
          },
        }
      : {
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": this.pk(userId),
            ":prefix": "TASK#",
          },
        };

    const r = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        ScanIndexForward: false,
        Limit: opts.limit,
        ExclusiveStartKey: opts.cursor
          ? JSON.parse(Buffer.from(opts.cursor, "base64").toString("utf8"))
          : undefined,
        ...params,
      })
    );

    return {
      items: (r.Items ?? []).map((i) => this.toTask(i)),
      cursor: r.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString("base64")
        : null,
    };
  }

  async get(userId: string, id: string): Promise<Task | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(userId), SK: this.sk(id) },
      })
    );
    return r.Item ? this.toTask(r.Item) : null;
  }

  async create(userId: string, input: { title: string; priority: "low" | "med" | "high" }): Promise<Task> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const item = {
      PK: this.pk(userId),
      SK: this.sk(id),
      GSI1SK: this.gsi1Sk(false, now),
      taskId: id,
      title: input.title,
      priority: input.priority,
      done: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return this.toTask(item);
  }

  async update(
    userId: string,
    id: string,
    patch: { title?: string; priority?: "low" | "med" | "high"; done?: boolean }
  ): Promise<Task | null> {
    const existing = await this.get(userId, id);
    if (!existing) return null;

    const next: Task = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    const newGsi1Sk = this.gsi1Sk(next.done, existing.createdAt);

    await ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(userId), SK: this.sk(id) },
        UpdateExpression:
          "SET title = :t, priority = :p, done = :d, updatedAt = :u, GSI1SK = :g, version = :v",
        ConditionExpression: "version = :prev",
        ExpressionAttributeValues: {
          ":t": next.title,
          ":p": next.priority,
          ":d": next.done,
          ":u": next.updatedAt,
          ":g": newGsi1Sk,
          ":v": next.version,
          ":prev": existing.version,
        },
      })
    );
    return next;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(userId), SK: this.sk(id) },
          ConditionExpression: "attribute_exists(PK)",
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  private toTask(i: Record<string, unknown>): Task {
    return {
      id: i.taskId as string,
      title: i.title as string,
      priority: i.priority as Task["priority"],
      done: i.done as boolean,
      createdAt: i.createdAt as string,
      updatedAt: i.updatedAt as string,
      version: i.version as number,
    };
  }
}
