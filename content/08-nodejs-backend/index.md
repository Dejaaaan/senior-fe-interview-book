---
title: "Node.js Backend"
sidebar_label: "8. Node.js Backend"
description: "Node fundamentals, project setup, and the same Tasks API in Express, Fastify, and NestJS."
sidebar_position: 7
---

For senior frontend roles, the candidate will be asked Node.js questions. The bar is not "I can write a service that scales to a million Requests Per Second"; it is "I understand what is happening on the other side of the network and I can prototype a backend without slowing the team down". A senior frontend candidate is expected to read backend code fluently, recognise the framework idioms, and pair productively with backend engineers on contract design and operational concerns.

This part is structured around building the same Tasks Application Programming Interface three times — once in Express, once in Fastify, once in NestJS — so the trade-offs are visible side by side rather than discussed abstractly. Each backend supports the same endpoints with the same Zod-validated request and response shapes, so the difference between the three implementations is the framework's idioms rather than the surface area of the Application Programming Interface.

Each chapter includes a `## Common interview questions` section followed by an `## Answers` section containing the detailed multi-paragraph answers that a senior candidate would deliver in an interview, focusing on the framing, the operational trade-offs, and the production hazards an experienced engineer would name.

- `GET /tasks?status=open&page=1&pageSize=20` — list with pagination and filtering.
- `POST /tasks` — create.
- `GET /tasks/:id` — fetch one.
- `PATCH /tasks/:id` — update.
- `DELETE /tasks/:id` — remove.

The chapters cover the runtime first, the project setup, and then each framework with its idioms. Finish with the comparison chapter to lock in when to pick which.

## Chapters in this part

1. [Node fundamentals](./01-node-fundamentals.md) — the event loop, streams, ESM/CJS, worker threads, error handling, the performance toolkit.
2. [Project setup baseline](./02-project-setup.md) — TypeScript, lint, format, test, and build configured the same way every time.
3. [Express](./03-express.md) — middleware-first, the Tasks API written the minimal way.
4. [Fastify](./04-fastify.md) — schema-first, JSON Schema validation, hooks, and the plugin ecosystem.
5. [NestJS](./05-nestjs.md) — modules, dependency injection, controllers, providers, pipes, guards, interceptors.
6. [Express vs. Fastify vs. NestJS — when to pick which](./06-comparison.md) — the same Tasks API compared and a senior decision matrix.
