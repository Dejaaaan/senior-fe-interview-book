import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { TasksRepo } from "./tasks-repo";

const repo = new TasksRepo(process.env.TABLE_NAME!);

const TaskCreate = z.object({
  title: z.string().min(1).max(120),
  priority: z.enum(["low", "med", "high"]).default("med"),
});

const TaskPatch = z
  .object({
    title: z.string().min(1).max(120).optional(),
    priority: z.enum(["low", "med", "high"]).optional(),
    done: z.boolean().optional(),
  })
  .strict();

const jsonHeaders = { "content-type": "application/json" };

function ok(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return { statusCode: status, headers: jsonHeaders, body: JSON.stringify(body) };
}

function noContent(): APIGatewayProxyResultV2 {
  return { statusCode: 204, headers: jsonHeaders, body: "" };
}

function problem(
  status: number,
  type: string,
  title: string,
  extras?: Record<string, unknown>
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { ...jsonHeaders, "content-type": "application/problem+json" },
    body: JSON.stringify({
      type: `https://errors.example.com/${type}`,
      title,
      status,
      ...extras,
    }),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const id = (event.pathParameters?.id ?? "").trim();

  try {
    if (method === "GET" && path === "/api/tasks") {
      const status = (event.queryStringParameters?.status ?? "all") as
        | "all"
        | "done"
        | "todo";
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50), 100);
      const cursor = event.queryStringParameters?.cursor;
      return ok(await repo.list(userId, { status, limit, cursor }));
    }

    if (method === "POST" && path === "/api/tasks") {
      const body = TaskCreate.parse(JSON.parse(event.body ?? "{}"));
      return ok(await repo.create(userId, body), 201);
    }

    if (method === "GET" && id) {
      const task = await repo.get(userId, id);
      return task ? ok(task) : problem(404, "not-found", "Not found");
    }

    if (method === "PATCH" && id) {
      const body = TaskPatch.parse(JSON.parse(event.body ?? "{}"));
      const task = await repo.update(userId, id, body);
      return task ? ok(task) : problem(404, "not-found", "Not found");
    }

    if (method === "DELETE" && id) {
      const removed = await repo.remove(userId, id);
      return removed ? noContent() : problem(404, "not-found", "Not found");
    }

    return problem(404, "not-found", "Not found");
  } catch (err) {
    if (err instanceof z.ZodError) {
      return problem(400, "validation", "Validation failed", { issues: err.issues });
    }
    console.error("unhandled", err);
    return problem(500, "internal", "Internal error");
  }
};
