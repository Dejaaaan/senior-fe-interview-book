---
title: "HttpClient & interceptors"
sidebar_label: "5.6 HttpClient & interceptors"
description: "The Angular HTTP client, interceptors, and modern error / cancellation patterns."
sidebar_position: 6
---

`HttpClient` is Angular's HyperText Transfer Protocol layer. It is strongly typed (every method has a generic for the response shape), Observable-based (returns cancellable cold Observables), and supports an interceptor pipeline that lets the application apply cross-cutting concerns — authentication tokens, retries, tracing, logging — without scattering the logic across every call site.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. DI: Dependency Injection. HTTP: HyperText Transfer Protocol. JSON: JavaScript Object Notation. MSW: Mock Service Worker. SSE: Server-Sent Events. SSR: Server-Side Rendering. URL: Uniform Resource Locator. UUID: Universally Unique Identifier. XHR: XMLHttpRequest.

## Setup

```ts
import { provideHttpClient, withFetch, withInterceptors } from "@angular/common/http";

bootstrapApplication(App, {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor])
    ),
  ],
});
```

`withFetch()` selects the modern fetch-based backend instead of the legacy XMLHttpRequest backend. The fetch backend is required for Server-Side Rendering with hydration (because it integrates with the framework's `TransferState` for transferring server-fetched data to the client) and is recommended in general because it aligns the application with the modern Web Standard.

## Basic usage

```ts
import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export type Task = { id: string; title: string; done: boolean };

@Injectable({ providedIn: "root" })
export class TasksApi {
  private http = inject(HttpClient);

  list(): Observable<Task[]> {
    return this.http.get<Task[]>("/api/tasks");
  }

  create(input: { title: string }): Observable<Task> {
    return this.http.post<Task>("/api/tasks", input);
  }

  update(id: string, patch: Partial<Task>): Observable<Task> {
    return this.http.patch<Task>(`/api/tasks/${id}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tasks/${id}`);
  }
}
```

These are **cold** Observables: nothing happens until you subscribe (or use `async` pipe / `firstValueFrom`).

## Query / headers / params

```ts
this.http.get<Task[]>("/api/tasks", {
  params: { status: "open", limit: "50" },
  headers: { "X-Trace-Id": traceId },
});
```

`HttpParams` and `HttpHeaders` are immutable; chain `.set()`/`.append()` to build.

## Functional interceptors (the modern style)

```ts
import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { AuthService } from "./auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      if (err.status === 401) {
        inject(AuthService).logout();
      }
      return throwError(() => err);
    })
  );
};
```

Functions, no classes. Inject anything you need via `inject()`.

## Request cancellation

Switching from one search query to another should cancel the in-flight request. Two ways:

1. **`switchMap`**: the operator unsubscribes from the previous Observable when a new value arrives, which cancels the underlying fetch (because `HttpClient` Observables are cancellable).
2. **AbortController** through `signal` option (since Angular 17):

```ts
const ctrl = new AbortController();
this.http.get("/api/tasks", { signal: ctrl.signal }).subscribe(...);
ctrl.abort();   // cancels
```

## Interceptors: common use cases

### Retry transient errors

```ts
import { retry, timer } from "rxjs";

export const retryInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    retry({
      count: 3,
      delay: (err, attempt) => {
        if (err.status >= 500 || err.status === 0) {
          return timer(Math.min(1000 * 2 ** attempt, 10_000));
        }
        throw err;
      },
    })
  );
```

Exponential backoff for 5xx and network errors; immediate fail for 4xx.

### Trace ID propagation

```ts
export const traceInterceptor: HttpInterceptorFn = (req, next) => {
  const traceId = crypto.randomUUID();
  return next(req.clone({ setHeaders: { "X-Trace-Id": traceId } }));
};
```

For end-to-end debugging (correlate browser → API logs).

### Request logging (dev)

```ts
export const logInterceptor: HttpInterceptorFn = (req, next) => {
  const t = performance.now();
  return next(req).pipe(
    tap({
      next: (e) => { if (e.type === HttpEventType.Response) console.log(req.method, req.url, e.status, `${(performance.now() - t).toFixed(0)}ms`); },
      error: (err) => console.error(req.method, req.url, err.status),
    })
  );
};
```

## Interceptor order

Interceptors run in the order provided. Order matters:

```ts
withInterceptors([
  authInterceptor,    // adds Bearer
  retryInterceptor,   // retries with the same Bearer
  logInterceptor,     // logs the final outcome
])
```

If you put `retryInterceptor` first, retries happen before the auth header is attached.

## Server-Sent Events / streaming

`HttpClient` doesn't natively support SSE. Use the `EventSource` API directly, or for fetch-based streams:

```ts
const res = await fetch("/api/stream", { method: "POST", body });
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

Wrap in `from()` if you want an Observable.

## Testing

```ts
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { TasksApi } from "./tasks.api";

describe("TasksApi", () => {
  let api: TasksApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TasksApi,
      ],
    });
    api = TestBed.inject(TasksApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("lists tasks", () => {
    api.list().subscribe((tasks) => expect(tasks).toHaveLength(2));

    const req = httpMock.expectOne("/api/tasks");
    expect(req.request.method).toBe("GET");
    req.flush([{ id: "1", title: "a", done: false }, { id: "2", title: "b", done: true }]);
  });
});
```

`HttpTestingController` is the testing equivalent of MSW for Angular.

## SSR and hydration

With `withFetch()` and `provideClientHydration()`, Angular Universal can:

- Fetch data on the server using the same `HttpClient` code.
- Transfer the fetched state to the client (`TransferState`) so the client doesn't refetch.

```ts
provideHttpClient(withFetch(), withInterceptors([cacheInterceptor()]));
```

Built-in `withInterceptorsFromDi()` helps if you're mixing legacy class interceptors.

## Key takeaways

- Functional interceptors with `inject()` are the 2026 standard, replacing class-based interceptors that depended on the legacy `HTTP_INTERCEPTORS` multi-token.
- Use `withFetch()` for the modern fetch-based backend; it is required for Server-Side Rendering with hydration and recommended in general for alignment with the Web Standard.
- Cancellation comes for free via `switchMap` (which unsubscribes from the previous Observable when a new value arrives), and the `AbortSignal` option provides explicit cancellation when needed.
- Interceptor ordering matters: the typical chain is authentication first (so retries carry the token), then retry, then logging (so the log captures the final outcome including any retries).
- Use `HttpTestingController` for unit tests; the controller intercepts every request and lets the test assert which requests were made and respond with controlled fixtures.

## Common interview questions

1. How do you attach an Authorization header to every request?
2. How does Angular cancel in-flight HTTP requests on route changes?
3. Where would retry-with-backoff live and what status codes would you retry?
4. How do you test an `HttpClient`-using service?
5. What's `withFetch()` and why use it?

## Answers

### 1. How do you attach an Authorization header to every request?

Implement a functional `HttpInterceptorFn` that clones the outgoing request, attaches the `Authorization` header (typically `Bearer <token>`), and forwards the cloned request to `next`. Register the interceptor in the application's `provideHttpClient(withInterceptors([...]))` configuration. The interceptor is then applied to every `HttpClient` call automatically, eliminating the need to attach the header manually at every call site.

**How it works.** The interceptor receives the request and the `next` handler. It clones the request (because requests are immutable) with the additional header, and calls `next(cloned)` to forward it. The clone preserves every other property of the original request — URL, method, body, params, response type — and only adjusts the headers.

```ts
import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "./auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token) return next(req);                            // no token — forward unchanged
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

// Registration:
provideHttpClient(withInterceptors([authInterceptor]));
```

**Trade-offs / when this fails.** The pattern attaches the header to every request, which is wrong when the application calls third-party services that should not receive the application's token. The cure is a URL allowlist or denylist inside the interceptor — only attach the header when the URL is on the application's own origin. The pattern also fails when the token is held in a synchronous accessor (a signal) but the token's refresh is asynchronous; for those cases, see the React client authentication chapter's silent-refresh pattern, which the same logic applies to in Angular.

### 2. How does Angular cancel in-flight HTTP requests on route changes?

`HttpClient` Observables are cold and cancellable — unsubscribing from the Observable cancels the underlying request. The two practical patterns are `switchMap` (which unsubscribes from the previous inner Observable when a new outer value arrives) and binding via the `async` pipe (which unsubscribes when the binding is destroyed, including on route navigation away from the component). Both result in the underlying fetch being aborted via the `AbortController` the framework manages internally.

**How it works.** The fetch backend creates an `AbortController` for each request and aborts it when the Observable is unsubscribed. The cancellation propagates to the network layer, which cancels the in-flight request — the server may still process the request (depending on when the cancellation arrives), but the client discards any response.

```ts
// Autocomplete — switchMap cancels the previous fetch when a new query arrives.
search$.pipe(
  debounceTime(300),
  switchMap((q) => http.get(`/search?q=${q}`)),
).subscribe(/* ... */);

// Component subscription — async pipe cancels on destroy (route change).
@Component({ template: `@for (t of tasks$ | async; track t.id) { ... }` })
export class TaskListComponent {
  tasks$ = inject(TasksService).list();
}
```

**Trade-offs / when this fails.** The pattern fails when the developer subscribes manually and forgets to unsubscribe — the request continues, the response is processed, and the component (which is now gone) cannot do anything with it; in the worst case, the response triggers a state update on a destroyed component. The cure is `takeUntilDestroyed()` (Angular 16+) or the `async` pipe. The pattern also fails when the application needs to cancel for reasons other than navigation; for those, use the explicit `AbortController` via the `signal` option on the request.

### 3. Where would retry-with-backoff live and what status codes would you retry?

Implement retry-with-backoff in a functional interceptor so the policy applies uniformly to every request without scattering retry logic across call sites. Retry only on transient failures: network errors (status 0), gateway errors (502, 503, 504), and optionally rate-limit responses (429) when the server returns a `Retry-After` header. Do not retry on permanent failures (4xx other than 429) or on requests whose retry is unsafe (non-idempotent POST without an idempotency key).

**How it works.** The interceptor wraps the downstream Observable in `retry({ count, delay })`, where `delay` is a function that decides whether to retry and how long to wait. The function inspects the error's status, applies an exponential-backoff delay (with jitter to avoid thundering herds), and either returns a `timer` Observable (to retry after the delay) or throws (to fail immediately).

```ts
import { retry, timer, throwError } from "rxjs";

export const retryInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    retry({
      count: 3,
      delay: (err, attempt) => {
        const status = err.status as number;
        const transient = status === 0 || status === 429 || (status >= 500 && status < 600);
        if (!transient) throw err;
        const base = Math.min(1000 * 2 ** attempt, 10_000);
        const jitter = Math.random() * 250;
        return timer(base + jitter);
      },
    }),
  );
```

**Trade-offs / when this fails.** Retrying every request is unsafe for non-idempotent operations (POST without idempotency key, PATCH that is not naturally idempotent), because the second attempt could create a duplicate or apply the change twice. The cure is to opt into retries via a request property (a custom header or a context token) and have the interceptor honour it. The pattern also fails when the retries cascade across services — every service in a chain retries three times, multiplying the load on the failing dependency; the cure is a circuit breaker upstream that stops retrying when failure is sustained.

### 4. How do you test an `HttpClient`-using service?

Use `provideHttpClientTesting()` and the `HttpTestingController`. The controller intercepts every request the service makes, lets the test assert which requests were issued (URL, method, headers, body), and responds with controlled fixtures via `req.flush(data)` or `req.error(error)`. The test runs entirely in memory — no real network calls — and is fully deterministic.

**How it works.** The testing module replaces the real HTTP backend with a fake one that records every request. The test code makes the call (typically by subscribing to the service method's return value), then asks the controller to find the expected request (`expectOne`, `match`) and responds with the desired payload. The controller's `verify()` call in the `afterEach` hook fails the test if any request was made that the test did not explicitly handle.

```ts
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { TasksApi } from "./tasks.api";

let api: TasksApi;
let httpMock: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), TasksApi],
  });
  api = TestBed.inject(TasksApi);
  httpMock = TestBed.inject(HttpTestingController);
});

afterEach(() => httpMock.verify());

it("lists tasks", () => {
  api.list().subscribe((tasks) => expect(tasks).toHaveLength(2));
  const req = httpMock.expectOne("/api/tasks");
  expect(req.request.method).toBe("GET");
  req.flush([{ id: "1", title: "a", done: false }, { id: "2", title: "b", done: true }]);
});
```

**Trade-offs / when this fails.** The pattern is the standard for unit-testing services that depend on `HttpClient`. It is the wrong shape for end-to-end tests, where the team typically wants the real network or a service worker (Mock Service Worker) intercepting at the browser level. The pattern fails when the service uses streams or Server-Sent Events that the controller does not model well; for those, fall back to a real fake server (such as `msw` running in Node) that supports streaming.

### 5. What's `withFetch()` and why use it?

`withFetch()` is the configuration option that selects the modern fetch-based HTTP backend instead of the legacy XMLHttpRequest backend. The fetch backend is built on the Web Standard `fetch` API, supports streaming responses, integrates with the framework's Server-Side Rendering hydration via `TransferState`, and aligns Angular with the rest of the JavaScript ecosystem (Node.js, the browser's native APIs, Service Workers).

**How it works.** Without `withFetch()`, `HttpClient` uses Angular's older `HttpXhrBackend`, which wraps `XMLHttpRequest`. With `withFetch()`, the framework uses `HttpFetchBackend`, which wraps the global `fetch` function. The API surface is identical — the application's code does not change — but the underlying transport, the streaming capability, and the SSR integration differ.

```ts
provideHttpClient(
  withFetch(),                                // modern backend
  withInterceptors([authInterceptor]),
);
```

**Trade-offs / when this fails.** `withFetch()` is the recommended default in 2026 and the senior expectation for new applications. The pattern fails when the application depends on XHR-specific behaviour — for example, the legacy `progress` event handlers — that the fetch backend models differently; the cure is to either migrate to fetch's streaming primitives or to keep the legacy backend until the dependency is removed. The pattern also requires the runtime to provide a `fetch` global; this is universal in modern browsers and Node.js 18+, but older Node.js runtimes need a polyfill.

## Further reading

- [Angular HTTP guide](https://angular.dev/guide/http).
- [Functional interceptors](https://angular.dev/api/common/http/HttpInterceptorFn).
