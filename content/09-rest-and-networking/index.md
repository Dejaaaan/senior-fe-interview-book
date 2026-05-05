---
title: "REST APIs & Networking"
sidebar_label: "9. REST APIs & Networking"
description: "REST principles, pagination, versioning, idempotency, errors, OpenAPI, HTTP/TLS, WebSockets/SSE/WebRTC, GraphQL & tRPC."
sidebar_position: 8
---

Representational State Transfer and the protocols underneath it come up in every senior interview, even in nominally "frontend-only" loops. The expectation is that the candidate understands how the network actually behaves, what the Hypertext Transfer Protocol provides without additional engineering effort, and when each real-time protocol is the right choice for the problem at hand.

The chapters cover Representational State Transfer design as it should be practiced in 2026 — including the parts most tutorials skip such as idempotency keys, Request for Comments 7807 errors, and conditional requests — followed by the lower-level networking topics (Hypertext Transfer Protocol versions, Transport Layer Security, headers) and the real-time alternatives (WebSockets, Server-Sent Events, Web Real-Time Communication, GraphQL, typed Remote Procedure Call).

Each chapter includes a `## Common interview questions` section followed by an `## Answers` section with detailed, multi-paragraph answers a senior candidate would give in an interview, focusing on the operational hazards an experienced engineer would name.

## Chapters in this part

1. [REST principles](./01-rest-principles.md) — resources, methods, status codes, content negotiation, the common mistakes seniors are expected to call out.
2. [Pagination, filtering, sorting](./02-pagination-filtering.md) — offset vs cursor (keyset), structured filters, deterministic sorting, sparse fieldsets.
3. [Versioning & idempotency](./03-versioning-idempotency.md) — versioning strategies, idempotency keys, conditional requests, ETags.
4. [Error envelope (RFC 7807)](./04-errors.md) — `application/problem+json`, error codes, machine vs human messaging.
5. [OpenAPI / Swagger](./05-openapi.md) — schema-first contracts, code generation, keeping client and server aligned.
6. [HTTP/1.1 vs /2 vs /3 and TLS](./06-http-and-tls.md) — protocol differences, TLS 1.3, HSTS, when each protocol matters.
7. [Real-time: WebSockets, SSE, WebRTC](./07-realtime.md) — when each is appropriate and the server-side and client-side patterns for each.
8. [GraphQL & tRPC — quick contrast](./08-graphql-trpc.md) — when REST is not the right choice and what replaces it.
