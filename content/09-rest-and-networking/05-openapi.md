---
title: "OpenAPI / Swagger"
sidebar_label: "9.5 OpenAPI / Swagger"
description: "Generating spec from your code, generating clients from your spec."
sidebar_position: 5
---

OpenAPI is the standard specification format for Representational State Transfer Application Programming Interfaces. The framing senior candidates typically present is to generate the specification from the code and to generate clients from the specification; hand-written OpenAPI documents drift out of sync with the implementation within a single sprint.

> **Acronyms used in this chapter.** API: Application Programming Interface. BE: Backend. CI: Continuous Integration. FE: Frontend. HTML: HyperText Markup Language. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. OpenAPI: Open Application Programming Interface specification. REST: Representational State Transfer. SDK: Software Development Kit. SSE: Server-Sent Events. TS: TypeScript. URL: Uniform Resource Locator. YAML: YAML Ain't Markup Language.

## What an OpenAPI document looks like

```yaml
openapi: 3.1.0
info:
  title: Tasks API
  version: 0.1.0
servers:
  - url: https://api.example.com
paths:
  /tasks:
    get:
      summary: List tasks
      parameters:
        - name: status
          in: query
          schema: { $ref: "#/components/schemas/TaskStatus" }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TaskList" }
components:
  schemas:
    TaskStatus:
      type: string
      enum: [open, in_progress, done]
    Task:
      type: object
      required: [id, title, status, createdAt, updatedAt]
      properties:
        id: { type: string, format: uuid }
        title: { type: string, maxLength: 200 }
        description: { type: string, maxLength: 2000 }
        status: { $ref: "#/components/schemas/TaskStatus" }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    TaskList:
      type: object
      required: [items, total]
      properties:
        items: { type: array, items: { $ref: "#/components/schemas/Task" } }
        total: { type: integer }
```

For a five-hundred-endpoint Application Programming Interface, a document of this kind is unmaintainable by hand; every refactor of a route or schema requires a synchronised edit to the YAML, and the synchronisation invariably falls behind the code.

## Generation strategies

### Strategy 1: code-first (preferred)

Define the schemas once — using Zod, JSON Schema, or class-validator — and generate the specification from them. The schema is simultaneously the runtime validator and the contract document; drift is structurally impossible because there is one source of truth.

| Stack | Tool |
| --- | --- |
| Express + Zod | `zod-to-openapi` |
| Fastify + Zod | `fastify-type-provider-zod` + `@fastify/swagger` |
| NestJS | `@nestjs/swagger` (decorators) |
| tRPC | `trpc-openapi` |

```ts
// Fastify example
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import swagger from "@fastify/swagger";

await app.register(swagger, {
  openapi: { info: { title: "Tasks API", version: "0.1.0" } },
  transform: jsonSchemaTransform,
});
```

Now `/openapi.json` reflects the routes exactly; no drift is possible because the schema is also the validation.

### Strategy 2: spec-first

Write the OpenAPI YAML by hand or in a tool such as Stoplight, then generate server stubs and client Software Development Kits from it. The pattern is appropriate when the specification is the contract before any code exists, when multiple teams in different languages (Java, Go, TypeScript) implement servers from the same specification, or when the specification is shared with external partners and stability matters more than implementation velocity.

For a TypeScript-only product team owning both the server and the clients, code-first wins on every dimension that matters: faster iteration, no drift, less ceremony.

## Client generation

```bash
# OpenAPI Generator (Java-based, supports many languages)
openapi-generator-cli generate -i openapi.json -g typescript-fetch -o packages/api-client/src

# openapi-typescript (TS-only, fast)
npx openapi-typescript https://api.example.com/openapi.json -o src/api.ts
```

The result is a typed client in which every endpoint, parameter, and response shape is encoded in TypeScript. Refactors that change the specification break the consumer's TypeScript build immediately, surfacing the breakage at compile time rather than at runtime in production.

For consumers using TanStack Query, the combination of `openapi-fetch` and `openapi-react-query` generates a typed hook per endpoint, with full type inference for path parameters, query parameters, and response bodies.

```ts
import createClient from "openapi-fetch";
import type { paths } from "./api";

const client = createClient<paths>({ baseUrl: "https://api.example.com" });
const { data, error } = await client.GET("/tasks/{id}", { params: { path: { id: "123" } } });
```

## Documentation tools

OpenAPI feeds into a small ecosystem of documentation rendering tools. Swagger UI is the canonical "try it out" interface, with an interactive form per endpoint that issues real requests against the configured server. Redoc produces static, well-typeset HyperText Markup Language documentation suitable for embedding in a marketing site. Stoplight Elements is a modern, embeddable component library that combines reference and try-it-out. Scalar is a lighter alternative that has gained traction for its faster initial load and cleaner default theme.

Most frameworks bundle Swagger UI under `/docs` or `/openapi`. Expose it on a stable path and link to it from the team's documentation hub.

```ts
await app.register(swaggerUi, { routePrefix: "/docs" });
```

## Versioning the spec

The `info.version` field changes alongside the Application Programming Interface. The recommended senior practice has three components. First, tag major specification versions (`v1`, `v2`) and serve them at distinct Uniform Resource Locators (`/v1/openapi.json`, `/v2/openapi.json`) so consumers can pin to a known contract. Second, sunset old versions explicitly using the `deprecated: true` flag on operations and the `Sunset` Hypertext Transfer Protocol header (Request for Comments 8594) on responses, giving clients programmatic notice of the upcoming removal. Third, generate clients per version with explicit names (`api-client-v1`, `api-client-v2`) so consumers can hold both versions while migrating.

## Spec linting

Treat the OpenAPI specification as code. Lint it in Continuous Integration to catch quality regressions before they reach consumers.

```bash
npx @stoplight/spectral-cli lint openapi.yaml --ruleset .spectral.yml
```

Common rules require every operation to declare `summary`, `tags`, and `operationId`; require response codes to match the Hypertext Transfer Protocol semantics expected for the path; and require `description` on every path-level parameter so generated documentation has prose rather than just a name.

## Mock servers from spec

A mock server generated from the specification unblocks parallel development between frontend and backend teams. The frontend builds against the mock and adopts the contract immediately; the backend implements the real thing on its own timeline; the two meet at the specification rather than in scheduling meetings.

```bash
npx prism mock openapi.json
```

## What OpenAPI doesn't cover well

OpenAPI is designed for synchronous request/response Representational State Transfer Application Programming Interfaces and covers some patterns less gracefully. Asynchronous Application Programming Interfaces — WebSocket, Server-Sent Events, Kafka, message queues — are better described by [AsyncAPI](https://www.asyncapi.com/), a sibling specification with similar tooling. GraphQL has its own schema language and tooling ecosystem; do not force it into OpenAPI. Streaming responses can be partially expressed in OpenAPI (`text/event-stream` media type), but tooling support is uneven and consumers often need to write hand-rolled parsers anyway.

For non-Representational State Transfer Application Programming Interfaces, document them in their own contract format and link from a single documentation hub so consumers have one place to look.

## Key takeaways

The senior framing for OpenAPI is that code-first generation is the only sustainable approach for long-lived Application Programming Interfaces; generated TypeScript clients catch breaking changes at consumer build time; Swagger UI bundled under a stable `/docs` path is essential discoverability; the specification should be linted in Continuous Integration and major versions should be tagged and sunset explicitly; mock servers generated from the specification unblock parallel frontend/backend development; and non-Representational State Transfer contracts (WebSocket, GraphQL) should be documented in their own native format rather than forced into OpenAPI.

## Common interview questions

1. Why is generated OpenAPI better than hand-written?
2. How can a TypeScript client be kept in sync with the server's Application Programming Interface?
3. Walk through the frontend/backend parallel-development workflow with a mocked OpenAPI.
4. When would AsyncAPI be the right choice?
5. How can breaking Application Programming Interface changes be communicated to consumers?

## Answers

### 1. Why is generated OpenAPI better than hand-written?

Hand-written OpenAPI documents drift out of sync with the implementation within a single sprint because the document and the code are two sources of truth that nobody keeps consistent under deadline pressure. Generated OpenAPI eliminates the drift structurally: the specification is derived from the same schema (Zod, JSON Schema, class-validator decorators) that validates incoming requests at runtime. A change to the schema simultaneously changes the validator and the specification; there is no second artifact to remember to update.

**Trade-offs / when this fails.** Code-first requires a runtime schema library that can also emit OpenAPI, which constrains framework choice. Spec-first is the right answer when the specification is the contract before any code exists, when multiple teams in different languages implement servers from the same specification, or when external partners depend on the specification's stability more than the implementation's velocity. For a TypeScript-only product team owning both server and client, code-first wins.

### 2. How can a TypeScript client be kept in sync with the server's API?

Generate the client from the server's OpenAPI document on every server release. Tools such as `openapi-typescript` or `openapi-fetch` produce a typed client where every endpoint, parameter, and response shape is captured in TypeScript types. Wire client generation into the Continuous Integration pipeline: when the server publishes a new version, the client package version bumps; when a consumer pulls the new client version, any breaking change to the contract surfaces as a TypeScript compile error rather than a runtime four-hundred response.

```ts
const client = createClient<paths>({ baseUrl: process.env.API_URL });
const { data, error } = await client.GET("/tasks/{id}", { params: { path: { id } } });
```

**Trade-offs / when this fails.** The discipline depends on every consumer actually upgrading the generated client; a consumer that pins to an old version misses the type-level signal. Some changes are not type-level breaking (semantics changes, new validation rules) and require consumers to read the changelog carefully. Pair the generated client with explicit changelogs for behavioural changes.

### 3. Walk through the FE/BE parallel-development workflow with a mocked OpenAPI.

The teams agree the OpenAPI specification first — typically authored by the backend team but reviewed by frontend. The backend generates a mock server from the specification (`npx prism mock openapi.yaml`) and exposes it on a shared internal Uniform Resource Locator. The frontend builds against the mock immediately, integrating real types from the generated client and exercising the User Interface end-to-end against canned responses. The backend implements the real handlers on its own timeline. When the backend is ready, the frontend swaps the base Uniform Resource Locator from the mock to the real server; the contract has not changed, so the swap is mechanical.

**Trade-offs / when this fails.** The pattern works only when the specification is treated as a binding contract; mid-sprint changes to the specification break both teams. Mock responses must include realistic edge cases (empty arrays, error envelopes, slow responses) or the frontend ships against an unrealistically friendly server. The frontend should still write Mock Service Worker handlers for tests rather than depending on the live mock server.

### 4. When would AsyncAPI be the right choice?

AsyncAPI is the right choice for any Application Programming Interface that is not a synchronous request/response Representational State Transfer call: WebSocket channels, Server-Sent Events streams, Apache Kafka topics, message queues such as RabbitMQ or AWS Simple Queue Service, and any event-driven contract. The specification language describes channels (logical paths), messages (payload schemas), and operations (publish/subscribe roles), and tooling exists for code generation, documentation rendering, and validation similar to OpenAPI's ecosystem.

**Trade-offs / when this fails.** AsyncAPI is younger and has thinner tooling than OpenAPI; expect to fill gaps. Some asynchronous patterns (WebRTC peer-to-peer, custom binary protocols) are not well-served by either specification and benefit from prose documentation paired with reference client code. For a hybrid system that exposes both Representational State Transfer and event-driven Application Programming Interfaces, document each in its native specification and cross-link from a single documentation hub.

### 5. How can breaking API changes be communicated to consumers?

The communication is multi-channel. The OpenAPI specification marks the affected operations `deprecated: true` so generated documentation and clients surface the deprecation. Responses from deprecated endpoints carry the `Deprecation` and `Sunset` Hypertext Transfer Protocol headers (Request for Comments 8594) so consumers can detect deprecation programmatically and trigger automated alerts. The team publishes a changelog entry with the rationale, the migration path, and the sunset date. For high-traffic Application Programming Interfaces, the team also reaches out directly to the top consumers (identified from logs) and offers help with the migration.

**Trade-offs / when this fails.** Headers alone are insufficient because most consumers do not log them. Changelogs alone are insufficient because most consumers do not read them. The combined approach — headers for programmatic detection, changelogs for human reading, and direct outreach for the largest consumers — is the senior standard for any Application Programming Interface with external dependencies. Sunset windows must be generous enough for consumers to migrate (one quarter is a common minimum); shorter windows generate complaints and erode trust.

## Further reading

- [OpenAPI 3.1 specification](https://spec.openapis.org/oas/v3.1.0).
- [`zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).
- [`openapi-typescript`](https://openapi-ts.dev/).
- [Stoplight Spectral](https://github.com/stoplightio/spectral) for linting.
