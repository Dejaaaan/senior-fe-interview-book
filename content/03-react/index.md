---
title: "Modern React"
sidebar_label: "3. Modern React"
description: "Mental model, hooks, Suspense, server components, state, forms, performance, and testing for senior FE interviews."
sidebar_position: 2
---

This is the most-asked part of the book. The chapters move from how React renders, through the subtleties of hooks, to concurrent features, server components, state strategies, forms, performance, and testing. Each chapter ends with the questions interviewers actually ask and detailed answers written at the depth a senior candidate would deliver under interview conditions.

If preparation time is short, read [Mental model](./01-mental-model.md) and [Hooks deep-dive](./02-hooks-deep-dive.md). Most senior React questions reduce to a misunderstanding from one of those two chapters: "why did this re-render?" reduces to the rendering mental model, and "why does this effect see stale state?" reduces to the closure semantics inside a hook.

For authentication patterns specific to a React client — token storage, the `useAuth` hook, route guards, the `fetch` wrapper with silent refresh, cross-tab logout, and pure-client OpenID Connect with Proof Key for Code Exchange — see [Part 10 chapter 8: React client authentication](../10-auth/08-react-client.md).

## Chapters in this part

1. [React mental model](./01-mental-model.md) — render, reconcile, commit, schedule.
2. [Hooks deep-dive](./02-hooks-deep-dive.md) — every built-in hook through React 19, with the closure pitfalls that drive the most interview questions.
3. [Suspense, Error Boundaries & concurrent rendering](./03-suspense-concurrent.md) — `<Suspense>`, error boundaries, `startTransition`, `useDeferredValue`, the `use(promise)` hook.
4. [Server vs. Client Components](./04-server-vs-client.md) — the boundary, when each runs, serialisation rules, and the senior pitfalls.
5. [State management](./05-state-management.md) — TanStack Query for server state, Zustand and Redux Toolkit for client state, when context is enough.
6. [Forms](./06-forms.md) — React Hook Form with Zod, Server Actions for submission, controlled vs uncontrolled trade-offs.
7. [Performance — first principles](./07-performance-intro.md) — when to memoise, when not to, virtualisation with TanStack Virtual, the React Compiler in 2026.
8. [Testing — first principles](./08-testing-intro.md) — Vitest with React Testing Library, Mock Service Worker for the network, the contract-first approach.
