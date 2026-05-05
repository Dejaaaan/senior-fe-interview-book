import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from "./schemas.js";

const store: Task[] = [];

export const taskService = {
  list({ status, page, pageSize }: z.infer<typeof ListTasksQuery>) {
    const all = store.filter((t) => !status || t.status === status);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  },
  get(id: string) {
    return store.find((t) => t.id === id) ?? null;
  },
  create(input: z.infer<typeof CreateTaskInput>): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: input.status ?? "open",
      createdAt: now,
      updatedAt: now,
    };
    store.push(task);
    return task;
  },
  update(id: string, input: z.infer<typeof UpdateTaskInput>): Task | null {
    const t = store.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, input, { updatedAt: new Date().toISOString() });
    return t;
  },
  delete(id: string): boolean {
    const i = store.findIndex((t) => t.id === id);
    if (i < 0) return false;
    store.splice(i, 1);
    return true;
  },
};
