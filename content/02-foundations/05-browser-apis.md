---
title: "Browser & Web Platform APIs"
sidebar_label: "2.5 Browser & Web Platform APIs"
description: "fetch + AbortController, Storage / IndexedDB, Service & Web Workers, observers, History, Web Crypto, BroadcastChannel."
sidebar_position: 5
---

The platform is bigger than React. Senior interviews probe whether the candidate knows what is available natively before reaching for a library. This chapter covers the application programming interfaces (APIs) that should be writable as a small example from memory; for each, the chapter explains the mechanism and the production pitfalls.

> **Acronyms used in this chapter.** API: Application Programming Interface. CDN: Content Delivery Network. COOP: Cross-Origin-Opener-Policy. COEP: Cross-Origin-Embedder-Policy. CPU: Central Processing Unit. DOM: Document Object Model. JS: JavaScript. JSON: JavaScript Object Notation. PWA: Progressive Web App. RFC: Request for Comments. SPA: Single-Page Application. SSE: Server-Sent Events. SW: Service Worker. URL: Uniform Resource Locator. UUID: Universally Unique Identifier. XSS: Cross-Site Scripting.

## `fetch` and `AbortController`

`fetch` is the default network primitive. Cancellation is via `AbortController` and the `signal` option, which is the same `signal` interface that `addEventListener`, `setTimeout` (`AbortSignal.timeout`), and most modern asynchronous APIs accept. Using one controller per logical operation makes cleanup tractable: aborting the controller cancels every operation associated with it.

```ts
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 5_000);

try {
  const res = await fetch("/api/users", { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as User[];
} catch (err) {
  if (err instanceof DOMException && err.name === "AbortError") {
    // Expected cancellation; swallow.
  } else {
    throw err;
  }
} finally {
  clearTimeout(id);
}
```

`AbortSignal.timeout(ms)` produces a signal that aborts after the specified delay, and `AbortSignal.any([sig1, sig2])` composes two signals into one that aborts when either does. Both remove a substantial amount of boilerplate around timeouts and double-cancellation patterns.

```ts
const userCancel = new AbortController();
const timeout = AbortSignal.timeout(5_000);
const combined = AbortSignal.any([userCancel.signal, timeout]);
await fetch("/slow", { signal: combined });
```

## Storage: when to use what

The browser exposes four storage mechanisms with different capacity, synchronicity, and persistence characteristics. Picking the wrong one for a given workload is a substantial source of production bugs.

| API | Capacity | Synchronous? | Survives close? | Use for |
| --- | --- | --- | --- | --- |
| `localStorage` | ~5 MB | Yes | Yes | Small key/value such as theme, last route. |
| `sessionStorage` | ~5 MB | Yes | No (per tab) | Throwaway per-session state. |
| Cookies | ~4 KB | Sync (read) | Configurable | Server-readable session/auth tokens. |
| **IndexedDB** | Hundreds of MB to GB | Async | Yes | Structured data, offline queues, large blobs. |
| Cache API | Quota-bound | Async | Yes (controlled by SW) | Service Worker response cache. |

Two senior positions worth defending in interviews:

- **Authentication tokens never live in `localStorage`.** Anything readable by JavaScript is exfiltrable by Cross-Site Scripting. Use `HttpOnly` cookies instead (see [Part 10](../10-auth/index.md) for the full discussion and the threat model).
- **Do not use `localStorage` from the main thread for anything large or hot.** It is synchronous and blocks the rendering thread; a single 1-megabyte read can stall a frame. For anything beyond a handful of small key/value pairs, IndexedDB is the right answer.

### IndexedDB without the boilerplate

The raw IndexedDB API is famously verbose. In real applications use `idb`, a small `Promise` wrapper that turns the event-driven API into a familiar `await`-based one.

```ts
import { openDB } from "idb";

const db = await openDB("app", 1, {
  upgrade(db) {
    const store = db.createObjectStore("drafts", { keyPath: "id" });
    store.createIndex("by-updated", "updatedAt");
  },
});

await db.put("drafts", { id: "abc", title: "Hello", updatedAt: Date.now() });
const draft = await db.get("drafts", "abc");
const recent = await db.getAllFromIndex("drafts", "by-updated");
```

The `upgrade` callback runs only when the version number changes, which is the migration hook for adding object stores or indexes. The pattern is to bump the version number whenever the schema changes and to handle every previous version inside `upgrade`, in the style of a database migration suite.

## Service Workers

A Service Worker is a script the browser runs **in a separate thread** that intercepts network requests for the origin. It is the foundation of offline support, custom caching strategies, push notifications, and background synchronisation.

```ts
// public/sw.ts (registered at the origin root)
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open("static-v1").then((cache) =>
      cache.addAll(["/", "/index.html", "/styles.css", "/app.js"]),
    ),
  );
});

self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.destination === "document") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
  }
});
```

Service Workers have a strict lifecycle: `install` runs once when a new worker is registered, then the new worker waits in the `installed` state until the old worker releases (every controlled tab is closed or `self.skipWaiting()` is called), then the new worker enters `activated` and starts handling requests. If the developer forgets `self.skipWaiting()` and `clients.claim()`, users can run the old version of the application after a deploy until they happen to close every tab — a substantial source of "works on my machine" reports for new feature rollouts.

```ts
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting()); // Skip the wait phase.
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim()); // Take control of existing clients.
});
```

The trade-off of `skipWaiting` plus `claim` is that the in-flight tab loads code that was deployed in two halves — the HTML from the previous deploy and the worker-served assets from the new one — which can cause subtle consistency bugs. The senior pattern is to version the cache and to only skip waiting once a "you are running an old version" prompt has been confirmed by the user. Service Worker caching strategies are covered in depth in [PWA & offline-first](../07-production-concerns/07-pwa-offline.md).

## Web Workers

A Web Worker runs JavaScript on a background thread without access to the Document Object Model. It is the right tool for CPU-heavy work that would otherwise block the main thread: large parsers, image processing, cryptographic operations, search-index construction.

```ts
// worker.ts
self.addEventListener("message", (e: MessageEvent<{ items: Item[] }>) => {
  const { items } = e.data;
  const result = expensiveSort(items);
  self.postMessage(result);
});

// main.ts
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

worker.onmessage = (e) => setResults(e.data);
worker.postMessage({ items });
```

For a friendlier API, `comlink` lets the developer call worker functions as if they were ordinary `await`-able functions, which removes the `postMessage` ceremony entirely:

```ts
import { wrap } from "comlink";
const api = wrap<typeof workerApi>(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }));
const result = await api.expensiveSort(items);
```

`SharedArrayBuffer` lets workers share memory with the main thread for high-throughput data exchange, but the page must be **cross-origin isolated** by serving `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. The combination is rare in practice and worth knowing exists more than worth deploying.

## Observers

Three observer APIs cover most reactive Document Object Model needs and replace the pre-2015 idiom of attaching listeners to `scroll` and `resize` events. Observers batch their callbacks and avoid the per-frame layout thrashing that scroll listeners caused.

```ts
// IntersectionObserver: react to elements entering or leaving the viewport.
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) loadMore();
    }
  },
  { rootMargin: "200px" },
);
io.observe(sentinelRef.current!);

// ResizeObserver: react to size changes (responsive components, JS-driven container queries).
const ro = new ResizeObserver(([entry]) => {
  setWidth(entry.contentRect.width);
});
ro.observe(elementRef.current!);

// MutationObserver: react to DOM-tree changes (rare, useful for third-party scripts).
const mo = new MutationObserver((mutations) => {
  for (const m of mutations) console.log(m.type, m.target);
});
mo.observe(document.body, { childList: true, subtree: true });
```

All three are substantially cheaper than the equivalent scroll or resize listener because they piggyback on layout work the browser is already doing. Each delivers an entries array, so a single callback can process many observed targets in one call — preferring one observer with many `observe` calls over many one-target observers is the idiomatic pattern.

## History API

`history.pushState` and `history.replaceState` change the URL without a full page load. The `popstate` event fires when the user navigates back or forward through the session history, including via the browser back button.

```ts
function navigate(path: string) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

window.addEventListener("popstate", () => render(location.pathname));
```

In application code these are usually consumed through a router (Next.js, React Router, TanStack Router); the senior expectation is to know what is underneath the router so that a "the back button does the wrong thing" bug can be diagnosed.

The newer **Navigation API** (`navigation.navigate`, `navigation.intercept`) is the modern replacement and exposes a single navigation event for both same-document and cross-document navigations, which simplifies the router implementation considerably. It is available in Chromium-based browsers and is gaining adoption; the History API remains the lowest-common-denominator option.

## Web Crypto

Native cryptography. Use it for hashing, generating cryptographically secure random data, and verifying signatures from the browser. The API lives at `crypto.subtle` and is asynchronous because some operations may be hardware-accelerated.

```ts
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const id = crypto.randomUUID();          // RFC 4122 v4 UUID
const bytes = crypto.getRandomValues(new Uint8Array(16));
```

Do not roll a custom cryptographic implementation — use Web Crypto and let the platform do the work. The runtime is constant-time where it matters (signature verification) and is implemented by people whose full-time job is cryptography, which is a higher bar than a frontend feature team can sustain.

## BroadcastChannel

`BroadcastChannel` is a same-origin pub/sub channel for tabs and workers. Messages are delivered to every other context that has opened the same channel name; the publishing context does not receive its own messages.

```ts
const channel = new BroadcastChannel("auth");

// Tab A logs out -> all tabs sign out.
channel.postMessage({ type: "logout" });

// Tab B receives the message.
channel.addEventListener("message", (e) => {
  if (e.data.type === "logout") signOut();
});
```

Real-world uses include cross-tab session synchronisation (covered in detail in [chapter 10.8](../10-auth/08-react-client.md)), "you have unsaved changes" coordination, and broadcasting cache invalidations to peer tabs after a successful mutation. The fall-back for older browsers without `BroadcastChannel` is a sentinel write to `localStorage` plus a `storage` event listener, which has weaker semantics but works back to early 2010s browsers.

## Page lifecycle and visibility

`visibilitychange` and the Page Lifecycle API tell the page when a tab is hidden, frozen, or about to be evicted. Use these signals to pause polling, stop animations, and save drafts before the operating system swaps the tab out.

```ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveDraft();
    stopPolling();
  } else {
    resumePolling();
  }
});
```

The pattern is critical for battery and data-budget reasons on mobile, where a backgrounded tab that continues to poll a server can drain the battery and the user's data plan unobserved. The Page Lifecycle API additionally exposes `freeze` and `resume` events for the more aggressive states some browsers enter for backgrounded tabs.

## Key takeaways

- `AbortController.signal` is the universal cancellation primitive — it works for `fetch`, event listeners, and `setTimeout` (via `AbortSignal.timeout`).
- Pick storage by lifetime and structure; never store auth tokens in `localStorage`.
- Use `idb` to make IndexedDB tractable; reserve raw IndexedDB code for libraries.
- Service Workers run in their own thread and intercept network requests — they are how offline-first applications work, and the lifecycle is the source of most "old code after deploy" bugs.
- Web Workers move CPU-heavy work off the main thread; `comlink` makes them ergonomic.
- Use `IntersectionObserver` and `ResizeObserver` instead of `scroll` and `resize` listeners.
- `crypto.randomUUID`, `crypto.getRandomValues`, and `crypto.subtle` give the platform's cryptographic primitives at no library cost.

## Common interview questions

1. How do you cancel an in-flight `fetch`? What other APIs use the same primitive?
2. When would you reach for IndexedDB instead of `localStorage`?
3. Walk me through the lifecycle of a Service Worker. What is the pitfall with deploys?
4. What is the difference between a Web Worker and a Service Worker?
5. Why is `IntersectionObserver` preferred over a scroll listener for "load more" sentinels?
6. What does Web Crypto give you that you could not easily build yourself?

## Answers

### 1. How do you cancel an in-flight `fetch`? What other APIs use the same primitive?

Pass the `signal` of an `AbortController` to `fetch`, then call `controller.abort()` when the request should be cancelled. The same `AbortSignal` interface is accepted by `addEventListener`, `setTimeout` (indirectly via `AbortSignal.timeout`), the modern `EventSource`, and the streaming variants of `WritableStream` and `ReadableStream`. The unification means a single controller can govern an arbitrary collection of asynchronous resources.

**How it works.** `AbortController` exposes a `signal` property and an `abort()` method. Passing the signal to a consumer registers it; calling `abort()` synchronously fires the signal's `abort` event and sets `signal.aborted = true`. Each consumer reacts according to its semantics — `fetch` rejects with a `DOMException` named `AbortError`, `addEventListener` removes the listener, the streaming reader closes its stream.

```ts
const controller = new AbortController();
const signal = controller.signal;

const req = fetch("/api/users", { signal });
const onClick = () => console.log("hi");
window.addEventListener("click", onClick, { signal });
const id = setTimeout(() => console.log("late"), 1000);
signal.addEventListener("abort", () => clearTimeout(id));

controller.abort();
// The fetch rejects with AbortError, the click handler is removed, the timeout is cleared.
```

**Trade-offs / when this fails.** The signal is not retroactive: aborting after the response has been delivered does nothing. The hidden hazard is forgetting to handle the `AbortError` in the `catch` branch — an unhandled rejection from a deliberately cancelled request shows up as a noisy error in monitoring. The standard pattern is to filter `AbortError` early in the catch and re-throw everything else.

### 2. When would you reach for IndexedDB instead of `localStorage`?

Use IndexedDB when the data is more than a handful of small key/value pairs, when the access pattern is structured (queries by index, range scans, transactions), or when the read/write volume would noticeably block the main thread under `localStorage`'s synchronous semantics. The crossover point is usually around a few hundred kilobytes or whenever the application starts wanting indexes; below that, `localStorage` is acceptable for its API simplicity.

**How it works.** `localStorage` is a synchronous string-to-string map. Every read and write blocks the rendering thread, the values are strings only (so the application serialises and deserialises through JSON on every access), and the total quota is a few megabytes. IndexedDB is an asynchronous structured-storage engine modelled on a key/value object store with optional indexes; it stores arbitrary structured-clone-able values, supports transactions across multiple object stores, and the quota is in the hundreds of megabytes to several gigabytes depending on the browser.

```ts
import { openDB } from "idb";
const db = await openDB("messages", 1, {
  upgrade(db) {
    const store = db.createObjectStore("by-id", { keyPath: "id" });
    store.createIndex("by-conversation", "conversationId");
  },
});
const recent = await db.getAllFromIndex("by-conversation", "by-conversation", convoId);
```

**Trade-offs / when this fails.** IndexedDB has more ceremony per call (the raw API is event-driven and notoriously verbose), which is why the `idb` wrapper is effectively a default in 2026. The schema migration story (the `upgrade` callback) requires upfront thought — bumping a version number across deployed application versions has caused many an outage. For ephemeral per-session data, `sessionStorage` may still be the right answer; the IndexedDB recommendation applies to data that should persist and that benefits from indexed access.

### 3. Walk me through the lifecycle of a Service Worker. What is the pitfall with deploys?

The lifecycle has four phases: `installing` (the new worker downloads, parses, and runs its `install` event), `installed` (waiting for previous workers to release before activating), `activating` (running the `activate` event, typically clearing old caches), and `activated` (handling `fetch` events). The wait between `installed` and `activating` is where deploys go wrong: a new worker is installed but cannot take over because tabs running the old worker are still open, so users continue to receive the old assets until they happen to close every tab.

**How it works.** The browser registers the worker, downloads the script if its byte content has changed, and runs `install`. Once `install` completes successfully, the worker enters `installed` and waits. Calling `self.skipWaiting()` inside `install` skips the wait and forces immediate activation; `self.clients.claim()` inside `activate` makes the new worker control existing tabs without requiring them to reload. Without these two calls, the new worker only takes over on the next navigation after every old-worker-controlled tab has been closed.

```ts
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(Promise.all([
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== "static-v2").map((k) => caches.delete(k)))
    ),
    self.clients.claim(),
  ]));
});
```

**Trade-offs / when this fails.** Aggressive `skipWaiting` plus `claim` makes the in-flight tab use a mix of old HTML and new worker-served assets, which can cause hash mismatches or runtime errors. The senior pattern is to guard `skipWaiting` behind a "new version available, click to update" prompt that the user accepts, then call `skipWaiting` from the page via `postMessage`. The trade-off is simplicity (`skipWaiting` immediately) versus consistency (prompt the user); production apps typically prefer the prompt.

### 4. What is the difference between a Web Worker and a Service Worker?

A Web Worker is a background thread for CPU-heavy work that runs only while the page that started it is open and that has no special powers beyond running JavaScript off the main thread. A Service Worker is a network proxy that runs independently of any open page, intercepts requests from every controlled tab, and persists across reloads and navigations; it is the foundation of offline-first applications and push notifications.

**How it works.** Both run JavaScript without access to the Document Object Model. The differences are in lifecycle and capability. A Web Worker is created by `new Worker(url)` and dies when the page closes; communication is via `postMessage`, and the worker has no special browser APIs. A Service Worker is registered once with `navigator.serviceWorker.register(url)`, persists across page lifetimes, intercepts `fetch` events from controlled clients, and exposes `caches`, `Notification`, and `Background Sync` APIs that Web Workers do not have.

```ts
// Web Worker — page-scoped, CPU work.
const worker = new Worker(new URL("./compute.ts", import.meta.url), { type: "module" });
worker.postMessage({ items });

// Service Worker — origin-scoped, network proxy.
await navigator.serviceWorker.register("/sw.js");
```

**Trade-offs / when this fails.** Web Workers are appropriate when the cost of crossing the worker boundary (serialising data via `postMessage`) is amortised by the work that happens on the other side; a worker that is asked to do a few microseconds of work per call will be slower than the main thread because the messaging overhead dominates. Service Workers are appropriate for offline support and custom caching but introduce the deploy-update lifecycle described in the previous answer; for an application that does not need offline capability, the operational cost of the Service Worker may exceed the value.

### 5. Why is `IntersectionObserver` preferred over a scroll listener for "load more" sentinels?

`IntersectionObserver` runs the callback only when an observed element's intersection with the viewport (or a configured root) crosses a threshold; a scroll listener fires on every scroll event and forces the developer to query layout (`getBoundingClientRect`) to determine whether the sentinel is visible, which is expensive and synchronous. The observer is roughly two orders of magnitude cheaper at high scroll rates, runs off the main thread for the intersection computation, and avoids the layout-thrashing pattern that scroll listeners encourage.

**How it works.** The browser already computes intersection geometry as part of layout. `IntersectionObserver` exposes that pre-computed information and only invokes the callback when an entry's intersection state changes — typically a handful of times during a scroll, regardless of how many scroll events fire. The `rootMargin` option lets the developer expand the trigger area outward, which is the idiomatic way to start loading the next page before the user actually reaches the sentinel.

```ts
const io = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) loadMore();
}, { rootMargin: "200px" });

io.observe(sentinelRef.current!);
```

**Trade-offs / when this fails.** The observer fires asynchronously, so the callback may run after the user has scrolled past the sentinel; for a "load more" pattern this is fine because the loaded content appears below where the user is now looking. The pattern fails for use cases that need exact pixel-precise scroll position (parallax effects, scroll-driven animations); the modern replacement for those is the Scroll-Driven Animations API, not a scroll listener. The other failure mode is observing too many elements — observe one sentinel, not every list item.

### 6. What does Web Crypto give you that you could not easily build yourself?

Web Crypto gives the application four things that a hand-rolled implementation cannot: a constant-time signature verification path, hardware acceleration where available, a curated set of algorithms maintained by browser-security teams, and a cryptographically secure random source (`crypto.getRandomValues`) that draws from the operating system entropy pool. The combination is the difference between "secure" and "looks secure", and the gap is exactly where home-rolled cryptography fails in audit.

**How it works.** Modern browsers implement Web Crypto on top of native cryptographic libraries that are written in low-level languages, audited for side-channel resistance, and updated through the browser's standard release process. `crypto.subtle.digest` for hashing, `crypto.subtle.sign` and `crypto.subtle.verify` for signatures, `crypto.subtle.encrypt` and `crypto.subtle.decrypt` for symmetric and public-key cryptography, plus the random-number generators, cover essentially everything a frontend application needs. The API is asynchronous because the underlying implementation may use hardware acceleration that benefits from the asynchronous boundary.

```ts
async function verifyToken(token: string, key: CryptoKey, signature: ArrayBuffer): Promise<boolean> {
  const data = new TextEncoder().encode(token);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, data);
}

const id = crypto.randomUUID();          // RFC 4122 v4 UUID
const bytes = crypto.getRandomValues(new Uint8Array(16));
```

**Trade-offs / when this fails.** The asynchronous interface adds complexity for code that previously used synchronous JavaScript implementations of MD5 or SHA-1. The cure is to embrace the asynchrony and bake it into the call sites; cryptographic operations are usually network-adjacent, so the asynchrony is rarely the bottleneck. The legitimate exception is short-lived deterministic identifiers where a non-cryptographic hash is sufficient and `crypto.subtle.digest`'s asynchrony is a nuisance — for those, a synchronous library such as `xxhash-wasm` is appropriate, but the result must not be relied on for security.

## Further reading

- MDN: [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
- web.dev, [Page Lifecycle API](https://web.dev/articles/page-lifecycle-api).
- Jake Archibald, ["Service Workers: an Introduction"](https://web.dev/articles/service-workers-cache-storage).
