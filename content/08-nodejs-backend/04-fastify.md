---
title: "Fastify"
sidebar_label: "8.4 Fastify"
description: "Schema-first API with JSON Schema validation, plugins, and hooks."
sidebar_position: 4
---

Fastify is the framing senior candidates typically present as the right pick when the project requires higher throughput, schema-first development, or a plugin architecture as the primary unit of composition. The trade-off, relative to Express, is a slightly less universal ecosystem — many third-party packages target Express directly and require a thin adapter to work with Fastify.

> **Acronyms used in this chapter.** API: Application Programming Interface. CORS: Cross-Origin Resource Sharing. CSV: Comma-Separated Values. DB: Database. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. RPS: Requests Per Second. SSE: Server-Sent Events. UI: User Interface. URL: Uniform Resource Locator. UUID: Universally Unique Identifier.

## Setup

```ts
// src/server.ts
import Fastify, { type FastifyInstance } from "fastify";
import { tasksRoutes } from "./routes/tasks.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: "info" },
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
  });

  app.get("/healthz", async () => ({ ok: true }));
  app.register(tasksRoutes, { prefix: "/tasks" });

  app.setErrorHandler((err, req, reply) => {
    if (err.statusCode && err.statusCode < 500) {
      reply.status(err.statusCode).send({
        type: "about:blank",
        title: err.message,
        status: err.statusCode,
        ...(err.validation ? { details: err.validation } : {}),
      });
      return;
    }
    req.log.error({ err }, "unhandled error");
    reply.status(500).send({ type: "about:blank", title: "Internal server error", status: 500 });
  });

  return app;
}
```

```ts
// src/index.ts
import { buildApp } from "./server.js";
import { env } from "./env.js";

const app = buildApp();
app.listen({ port: env.PORT, host: "0.0.0.0" });
```

## Schema-first routes

Fastify validates both the request and the response against JSON Schema declared on each route. The validation is automatic — request schemas reject invalid input with a 400 response before the handler runs, and response schemas (when configured to enforce) prevent the handler from accidentally leaking fields the schema does not declare. With Zod as the source of truth, the `fastify-type-provider-zod` package bridges Zod schemas into Fastify's JSON Schema-based validator and produces inferred types for `req.query`, `req.body`, and `req.params`.

```ts
// src/routes/tasks.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  CreateTaskInput, ListTasksQuery, Task, UpdateTaskInput,
} from "../schemas/tasks.js";
import { taskService } from "../services/tasks.js";

export async function tasksRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/", {
    schema: {
      querystring: ListTasksQuery,
      response: { 200: z.object({ items: z.array(Task), total: z.number() }) },
    },
  }, async (req) => taskService.list(req.query));

  r.post("/", {
    schema: {
      body: CreateTaskInput,
      response: { 201: Task },
    },
  }, async (req, reply) => {
    const task = taskService.create(req.body);
    return reply.code(201).send(task);
  });

  r.get("/:id", {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: Task, 404: z.object({ title: z.string(), status: z.literal(404) }) },
    },
  }, async (req, reply) => {
    const task = taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ title: "Task not found", status: 404 });
    return task;
  });

  r.patch("/:id", {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: UpdateTaskInput,
      response: { 200: Task, 404: z.object({ title: z.string(), status: z.literal(404) }) },
    },
  }, async (req, reply) => {
    const task = taskService.update(req.params.id, req.body);
    if (!task) return reply.code(404).send({ title: "Task not found", status: 404 });
    return task;
  });

  r.delete("/:id", {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 204: z.null() },
    },
  }, async (req, reply) => {
    if (!taskService.delete(req.params.id)) {
      return reply.code(404).send({ title: "Task not found", status: 404 });
    }
    return reply.code(204).send();
  });
}
```

The wins of the schema-first approach are concrete. Request validation is automatic — invalid input produces a 400 with the structured error details, with no manual `safeParse` call in the handler. Response validation is automatic — the handler cannot accidentally leak fields the schema does not declare, which is a real defence against information disclosure. Type inference flows through — `req.query`, `req.body`, and `req.params` are typed from the schema, so the handler benefits from full TypeScript autocomplete without any explicit annotation. Performance is materially better because Fastify pre-compiles the validators with `ajv` once per route, while ad-hoc Zod parsing pays the parse cost on every request; the compiled-validator approach is approximately three to five times faster.

## Plugins

A Fastify plugin is a function that registers routes, hooks, decorators, or other plugins. Encapsulation is automatic — by default, what a plugin registers does not leak out to its parent or its siblings, which is what makes Fastify's plugin system genuinely modular rather than just a decorative pattern. The team uses encapsulation to enforce per-plugin scopes for hooks, validators, and decorators; when leakage is required (a plugin that adds an authentication helper to be reused by sibling plugins), the team wraps the plugin with `fastify-plugin` to opt out of encapsulation for that one plugin.

```ts
// src/plugins/auth.ts
import fp from "fastify-plugin";

export const auth = fp(async (app) => {
  app.decorate("verifyAuth", async (req) => {
    const token = req.cookies?.session;
    if (!token) throw app.httpErrors.unauthorized();
    req.user = await verifySessionToken(token);
  });
});

declare module "fastify" {
  interface FastifyInstance {
    verifyAuth: (req: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    user?: { id: string };
  }
}
```

The `fastify-plugin` wrapper (imported as `fp`) opts the plugin out of encapsulation so its decorations are visible to siblings. Without the wrapper, the decorator would be visible only inside the plugin that registered it, which is the right default — encapsulation prevents accidental cross-plugin coupling.

Use it on a route:

```ts
r.get("/me", { preHandler: [app.verifyAuth] }, async (req) => req.user);
```

## Hooks

Hooks run at well-defined lifecycle events of every request. The hooks used most often span the request lifecycle from the moment the request arrives to the moment the response is sent.

| Hook | Runs |
| --- | --- |
| `onRequest` | First, before parsing |
| `preParsing` | Before body parsing |
| `preValidation` | After parsing, before schema validation |
| `preHandler` | After validation, before the handler |
| `preSerialization` | After handler, before response is serialized |
| `onSend` | After serialization, before sending |
| `onResponse` | After response is sent |
| `onError` | When an error is thrown |

Most authentication, Cross-Origin Resource Sharing, and rate-limiting middleware in the Fastify ecosystem is implemented as plugins that register hooks at the appropriate lifecycle phase. The hook system replaces the linear middleware chain that Express uses, and the per-phase semantics are precise — `preHandler` runs after validation but before the handler, `preSerialization` runs after the handler but before the response is serialized, and so on.

## OpenAPI from your schemas

```ts
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

await app.register(swagger, {
  openapi: {
    info: { title: "Tasks API", version: "0.1.0" },
  },
  transform: ({ schema, url }) => ({ schema: jsonSchemaTransform({ schema, url }) }),
});
await app.register(swaggerUi, { routePrefix: "/docs" });
```

With the `fastify-type-provider-zod` transform, the team's Zod schemas become OpenAPI definitions automatically; visiting `/docs` shows the Swagger user interface populated from the schemas the code already declares. The team maintains one source of truth — the Zod schemas — and the validation, the type inference, and the OpenAPI documentation all derive from it.

## Performance

Fastify is among the fastest Node.js frameworks for several architectural reasons. The validators are pre-compiled with `ajv` once per route, rather than parsed per request. The response serializers are pre-compiled with `fast-json-stringify`, which is faster than `JSON.stringify` because it knows the response shape in advance. Plugin encapsulation reduces global lookup costs because each plugin's scope is resolved at registration time. The framework avoids the deep middleware-stack walk that Express performs on every request.

The real-world impact is approximately 30,000 to 60,000 Requests Per Second for "echo a JavaScript Object Notation" handlers, versus approximately 5,000 to 10,000 for Express on the same hardware. For most applications, the bottleneck is the Database rather than the framework, so the absolute throughput difference rarely matters; at scale (a real-time gateway, a high-throughput Application Programming Interface aggregator) the difference becomes operationally significant.

## Testing

Fastify has built-in `inject` for in-memory request testing, no `supertest` needed:

```ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/server.js";

describe("Tasks API", () => {
  it("creates a task", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: { title: "Write the chapter" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ title: "Write the chapter" });
    await app.close();
  });
});
```

## Streaming

Fastify supports both Node streams and Web Streams natively:

```ts
app.get("/large", async (_req, reply) => {
  const stream = createReadStream("./big.csv");
  reply.type("text/csv");
  return reply.send(stream);
});
```

For SSE, use `@fastify/sse` or write headers manually.

## When Fastify is the right pick

Fastify is the right pick under four conditions. The Application Programming Interface is high-throughput and the absolute Requests Per Second number matters for operational reasons. Schema-first development is non-negotiable for the team's process. The team wants OpenAPI documentation to derive from the schemas without additional tooling. The team values plugin encapsulation as an architecture tool to enforce per-module scope and prevent cross-module coupling.

## Key takeaways

The schema-first model declares request and response schemas on each route; validation, type inference, and OpenAPI documentation all derive from the schemas. Use Zod via `fastify-type-provider-zod` so the schemas are shareable with the frontend and the type inference works through both layers. Plugins are the unit of composition; the `fastify-plugin` wrapper opts out of encapsulation when a plugin needs to expose decorations to siblings. Use `app.inject(...)` for in-memory integration tests; the built-in injector is faster than `supertest` and does not require binding to a port. Fastify is faster than Express by a meaningful margin under load, but for most applications the database is the bottleneck and the framework difference is invisible.

## Common interview questions

1. What does "schema-first" buy you over Express plus Zod?
2. What is encapsulation in a Fastify plugin?
3. Walk me through generating OpenAPI from your route schemas.
4. When does Fastify's performance advantage actually matter in production?
5. How would you do per-route auth in Fastify?

## Answers

### 1. What does "schema-first" buy you over Express plus Zod?

The schema-first model in Fastify integrates the schema with the framework's request lifecycle, so validation runs automatically before the handler, response shape is enforced after the handler, types flow through inference into the handler, and OpenAPI documentation is derived from the same schema. With Express plus Zod, the team must wire each of these manually — a `safeParse` call at the start of every handler, an explicit type annotation on every request object, a separate hand-written OpenAPI schema. The integration is the value; the validation library is identical.

**How it works.** Fastify's route definition accepts a `schema` object alongside the handler. When the request arrives, Fastify validates each declared part (body, query, params, headers) against the corresponding schema before invoking the handler. If validation fails, Fastify produces a 400 response with structured error details and the handler never runs. The handler receives a typed request object derived from the schema. After the handler returns, the response is validated against the response schema for the chosen status code, which prevents leakage of fields the schema does not declare.

```ts
r.post("/", {
  schema: {
    body: CreateTaskInput,
    response: { 201: Task },
  },
}, async (req, reply) => reply.code(201).send(taskService.create(req.body)));
```

**Trade-offs / when this fails.** Schema-first development requires the team to write the schemas before the handlers, which feels like extra work for trivial Application Programming Interfaces. The cure is the realisation that the schemas are not extra work — they are the source of truth that would otherwise be duplicated across validation, types, and documentation. The model also requires `fastify-type-provider-zod` to bridge Zod into Fastify's JSON Schema-based validator; the bridge is mature in 2026 but adds a dependency the Express equivalent does not need.

### 2. What is encapsulation in a Fastify plugin?

Encapsulation in Fastify is the property that what a plugin registers (routes, hooks, decorators, other plugins) is visible only inside that plugin and its children, not to its parent or its siblings. This is the default behaviour of `app.register(plugin)`, and it is the mechanism by which Fastify achieves genuine modularity rather than the loose composition Express provides. The team uses encapsulation to enforce per-module scope; a plugin that registers a `preHandler` hook for authentication only affects routes inside that plugin, not the entire application.

**How it works.** When the team calls `app.register(plugin)`, Fastify creates a child context and runs the plugin within it. Decorators added to the child context are not visible in the parent. The team opts out of encapsulation for a specific plugin by wrapping it with `fastify-plugin`, which causes the child context's decorators to propagate to the parent. The pattern is "encapsulate by default, opt out for shared utilities".

```ts
import fp from "fastify-plugin";

export const auth = fp(async (app) => {
  app.decorate("verifyAuth", async (req) => {
    /* ... */
  });
});
```

**Trade-offs / when this fails.** Encapsulation is a powerful mechanism but requires the team to understand the parent/child context model; a developer who expects Express-style global registration will be surprised when a hook registered inside one plugin does not affect routes in another plugin. The cure is to teach the model explicitly during onboarding. The pattern also requires the team to be deliberate about when to use `fastify-plugin` (for shared utilities that must be visible across plugins) versus when to leave encapsulation in place (for module-local concerns).

### 3. Walk me through generating OpenAPI from your route schemas.

Register `@fastify/swagger` with the application's metadata (title, version, base information), register `@fastify/swagger-ui` to serve the Swagger user interface at a chosen route prefix, and configure the Zod-to-JSON-Schema transform from `fastify-type-provider-zod`. From that point on, every route's schema contributes to the OpenAPI document automatically — the request body, the query parameters, the path parameters, the response shapes per status code. Visiting the configured route (`/docs` is the conventional choice) shows the Swagger user interface populated from the schemas.

**How it works.** Fastify exposes a `getSchemas()` API that returns all schemas registered across the application's plugins. The Swagger plugin reads these schemas and transforms them into the OpenAPI document format. The Zod-specific transform converts Zod schemas (which are not JSON Schema) into the JSON Schema format that OpenAPI requires. The Swagger user interface plugin then serves the generated document and the interactive user interface.

```ts
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

await app.register(swagger, {
  openapi: { info: { title: "Tasks API", version: "0.1.0" } },
  transform: jsonSchemaTransform,
});
await app.register(swaggerUi, { routePrefix: "/docs" });
```

**Trade-offs / when this fails.** The generated OpenAPI is only as good as the schemas the team has written; routes without schemas appear in the document as untyped, which is misleading. The cure is a team norm that every route has a schema. The Swagger user interface should typically not be exposed in production (or should be gated behind authentication) because it reveals the Application Programming Interface surface to anyone who can reach the endpoint.

### 4. When does Fastify's performance advantage actually matter in production?

The performance advantage matters in three concrete situations. First, when the workload is dominated by request handling rather than downstream Input/Output — a real-time gateway that proxies many small requests, a high-throughput Application Programming Interface aggregator, an in-process cache server. Second, when the team is paying per-instance for the Application Programming Interface workload (serverless platforms, dedicated containers) and a 3x throughput improvement maps to a 3x cost reduction. Third, when the team has measured the framework as a meaningful contributor to the latency budget and the budget cannot accommodate Express's higher per-request cost.

**How it works.** For typical applications where each request waits on a database query, the request handler's cost is a small fraction of the total request time and the framework's overhead is invisible. For applications where the framework's overhead is a significant fraction of the request, the architectural choices Fastify makes (pre-compiled validators, fast serializer, plugin encapsulation) translate directly into measurable throughput.

```bash
autocannon -c 100 -d 30 http://localhost:3000/healthz
# Express ~ 8k RPS
# Fastify ~ 35k RPS
```

**Trade-offs / when this fails.** The performance advantage does not matter when the database is the bottleneck, which is the common case. Switching to Fastify does not improve a service whose 99th-percentile latency is dominated by a slow Structured Query Language query. The cure is to measure first — if the framework is not on the critical path, the performance advantage is not the right reason to choose Fastify, and the schema-first development experience or the plugin architecture may still justify the choice on other grounds.

### 5. How would you do per-route auth in Fastify?

Register an authentication plugin that decorates the application with a `verifyAuth` helper, wrap the plugin in `fastify-plugin` so the helper is visible to sibling plugins, and add `preHandler: [app.verifyAuth]` to each route that requires authentication. The helper reads the credential (a session cookie, a Bearer token), verifies it, and either attaches the resolved user to the request or throws a 401 error that the application's error handler serializes into the response.

**How it works.** The `preHandler` hook runs after schema validation but before the route handler, which is the right place for authentication because the request shape is already validated by the time the auth check runs. The `fastify-plugin` wrapper exposes the decorator across the plugin tree so any route can opt in. Routes that do not require authentication simply omit the `preHandler`, which is a clearer per-route opt-in than the global-middleware-with-exclusion pattern Express tends to use.

```ts
r.get("/me", { preHandler: [app.verifyAuth] }, async (req) => req.user);
```

**Trade-offs / when this fails.** The pattern fails when the team forgets to add the `preHandler` to a route that should require authentication; the cure is a TypeScript-level discipline (a per-route policy check, a wrapper that requires the auth declaration explicitly) or an automated test that asserts every protected route returns 401 when called without credentials. The pattern also requires the team to decide whether authentication is per-route or per-plugin — the latter is cleaner when an entire group of routes shares the same auth requirement, while the former is more granular when individual routes have different requirements.

## Further reading

- [Fastify docs](https://fastify.dev/).
- [`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod).
- [Fastify reference benchmarks](https://fastify.dev/benchmarks).
