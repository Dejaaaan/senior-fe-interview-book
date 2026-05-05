---
title: "Express"
sidebar_label: "8.3 Express"
description: "Minimal Tasks API in Express: middleware, validation, error handling."
sidebar_position: 3
---

Express is the senior bar for "I know Node.js web servers". It is old, simple, and ubiquitous; nearly every Node.js codebase a senior candidate will encounter either uses Express directly or uses a framework whose mental model derives from Express. The patterns below show what production Express code looks like in 2026 — not the ten-year-old tutorials whose advice has been overtaken by Express 5, Zod, and modern TypeScript practice.

> **Acronyms used in this chapter.** API: Application Programming Interface. CORS: Cross-Origin Resource Sharing. CSP: Content Security Policy. DI: Dependency Injection. HTTP: Hypertext Transfer Protocol. RFC: Request for Comments. RPS: Requests Per Second. SSE: Server-Sent Events. URL: Uniform Resource Locator.

## Setup

```ts
// src/server.ts
import express, { type Express } from "express";
import { tasksRouter } from "./routes/tasks.js";
import { errorHandler } from "./lib/errors.js";

export function buildApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/tasks", tasksRouter);

  app.use(errorHandler);    // must be LAST
  return app;
}
```

```ts
// src/index.ts
import { buildApp } from "./server.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

const app = buildApp();
app.listen(env.PORT, () => logger.info({ port: env.PORT }, "listening"));
```

The factory pattern — `buildApp` returns a configured Express application without calling `listen` — means integration tests can use `supertest(buildApp())` without binding to a real port. This makes the test suite faster and parallelisable, and keeps the entry point thin (the entry point's only responsibility is to read the validated environment and call `listen`).

## A route with Zod validation

```ts
// src/routes/tasks.ts
import { Router } from "express";
import { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "../schemas/tasks.js";
import { taskService } from "../services/tasks.js";
import { HttpError } from "../lib/errors.js";

export const tasksRouter = Router();

tasksRouter.get("/", (req, res) => {
  const parsed = ListTasksQuery.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, "Invalid query", parsed.error.flatten());
  res.json(taskService.list(parsed.data));
});

tasksRouter.post("/", (req, res) => {
  const parsed = CreateTaskInput.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid body", parsed.error.flatten());
  res.status(201).json(taskService.create(parsed.data));
});

tasksRouter.get("/:id", (req, res) => {
  const task = taskService.get(req.params.id);
  if (!task) throw new HttpError(404, "Task not found");
  res.json(task);
});

tasksRouter.patch("/:id", (req, res) => {
  const parsed = UpdateTaskInput.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid body", parsed.error.flatten());
  const updated = taskService.update(req.params.id, parsed.data);
  if (!updated) throw new HttpError(404, "Task not found");
  res.json(updated);
});

tasksRouter.delete("/:id", (req, res) => {
  if (!taskService.delete(req.params.id)) throw new HttpError(404, "Task not found");
  res.status(204).end();
});
```

A discipline a senior engineer adds: factor the validation pattern into a helper so the same shape is not duplicated at every route. The helper lifts the schema-to-validation-to-typed-data flow into a single line per route handler, eliminating a common source of inconsistency where one route returns a bare error string and another returns a structured error.

```ts
function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, "Validation failed", parsed.error.flatten());
  return parsed.data;
}
```

## Error handling middleware

Express identifies a function as an error handler when its signature accepts four arguments — `err`, `req`, `res`, `next` — rather than the three-argument signature of a regular middleware. This convention is structurally important: an error handler with three arguments is silently treated as regular middleware and never receives errors, which is a subtle source of bugs the team should guard against in code review.

```ts
// src/lib/errors.ts (continued)
import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      type: "about:blank",
      title: err.message,
      status: err.status,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ type: "about:blank", title: "Internal server error", status: 500 });
};
```

The shape of the error response follows Request for Comments 7807 (the `application/problem+json` media type), which is the standard for machine-readable Hypertext Transfer Protocol error responses; the team should adopt it consistently across every service so consumers can rely on a uniform error structure. See [REST: Errors](../09-rest-and-networking/04-errors.md) for the full discussion.

## Async handlers

Express 4 didn't auto-forward thrown errors from async handlers. Use the `express-async-errors` shim or wrap each handler:

```ts
import "express-async-errors";   // patches Express; do this once at the top
```

Express 5 (stable since 2024) handles this natively — async handlers' rejections forward to the error middleware automatically with no shim required. For new code in 2026, use Express 5.

## Middleware: the basics

```ts
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

app.use(helmet());                 // common security headers
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
```

Three reminders for production. `helmet()` is a starting point but not a Content Security Policy; the team must set the `Content-Security-Policy` header explicitly based on the application's threat model. See [Security: XSS & CSP](../11-security-and-privacy/02-xss-csp.md) for the full discussion. Cross-Origin Resource Sharing with `credentials: true` requires an explicit origin and rejects the wildcard `*`; the team must enumerate the allowed origins and reject requests with an `Origin` header that does not match. Rate limiting at the application is a backstop; per-user limits at the Application Programming Interface gateway, the Identity Provider, or Cognito are usually a better defence because they are enforced before the request reaches the application.

## Auth middleware

```ts
function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session || req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Unauthorized");
  req.user = verifySessionToken(token);   // throws on invalid
  next();
}

tasksRouter.use(requireAuth);
```

Define `Express.Request['user']` in a `.d.ts` so TypeScript knows about it.

## Testing with `supertest`

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../src/server.js";

describe("Tasks API", () => {
  it("creates and lists a task", async () => {
    const app = buildApp();

    const created = await request(app)
      .post("/tasks")
      .send({ title: "Write the chapter" })
      .expect(201);

    expect(created.body).toMatchObject({ title: "Write the chapter", status: "open" });

    const listed = await request(app).get("/tasks").expect(200);
    expect(listed.body.items).toContainEqual(expect.objectContaining({ id: created.body.id }));
  });

  it("400s on invalid body", async () => {
    const app = buildApp();
    await request(app).post("/tasks").send({}).expect(400);
  });
});
```

## Streaming responses

Express supports streaming via `res.write`/`res.end`. For SSE:

```ts
app.get("/events", (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const interval = setInterval(() => {
    res.write(`data: ${new Date().toISOString()}\n\n`);
  }, 1000);

  res.on("close", () => clearInterval(interval));
});
```

For Web Streams interop (newer pattern), Express 5 supports passing a `Response` returned from `Response.json()` etc.

## What Express does not provide

Express is intentionally minimal and leaves a number of common needs to the team. Schema validation is not built in — the team must bring Zod or an equivalent library. Auto-generated OpenAPI documentation requires an additional library such as `zod-to-openapi` or a hand-written schema. Performance is acceptable for most workloads but Fastify is meaningfully faster for high-Requests-Per-Second scenarios. Opinionated structure is absent; NestJS dictates a project shape, while Express leaves the team to design its own.

If those concerns matter for the project, the next two chapters cover Fastify and NestJS as alternatives.

## Key takeaways

Use Express 5 for new code; the native async-error forwarding eliminates the most common Express 4 pitfall. Use a factory function (`buildApp()`) so tests can use `supertest` without binding to a real port. Validate inputs with Zod and centralise the validation helper so every route follows the same shape. The error handler middleware has four arguments and must be registered last so it can intercept errors from every preceding middleware and route. The standard production middleware stack is `helmet`, `cors`, `morgan` (or `pino-http`), and `express-rate-limit`. Declare `Express.Request['user']` in a `.d.ts` declaration file so the typed authentication flow propagates through every handler.

## Common interview questions

1. What changed about async error handling between Express 4 and 5?
2. Where does the error middleware go and why?
3. How would you wire Zod to validate body, query, and params?
4. CORS with `credentials: true` and a wildcard origin — what happens?
5. When would you NOT pick Express for a new service?

## Answers

### 1. What changed about async error handling between Express 4 and 5?

Express 4 did not forward rejections from `async` route handlers to the error middleware; if an `async` handler threw or its returned Promise rejected, the rejection was silently dropped and the request hung until the client timed out. The standard mitigations were `express-async-errors` (a shim that monkey-patched the router) or wrapping every handler in a `try/catch` that called `next(err)`. Express 5, stable since 2024, fixes this natively — `async` handlers' rejections now propagate to the error middleware automatically, no shim required.

**How it works.** In Express 5, the router awaits the return value of each handler and, on rejection, calls `next(err)` automatically. The error middleware then runs as it would for a synchronous error.

```ts
app.get("/users/:id", async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new HttpError(404, "User not found");
  res.json(user);
});
```

**Trade-offs / when this fails.** The improvement applies to Promise rejections in `async` handlers. It does not catch errors thrown after the response has started (for example, in a stream the team writes to after `res.write` has begun), because the response is already partially sent. The cure is to handle stream errors explicitly inside the handler. Migrating from Express 4 to Express 5 also requires reviewing the team's middleware for any Express 4-specific behaviour that has been changed (the path-to-regexp version differs, some deprecated APIs are removed); the cure is to read the Express 5 migration guide before upgrading.

### 2. Where does the error middleware go and why?

The error middleware is registered last in the middleware chain, after every route and every other middleware. The reason is that Express's error-propagation flow is sequential: when a handler throws or calls `next(err)`, Express looks for the next middleware with a four-argument signature in registration order. Registering the error middleware last ensures it can intercept errors from every preceding middleware and route handler.

**How it works.** Express identifies error-handling middleware by its arity — a function with four arguments (`err`, `req`, `res`, `next`) is treated as an error handler; any other arity is treated as regular middleware. The error handler runs only when an error has been propagated; for non-error requests, Express skips it.

```ts
const app = express();
app.use(express.json());
app.use("/tasks", tasksRouter);
app.use("/users", usersRouter);
app.use(errorHandler); // last
```

**Trade-offs / when this fails.** Registering an error middleware before a route means errors from that route are not caught by it (subsequent error middleware would catch them, but the route's specific error middleware does not). Defining a function with three arguments instead of four turns it into regular middleware and it never receives errors; this is a subtle bug that is easy to introduce and hard to diagnose. The cure is to use a TypeScript-typed `ErrorRequestHandler` that enforces the four-argument shape.

### 3. How would you wire Zod to validate body, query, and params?

Use a single validation helper that accepts a Zod schema and the data to validate, returns the typed parsed value on success, and throws an `HttpError` on failure. Apply the helper at the start of every route handler, validating each part of the request (body, query, params) against its corresponding schema. The validated values then flow into the service layer with their inferred TypeScript types.

**How it works.** The helper wraps `schema.safeParse(data)`, which returns a discriminated union of success or failure. On success, the helper returns the typed value. On failure, the helper throws an `HttpError` with status 400 and the structured error report from Zod, which the error middleware serialises into a `problem+json` response.

```ts
import { z } from "zod";

function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, "Validation failed", parsed.error.flatten());
  }
  return parsed.data;
}

tasksRouter.post("/", (req, res) => {
  const input = validate(CreateTaskInput, req.body);
  res.status(201).json(taskService.create(input));
});
```

**Trade-offs / when this fails.** The pattern fails when the validation is repeated inline at every route rather than extracted into the helper; the cure is the helper above. The pattern also fails when the team validates the body but not the query or params, which leaves a gap in the input-validation surface. The cure is a per-route discipline that every untrusted input is validated before it reaches the service layer.

### 4. CORS with `credentials: true` and a wildcard origin — what happens?

The browser refuses to use the response. The Cross-Origin Resource Sharing specification explicitly prohibits the wildcard origin (`Access-Control-Allow-Origin: *`) when the request includes credentials (cookies, the `Authorization` header) — the browser treats the response as if the Cross-Origin Resource Sharing pre-flight had failed and the request is blocked. The fix is to enumerate the allowed origins and echo the request's `Origin` back when it matches.

**How it works.** When the browser sends a credentialed cross-origin request, it requires the response to specify a single allowed origin (not the wildcard) and to include `Access-Control-Allow-Credentials: true`. The `cors` middleware handles this when the team configures it with an explicit origin or a function that validates the origin per request.

```ts
import cors from "cors";

app.use(cors({
  origin: (origin, callback) => {
    const allowed = ["https://app.example.com", "https://staging.example.com"];
    callback(null, !origin || allowed.includes(origin));
  },
  credentials: true,
}));
```

**Trade-offs / when this fails.** The pattern fails when the team configures `origin: "*"` and `credentials: true`; the request is blocked by the browser and the team's logs show the request never arriving (because the browser blocks it before the request leaves). The cure is to use an explicit origin list and to test credentialed cross-origin requests in development. The pattern also fails when the team allows `null` as an origin (which corresponds to documents loaded from `file://` or sandboxed iframes) without intent; the cure is to reject `null` explicitly unless the application has a specific reason to support it.

### 5. When would you NOT pick Express for a new service?

Three project shapes argue against Express. First, when raw performance matters — for high-Requests-Per-Second workloads (real-time gateways, high-throughput Application Programming Interface aggregators), Fastify is two to three times faster than Express on most benchmarks, and the difference is operationally significant. Second, when the team wants enforced structure — NestJS provides Dependency Injection, modules, and a strong opinion on project layout that pays off when the team is large or growing rapidly. Third, when the team wants schema-first development with auto-generated OpenAPI — Fastify's JSON Schema integration produces OpenAPI from the schemas the team is already writing, while Express requires additional tooling.

**How it works.** Express is intentionally minimal — the team brings the validation library, the OpenAPI generator, the Dependency Injection container, the project structure. The cost of that minimalism is real for teams that want a more opinionated framework; the benefit is that the team's stack is exactly what the team chose, with no mandatory dependencies.

```ts
// Fastify equivalent, schema-first.
fastify.post("/tasks", {
  schema: { body: createTaskSchema, response: { 201: taskSchema } },
}, async (req) => taskService.create(req.body));
```

**Trade-offs / when this fails.** The decision to skip Express is not always correct; for small services where the team's existing knowledge and ecosystem alignment favour Express, the simplicity of the choice is worth more than the marginal performance or structural benefits of an alternative. The cure is to evaluate per-project rather than dogmatically; the senior framing in interviews is "Express is the right default for most services and the alternatives are correct only when their specific advantages address a concrete project need".

## Further reading

- [Express docs](https://expressjs.com/).
- [`zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).
- [supertest](https://github.com/ladjs/supertest).
