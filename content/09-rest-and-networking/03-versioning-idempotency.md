---
title: "Versioning & idempotency"
sidebar_label: "9.3 Versioning & idempotency"
description: "URL vs. header versioning, idempotency keys, ETag and conditional requests."
sidebar_position: 3
---

Two topics that interviews often combine because both are concerned with safety under change and retry. Versioning addresses how the Application Programming Interface evolves without breaking the consumers that depend on its current contract; idempotency addresses how the consumers can safely retry a failed request without producing duplicate effects.

> **Acronyms used in this chapter.** API: Application Programming Interface. CDN: Content Delivery Network. ETag: Entity Tag. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. RFC: Request for Comments. TTL: Time-to-Live. URL: Uniform Resource Locator. UUID: Universally Unique Identifier.

## API versioning

A common interview question: "how do you version an Application Programming Interface without breaking clients?". The honest answer is to avoid versioning if possible by adopting an additive-only contract, and to version at the Uniform Resource Locator path when versioning is unavoidable.

### Strategy 1: avoid breaking changes

Most version needs are really "I want to add a field"; additive changes do not require a version bump. The team's contract for compatibility classifies each kind of change. Adding optional fields to responses or accepting new optional fields in requests is safe — clients that do not know the new field ignore it. Adding endpoints is safe — existing clients are unaffected. Removing fields is breaking — clients that read the removed field will fail; the safe path is to deprecate the field first, give consumers time to migrate, and remove it later. Renaming fields is breaking — the safe path is to add the new field, keep the old field with the same value, deprecate the old field, and remove it after the deprecation window. Changing the type or the semantics of an existing field is always breaking and should be avoided in favour of adding a new field with the new type or semantics.

If the team rigorously follows the additive-only discipline, the Application Programming Interface may never need a version-2.

### Strategy 2: URL versioning

URL versioning encodes the version in the path (`/v1/users`, `/v2/users`). The benefits are operational: the version is easy to reason about, easy to cache (a Content Delivery Network keys cache entries by Uniform Resource Locator), and easy to route at the Application Programming Interface gateway. The cost is that every Uniform Resource Locator carries the version stamp and multiple versions of every endpoint must coexist for as long as the team supports the older version.

### Strategy 3: header versioning

Header versioning passes the desired version in an `Accept` header (`Accept: application/vnd.example.v2+json`). The benefit is that Uniform Resource Locators are version-independent — `/users` is canonical regardless of which version the client requests. The cost is that the version is harder to discover (browser address bars and curl invocations default to no `Accept` header), harder to cache (the cache must vary by `Accept`), and harder to route at the gateway.

### Strategy 4: date-based or sunset

GitHub's pattern uses a date-based version header (`X-Api-Version: 2024-08-15`); each "version" is a release date and the contract for that date is preserved indefinitely. The benefit is fine-grained version selection without the proliferation of integer versions; the cost is the operational burden of supporting many version contracts simultaneously.

For most teams, URL versioning is the right pragmatic choice when versioning is unavoidable, paired with a clear sunset policy and deprecation headers (`Deprecation` and `Sunset` per Request for Comments 8594) that communicate the timeline to consumers programmatically.

## Idempotency keys

The senior-level topic that arises in payment processing, e-commerce checkout, and any operation where "this must not happen twice" is the requirement.

### The problem

A client sends `POST /payments` with a $10 amount. The Hypertext Transfer Protocol request times out before the response arrives — but the server has actually processed the payment and the failure is in the response path, not the request path. The client retries with the same body; the server processes the payment again; the user has been charged twice.

### The solution

The client generates an idempotency key (a Universally Unique Identifier) and sends it in a `Idempotency-Key` header:

```h
ttpPOST /payments
Idempotency-Key: 4f2d11ee-9b12-4a4f-8a1d-6e8f12345678
Content-Type: application/json

{ "amount": 10, "currency": "USD" }
```

The server's responsibilities are precise. First, it looks up the idempotency key in durable storage. If the key is present, the server returns the same response as the first time — the same status code and the same body — without re-executing the operation. If the key is absent, the server processes the request, records the response keyed by the idempotency key, and returns the response to the client.

The key has a Time-to-Live; twenty-four hours is a common choice. Two requests with the same key but different bodies should return `422 Unprocessable Entity`: clients should not mutate the body across retries with the same key, and the divergence indicates a programming error worth surfacing.

```ts
async function withIdempotency<T>(
  key: string | undefined,
  body: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  if (!key) return fn();

  const stored = await idempotencyStore.get(key);
  if (stored) {
    if (!equal(stored.bodyHash, hash(body))) {
      throw new HttpError(422, "Idempotency key reused with different body");
    }
    return stored.response as T;
  }

  const result = await fn();
  await idempotencyStore.set(key, { bodyHash: hash(body), response: result }, { ttl: 24 * 3600 });
  return result;
}
```

This is exactly the pattern Stripe documents and that any payment platform should adopt.

### When to require idempotency keys

The keys are mandatory for `POST` endpoints that create or charge — payments, orders, message sends, anything where double-processing has business consequences. They are recommended for server-to-server Application Programming Interfaces in general, where retries are common and the cost of a duplicate is non-trivial. They are not necessary for `DELETE` and `PUT`, which are already idempotent by Hypertext Transfer Protocol semantics — repeated calls produce the same end state.

## ETag and conditional requests

The Entity Tag (`ETag`) header lets clients re-validate a cached response cheaply. The server includes an opaque token (often a hash of the response body or a version counter) in the response; the client stores the token alongside the cached body; on subsequent requests the client sends the token in `If-None-Match`; the server compares and responds with `304 Not Modified` and an empty body if the cache is still current.

```h
ttpGET /tasks/123

-> 200 OK
  ETag: "v3-7c3d"
  { ... }


GET /tasks/123
If-None-Match: "v3-7c3d"

-> 304 Not Modified
  (no body)
```

The savings are bandwidth on the wire and parsing time at the client; browsers perform this revalidation automatically for cacheable responses. Application Programming Interfaces benefit when their consumers actually use the headers.

### `If-Match` for optimistic concurrency

The same Entity Tag is also used to prevent lost-update races on writes. The client reads, receives the Entity Tag, and includes it in `If-Match` when writing back. If the resource has changed in the interim, the server returns `412 Precondition Failed` instead of overwriting.

```h
ttpPATCH /tasks/123
If-Match: "v3-7c3d"
Content-Type: application/json

{ "status": "done" }

-> 412 Precondition Failed
  (someone else updated since you fetched)
```

If two users edit the same task and try to save, only the first save wins; the second receives `412` and can refetch, merge the changes, and retry. Most production Application Programming Interfaces that allow concurrent edits use this pattern; the alternative is silent data loss when the second save overwrites the first.

## `Cache-Control` and `Vary`

The `Cache-Control` header is the canonical way to instruct intermediaries — the browser cache and any Content Delivery Network in the request path — how to cache a response.

```h
ttpCache-Control: public, max-age=3600, stale-while-revalidate=86400
```

| Directive | Effect |
| --- | --- |
| `public` | Any cache may store |
| `private` | Only the user's browser may store |
| `no-store` | Don't cache at all (sensitive responses) |
| `no-cache` | Cache, but revalidate before serving |
| `max-age=3600` | Fresh for 3600 seconds |
| `s-maxage=3600` | Same, for shared caches (CDN) only |
| `stale-while-revalidate=86400` | Serve stale for up to 86400s while refreshing in background |
| `must-revalidate` | Don't serve stale; revalidate when expired |

The `Vary` header (`Vary: Accept, Accept-Encoding, Authorization`) tells caches that the response varies based on the named request headers — cache entries are keyed separately per distinct value of each. For private user-specific responses, the canonical headers are `Cache-Control: private, no-cache` together with `Vary: Authorization`, which prevents Content Delivery Networks from serving one user's data to another.

## When to NOT cache

Anything authenticated and user-specific without `Cache-Control: private` is a candidate for accidental cross-user disclosure. Any response that includes secrets in headers (for example, the `Set-Cookie` of a session) should set `Cache-Control: no-store`. Any response that is expensive to invalidate — analytics roll-ups, search indexes, anything with a long write path — should be cached only with explicit invalidation strategy in place.

## Key takeaways

The senior framing for versioning is to avoid breaking changes through additive-only discipline; when versioning is unavoidable, URL-versioning paired with a clear sunset plan and `Deprecation`/`Sunset` headers is the pragmatic choice. Idempotency keys prevent double-processing on retry and are mandatory for `POST` endpoints that create or charge. The `ETag` header with `If-None-Match` enables cheap revalidation; the same header with `If-Match` enables optimistic concurrency control on writes. Use `Cache-Control` precisely, mark authenticated responses `private`, and add `Vary` whenever the response varies by a request header.

## Common interview questions

1. URL versus header Application Programming Interface versioning — when each?
2. Walk through how to implement idempotency keys server-side.
3. The difference between `If-None-Match` and `If-Match`?
4. What does `stale-while-revalidate` provide that `max-age` alone does not?
5. A user submits the same form twice within one hundred milliseconds because of a flaky network. How can the duplicate be prevented?

## Answers

### 1. URL versus header API versioning — when each?

URL versioning encodes the version in the path (`/v1/users`); header versioning encodes it in `Accept` or a custom header. URL versioning is the right default for public Application Programming Interfaces because it is operationally simple — easy to discover by reading a Uniform Resource Locator, easy to cache (cache keys include the path), easy to route at the gateway, and easy to debug from a browser address bar or curl invocation. Header versioning is appropriate for internal Application Programming Interfaces where consumers always set `Accept` programmatically and where keeping the Uniform Resource Locator clean is valued more than discoverability.

**Trade-offs / when this fails.** URL versioning forces multiple versions to coexist for as long as any consumer depends on the older version, which is a real operational burden — duplicate routes, duplicate handlers, duplicate test surface. Header versioning is harder to debug because the request URL alone does not capture the contract; tooling and Content Delivery Networks must vary cache entries by the version header. The best long-term answer is rarely either: pursue additive-only changes and avoid versioning entirely.

### 2. Walk through how to implement idempotency keys server-side.

The client generates a Universally Unique Identifier and sends it in `Idempotency-Key`. The server stores `(key → { request_hash, response, status, expires_at })` in a durable store such as Redis or PostgreSQL. On each `POST`, the server first looks up the key. If absent, it processes the request, stores the response under the key with a Time-to-Live (twenty-four hours is typical), and returns. If present and the request hash matches the stored hash, the server returns the cached response without re-executing. If present and the hash differs, the server returns `422 Unprocessable Entity` because the client has reused the key with a different body — a programming error.

```ts
async function withIdempotency<T>(key: string, body: unknown, fn: () => Promise<T>) {
  const stored = await store.get(key);
  if (stored) {
    if (stored.bodyHash !== hash(body)) throw new HttpError(422, "Idempotency key reused");
    return stored.response as T;
  }
  const result = await fn();
  await store.set(key, { bodyHash: hash(body), response: result }, { ttl: 86400 });
  return result;
}
```

**Trade-offs / when this fails.** The store must be transactional with the operation, otherwise a crash between executing the operation and writing the key produces a duplicate on retry. The standard fix is to write the key as part of the same database transaction as the operation, or to use an "in-progress" sentinel so concurrent retries with the same key serialize on the lookup. Time-to-Live must outlive the longest reasonable client retry window.

### 3. The difference between `If-None-Match` and `If-Match`?

Both headers carry an Entity Tag, but they are used in opposite directions. `If-None-Match` is a read-side optimisation: the client says "return the resource only if its current Entity Tag is none of these"; the server responds with `304 Not Modified` and an empty body when the cache is current, saving bandwidth. `If-Match` is a write-side concurrency control: the client says "execute this write only if the current Entity Tag matches"; the server responds with `412 Precondition Failed` when the resource has changed in the interim, preventing the write from clobbering a concurrent update.

**Trade-offs / when this fails.** Both depend on the server actually generating stable Entity Tags for the resource. Weak tags (prefixed `W/`) match by semantic equivalence; strong tags must match byte-for-byte; mixing the two confuses caches. For optimistic concurrency, the client must surface the `412` to the user with a sensible "your changes conflict with another edit; refresh and reapply" path, otherwise the user loses work and blames the application.

### 4. What does `stale-while-revalidate` provide that `max-age` alone does not?

`max-age=N` lets caches serve a response without contacting the origin for N seconds. After N seconds the response is stale and the next request blocks on a fresh fetch from the origin. `stale-while-revalidate=M` adds a window after the freshness window during which the cache may serve the stale response immediately and refresh in the background. The user always receives a fast response; the next user receives the refreshed response. The pattern is ideal for content that is expensive to fetch but tolerant of being a few seconds stale — search results, recommendation feeds, dashboards.

```h
ttpCache-Control: public, max-age=60, stale-while-revalidate=600
```

**Trade-offs / when this fails.** The pattern hides freshness lag behind the cache, which can be surprising during incidents — a stale value can persist for `max-age + stale-while-revalidate` seconds even after the origin recovers. The pattern requires a cache that supports `stale-while-revalidate` (Vercel, Cloudflare, and modern browsers do; older caches ignore it and fall back to `max-age`). For data that must be exact (account balances, inventory counts at checkout), use `must-revalidate` instead.

### 5. Preventing a duplicate form submission on a flaky network.

The defence is layered. On the client, disable the submit button immediately on first click and show a pending state — this prevents the double-click case. Generate an idempotency key in the client when the form mounts (a Universally Unique Identifier) and include it in the `POST`. On the server, validate the idempotency key: if the same key arrives twice, return the cached response from the first execution rather than processing again. If the operation creates a row with a natural unique constraint (an order number, a payment reference), enforce that constraint at the database level so even a missing idempotency key cannot produce two rows.

```ts
const idempotencyKey = useRef(crypto.randomUUID()).current;
await fetch("/orders", {
  method: "POST",
  headers: { "Idempotency-Key": idempotencyKey, "Content-Type": "application/json" },
  body: JSON.stringify(order),
});
```

**Trade-offs / when this fails.** Client-side button disabling alone is insufficient because the user may refresh the page or the network may retry transparently. Idempotency keys alone are insufficient if the server stores them outside the transaction boundary. Database constraints alone produce ugly error messages and surface failure to the user. The combined defence is cheap and worth it for any operation with business consequences.

## Further reading

- [Stripe's idempotency documentation](https://stripe.com/docs/api/idempotent_requests).
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html).
- [RFC 8594 — Sunset header](https://www.rfc-editor.org/rfc/rfc8594.html).
