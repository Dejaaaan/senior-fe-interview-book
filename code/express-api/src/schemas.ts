import { z } from "zod";

export const TaskStatus = z.enum(["open", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Task = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.default("open"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof Task>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = CreateTaskInput.partial();
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const ListTasksQuery = z.object({
  status: TaskStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuery>;
