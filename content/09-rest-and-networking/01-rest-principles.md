---
title: "REST principles"
sidebar_label: "9.1 REST principles"
description: "Resources, methods, status codes done right, and the parts of REST seniors are still asked to defend."
sidebar_position: 1
---

Representational State Transfer is an architectural style, not a formal standard, but senior interviews expect candidates to know its conventions and to defend the design choices that follow from them. This chapter covers the parts that consistently arise: resource modelling, Hypertext Transfer Protocol method semantics, and the correct application of status codes.

> **Acronyms used in this chapter.** API: Application Programming Interface. CORS: Cross-Origin Resource Sharing. CRUD: Create, Read, Update, Delete. CSV: Comma-Separated Values. FE: Frontend. HATEOAS: Hypermedia as the Engine of Application State. HTTP: Hypertext Transfer Protocol. JSON: JavaScript Object Notation. REST: Representational State Transfer. RFC: Request for Comments. URL: Uniform Resource Locator.

## Resources, not actions

Uniform Resource Locators name *things* (nouns) — the entities the application exposes — rather than actions (verbs). The action is selected by the Hypertext Transfer Protocol method, not by the path.

| ❌ | ✅ |
| --- | --- |
| `POST /createUser` | `POST /users` |
| `GET /getUserById?id=1` | `GET /users/1` |
| `POST /resetPassword` | `POST /users/me/password-reset` |
| `POST /sendMessage` | `POST /conversations/abc/messages` |

The "verbs" are the HTTP methods. "What kind of action" is determined by which method.

## Methods and their semantics

| Method | Safe? | Idempotent? | Body? | Use for |
| --- | --- | --- | --- | --- |
| `GET` | Yes | Yes | No | Read |
| `HEAD` | Yes | Yes | No | Same as GET, headers only |
| `POST` | No | No | Yes | Create, or non-idempotent action |
| `PUT` | No | Yes | Yes | Replace the entire resource |
| `PATCH` | No | No (often) | Yes | Partial update |
| `DELETE` | No | Yes | Optional | Remove |
| `OPTIONS` | Yes | Yes | No | CORS preflight, capability discovery |

A *safe* method does not modify server state — it can be called repeatedly without side effects. An *idempotent* method produces the same effect when called once or many times — the second call adds nothing beyond what the first did. The two properties are independent: `GET` is both safe and idempotent, `PUT` is unsafe but idempotent, `POST` is neither.

Four facts a senior candidate is expected to articulate. `PUT /resources/1` should *replace* the resource at identifier `1`, possibly creating it if it does not exist (the upsert semantic is part of the standard but not always implemented). `PATCH /resources/1` should *partially update* the resource, with the precise semantics defined by the team — JSON Merge Patch (Request for Comments 7396) is the most common convention. `POST /resources` is the canonical create operation; `POST /resources/1/action` is the canonical "do something to this resource" operation. `DELETE` is idempotent — calling delete twice on the same resource should not produce an error inherently, although the second call typically returns 404 because the resource is gone.

## Status codes done right

Memorize these eight; you'll use them 95% of the time.

| Code | When |
| --- | --- |
| **200** | OK, with body |
| **201** | Created, often with `Location` header pointing at the new resource |
| **204** | No Content — successful DELETE, or PATCH/PUT with empty response |
| **301 / 308** | Permanent redirect (308 preserves method/body) |
| **302 / 307** | Temporary redirect (307 preserves method/body) |
| **400** | Bad Request — malformed input, validation failure |
| **401** | Unauthorized — no/invalid auth credentials |
| **403** | Forbidden — authenticated but not allowed |
| **404** | Not Found |
| **409** | Conflict (concurrent edit, unique constraint) |
| **410** | Gone — used to exist, now removed permanently |
| **412** | Precondition Failed (`If-Match` mismatch) |
| **422** | Unprocessable Content — well-formed but semantically invalid |
| **429** | Too Many Requests (rate limited) |
| **500** | Internal Server Error |
| **502 / 503 / 504** | Upstream/dependency problems |

Two distinctions consistently arise in interviews. The 400 versus 422 distinction: 400 is the right code for "I cannot even understand the request" (malformed JavaScript Object Notation, missing required headers); 422 is the right code for "I understand the request but it is semantically invalid" (the title is too long, the email format is wrong, the referenced resource does not exist). Many Application Programming Interfaces collapse the two into 400 and that is defensible; the team should pick one approach and apply it consistently. The 401 versus 403 distinction: 401 means "you are not authenticated, please provide credentials"; 403 means "you are authenticated, but you are not allowed to do this". Returning 403 for a missing token is a common mistake that breaks client retry logic, because the client interprets 403 as "credentials will not help" and stops trying.

## Pagination

Two patterns dominate. *Offset/limit* pagination uses query parameters such as `?page=2&pageSize=20` or `?offset=40&limit=20`; the model is simple to implement, easy for clients to reason about, and the right choice for bounded admin tables. The model degrades for two reasons: at deep offsets, the database must skip every row up to the offset before returning results, so the cost grows with offset; and the model is unstable when items are inserted or removed during pagination because the offset shifts and the client either skips items or sees them twice. *Cursor-based* pagination uses a `?cursor=abc&limit=20` parameter where the cursor is an opaque token (typically a base64-encoded reference to the last item's sort key) and the server returns a `next_cursor` value that the client uses to fetch the next page. The model is stable across concurrent writes and efficient at any depth.

For senior frontend system-design interviews, the cursor-based approach is the framing senior candidates typically present for infinite feeds — Twitter timelines, Instagram feeds, Slack message history. Offset/limit works for admin tables and other small bounded lists where the depth never exceeds a few pages.

```h
ttpGET /tasks?cursor=eyJpZCI6IjEyMyJ9&limit=20

200 OK
{
  "items": [...],
  "next_cursor": "eyJpZCI6IjE0MyJ9"
}
```

We cover details in [Pagination & filtering](./02-pagination-filtering.md).

## Filtering, sorting, partial responses

Conventions for filtering, sorting, and partial responses vary across Application Programming Interfaces; the position a senior candidate typically presents is to be consistent within the team's Application Programming Interfaces, document the chosen conventions, and avoid over-engineering with elaborate query languages when simple parameters suffice.

Filtering uses query parameters that name the field and the desired value (`?status=open&assignee=me`). Sorting uses a single `sort` parameter with a leading minus sign indicating descending order (`?sort=-createdAt,title`). Partial responses, also known as sparse fieldsets, use a `fields` parameter listing the fields the client wants returned (`?fields=id,title`). Some teams adopt the JSON:API specification's conventions for these, which makes the Application Programming Interface easier to integrate with tooling that supports the specification. For most projects, the simpler ad-hoc conventions are sufficient.

## Hypermedia (HATEOAS)

Pure REST says responses link to next steps:

```json
{
  "id": 123,
  "title": "Write the chapter",
  "_links": {
    "self": { "href": "/tasks/123" },
    "complete": { "href": "/tasks/123/complete", "method": "POST" }
  }
}
```

In practice, almost no one ships Hypermedia as the Engine of Application State at the level Roy Fielding intended in his original Representational State Transfer dissertation. Senior interviews do not expect the candidate to defend full Hypermedia as the Engine of Application State; they expect the candidate to know what it is, why it is theoretically attractive, and why most teams skip it (the client tooling that would consume the hypermedia links never matured, and the cost of always sending the link metadata exceeded the benefit for most workloads).

## Content negotiation

The `Accept` header lets the client request a representation:

```h
ttpGET /tasks/123
Accept: application/json

GET /tasks/123
Accept: text/csv
```

Useful for "the same resource as JSON or CSV". Less useful for versioning (covered in [Versioning](./03-versioning-idempotency.md)).

For errors, return `application/problem+json` (RFC 7807). Detailed in [Errors](./04-errors.md).

## A canonical CRUD example

```h
ttpPOST /tasks
Content-Type: application/json

{ "title": "Write the chapter" }

-> 201 Created
  Location: /tasks/123
  { "id": "123", "title": "Write the chapter", "status": "open", ... }


GET /tasks?status=open&page=1&pageSize=20

-> 200 OK
  { "items": [...], "total": 42, "next_cursor": null }


GET /tasks/123

-> 200 OK
  { "id": "123", ... }


PATCH /tasks/123
Content-Type: application/json

{ "status": "done" }

-> 200 OK
  { "id": "123", "status": "done", ... }


DELETE /tasks/123

-> 204 No Content
```

That's the shape. The Tasks API in [Part 8 (Node.js Backend)](../08-nodejs-backend/index.md) implements exactly this.

## Common mistakes

A handful of antipatterns appear repeatedly. `POST /getUsers` puts a verb in the Uniform Resource Locator and signals that the team's understanding of Representational State Transfer is shallow. `200 OK` with `{ "error": "..." }` in the body uses the wrong status code and breaks every client library that relies on status codes to detect failure. `204 No Content` with a body in the response violates the definition of 204 (no body is permitted). `200 OK` for a failed validation is an inversion of the protocol — the request was bad, so the right response is 400. `PUT` that updates only the fields sent in the body uses the wrong method semantic — that operation is `PATCH`, not `PUT`. `DELETE` that returns 404 on the second call is debatable: many teams return 404 (consistent with "the resource does not exist now"), many return 204 (consistent with the idempotency guarantee). The team should pick one approach and document it.

## Key takeaways

Uniform Resource Locators are nouns; Hypertext Transfer Protocol methods are verbs. Memorise the eight or so status codes that account for the vast majority of real responses (200, 201, 204, 400, 401, 403, 404, 500). Cursor-based pagination for infinite feeds; offset/limit pagination for bounded admin tables. 401 means not authenticated; 403 means authenticated but not allowed; do not conflate them. Return errors in `application/problem+json` so consumers can parse them uniformly. Be consistent in conventions, document them, and do not over-engineer with Hypermedia as the Engine of Application State unless the contract specifically requires it.

## Common interview questions

1. Difference between PUT and PATCH?
2. 401 versus 403 — when each?
3. When would you choose cursor pagination over offset?
4. What does "idempotent" mean and why does it matter for retry behaviour?
5. Why is `200 OK { "error": "..." }` an anti-pattern?

## Answers

### 1. Difference between PUT and PATCH?

`PUT` replaces the entire resource at the target Uniform Resource Locator with the body of the request; if the resource exists, it is replaced; if not, it is created (the upsert semantic is part of the standard). `PATCH` partially updates the resource, with the precise semantics defined by the team — the most common conventions are JSON Merge Patch (Request for Comments 7396, where the request body is a partial JavaScript Object Notation object whose fields override the corresponding fields on the resource) and JSON Patch (Request for Comments 6902, where the request body is a sequence of operations). `PUT` is idempotent because the target state after the request is fully determined by the request body; `PATCH` is generally idempotent for JSON Merge Patch but not always for JSON Patch (an "add to array" operation is not idempotent because each call appends another element).

**How it works.** A `PUT /users/123` with body `{ "name": "Ada", "email": "ada@example.com" }` produces a resource with exactly those two fields and any other fields previously present are gone. A `PATCH /users/123` with body `{ "name": "Ada" }` updates only the name and leaves the email and other fields untouched. The choice between them depends on what the client wants to express: "I have the full new state" (PUT) versus "I want to change these specific fields" (PATCH).

```h
ttpPUT /users/123
Content-Type: application/json

{ "name": "Ada", "email": "ada@example.com", "role": "admin" }
```

```h
ttpPATCH /users/123
Content-Type: application/merge-patch+json

{ "role": "admin" }
```

**Trade-offs / when this fails.** The pattern fails when teams use `PUT` with semantics that match `PATCH` (sending only a subset of fields and expecting the server to merge); this is a violation of the standard and breaks any client library that assumes `PUT` replaces. The cure is to use `PATCH` for partial updates and to document the patch semantics (Merge Patch versus JSON Patch) in the Application Programming Interface specification. The pattern also fails when teams use `PATCH` for operations that have side effects beyond the resource (a patch that changes a `status` field that triggers a workflow); the cure is to consider whether a `POST /resources/123/action` call would be a clearer expression of the intent.

### 2. 401 versus 403 — when each?

401 means "you are not authenticated, please provide credentials" and is the right status code when no authentication has been provided or the provided authentication is invalid (an expired token, a malformed signature, an unknown user). 403 means "you are authenticated, but you are not allowed to perform this operation" and is the right status code when the request is authenticated but the authenticated principal lacks the permission to perform the operation (a regular user trying to access an admin endpoint, a tenant trying to read another tenant's data).

**How it works.** The distinction matters operationally because the appropriate client behaviour differs. A 401 response should trigger the client's authentication flow — refresh the token, redirect to the login page, prompt for credentials. A 403 response should not trigger the authentication flow because authenticating again will not help; the client should display an error indicating insufficient permissions. Conflating the two breaks the client's behaviour: a 403 returned when the token is missing causes the client to display "permission denied" instead of redirecting to login; a 401 returned when the user lacks permission causes the client to enter an infinite loop of re-authentication.

```ts
function handleResponse(response: Response) {
  if (response.status === 401) {
    return refreshTokenAndRetry();
  }
  if (response.status === 403) {
    return showPermissionDeniedError();
  }
  return response.json();
}
```

**Trade-offs / when this fails.** The pattern fails when teams security-paint by using 404 for resources the user is not allowed to see; this is a defensible choice because it does not reveal the existence of the resource to unauthorised users, but it must be applied consistently and documented because clients cannot distinguish "resource does not exist" from "you are not allowed to know it exists". The pattern also fails when teams use 401 with no `WWW-Authenticate` header; the standard requires the header, and its absence breaks some Hypertext Transfer Protocol clients that look for it before initiating the authentication flow.

### 3. When would you choose cursor pagination over offset?

Choose cursor pagination when the data is large enough that deep offsets become slow, when the data is mutated frequently enough that offset-based navigation produces inconsistent results (items skipped or seen twice), and when the access pattern is sequential ("next page", "previous page") rather than random ("page 137 of 245"). Almost every infinite-feed user experience falls into all three categories — Twitter timelines, Slack message history, log readers, search results — so cursor pagination is the right default for those use cases.

**How it works.** A cursor encodes the position of the last item the client received (typically a base64-encoded reference to the item's sort key, sometimes including a tiebreaker for non-unique sort keys). The server uses the cursor as a starting point for the database query (`WHERE created_at < ? ORDER BY created_at DESC LIMIT 20`), which is efficient regardless of how deep into the data the cursor points. The server returns the items and a `next_cursor` value the client uses for the subsequent request.

```ts
function buildCursor(item: { id: string; createdAt: string }): string {
  return Buffer.from(JSON.stringify({
    id: item.id,
    createdAt: item.createdAt,
  })).toString("base64url");
}

function parseCursor(cursor: string): { id: string; createdAt: string } {
  return JSON.parse(Buffer.from(cursor, "base64url").toString());
}
```

**Trade-offs / when this fails.** Cursor pagination cannot easily express "go to page N" because each cursor encodes only the next position; the client must walk forward through all intermediate cursors. The cure for use cases that need arbitrary access is to fall back to offset pagination for those queries. Cursor pagination also requires a stable sort order; if the sort key changes (the item is updated), the cursor may point at a position that has moved, and the client may see duplicates or skipped items. The cure is to pick sort keys that do not change frequently (creation timestamp plus identifier as tiebreaker is a common choice) and to document the consistency guarantees the Application Programming Interface provides.

### 4. What does "idempotent" mean and why does it matter for retry behaviour?

A method is idempotent when calling it once has the same effect as calling it many times — the second and subsequent calls add nothing beyond what the first did. `GET`, `PUT`, and `DELETE` are idempotent by the Hypertext Transfer Protocol specification; `POST` and `PATCH` are not (in general). Idempotency matters for retry behaviour because it tells the client whether retrying a failed request is safe: an idempotent method can be retried without risk, while a non-idempotent method risks a duplicate operation if the original request succeeded but the response was lost.

**How it works.** A retry policy uses the method's idempotency to decide whether to retry on transient failures. For idempotent methods, the client retries with exponential backoff until the response succeeds or the retry budget is exhausted. For non-idempotent methods, the client either does not retry, or uses an idempotency key (a unique client-generated identifier sent in a header) that the server uses to detect and ignore duplicates.

```ts
async function postWithIdempotency(url: string, body: unknown) {
  const idempotencyKey = crypto.randomUUID();
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}
```

**Trade-offs / when this fails.** The pattern fails when teams claim idempotency for methods that are not actually idempotent in their implementation; a `PUT` that triggers a side effect (sending an email, billing the user) on each call is not idempotent regardless of what the standard says, and retrying it produces incorrect behaviour. The cure is to design the implementation to match the standard's expectation (compute the new state and apply it without side effects, then trigger the side effect only when the state actually changed). The pattern also fails when teams send `POST` requests without idempotency keys; the cure is the idempotency-key pattern from the next chapter on versioning and idempotency.

### 5. Why is `200 OK { "error": "..." }` an anti-pattern?

Returning `200 OK` with an error in the body is an anti-pattern because it inverts the protocol: every Hypertext Transfer Protocol client library treats 200 as success and routes the response to the success handler, but the response is actually a failure. The application code must inspect the body to discover that the request failed, which requires custom error-handling logic that bypasses the framework's standard error path. Worse, every middleware in the request chain (load balancers, monitoring tools, retry logic) treats the response as successful when it is not — error rates appear artificially low, retry logic does not engage, alerts do not fire on real failures.

**How it works.** Hypertext Transfer Protocol status codes communicate the outcome of the request to the entire chain of intermediaries — the client, the proxy, the monitoring tool, the alerting system. Using a non-2xx status code for a failure (4xx for client errors, 5xx for server errors) ensures every layer agrees on the outcome and behaves accordingly. The body then carries the error details for the client's user-facing handling, in `application/problem+json` format per Request for Comments 7807.

```h
ttpHTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://errors.example.com/validation",
  "title": "Validation failed",
  "status": 422,
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

**Trade-offs / when this fails.** Some legacy Application Programming Interfaces use `200 OK` with a body-based error indicator because the team's framework or transport (a JSONP endpoint, for example) cannot reliably distinguish status codes; the cure is to migrate to a transport that supports status codes and to deprecate the legacy convention. Some teams adopt the anti-pattern because their initial framework choice made non-200 responses awkward; the cure is to fix the framework integration rather than to perpetuate the inverted protocol.

## Further reading

- Roy Fielding's [REST dissertation](https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm).
- [HTTP Semantics RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
- [JSON:API specification](https://jsonapi.org/) for one consistent take.
