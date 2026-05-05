---
title: "App Router vs. Pages Router"
sidebar_label: "4.1 App Router vs. Pages Router"
description: "What changed, when each is the right answer, and the migration path."
sidebar_position: 1
---

Next.js has two routers. As of 2026, **App Router is the default** for new code; Pages Router is supported for compatibility and remains a reasonable choice for specific cases. A senior candidate should be able to articulate why App Router exists and when Pages Router is still defensible.

> **Acronyms used in this chapter.** API: Application Programming Interface. CSS: Cascading Style Sheets. DOM: Document Object Model. JS: JavaScript. JSX: JavaScript XML. ROI: Return on Investment. RSC: React Server Components. SEO: Search Engine Optimisation. SSG: Static Site Generation. SSR: Server-Side Rendering. UI: User Interface. URL: Uniform Resource Locator.

## Two routers, side-by-side

| Concern | Pages Router (`pages/`) | App Router (`app/`) |
| --- | --- | --- |
| File for a route | `pages/posts/[id].tsx` | `app/posts/[id]/page.tsx` |
| Layouts | `_app.tsx` only | Nested `layout.tsx` per segment |
| Data fetching | `getServerSideProps`, `getStaticProps` | `await` directly in server components |
| Components | All client | **Server by default**, opt into client |
| Mutations | API routes (`pages/api/*`) | **Server Actions** + API routes |
| Loading states | Manual | `loading.tsx` files + Suspense |
| Errors | `_error.tsx`, `_500.tsx` | `error.tsx` + `not-found.tsx` per segment |
| Streaming | No (request waits) | Yes (Suspense streams) |
| Caching | Mostly per-request | Multi-layer (request, data, full-route) |
| Bundle | All ships to client | Server components stay server-side |

## Why App Router exists

Pages Router was designed before React Server Components (RSC) existed. Its model is "every page is a single React tree that runs in the browser, optionally pre-rendered on the server". That model made three things substantially harder than they needed to be: avoiding waterfalls when nested components each fetch their own data; keeping data fetching close to the component that uses it without a lifecycle method hoisted to the top of the page; and streaming above-the-fold content before all data has resolved.

App Router solves all three by making every component a server component by default (so `await` is allowed everywhere in the render tree), by letting the application nest layouts and `<Suspense>` boundaries per route segment (so streaming is fine-grained rather than per-page), and by adding Server Actions so mutations no longer require a separate hand-rolled API surface.

## When Pages Router is still defensible

Three situations make Pages Router the right choice in 2026. The first is a large, stable Pages Router application where the migration Return on Investment is low — the team would spend weeks rewriting routes for marginal benefit. The second is a dependency on a library that does not yet support RSC, which is becoming rare but still occasionally appears for niche libraries that touch global state in non-serialisable ways. The third is a small marketing site where the goal is the simplest possible static export; App Router can do this too, but the model is more involved than `next export` from Pages Router.

## File conventions in App Router

```text
app/
├── layout.tsx                # root layout (must include <html><body>)
├── page.tsx                  # /
├── not-found.tsx
├── error.tsx                 # client component, catches render errors below
├── posts/
│   ├── layout.tsx            # wraps every posts/* route
│   ├── page.tsx              # /posts
│   ├── loading.tsx           # Suspense fallback for /posts and below
│   └── [id]/
│       ├── page.tsx          # /posts/123
│       ├── @comments/        # parallel route slot
│       │   └── page.tsx
│       └── (modal)/          # route group (no URL segment)
│           └── page.tsx
└── api/
    └── webhook/route.ts      # POST /api/webhook
```

Conventions worth knowing:

- **`page.tsx`** = the route's UI.
- **`layout.tsx`** = wraps all child routes; persistent across navigations.
- **`loading.tsx`** = Suspense fallback for everything below.
- **`error.tsx`** = Error Boundary for everything below; **must be a client component**.
- **`not-found.tsx`** = rendered when `notFound()` is called.
- **`route.ts`** = REST handler (GET/POST/...) for `/api/*` style endpoints.
- **`(group)/`** = route group, no URL segment added.
- **`@slot/`** = parallel route slot.

## Migration path

Both routers can coexist. App Router takes precedence for matching routes; everything else falls through to `pages/`. The pragmatic order:

1. Add `app/layout.tsx` at the root (with `<html><body>`).
2. Move one low-risk route (e.g. `/about`) to `app/about/page.tsx`.
3. Move shared layout pieces from `_app.tsx` into the App Router's `layout.tsx`.
4. Replace `getServerSideProps` calls one by one — they become `await` in a server component.
5. Replace `pages/api/*` mutations with Server Actions where the form lives in a Next.js page.
6. Keep API routes that are consumed by external clients (mobile, third-party) in `app/api/*/route.ts`.

## The senior framing

When asked "App Router or Pages Router?", a senior answer is:

> "For new code, App Router. The data-fetching model is colocated and parallelizable, layouts are real, and streaming + Server Actions reduce the amount of client JS we ship. Pages Router still works well for large existing apps where migration ROI is low or for specific libraries that haven't moved to RSC yet."

## Key takeaways

- App Router is the default; Pages Router remains supported.
- App Router enables: nested layouts, server components by default, Server Actions, streaming via Suspense, multi-layer caching.
- Both routers can coexist. Migrate one route at a time.
- Keep external-API endpoints as `route.ts` handlers; convert internal mutations to Server Actions.

## Common interview questions

1. What problems does App Router solve that Pages Router struggled with?
2. Walk me through the file conventions: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `route.ts`.
3. When would you keep a route in `pages/` instead of moving it to `app/`?
4. How does streaming work in App Router?
5. When would you choose a `route.ts` API endpoint over a Server Action?

## Answers

### 1. What problems does App Router solve that Pages Router struggled with?

The three concrete problems are colocated data fetching without waterfalls, per-segment streaming, and bundle-size reduction via server components. Pages Router collapsed data fetching to one lifecycle hook per page (`getServerSideProps` or `getStaticProps`), which forced every nested data dependency to be hoisted to the page level or moved to a client-side `useEffect`. App Router lets every server component `await` its own data and lets the framework parallelise sibling fetches, eliminating the waterfall. Pages Router rendered the whole page as one HTML response, which meant the server waited for the slowest data before flushing anything; App Router streams each `<Suspense>` boundary as its content resolves, so above-the-fold content reaches the wire before the slow boundaries finish. And Pages Router shipped every component to the browser as JavaScript; App Router keeps server components on the server, sending only the rendered output.

**How it works.** The App Router renders server components in a streaming-aware runtime that can suspend on data and emit the suspended fallback to the wire. As each promise resolves, the framework streams a continuation chunk that replaces the fallback in place, which the React client runtime applies seamlessly. The framework deduplicates `fetch` calls within a render so a `getUser(id)` call from two places resolves to one HTTP round-trip.

```tsx
// App Router: data fetching colocated, parallelised by the framework.
export default async function Dashboard({ userId }: { userId: string }) {
  const userPromise = getUser(userId);
  const projectsPromise = getProjects(userId);
  const [user, projects] = await Promise.all([userPromise, projectsPromise]);
  return <><Header user={user} /><ProjectList projects={projects} /></>;
}
```

**Trade-offs / when this fails.** The model requires the team to internalise the server/client split. A Pages Router developer who marks every component `"use client"` recreates the original problems and gains none of the wins. The streaming model also requires the host to support HTTP streaming, which is true of every modern Node.js or Edge runtime but can be a surprise for legacy platforms. See [Server vs Client Components](../03-react/04-server-vs-client.md) for the full conceptual coverage.

### 2. Walk me through the file conventions: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `route.ts`.

`page.tsx` defines the user interface for a route segment; the file's default export is the component rendered at the route's URL. `layout.tsx` wraps every child route under its segment and persists across navigations within that segment, so state inside the layout is preserved when the user navigates between sibling pages. `loading.tsx` is the Suspense fallback for the segment and everything below it; the framework wraps the segment in `<Suspense fallback={Loading}>` automatically. `error.tsx` is the Error Boundary for the segment and everything below it, and it must be a client component because it carries a `reset` callback that the user can invoke. `route.ts` defines REST handlers (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) for `/api/*`-style endpoints; the file replaces the Pages Router's `pages/api/*` convention.

**How it works.** The framework discovers files by name and assembles the route tree from them at build time. Each segment in the URL maps to a folder, and the special files in that folder define the segment's behaviour. The composition rule is "child files are wrapped by parent files": `app/dashboard/page.tsx` is rendered inside `app/dashboard/layout.tsx`, which is rendered inside `app/layout.tsx`, with `loading.tsx` and `error.tsx` providing the Suspense and error boundaries at each level.

```text
app/
├── layout.tsx           # wraps every route
├── page.tsx             # /
└── dashboard/
    ├── layout.tsx       # wraps /dashboard/*
    ├── page.tsx         # /dashboard
    ├── loading.tsx      # fallback for /dashboard subtree
    └── error.tsx        # boundary for /dashboard subtree
```

**Trade-offs / when this fails.** The convention is opinionated and learning it takes a couple of hours. The most common mistake is forgetting that `error.tsx` must be a client component (the file needs `"use client"` at the top) because it carries a callback. The convention also makes some advanced cases (intercepting routes, parallel routes) harder to discover; those are covered in [chapter 4.2](./02-layouts-routing.md).

### 3. When would you keep a route in `pages/` instead of moving it to `app/`?

Three situations justify keeping a route in Pages Router. A large, stable application where the migration Return on Investment is low — every route migration is engineering time that could be spent on features, and a stable Pages Router application is not broken. A dependency on a library that does not support React Server Components — increasingly rare but real for niche libraries that bundle global state, mutate the document at import time, or otherwise violate the serialisation contract. A static marketing site where `next export` from Pages Router is materially simpler than the App Router equivalent and the application has no need for the App Router's features.

**How it works.** Both routers can coexist in the same Next.js application. The framework matches App Router routes first; any URL that does not match falls through to Pages Router. The migration is therefore incremental: the team can move one route at a time from `pages/` to `app/` without a coordinated rewrite.

```text
app/about/page.tsx        # served at /about (App Router)
pages/legacy/[id].tsx     # served at /legacy/:id (Pages Router)
```

**Trade-offs / when this fails.** Maintaining both routers indefinitely is a tax — there are two mental models, two sets of conventions, two debugging patterns, and the team's React-best-practices document has to cover both. The pragmatic recommendation is to use the coexistence to migrate gradually, not as a permanent state. The pattern is wrong when a route is frequently modified and would benefit from the App Router's data-fetching ergonomics; the migration cost amortises quickly for hot routes.

### 4. How does streaming work in App Router?

The framework wraps each `<Suspense>` boundary (or `loading.tsx`) in a streaming render. When the server renders the route, it emits the parts of the response that have already resolved as soon as they are ready and emits a placeholder for the parts that are still suspended. As each suspended boundary resolves, the framework writes a continuation chunk to the response stream that replaces the placeholder in place. The client React runtime applies the continuations as they arrive, so the user sees the above-the-fold shell immediately and the slower content fills in as it resolves.

**How it works.** The streaming render relies on HTTP chunked transfer encoding to send multiple chunks of HTML before closing the response. The runtime emits the document, the rendered tree above the first `<Suspense>` boundary, an inline placeholder for each suspended region, and then an inline `<script>` that resolves each placeholder as its content streams in. The mechanism works in any modern Node.js or Edge runtime because it depends only on streaming HTTP responses and no special browser support.

```tsx
// Streams the header immediately; the slow Comments section streams when ready.
export default function Page({ id }: { id: string }) {
  return (
    <>
      <Header />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments postId={id} />
      </Suspense>
    </>
  );
}
```

**Trade-offs / when this fails.** Streaming requires the entire stack to support it: the host runtime, the proxy in front of the application, and the cache layer all must not buffer the response. CDN configurations that buffer for compression can defeat streaming silently; the cure is to verify the response is streaming end to end with a tool such as `curl --no-buffer`. The pattern also fails for routes where every piece of data must be present before the page makes sense (a dashboard whose header depends on the same fetch as its body); for those, awaiting upfront is the correct shape.

### 5. When would you choose a `route.ts` API endpoint over a Server Action?

`route.ts` is the right choice when the endpoint is consumed by clients that are not the Next.js application itself: a mobile application, a third-party integration, a cron job, a webhook receiver, an iframe in another origin. Server Actions are tightly coupled to the framework's form-action and React client integration, so using them as a public API surface gives up the standard HTTP semantics, the documentation tooling, and the integration patterns that consumers expect. `route.ts` is the right choice for streaming endpoints (Server-Sent Events, file downloads), for endpoints that need full control of HTTP headers (caching, content-type negotiation), and for any endpoint that benefits from a stable, framework-independent contract.

**How it works.** `route.ts` exports per-method handler functions (`GET`, `POST`, etc.) that receive a `Request` and return a `Response`. The handler is a standard Web Fetch handler, runs on the server (Node.js or Edge depending on configuration), and is fully under the developer's control. Server Actions are framework-managed RPC endpoints whose request and response shape is dictated by the framework; they are an internal detail that the framework can change between releases.

```ts
// app/api/webhook/route.ts — public, contract-driven endpoint.
export async function POST(req: Request) {
  const signature = req.headers.get("x-signature");
  if (!verify(signature, await req.text())) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  await processWebhook(await req.json());
  return Response.json({ ok: true });
}
```

**Trade-offs / when this fails.** Server Actions are usually the better choice for forms and mutations originating from the same Next.js application because they integrate with `useActionState`, progressive enhancement, and the framework's revalidation primitives. Choosing `route.ts` for those cases reintroduces hand-written serialisation, error handling, and the loss of progressive enhancement. The senior framing is "Server Actions for internal mutations from a Next.js client; `route.ts` for external API consumers".

## Further reading

- Next.js docs: [App Router fundamentals](https://nextjs.org/docs/app/building-your-application/routing).
- Lee Robinson, [Why we switched to App Router](https://leerob.io/blog/) blog series.
