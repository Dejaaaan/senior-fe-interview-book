---
title: "Next.js"
sidebar_label: "4. Next.js"
description: "App Router, Server Components, Server Actions, caching, middleware, and deployment for senior FE interviews."
sidebar_position: 3
---

Next.js is the default React metaframework in 2026 and the one most interviewers will ask about. The App Router is a substantial rethink of how routing, data fetching, and rendering work, and the model it introduces — server components by default, nested layouts, streaming via Suspense, multi-layer caching — is materially different from the Pages Router that preceded it.

This part covers the App Router as the default and mentions the Pages Router only where the contrast helps reason about the trade-offs. The chapters are sequential and are best read in order for a reader who has not yet shipped App Router code.

If preparing for a Vercel- or Next-heavy company, also read [Part 6 (Architecture)](../06-fe-architecture/index.md) and [Performance](../07-production-concerns/01-performance.md) — they are frequently asked alongside the Next.js material.

For React-side authentication patterns that complement the Next.js auth-integration chapter, see [Part 10 chapter 8: React client authentication](../10-auth/08-react-client.md).

## Chapters in this part

1. [App Router vs. Pages Router](./01-app-vs-pages.md) — what changed, what each is good at, why the App Router is the default.
2. [Layouts, routing, and special files](./02-layouts-routing.md) — file conventions, route groups, parallel and intercepting routes, the Metadata API.
3. [Data fetching & caching](./03-data-fetching-caching.md) — request memoisation, the data cache, the full route cache, the router cache, `revalidateTag`, `unstable_cache`.
4. [Server Actions](./04-server-actions.md) — form actions, `useFormStatus`, `useActionState`, optimistic UI for mutations.
5. [Middleware, Edge runtime, and image/font optimization](./05-middleware-edge.md) — request rewriting, Edge constraints, `next/image`, `next/font`.
6. [Auth integration](./06-auth-integration.md) — Auth.js, Clerk, and Cognito wired into the App Router.
7. [Deployment](./07-deployment.md) — Vercel, self-hosted Node with `output: "standalone"`, AWS via OpenNext.
