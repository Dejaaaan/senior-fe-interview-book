---
title: "Project setup baseline"
sidebar_label: "8.2 Project setup baseline"
description: "TS + tsx + ESLint + Prettier + Vitest + Zod — the floor for any new Node service."
sidebar_position: 2
---

The same setup works for the Express, Fastify, and NestJS examples in this part. Get the baseline right once so the framework-specific chapters can focus on the framework idioms rather than re-establishing the foundations every time.

> **Acronyms used in this chapter.** API: Application Programming Interface. CI: Continuous Integration. CJS: CommonJS. DB: Database. ESM: ECMAScript Modules. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. TS: TypeScript. UUID: Universally Unique Identifier.

## `package.json`

```json
{
  "name": "tasks-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "test": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "~5.6.0",
    "vitest": "^2.1.4"
  }
}
```

The pieces and their purpose. `tsx` is the development-time TypeScript runner; with `tsx watch`, the server reloads on file changes without a separate build step. `"type": "module"` declares the project as ECMAScript Modules — the modern default for new code in 2026. Vitest is the test runner because it is fast, well-integrated with TypeScript, and works equivalently in development and Continuous Integration; Jest remains acceptable if the team is already using it. Zod handles runtime validation everywhere — a single schema validates the Hypertext Transfer Protocol request body, validates the Database shape, and produces the static type for the response, eliminating the duplication that occurs when validation, types, and serialisation are maintained separately.

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"]
}
```

The `module: "NodeNext"` setting is the modern ECMAScript Modules-friendly choice for Node.js targets; it enforces the `.js` import suffix that ECMAScript Modules require at runtime, so the source code matches what the runtime expects rather than relying on a bundler to rewrite paths. The `noUncheckedIndexedAccess` flag forces explicit handling of the case in which an array or record lookup returns `undefined`, eliminating a common source of runtime errors. The `verbatimModuleSyntax` flag prevents TypeScript from silently elision of `import`/`export` statements at compile time, which is the right behaviour for Node.js where module resolution depends on the exact text of the imports.

## File layout

```text
tasks-api/
├── src/
│   ├── index.ts            # entry: starts the server
│   ├── server.ts           # builds the app/factory
│   ├── routes/
│   │   └── tasks.ts
│   ├── services/
│   │   └── tasks.ts        # business logic, framework-agnostic
│   ├── schemas/
│   │   └── tasks.ts        # Zod schemas + inferred types
│   ├── lib/
│   │   ├── db.ts           # tiny in-memory repo for the demo
│   │   ├── errors.ts
│   │   └── logger.ts
│   └── env.ts              # validated env config
├── tests/
│   └── tasks.test.ts
├── tsconfig.json
└── package.json
```

The discipline a senior engineer adds: `server.ts` exports a factory function that builds the application without calling `listen`, so tests can call the factory directly without binding to a real port. This pattern makes integration tests fast and parallelisable because they share no port allocation, and keeps the entry point thin (the entry point's only job is to read the validated environment, build the application via the factory, and start listening).

## Validated environment configuration

Do not read `process.env.X` scattered through the codebase. Validate every environment variable the application depends on at startup, in a single module, and re-export the validated values as a typed object the rest of the code consumes. The pattern catches missing or malformed configuration at boot rather than at the third request when a code path finally references the missing value.

```ts
// src/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = schema.parse(process.env);
```

If a required environment variable is missing, the process fails at boot rather than at the third request when some code path finally references it.

## Logger

Use `pino`. It is fast, defaults to JavaScript Object Notation output (which downstream log aggregators consume directly without parsing), and provides ergonomic structured-logging helpers.

```ts
// src/lib/logger.ts
import pino from "pino";
import { env } from "../env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "tasks-api" },
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
```

The `redact` option removes secret-bearing fields from log output automatically. Always redact `authorization`, `cookie`, and any other token-bearing header so a log line that records request metadata does not leak credentials into the team's log aggregator.

## A shared schemas module

```ts
// src/schemas/tasks.ts
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

export const CreateTaskInput = Task.pick({ title: true, description: true, status: true })
  .partial({ description: true, status: true });
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = CreateTaskInput.partial();
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const ListTasksQuery = z.object({
  status: TaskStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuery>;
```

`z.infer<typeof Schema>` derives the static type from the schema, so the team maintains one source of truth for both the shape and the validation. The same schema validates the Hypertext Transfer Protocol request body, types the service-layer parameter, and types the response payload.

## Service layer

The business logic lives outside the framework. Frameworks come and go — Express to Fastify to NestJS to whatever appears next — and the domain logic should not have to move when the framework choice changes. The service layer's interface is plain TypeScript types and functions; the framework adapter (the controller, the route handler) handles the request/response translation and delegates the actual work to the service.

```ts
// src/services/tasks.ts
import { randomUUID } from "node:crypto";
import { db } from "../lib/db.js";
import type { CreateTaskInput, ListTasksQuery, Task, UpdateTaskInput } from "../schemas/tasks.js";

export class TaskService {
  list({ status, page, pageSize }: ListTasksQuery): { items: Task[]; total: number } {
    const all = db.tasks.filter((t) => !status || t.status === status);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  get(id: string): Task | null {
    return db.tasks.find((t) => t.id === id) ?? null;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: input.status ?? "open",
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.push(task);
    return task;
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    const t = this.get(id);
    if (!t) return null;
    Object.assign(t, input, { updatedAt: new Date().toISOString() });
    return t;
  }

  delete(id: string): boolean {
    const i = db.tasks.findIndex((t) => t.id === id);
    if (i < 0) return false;
    db.tasks.splice(i, 1);
    return true;
  }
}

export const taskService = new TaskService();
```

This service appears identically in all three framework chapters. Only the adapters — Express controllers, Fastify plugins, NestJS modules — differ. The discipline of keeping the service layer framework-free is what makes the framework migration tractable when it eventually happens.

## Errors

A typed error class makes mapping Hypertext Transfer Protocol status codes consistent across the framework boundary. The service throws an `HttpError` with the appropriate status and message; the framework adapter has a single error-mapping handler that translates `HttpError` instances into the framework's response format.

```ts
// src/lib/errors.ts
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}
```

## Health and readiness

Every service ships at least two endpoints: `/healthz` (live) and `/readyz` (ready to serve). The *live* endpoint returns 200 unless the process is deadlocked or otherwise unable to respond, telling the orchestrator that the process is alive enough to keep running. The *ready* endpoint returns 200 only when the application's dependencies (database, queues, downstream services) are connected and healthy enough to serve traffic; when not ready, it returns 503 and the load balancer routes around it. Distinguishing the two is what makes zero-downtime deploys and rolling restarts work — the orchestrator can wait for `/readyz` to return 200 before promoting a new instance into the rotation.

## What's next

The next three chapters build the same Tasks Application Programming Interface in Express, Fastify, and NestJS using this baseline. The final chapter of the part compares the three implementations side by side.

## Key takeaways

The canonical setup is ECMAScript Modules plus `tsx` plus Vitest plus Zod plus Pino plus validated environment configuration; this combination is the floor for any new Node.js service in 2026. Validate the environment at boot with Zod so missing or malformed configuration fails fast rather than at the third request. Schemas live in one module and the static types are derived with `z.infer`, so the team maintains one source of truth. Business logic lives in a service layer that knows nothing about Express, Fastify, or NestJS, so the framework choice does not constrain the domain. Ship distinct `/healthz` and `/readyz` endpoints so the orchestrator can distinguish "process alive" from "process ready to serve traffic".

## Common interview questions

1. Why ESM in 2026?
2. What does Zod give you over a hand-written validator?
3. Why `/healthz` and `/readyz` separately?
4. How would you ensure a missing env var crashes at boot, not at first request?
5. Where does business logic live in your services? Why?

## Answers

### 1. Why ESM in 2026?

ECMAScript Modules are the standard module system for JavaScript across browsers and Node.js, so adopting them eliminates the dual-build problem that the team would otherwise face when sharing code between the frontend and the backend. ESM also enables top-level `await`, supports static analysis (which makes tree-shaking effective), and produces live bindings (re-assignment in the exporter is visible to importers). CommonJS remains supported by Node.js for backwards compatibility, but new code in 2026 should default to ECMAScript Modules unless a specific dependency forces otherwise.

**How it works.** Setting `"type": "module"` in `package.json` tells Node.js to interpret `.js` files as ECMAScript Modules; the team writes `import` and `export` statements, and the runtime resolves modules through the standard ESM resolution algorithm. The `module: "NodeNext"` TypeScript setting matches the runtime behaviour, including the `.js` import suffix requirement.

```ts
import { z } from "zod";
import { taskService } from "./services/tasks.js";
```

**Trade-offs / when this fails.** The most common pain point is consuming a CommonJS-only library from an ECMAScript Modules application; the import either succeeds with a default-export-only shape or fails with a "named export not found" error. The cure is to inspect the library's `package.json` (`"type"`, `"main"`, `"exports"`) before consuming it and to wrap CommonJS-only libraries with a thin ECMAScript Modules adapter when they appear in the dependency tree. The other operational hazard is the `.js` extension requirement; an import that works under `tsx` (which rewrites paths) fails under raw `node` if the source path lacks the extension.

### 2. What does Zod give you over a hand-written validator?

Zod gives the team three properties that hand-written validators rarely match in practice. First, the schema is the source of truth for both validation and the static type — `z.infer<typeof Schema>` derives the type from the schema, so the two cannot drift out of sync. Second, the validation produces structured error reports with paths into the input (`["body", "title"]`), which the team can serialise into a Hypertext Transfer Protocol `problem+json` response without additional work. Third, the schema composes — a `CreateTaskInput` schema can be derived from the canonical `Task` schema by `pick`, `partial`, `omit`, and the derivation is type-checked, so a refactor of `Task` propagates correctly to its derivatives.

**How it works.** A Zod schema is a value (an instance of `z.ZodType`) that carries both the validation logic and the type information. Calling `schema.parse(input)` validates the input and returns a typed value or throws a `ZodError`. Calling `schema.safeParse(input)` returns a discriminated union of `{ success: true, data }` or `{ success: false, error }`, which is the right pattern for error-handling code that wants to avoid exceptions.

```ts
import { z } from "zod";

const Task = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.enum(["open", "in_progress", "done"]),
});

type Task = z.infer<typeof Task>;
```

**Trade-offs / when this fails.** Zod has a non-trivial bundle size and a measurable runtime cost; for performance-sensitive paths that validate millions of inputs per second, a hand-written validator with a fixed shape is faster. The cure is to use Zod for the request boundaries (where the input is untrusted and the validation is unavoidable) and skip it for internal calls between trusted modules. Zod's error messages are also generic and benefit from per-schema customisation when the team wants to present user-friendly errors.

### 3. Why `/healthz` and `/readyz` separately?

The two endpoints answer different questions and the orchestrator needs both. `/healthz` answers "is the process alive enough to keep running?" — used by Kubernetes' liveness probe, and a failure causes the orchestrator to restart the pod. `/readyz` answers "is the process ready to serve traffic?" — used by Kubernetes' readiness probe and the load balancer, and a failure causes the orchestrator to remove the pod from the rotation without restarting it.

**How it works.** During a normal startup, the process is alive (so `/healthz` returns 200) but its dependencies are not yet connected (so `/readyz` returns 503). The orchestrator sees a healthy but not-ready pod and keeps it running but does not route traffic to it. Once the dependencies are connected, `/readyz` returns 200 and the orchestrator promotes the pod into the rotation. During shutdown, `/readyz` can return 503 in response to a SIGTERM signal so the load balancer drains traffic before the process exits, while `/healthz` continues returning 200 until the process actually stops.

```ts
app.get("/healthz", (req, res) => res.send("ok"));
app.get("/readyz", async (req, res) => {
  try {
    await db.ping();
    res.send("ok");
  } catch {
    res.status(503).send("not ready");
  }
});
```

**Trade-offs / when this fails.** Conflating the two probes — pointing both at the same endpoint — produces incorrect behaviour at startup and shutdown. At startup, the orchestrator restarts the pod because the readiness probe fails; the restart resets the readiness state and the cycle continues. At shutdown, the load balancer keeps sending traffic right up until the process exits, which produces dropped requests. The cure is to distinguish the two probes from day one and to test the shutdown sequence in staging.

### 4. How would you ensure a missing env var crashes at boot, not at first request?

Validate the entire environment at startup, in a single module, before any other code reads `process.env`. Use Zod to define the schema (with explicit defaults and explicit required fields), call `parse` on `process.env`, and re-export the validated typed object. If a required variable is missing, the parse throws a `ZodError` which the team allows to propagate to the top-level entry point; the process exits with a non-zero status code and the orchestrator restarts it (and continues to fail-fast until the configuration is fixed).

**How it works.** The pattern relies on the ECMAScript Modules eager-evaluation guarantee — a top-level `parse` call runs as soon as the module is imported. By importing the env module from the entry point as the first action, the team forces the validation to happen before any application code runs. Subsequent imports of the env module reuse the cached, already-parsed value.

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
});

export const env = schema.parse(process.env);
```

**Trade-offs / when this fails.** The pattern fails when team members read `process.env.X` directly elsewhere in the code, bypassing the validated module; the cure is an ESLint rule that forbids direct `process.env` access outside the env module. The pattern also fails when the team validates the environment but ignores the validation result (logs the error and continues); the cure is to let the error propagate and crash the process.

### 5. Where does business logic live in your services? Why?

Business logic lives in a service layer that is framework-agnostic — pure TypeScript classes or functions whose interface is plain types and whose dependencies (the database, the logger, downstream services) are injected explicitly. The framework adapter (an Express handler, a Fastify route handler, a NestJS controller) is responsible only for translating Hypertext Transfer Protocol requests into service calls and translating service results into responses. The reason is that frameworks change — the team that ships an Express service in year one frequently rewrites it in Fastify or NestJS three years later — and the domain logic should not have to move when the framework choice changes.

**How it works.** The service is a class (or a set of functions) that operates on the domain types and produces the domain results. The controller validates the request, calls the service, and serialises the result. The integration test of the service operates directly on the service interface, with no framework involvement, which is faster and more focused than testing through the framework.

```ts
export class TaskService {
  list(query: ListTasksQuery): { items: Task[]; total: number } {
    const all = this.repo.findAll().filter((t) => !query.status || t.status === query.status);
    const start = (query.page - 1) * query.pageSize;
    return { items: all.slice(start, start + query.pageSize), total: all.length };
  }
}
```

**Trade-offs / when this fails.** The pattern adds a layer of indirection that may feel like overkill for a small Application Programming Interface; the cure is to start with the controller as the only layer and extract the service when the controller starts containing business logic that needs to be tested in isolation. The pattern also assumes the team has the discipline to keep framework dependencies out of the service layer; a single `import { Request } from "express"` in the service breaks the abstraction and the next migration is painful again.
