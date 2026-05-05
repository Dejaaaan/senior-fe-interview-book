import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./schemas.js";
import { taskService } from "./service.js";

class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, "Validation failed", parsed.error.flatten());
  return parsed.data;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      type: "about:blank",
      title: err.message,
      status: err.status,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  res.status(500).json({ type: "about:blank", title: "Internal server error", status: 500 });
};

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/tasks", (req, res) => {
    res.json(taskService.list(validate(ListTasksQuery, req.query)));
  });

  app.post("/tasks", (req, res) => {
    res.status(201).json(taskService.create(validate(CreateTaskInput, req.body)));
  });

  app.get("/tasks/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = taskService.get(req.params["id"]!);
      if (!task) throw new HttpError(404, "Task not found");
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/tasks/:id", (req, res, next) => {
    try {
      const task = taskService.update(req.params["id"]!, validate(UpdateTaskInput, req.body));
      if (!task) throw new HttpError(404, "Task not found");
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/tasks/:id", (req, res, next) => {
    try {
      if (!taskService.delete(req.params["id"]!)) throw new HttpError(404, "Task not found");
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);
  return app;
}
