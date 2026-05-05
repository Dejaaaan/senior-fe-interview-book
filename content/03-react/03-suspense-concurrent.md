---
title: "Suspense, Error Boundaries & concurrent rendering"
sidebar_label: "3.3 Suspense, Error Boundaries & concurrent rendering"
description: "Suspense for data, transitions, useDeferredValue, useOptimistic, and Error Boundaries."
sidebar_position: 3
---

The React 18 and later era is built on three primitives: **Suspense** (declaratively wait for something), **Error Boundaries** (declaratively catch failures), and **concurrent rendering** (interruptible work). Senior interviews expect the candidate to use them confidently and to articulate why each exists.

> **Acronyms used in this chapter.** API: Application Programming Interface. CDN: Content Delivery Network. DOM: Document Object Model. JSX: JavaScript XML. LCP: Largest Contentful Paint. RSC: React Server Components. SSR: Server-Side Rendering. UI: User Interface.

## Suspense: a render boundary for "not ready yet"

```tsx
<Suspense fallback={<Skeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

If anything inside the boundary throws a `Promise` — which is what happens when the component calls `use(somePromise)`, when it reads from a Suspense-aware data library (Relay, TanStack Query with `suspense: true`), or when a `lazy()`-imported chunk has not yet loaded — React displays the fallback instead of crashing.

This collapses three previously distinct patterns into one declarative boundary. Loading skeletons (the spinner shown while data fetches) and code-splitting placeholders (the loading state shown while a route's bundle downloads) and the coordination of N concurrent data dependencies into a single "wait for everything below" boundary all become the same `<Suspense fallback>` declaration.

```tsx
const Settings = lazy(() => import("./Settings"));

<Suspense fallback={<Spinner />}>
  <Settings />
</Suspense>
```

### Streaming Server-Side Rendering

In Next.js and any other React Server Components (RSC) framework, Suspense doubles as a **streaming boundary**. The server emits the fallback HyperText Markup Language (HTML) immediately, then streams the resolved content when the data resolves. This produces a fast Largest Contentful Paint (LCP) without sacrificing dynamic data, because the shell of the page is already on the wire while the slower data finishes computing.

## Error Boundaries

Suspense handles "not ready". Error Boundaries handle "broken". They catch exceptions thrown during render, in lifecycle methods, and in constructors of the children below them.

```tsx
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: info });
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
```

In a real codebase, use `react-error-boundary` (a functional application programming interface that adds reset-on-dependency-change semantics) instead of writing the class yourself; the manual implementation above is for whiteboard reference.

Error Boundaries do not catch every kind of failure. Three categories slip through and must be handled explicitly: errors in event handlers (use `try/catch` inside the handler), errors in asynchronous code (handle the `Promise` rejection — the runtime never reports it to React), and errors during legacy Server-Side Rendering (in RSC frameworks the framework handles SSR errors with its own boundary primitives).

## Concurrent rendering and `startTransition`

The central idea is that **not all renders are equally urgent**. Typing into an input is urgent because the user expects to see their keystroke immediately. Filtering a fifty-thousand-row list to match the input is not — the user does not notice if the list updates one frame later, and a hundred-millisecond block on the input is far worse than a hundred-millisecond delay on the list.

`startTransition` marks a state update as low-priority. The React runtime can interrupt the resulting render for higher-priority work and can discard the partial render entirely if newer state arrives, which is the property that keeps the input responsive even when the consequent filter render is heavy.

```tsx
import { useState, useTransition } from "react";

function SearchableList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(items);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    setQuery(next); // urgent
    startTransition(() => {
      setResults(items.filter((i) => i.title.includes(next))); // can be interrupted
    });
  }

  return (
    <>
      <input value={query} onChange={(e) => handleChange(e.target.value)} />
      {isPending && <small>Updating…</small>}
      <List items={results} />
    </>
  );
}
```

The benefit is real on slow devices: the input never feels janky because the filter render can be paused.

## `useDeferredValue`

A simpler API: pass a value, get a deferred version. React renders with the latest immediately and re-renders with the new value when it can.

```tsx
function ResultsPanel({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  // expensive computation uses the deferred value
  const results = useMemo(() => search(deferredQuery), [deferredQuery]);
  return <Results items={results} stale={query !== deferredQuery} />;
}
```

When to use which:

- `startTransition` when **you control the state update** that triggers expensive work.
- `useDeferredValue` when you **receive a prop** and want to defer the expensive render that depends on it.

## `useOptimistic`

In React 19, `useOptimistic` lets you update the UI before the server confirms, with automatic rollback on failure (when the action throws).

```tsx
"use client";
import { useOptimistic } from "react";
import { addLikeAction } from "./actions";

export function LikeButton({ post }: { post: Post }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    post.likes,
    (state, _delta: number) => state + 1,
  );

  return (
    <form action={async () => {
      addOptimisticLike(1);
      await addLikeAction(post.id);
    }}>
      <button type="submit">{optimisticLikes} ❤</button>
    </form>
  );
}
```

The optimistic value is automatically reverted if the action throws or the server returns different data on revalidation.

## `<Suspense>` ordering and waterfalls

The pitfall is that nested `<Suspense>` boundaries with sequential `await`s in the data path create a waterfall. Each child only starts its fetch after the parent has resolved, even though the requests are independent and could run in parallel.

```tsx
// BAD: user loads, then posts loads, then comments loads
<Suspense fallback={<S/>}>
  <User userId={id}>
    <Suspense fallback={<S/>}>
      <Posts userId={id}>
        <Suspense fallback={<S/>}>
          <Comments />
        </Suspense>
      </Posts>
    </Suspense>
  </User>
</Suspense>
```

The fix is to **start all the requests in parallel**, then suspend on the results:

```tsx
const userPromise = getUser(id);
const postsPromise = getPosts(id);
const commentsPromise = getComments(id);

return (
  <>
    <Suspense fallback={<S/>}>
      <User promise={userPromise} />
    </Suspense>
    <Suspense fallback={<S/>}>
      <Posts promise={postsPromise} />
    </Suspense>
    <Suspense fallback={<S/>}>
      <Comments promise={commentsPromise} />
    </Suspense>
  </>
);
```

In Next.js App Router, kicking off fetches in parallel at the top of a server component is the standard pattern.

## Key takeaways

- `<Suspense fallback>` declaratively waits for code (`lazy`), data (Suspense-aware libs), and streamed content.
- Error Boundaries catch render errors only; handle event handler and async errors yourself.
- `startTransition` and `useDeferredValue` make heavy renders interruptible — use them on real perf hot spots, not everywhere.
- `useOptimistic` updates the UI before the server confirms and reverts on failure.
- Avoid Suspense waterfalls by kicking off requests in parallel, then suspending in siblings.

## Common interview questions

1. What does Suspense actually do? What does the child throw?
2. When does an Error Boundary fail to catch an error?
3. What is the difference between `startTransition` and `useDeferredValue`?
4. Walk me through fixing a waterfall caused by nested Suspense.
5. What does `useOptimistic` give you that you could not easily build with `useState`?

## Answers

### 1. What does Suspense actually do? What does the child throw?

A `<Suspense>` boundary catches a thrown `Promise` from any descendant during render and displays its `fallback` until the `Promise` resolves. The child throws by calling `use(promise)` from React 19, by reading from a Suspense-aware data library that throws internally, or by being a `lazy()`-imported component whose chunk has not yet loaded. The runtime catches the thrown `Promise`, registers a continuation that re-renders the subtree when the `Promise` settles, and meanwhile shows the fallback.

**How it works.** During render, React walks the tree and invokes each component function. If a component throws a `Promise`, React unwinds back to the nearest `<Suspense>` boundary, marks the boundary as suspended, and renders the fallback in place of the boundary's children. When the `Promise` resolves, React schedules a retry of the suspended subtree. The mechanism is what lets data fetching, code splitting, and progressive hydration share one declarative API.

```tsx
function UserName({ promise }: { promise: Promise<User> }) {
  const user = use(promise); // throws the promise until it resolves
  return <span>{user.name}</span>;
}

<Suspense fallback={<Spinner />}>
  <UserName promise={getUserPromise(id)} />
</Suspense>
```

**Trade-offs / when this fails.** The thrown-`Promise` mechanism is an internal contract — application code rarely throws a `Promise` directly; it calls `use()` or a library helper. The fallback flickers if the resolution is fast, which is why frameworks add a small fade-in delay; if the data is already cached, React swaps to the children synchronously without showing the fallback at all. The boundary catches one suspension at a time, so a deep nest of suspending children produces a single fallback unless additional `<Suspense>` boundaries are introduced inside.

### 2. When does an Error Boundary fail to catch an error?

Error Boundaries catch synchronous errors thrown during render, in lifecycle methods, and in constructors of their descendants. They do not catch four categories: errors inside event handlers (the handler runs outside the render cycle), errors inside asynchronous callbacks such as `setTimeout` or a `fetch` `.then` (the runtime never reports them to React), errors during legacy Server-Side Rendering (the boundary is bypassed; in modern RSC frameworks the framework handles its own boundary), and errors thrown inside the boundary itself (the boundary cannot catch its own error).

**How it works.** React installs an internal `try/catch` around each render of each fiber. When a render throws synchronously, React unwinds to the nearest Error Boundary and renders its fallback. Event handlers run outside that `try/catch` because they are user-driven and may run long after the render completed; the runtime cannot wrap them without changing their semantics. Asynchronous callbacks similarly escape the boundary because the call stack at the time the callback throws does not pass through React.

```tsx
async function handleClick() {
  try {
    await api.delete(id); // not caught by an Error Boundary
  } catch (err) {
    setError(err);        // surface it to the UI manually
  }
}
```

**Trade-offs / when this fails.** The standard pattern is to combine an Error Boundary for render-time errors with explicit `try/catch` (or `mutation.onError`) for asynchronous errors, plus a global `window.addEventListener("unhandledrejection", ...)` that ships unhandled rejections to monitoring. The boundary is necessary but not sufficient; the asynchronous-error path requires every call site to opt in.

### 3. What is the difference between `startTransition` and `useDeferredValue`?

`startTransition` lets the component author mark a state update as non-urgent — it is the right tool when the component owns the state that triggers expensive work. `useDeferredValue` accepts a value (typically a prop) and returns a deferred copy of it that lags behind the latest value during expensive renders — it is the right tool when the component receives a prop and wants to defer the expensive computation that depends on it. The two cover the same need from opposite directions: state-owner versus state-consumer.

**How it works.** Both APIs put the consequent render at transition priority, which the runtime can interrupt for urgent updates and discard if newer state arrives. `startTransition` requires the call site to wrap the `setState` call: `startTransition(() => setResults(filter(q)))`. `useDeferredValue` returns a deferred snapshot the consumer can use: `const dq = useDeferredValue(query); const results = useMemo(() => filter(dq), [dq])`. The first is imperative; the second is declarative.

```tsx
// startTransition: the owner of the state opts in.
const [results, setResults] = useState<Result[]>([]);
function onChange(q: string) {
  startTransition(() => setResults(filter(q)));
}

// useDeferredValue: the consumer of a prop opts in.
function ResultsPanel({ query }: { query: string }) {
  const dq = useDeferredValue(query);
  return <Results items={useMemo(() => filter(dq), [dq])} />;
}
```

**Trade-offs / when this fails.** Neither API makes the work cheaper; both make it interruptible. If the consequent render still costs a hundred milliseconds and runs once per keystroke, the page will still feel slow even though the input echoes promptly. The complementary technique is to make the work itself cheaper through memoisation, virtualisation, or moving the computation off the main thread. The pattern fails for updates observably tied to user input (drag-and-drop, pointer-driven animation), which should remain at default priority.

### 4. Walk me through fixing a waterfall caused by nested Suspense.

The waterfall occurs when the data fetches are triggered inside the children of nested `<Suspense>` boundaries: the outer child fetches, suspends, resolves, then the next child mounts and fetches, suspends, resolves, and so on. Each fetch only starts after its parent has resolved, even though the fetches are independent. The fix is to start every fetch in parallel at the top of the tree and pass the resulting `Promise`s down to the children, so the children only suspend on values whose requests are already in flight.

**How it works.** A `Promise` created at the top of a server component (or in a parent client component) starts immediately when the component renders. Each `<Suspense>` child receives the `Promise` as a prop and calls `use(promise)`; the runtime suspends each child independently on its own promise, and the children resolve and reveal in parallel as their respective promises settle.

```tsx
// Top of the tree: kick off every request before awaiting any.
const userPromise = getUser(id);
const postsPromise = getPosts(id);
const commentsPromise = getComments(id);

return (
  <>
    <Suspense fallback={<Skeleton />}><User promise={userPromise} /></Suspense>
    <Suspense fallback={<Skeleton />}><Posts promise={postsPromise} /></Suspense>
    <Suspense fallback={<Skeleton />}><Comments promise={commentsPromise} /></Suspense>
  </>
);
```

**Trade-offs / when this fails.** The pattern requires the parent to know which fetches the children will need, which is a form of coupling. For server components that pattern is the framework default; for deeply nested client component trees, a server-state library such as TanStack Query with `prefetchQuery` is the maintainable answer. The pattern is wrong when the child fetches genuinely depend on the parent's resolved data (the child fetches `/users/{userId}/posts` where `userId` only appears after the user fetch); in that case the waterfall is intrinsic and the right mitigation is to issue the dependent fetch on the server side as a single combined call.

### 5. What does `useOptimistic` give you that you could not easily build with `useState`?

`useOptimistic` gives an automatic-revert-on-action-failure semantic that a hand-rolled `useState` cannot easily provide. The hook returns an optimistic snapshot of the state plus a function that updates the snapshot for the duration of an in-flight Server Action; when the action completes, React replaces the snapshot with the canonical state from the action's return value or revalidation, and on failure it reverts to the canonical state automatically. Building the same with `useState` requires the developer to track the action's lifecycle and remember to revert in the failure path, which is a substantial source of bugs.

**How it works.** The hook integrates with React 19's action lifecycle. The first argument is the canonical state (typically the data passed in as a prop); the second is a reducer that produces the optimistic state from the canonical state plus the optimistic input. While an action is pending, `useOptimistic` returns the reducer's output; once the action settles, the snapshot is discarded and the canonical state is shown.

```tsx
const [optimisticLikes, addOptimisticLike] = useOptimistic(
  post.likes,
  (state, _delta: number) => state + 1,
);

<form action={async () => {
  addOptimisticLike(1);              // optimistic snapshot becomes post.likes + 1
  await addLikeAction(post.id);      // server action runs; on success a revalidation refreshes post
}}>
  <button type="submit">{optimisticLikes} ❤</button>
</form>
```

**Trade-offs / when this fails.** The hook is designed for Server Actions and React 19's action lifecycle; using it with hand-rolled `fetch` requires wrapping the call in `useTransition`, which loses some of the hook's elegance. The hook also only handles single-action optimism — for a user who clicks "like" five times rapidly, the optimistic counter shows the partial count of acknowledged actions, not the full client-side count. For high-velocity actions, a client-side accumulator combined with a debounced server send is the right pattern; `useOptimistic` is the right tool for a single action with a single visible side effect.

## Further reading

- React docs: [Suspense](https://react.dev/reference/react/Suspense), [`useTransition`](https://react.dev/reference/react/useTransition), [`useOptimistic`](https://react.dev/reference/react/useOptimistic).
- Dan Abramov, ["A New Mental Model for React 18"](https://github.com/reactwg/react-18/discussions/27).
