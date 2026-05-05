import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from "./schemas.js";
import { taskService } from "./service.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: { level: "info" } }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/healthz", async () => ({ ok: true }));

  app.get("/tasks", {
    schema: {
      querystring: ListTasksQuery,
      response: { 200: z.object({ items: z.array(Task), total: z.number() }) },
    },
  }, async (req) => taskService.list(req.query));

  app.post("/tasks", {
    schema: { body: CreateTaskInput, response: { 201: Task } },
  }, async (req, reply) => {
    return reply.code(201).send(taskService.create(req.body));
  });

  const idParams = z.object({ id: z.string().uuid() });

  app.get("/tasks/:id", { schema: { params: idParams, response: { 200: Task } } },
    async (req, reply) => {
      const task = taskService.get(req.params.id);
      if (!task) return reply.code(404).send({ title: "Task not found", status: 404 });
      return task;
    });

  app.patch("/tasks/:id", {
    schema: { params: idParams, body: UpdateTaskInput, response: { 200: Task } },
  }, async (req, reply) => {
    const task = taskService.update(req.params.id, req.body);
    if (!task) return reply.code(404).send({ title: "Task not found", status: 404 });
    return task;
  });

  app.delete("/tasks/:id", { schema: { params: idParams } }, async (req, reply) => {
    if (!taskService.delete(req.params.id)) {
      return reply.code(404).send({ title: "Task not found", status: 404 });
    }
    return reply.code(204).send();
  });

  return app;
}
