---
title: "Layouts, routing, and special files"
sidebar_label: "4.2 Layouts, routing, and special files"
description: "Nested layouts, loading and error UI, parallel and intercepting routes, route groups."
sidebar_position: 2
---

The App Router uses the file system as the source of truth for routing. Senior interviews probe whether the candidate has internalised the conventions and knows which one to reach for in a given situation.

> **Acronyms used in this chapter.** API: Application Programming Interface. CSS: Cascading Style Sheets. HTML: HyperText Markup Language. LCP: Largest Contentful Paint. SEO: Search Engine Optimisation. UI: User Interface. URL: Uniform Resource Locator.

## The minimum: a root layout and a page

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// app/page.tsx
export default function HomePage() {
  return <h1>Welcome</h1>;
}
```

The root layout **must** include `<html>` and `<body>`. Layouts persist across navigations within their segment — state inside them survives. Pages do not.

## Nested layouts

A layout wraps every route under it. Layouts compose cleanly:

```tsx
// app/(app)/layout.tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_1fr]">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}

// app/(app)/dashboard/layout.tsx
export default function DashboardLayout({ children, modal }: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      <DashboardHeader />
      {children}
      {modal}
    </>
  );
}
```

Navigating from `/dashboard/projects` to `/dashboard/settings` re-renders only the page, not the layouts above it.

## `loading.tsx` and Suspense

A `loading.tsx` is a shorthand for wrapping the segment in `<Suspense>`.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />;
}
```

When the route segment is fetching data on the server, the framework streams the loading UI immediately and then streams the real content when ready. This is the cleanest way to get good LCP without sacrificing dynamic data.

## `error.tsx` and `not-found.tsx`

```tsx
// app/dashboard/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

```tsx
// app/dashboard/not-found.tsx
export default function NotFound() {
  return <p>This dashboard does not exist.</p>;
}
```

Trigger 404s from server components with `notFound()`:

```tsx
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { id: string } }) {
  const post = await db.post.find(params.id);
  if (!post) notFound();
  return <Article post={post} />;
}
```

## Route groups: `(group)/`

Wrap a folder name in parentheses to keep it out of the URL while still applying its layout. Useful for splitting auth'd vs. unauth'd sections, or marketing vs. app:

```text
app/
├── (marketing)/
│   ├── layout.tsx
│   ├── page.tsx        # /
│   └── pricing/page.tsx
└── (app)/
    ├── layout.tsx
    ├── dashboard/page.tsx
    └── settings/page.tsx
```

## Parallel routes: `@slot/`

A folder prefixed with `@` becomes a slot the parent layout receives as a prop. Useful for dashboards with independently-loading regions or modal overlays.

```text
app/dashboard/
├── @analytics/page.tsx
├── @team/page.tsx
└── layout.tsx
```

```tsx
export default function Layout({
  analytics, team, children,
}: { analytics: React.ReactNode; team: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <main>{children}</main>
      <aside>{analytics}{team}</aside>
    </>
  );
}
```

Each slot can stream and error independently.

## Intercepting routes: `(.)foo`

Intercepting routes let you render the same URL differently depending on whether the user navigated *into* it or refreshed. The classic use case: opening a photo as a modal in-place but rendering as a full page on refresh.

```text
app/
├── feed/page.tsx
├── photos/[id]/page.tsx              # full page on refresh
└── feed/(..)photos/[id]/page.tsx     # intercepted modal when navigating from feed
```

The `(..)` prefix means "match a sibling segment one level up". `(.)` is same level, `(...)` is from the root.

## Dynamic segments

```text
app/posts/[id]/page.tsx                # /posts/123
app/shop/[...slug]/page.tsx            # /shop/a, /shop/a/b/c (catch-all)
app/docs/[[...slug]]/page.tsx          # also matches /docs (optional catch-all)
```

```tsx
export default function Page({ params }: { params: { id: string } }) {
  return <p>Post {params.id}</p>;
}
```

In Next.js 15+, `params` is a promise; `await` it (the framework's lint rule will surface this).

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

## Linking and navigation

```tsx
import Link from "next/link";

<Link href="/posts/123" prefetch={true}>Read</Link>
```

For programmatic navigation:

```tsx
"use client";
import { useRouter } from "next/navigation";

const router = useRouter();
router.push("/dashboard");
router.refresh();    // re-fetches the current route's server data
```

`router.refresh()` is the senior-knowledge bit: it tells the framework to re-fetch the server payload for the current route without losing client state.

## Metadata API

Each page can export `metadata` (static) or `generateMetadata` (dynamic) for SEO and social previews.

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your projects",
  openGraph: { images: ["/og-dashboard.png"] },
};

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.id);
  return { title: post.title };
}
```

## Key takeaways

- Layouts persist across navigations within their segment, so any state held inside a layout — such as a sidebar's scroll position or a `useState`-backed toggle — survives the navigation; pages, by contrast, are remounted on each navigation.
- `loading.tsx` and `error.tsx` are `<Suspense>` and an Error Boundary in convention form; the framework wraps the segment automatically and the developer never writes the boundary explicitly.
- Route groups in the form `(name)` add a layout without contributing a URL segment, which is the cleanest way to split a marketing surface from an authenticated application surface.
- Parallel routes in the form `@slot` give the parent layout independently-streaming regions, each with its own loading and error boundaries.
- Intercepting routes in the form `(.)foo`, `(..)foo`, or `(...)foo` enable in-place modals that fall back to a full page when the URL is refreshed, which is the canonical pattern for image lightboxes and detail panes.
- `router.refresh()` re-runs the route's server components and applies the new payload to the existing client tree, preserving every piece of client state — input values, scroll positions, focus.
- Per-route Search Engine Optimisation metadata is exported from the page as either a static `metadata` object or a `generateMetadata` async function.

## Common interview questions

1. What's the difference between `app/dashboard/page.tsx` and `app/dashboard/layout.tsx`?
2. When would you use parallel routes? Intercepting routes?
3. How does `loading.tsx` interact with Suspense and streaming?
4. What does `router.refresh()` do that `router.push` doesn't?
5. Where do you set per-page SEO metadata in App Router?

## Answers

### 1. What's the difference between `app/dashboard/page.tsx` and `app/dashboard/layout.tsx`?

`page.tsx` is the leaf user interface for the `/dashboard` URL — it renders only when the URL matches that route and is unmounted when the user navigates to a sibling. `layout.tsx` wraps every child route under `/dashboard/*` and persists across navigations within that subtree, so the layout's component tree is mounted once when the user enters the segment and stays mounted as the user moves between sibling pages.

**How it works.** The framework composes the route by walking the URL one segment at a time and assembling each segment's `layout.tsx` (if present) around its `page.tsx` (or its child segments). When the URL changes, the framework diffs the new route against the old one and unmounts only the parts that have changed; layouts shared between the old and new routes stay mounted, preserving any state they hold.

```tsx
// app/dashboard/layout.tsx — mounted once, holds shared state.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <DashboardHeader /> {/* state inside this header survives navigation */}
      <main>{children}</main>
    </div>
  );
}
```

**Trade-offs / when this fails.** Putting state inside a `page.tsx` that should survive navigation is a common mistake; the cure is to lift the state into the surrounding layout. The opposite mistake — putting heavy data fetching in a layout that should rerun on each navigation — silently caches the wrong data; the cure is to fetch in the page or in a per-page server component.

### 2. When would you use parallel routes? Intercepting routes?

Parallel routes are the right choice when the page has multiple independently-loading regions that should stream and error in isolation. The canonical example is a dashboard whose header, analytics widget, and team panel all fetch from different services and have different latency profiles; using parallel routes lets each region stream as soon as its data is ready and surface its own error boundary if its service is down.

Intercepting routes are the right choice when a URL should render differently depending on whether the user navigated *into* it or refreshed the page. The canonical example is a photo viewer: clicking a thumbnail in a feed should open the photo as a modal overlay (preserving the feed underneath), but pasting the same URL or refreshing should render the photo as a full page.

**How it works.** Parallel routes pass each `@slot` folder to the layout as a prop, so the layout receives `{ children, analytics, team }` and can place each region in its own `<Suspense>` and `<ErrorBoundary>`. Intercepting routes match the same URL twice — once via the intercepted path (used during navigation) and once via the canonical path (used on refresh) — and the framework picks the right one based on navigation state.

```text
app/dashboard/
├── @analytics/page.tsx      # parallel route slot
├── @team/page.tsx           # parallel route slot
└── layout.tsx               # receives { children, analytics, team }
```

**Trade-offs / when this fails.** Parallel routes add navigation complexity; the framework needs `default.tsx` files for slots that have no match for some routes, which is easy to forget and produces confusing 404s. Intercepting routes are conceptually subtle and the file-system convention (`(.)`, `(..)`, `(...)`) is hard to discover; teams often skip them and ship a custom modal component instead, accepting that refresh loses the open photo. Both features are powerful but should be reached for only when their specific shape is needed.

### 3. How does `loading.tsx` interact with Suspense and streaming?

`loading.tsx` is sugar for wrapping the segment's children in `<Suspense fallback={Loading}>`. When the segment's server components are awaiting data, the framework streams the loading UI immediately and replaces it with the real content as the data resolves. The developer never writes the `<Suspense>` explicitly; the framework infers it from the file's presence.

**How it works.** The streaming render emits the response in chunks. When the renderer encounters a suspended boundary, it emits the fallback inline and continues rendering the rest of the document. As each suspended component resolves, the renderer streams a continuation chunk that the client React runtime applies in place of the fallback. The mechanism produces a fast First Contentful Paint and a fast Largest Contentful Paint without sacrificing the dynamic data, because the user sees the shell immediately and the slow content fills in.

```tsx
// app/dashboard/loading.tsx — automatically becomes the Suspense fallback.
export default function Loading() {
  return <DashboardSkeleton />;
}

// app/dashboard/page.tsx — slow data triggers the fallback.
export default async function Page() {
  const data = await slowFetch(); // suspends; framework streams the skeleton first
  return <Dashboard data={data} />;
}
```

**Trade-offs / when this fails.** The pattern relies on the entire stack supporting HTTP streaming end to end. A proxy or Content Delivery Node configuration that buffers the response for compression silently defeats streaming; the cure is to verify with `curl --no-buffer` that chunks arrive incrementally. The pattern also fails when every part of the page depends on the same data — there is nothing to stream — in which case awaiting upfront is the correct shape.

### 4. What does `router.refresh()` do that `router.push` doesn't?

`router.refresh()` re-runs the current route's server components and applies the new payload to the existing client tree, preserving every piece of client state — input values, focus, scroll positions, the contents of any `useState`-backed component. `router.push` navigates to a new URL, which unmounts the current page and mounts the new one, losing client state on the old page.

**How it works.** When `router.refresh()` is called, the framework requests a fresh React Server Components payload for the current URL, applies the new payload to the existing client tree using React's reconciliation, and the user sees updated data without a navigation. Because the client tree is reconciled rather than remounted, every client component that has not changed its props or position keeps its local state.

```tsx
// After a Server Action mutates data, refresh the route to re-fetch
// without losing the user's scroll position or open dropdown.
"use client";
import { useRouter } from "next/navigation";

const router = useRouter();
async function handleSave() {
  await saveAction(formData);
  router.refresh();
}
```

**Trade-offs / when this fails.** `router.refresh()` only refreshes the current route — sibling layouts above the current segment are not re-fetched. If the mutation affects data shown in a parent layout, the layout will not pick up the change until a hard navigation. The cure is to call `revalidatePath` from the Server Action with the path of the parent that needs refreshing.

### 5. Where do you set per-page SEO metadata in App Router?

Per-page Search Engine Optimisation metadata is exported directly from the route's page or layout file. Static metadata is exported as a `metadata` constant of type `Metadata`; dynamic metadata that depends on the route's data is exported as an async `generateMetadata` function that receives the same `params` object the page receives.

**How it works.** The framework calls `generateMetadata` (or reads the static `metadata`) during render and merges the result into the `<head>` of the response. Layouts can also export metadata, which is merged with descendant page metadata; the page-level value wins on conflict. The metadata covers `title`, `description`, OpenGraph fields, Twitter cards, robots directives, canonical URLs, and language alternates.

```tsx
// app/posts/[id]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
    alternates: { canonical: `/posts/${id}` },
  };
}
```

**Trade-offs / when this fails.** `generateMetadata` runs on every request to a dynamic route, which means slow upstream calls slow the whole response. The cure is to share the data fetch between `generateMetadata` and the page component using the framework's `fetch` deduplication (the same `getPost(id)` call from both places resolves to one upstream call). The pattern fails for pages that need browser-only metadata (such as the user's currently-selected language); for those, the metadata must be set on the server based on the request's `Accept-Language` header.

## Further reading

- Next.js: [Routing fundamentals](https://nextjs.org/docs/app/building-your-application/routing), [Parallel & intercepting routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes).
