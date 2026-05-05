---
title: "Error envelope (RFC 7807)"
sidebar_label: "9.4 Error envelope (RFC 7807)"
description: "problem+json: a single error shape that scales across services."
sidebar_position: 4
---

Choose a single error shape once and use it everywhere. The standard answer is Request for Comments 7807, the `application/problem+json` media type, now superseded by Request for Comments 9457 with the same wire format.

> **Acronyms used in this chapter.** API: Application Programming Interface. DB: Database. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. PII: Personally Identifiable Information. RFC: Request for Comments. UI: User Interface. URI: Uniform Resource Identifier.

## The shape

```h
ttpHTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://example.com/errors/validation",
  "title": "Invalid input",
  "status": 422,
  "detail": "The 'title' field must be 1-200 characters.",
  "instance": "/tasks",
  "errors": {
    "title": ["String must contain at most 200 character(s)"]
  }
}
```

The required fields are three. `type` is a Uniform Resource Identifier identifying the error class; the value `about:blank` is acceptable when no documentation Uniform Resource Locator is available. `title` is a short human-readable summary that is identical across instances of the same error class. `status` is the Hypertext Transfer Protocol status code, repeated in the body so log analysis tools that only have the body still see it.

Optional but practically essential fields include `detail`, a more specific human-readable description for this particular occurrence (for example, "the `title` field must be at most 200 characters" rather than the generic `title` of "Invalid input"); `instance`, a Uniform Resource Identifier for the specific occurrence (often a request identifier); and any custom fields the team's clients need — `errors` for per-field validation lists, `traceId` for distributed-tracing correlation, `code` for a stable application-level error code.

## Why a standard shape

A single shape provides three concrete benefits. Clients can parse errors uniformly because there is no per-endpoint schema to learn. Tooling integrates: OpenAPI generators, error trackers such as Sentry, and observability platforms such as Datadog all recognise `application/problem+json` and surface its fields automatically. Documentation is consistent because every endpoint's error section in the API reference uses the same template.

## A senior production shape

Add what is needed for operations; do not leak what should remain internal. The shape supports a `traceId` for correlating client error reports to backend logs and traces, and the constructor for the shape never leaks raw error messages from unknown sources.

```ts
type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
};
```

```ts
function toProblem(err: unknown, traceId?: string): Problem {
  if (err instanceof ZodError) {
    return {
      type: "https://example.com/errors/validation",
      title: "Validation failed",
      status: 400,
      errors: err.flatten().fieldErrors,
      traceId,
    };
  }
  if (err instanceof HttpError) {
    return { type: "about:blank", title: err.message, status: err.status, traceId };
  }
  // Unknown — never leak the message in production.
  return { type: "about:blank", title: "Internal server error", status: 500, traceId };
}
```

## Status codes by error class

| Class | Status | `type` URI |
| --- | --- | --- |
| Malformed JSON | 400 | `https://example.com/errors/malformed-json` |
| Validation | 400 (or 422) | `.../errors/validation` |
| Auth missing | 401 | `.../errors/unauthorized` |
| Permission | 403 | `.../errors/forbidden` |
| Not found | 404 | `.../errors/not-found` |
| Conflict | 409 | `.../errors/conflict` |
| Idempotency conflict | 422 | `.../errors/idempotency-conflict` |
| Rate limit | 429 | `.../errors/rate-limit` |
| Internal | 500 | `about:blank` |
| Upstream | 502/503/504 | `.../errors/upstream` |

A canonical error catalog page (`/docs/errors`) that lists every `type` Uniform Resource Identifier with the conditions that produce it is a valuable senior touch; it gives clients a stable target to link to and a single place to update when the contract evolves.

## What NOT to put in errors

Stack traces should never appear in production responses; they belong in the error tracker, not in the response body where any client can read them. Database error messages must not be returned verbatim because they leak schema details and sometimes data values that aid attacker reconnaissance. Personally Identifiable Information — email addresses, user identifiers, file paths, internal hostnames — must not appear in error bodies. The full request body, even in "I parsed it as X but you sent Y" cases, may contain secrets or Personally Identifiable Information; echo only the offending field name and the validation rule that failed.

## The `Retry-After` header

For status codes `429 Too Many Requests` (rate limit) and `503 Service Unavailable`, the server should send `Retry-After` advising the client when to retry. The header value can be a number of seconds or a HTTP date.

```h
ttpHTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/problem+json

{ "title": "Rate limit exceeded", "status": 429 }
```

Clients and well-behaved retry libraries honour `Retry-After` automatically; always send it for `429` and `503` so that exponential backoff in the client is anchored to a server-supplied hint rather than a guess.

```ts
// Client-side honouring of Retry-After.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 && response.status < 500) return response;
    const wait = Number(response.headers.get("retry-after") ?? 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  throw new Error("Retries exhausted");
}
```

## Aggregating validation errors

For form submissions, return all validation errors at once rather than only the first. The user fills the form once and expects to see every problem in a single pass; returning errors one at a time produces a frustrating "fix one, retry, fix the next" loop.

```json
{
  "type": "https://example.com/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "email": ["Must be a valid email"],
    "password": ["At least 8 characters", "Must include a number"]
  }
}
```

The frontend iterates over `errors` and displays each entry next to the matching form field, with the array's elements joined by a separator if multiple rules failed for the same field.

## Versioning errors

The error shape is part of the Application Programming Interface contract; do not change `type` Uniform Resource Identifiers casually because clients may switch on them programmatically. If a new error category is needed, add a new `type` Uniform Resource Identifier rather than overloading an existing one with new meaning.

## Localization

Errors should be both machine-readable through the `type` Uniform Resource Identifier and localizable for end-user display. Two patterns are common. In the first, the server localizes `title` and `detail` based on the request's `Accept-Language` header. In the second, the server returns a stable `code` or `type` Uniform Resource Identifier and the client localizes from a translation table that ships with the User Interface.

For external Application Programming Interfaces consumed by third-party developers, prefer the second pattern — the consumer owns the User Interface language and can produce error messages that match the look and feel of the surrounding application.

## Key takeaways

The senior framing for errors is to adopt `application/problem+json` (Request for Comments 7807, updated by 9457) for every error response, populate the three required fields (`type`, `title`, `status`) plus the practically essential `detail`, `instance`, `errors`, and `traceId`, and maintain an error catalog at a stable Uniform Resource Locator that consumers can link to. Aggregate validation errors so the user sees every problem in one pass. Always send `Retry-After` for `429` and `503`. Never leak stack traces, raw database errors, or Personally Identifiable Information.

## Common interview questions

1. What is Request for Comments 7807 and why is it the standard error shape?
2. The difference between `type` and `title`?
3. How can leaking secrets in error responses be avoided?
4. Walk through how a client should retry on a `429`.
5. Should error messages be localized? By whom?

## Answers

### 1. What is RFC 7807 and why is it the standard error shape?

Request for Comments 7807 (now updated by 9457) defines `application/problem+json`, a small standard schema for Hypertext Transfer Protocol error responses. Required fields are `type` (a Uniform Resource Identifier identifying the error class), `title` (a short human-readable summary), and `status` (the Hypertext Transfer Protocol status code repeated in the body). Optional fields include `detail` (specific to the instance), `instance` (a Uniform Resource Identifier for this occurrence), and arbitrary extensions for application-specific data. It is the standard because it solves a real coordination problem: every team would otherwise invent a different error shape, and clients would need per-endpoint deserialisation logic.

**Trade-offs / when this fails.** The schema is intentionally minimal; teams must agree on extensions (`errors`, `traceId`, `code`) for it to be useful in practice. The `type` Uniform Resource Identifier is opaque by design, which is great for stability but bad for discoverability — pair it with a published error catalog so clients have something to link to. Some Application Programming Interface gateways and frameworks set `Content-Type: application/json` regardless of the body shape; ensure the response actually emits `application/problem+json` so clients can content-type-sniff.

### 2. The difference between `type` and `title`?

`type` is the machine-readable identity of the error class — a stable Uniform Resource Identifier that clients can switch on (`if (problem.type === "https://example.com/errors/validation") { ... }`). `title` is the human-readable summary, identical across all instances of the same `type` ("Validation failed", "Rate limit exceeded"). The pair gives clients both a stable handle for code paths and a default string to display when no localized message is available.

**Trade-offs / when this fails.** Teams that use `title` as the switch target lock themselves into the English label and break when localization is added. Teams that use the Hypertext Transfer Protocol status code as the switch target conflate distinct error classes — `400` is "validation failed", "malformed JSON", and "missing required header" all at once. The `type` field is the right discriminator; treat it as part of the contract and version it carefully.

### 3. How can leaking secrets in error responses be avoided?

The defence is to never return the raw error from an unknown source; classify errors first, then construct the problem document from the classification. For known errors (`HttpError`, `ZodError`, `ValidationError`), the error already declares its public surface — `message`, `field errors`, `status` — and is safe to serialise. For unknown errors, the response is always the generic `Internal server error` with status 500, with the actual error sent to the error tracker (Sentry, Datadog) via a `traceId` that links the public response to the private record.

```ts
function toProblem(err: unknown, traceId: string): Problem {
  if (err instanceof HttpError) return { type: err.type, title: err.message, status: err.status, traceId };
  if (err instanceof ZodError) return { type: "/errors/validation", title: "Validation failed", status: 400, errors: err.flatten().fieldErrors, traceId };
  console.error("Unhandled error", { err, traceId });
  return { type: "about:blank", title: "Internal server error", status: 500, traceId };
}
```

**Trade-offs / when this fails.** Frameworks with default error handlers often serialise the error message verbatim — Express's default is exactly this. Override the default and route every error through the classifier. Database errors are a particular hazard because the message often contains the offending value; PostgreSQL's `duplicate key value violates unique constraint "users_email_key" Key (email)=(alice@example.com)` is a privacy leak. Catch these and translate to a generic conflict response.

### 4. Walk through how a client should retry on a 429.

The client should honour `Retry-After`, which the server sends with `429` to indicate the recommended wait. Parse the header (a number of seconds or a Hypertext Transfer Protocol date), wait that duration, and retry the same request — including the same idempotency key if one was sent. Apply the same logic to `503 Service Unavailable`. For repeated `429` responses, switch to exponential backoff with jitter to avoid thundering-herd retries that all hit the rate limit again at the same instant.

```ts
const wait = Number(response.headers.get("retry-after") ?? 1) * 1000;
const jitter = Math.random() * 250;
await new Promise((resolve) => setTimeout(resolve, wait + jitter));
```

**Trade-offs / when this fails.** Retries must be bounded — three to five attempts is typical — to avoid wedging the client when the server is genuinely down. Retries must be reserved for safe operations: `GET`, `PUT`, `DELETE` are idempotent; `POST` is only safe to retry when the server supports idempotency keys. Retries should be cancellable via `AbortController` so the user can navigate away without leaving requests in flight. And the user should see a "retrying..." indicator, otherwise long backoff durations look like the application is frozen.

### 5. Should error messages be localized? By whom?

Errors must be machine-readable through the `type` Uniform Resource Identifier or a stable `code` field, and they should be localizable for end-user display. For first-party Application Programming Interfaces — the team owns both the server and the User Interface — the server can localize `title` and `detail` based on `Accept-Language`. For third-party Application Programming Interfaces, the consumer should localize from a translation table keyed by the `type` Uniform Resource Identifier or `code` field, because the consumer owns the User Interface language and can produce messages that match the surrounding application.

**Trade-offs / when this fails.** Server-side localization couples the Application Programming Interface to the user's locale and forces every consumer to send `Accept-Language` correctly. Client-side localization requires clients to keep a translation table in sync with the server's error catalog. The hybrid pattern — return both the localized `title` for default display and a stable `code` for client-side override — is the safest option for public Application Programming Interfaces and is what Stripe, GitHub, and similar exemplars adopt.

## Further reading

- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) (the updated 7807).
- Stripe and GitHub's API error documentation as exemplars.
