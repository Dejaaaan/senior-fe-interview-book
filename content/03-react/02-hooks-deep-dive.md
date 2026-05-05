---
title: "Hooks deep-dive"
sidebar_label: "3.2 Hooks deep-dive"
description: "useState, useEffect pitfalls, useReducer, useMemo/useCallback, useRef, custom hooks — with the senior-level subtleties."
sidebar_position: 2
---

Hooks are where most senior React confusion lives. The rules are simple — call them at the top level, in the same order every render. The subtleties of how the runtime treats them are not, and they are the source of the largest single category of senior interview questions.

> **Acronyms used in this chapter.** API: Application Programming Interface. CPU: Central Processing Unit. DOM: Document Object Model. JS: JavaScript. JSON: JavaScript Object Notation. RSC: React Server Components. SSR: Server-Side Rendering. UI: User Interface.

## `useState`: snapshots, not variables

State setters take either the next value or an updater function. Always prefer the updater when the next value depends on the previous one.

```tsx
const [count, setCount] = useState(0);

function increment() {
  setCount(count + 1);     // BAD: stale if called twice in a row
  setCount(count + 1);     // count was captured at render time
  // result: +1, not +2

  setCount((c) => c + 1);  // OK: always sees the latest
  setCount((c) => c + 1);
  // result: +2
}
```

Function form is mandatory whenever you `setState` inside an effect, async callback, or any context where the value might be stale.

### Initial value: lazy form for expensive computation

```tsx
const [grid] = useState(() => buildExpensiveGrid()); // runs once
```

Without the function wrapper, `buildExpensiveGrid()` runs every render — even though only the first result is used.

## `useEffect`: the four common bugs

The four bug categories below cover the substantial majority of `useEffect` issues that reach production. Each has a deterministic fix; recognising the category is the senior signal.

### 1. Missing dependencies

The lint rule `react-hooks/exhaustive-deps` exists for a reason. Effects must declare every value they read so that the runtime can re-run them when those values change.

```tsx
useEffect(() => {
  fetch(`/api/users/${userId}`).then(/* ... */);
}, []); // BAD: stale userId after re-render

useEffect(() => {
  fetch(`/api/users/${userId}`).then(/* ... */);
}, [userId]); // OK:
```

### 2. Effects that should be derived state

If the effect's only job is to compute B from A, it shouldn't be an effect.

```tsx
// BAD: extra render
const [count, setCount] = useState(items.length);
useEffect(() => setCount(items.length), [items]);

// OK: no effect, no extra render
const count = items.length;
```

### 3. Effects that should be event handlers

If the work happens in response to a user event, do it in the handler.

```tsx
// BAD: runs on every render where `submitted` flips to true
useEffect(() => {
  if (submitted) sendAnalytics(form);
}, [submitted, form]);

// OK: run when the user clicks
function handleSubmit() {
  sendAnalytics(form);
  setSubmitted(true);
}
```

### 4. Race conditions on async fetches

```tsx
useEffect(() => {
  let cancelled = false;
  fetch(`/api/users/${userId}`)
    .then((r) => r.json())
    .then((data) => { if (!cancelled) setUser(data); });
  return () => { cancelled = true; };
}, [userId]);
```

Or, modern style with `AbortController`:

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => { if (e.name !== "AbortError") throw e; });
  return () => controller.abort();
}, [userId]);
```

## `useReducer` for complex state

Reach for `useReducer` when:

- State updates depend on multiple sub-fields atomically.
- The same state is updated from many places (the reducer becomes the spec).
- You want time-travel debugging (Redux DevTools work with `useReducer` via middleware).

```tsx
type State = { items: Item[]; status: "idle" | "loading" | "error" };
type Action =
  | { type: "load" }
  | { type: "loaded"; items: Item[] }
  | { type: "error" }
  | { type: "remove"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load": return { ...state, status: "loading" };
    case "loaded": return { items: action.items, status: "idle" };
    case "error": return { ...state, status: "error" };
    case "remove": return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}

const [state, dispatch] = useReducer(reducer, { items: [], status: "idle" });
```

## `useMemo` and `useCallback`: when **not** to use them

Both hooks pay a cost: they keep references on the fiber and run an equality comparison on every render. Most components do not benefit, and indiscriminate use can make a profile *slower* than the unmemoised baseline.

Reach for memoisation when one of the two conditions holds. The first is that the memoised value is expensive to compute — sorting a large array, parsing a large string, building a large lookup table — and it depends on inputs that change less often than every render. The second is that the memoised value is passed to a memoised child (a component wrapped in `React.memo`) or used as a dependency in another hook, and reference identity matters: a fresh array literal on every render defeats `React.memo`'s shallow-equality check.

Avoid memoisation in three specific cases. For primitive return values (`useMemo(() => prop * 2, [prop])`) the cache lookup costs more than the multiplication; compute the value inline. For "just in case" memoisation that is not justified by a profile or a downstream `React.memo`, the only effect is to add ceremony to the call site. For inline JSX in a function body — the React Compiler will memoise this automatically in 2026; before adopting the compiler, restrict manual memoisation to hot paths identified by the profiler.

```tsx
const sorted = useMemo(
  () => items.slice().sort((a, b) => a.priority - b.priority),
  [items],
);

const handleAdd = useCallback((id: string) => {
  setItems((prev) => [...prev, { id, priority: 0 }]);
}, []);
```

## `useRef` is a mutable box that doesn't trigger renders

Two distinct uses:

1. **A reference to a DOM node**:

   ```tsx
   const inputRef = useRef<HTMLInputElement | null>(null);
   useEffect(() => inputRef.current?.focus(), []);
   return <input ref={inputRef} />;
   ```

2. **Any mutable value you don't want to trigger a render**:

   ```tsx
   const lastSent = useRef(0);
   function send() {
     if (Date.now() - lastSent.current < 1000) return; // throttle
     lastSent.current = Date.now();
     api.send();
   }
   ```

Reading `ref.current` during render and using the result in JSX is a bug: refs are not reactive, so the user interface will not update when the ref changes. The reactive equivalent is `useState`; the non-reactive escape hatch is `useRef`.

## `useId` for Server-Side-Rendering-safe identifiers

Generating identifiers with `Math.random()` produces a different value on the server than on the client, which causes a hydration mismatch and a noisy console error. `useId` returns a stable identifier that is identical on server and client.

```tsx
function Field({ label }: { label: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} />
    </>
  );
}
```

## Custom hooks are function composition

A custom hook is a function whose name starts with `use` and which calls other hooks. That is the entire specification. Custom hooks are how the codebase shares **logic** between components, not how it shares **state** — each call site receives its own state instance.

```tsx
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

Two custom hooks called from two different components do not share state; each receives its own state instance. This is by design — sharing state across components is the job of context, a state-management library, or a parent component, not of a custom hook.

## `useSyncExternalStore` for external state

When subscribing to something React does not own — browser history, `document.title`, a Zustand store, a Web Worker channel — use `useSyncExternalStore` so concurrent rendering reads a consistent snapshot of the external state across the whole render. Without it, an external store that changes during a concurrent render can produce a torn read in which different parts of the tree see different values.

```tsx
const onlineStatus = useSyncExternalStore(
  (callback) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  },
  () => navigator.onLine,
  () => true, // SSR snapshot
);
```

## The React 19 hooks at a glance

React 19 added four hooks that target the Server Components and Server Actions surface. Each is short to learn but adds substantial expressive power for forms and asynchronous operations:

- **`use(promise)`** unwraps a `Promise` inside a component body and integrates with Suspense. The component suspends while the promise is pending and renders with the resolved value when it settles. The hook also unwraps Context, replacing `useContext` in the modern style.
- **`useOptimistic(state, reducer)`** returns an optimistic value derived from the current state plus a pending action. The optimistic value is shown immediately while the action is in flight and reverts to the canonical state if the action fails. This is the primitive behind "the comment appears immediately on submit, then disappears if the request fails".
- **`useFormStatus()`** reads the pending, data, and error state of the parent `<form>` driven by a Server Action. The hook lets a submit button display a spinner without lifting state to the form's parent.
- **`useActionState(action, initial)`** is `useReducer` for Server Actions: it returns the current state, a wrapped action that updates it, and a pending flag. The pattern fits form-style flows where the action returns the next state directly.

These hooks are covered in detail in [Server vs Client Components](./04-server-vs-client.md) and in the Next.js part.

## Key takeaways

- Use the **updater form** of `setState` when the next value depends on the previous.
- Most "useEffect bugs" reduce to: missed dep, effect that should be derived state, or effect that should be a handler.
- `useMemo` / `useCallback` cost something — only reach for them on real hot paths.
- `useRef` is for mutable values that should **not** cause renders, plus DOM refs.
- `useId` for SSR-safe IDs; `useSyncExternalStore` for subscriptions to external state.
- Custom hooks share **logic**, not state — each call gets its own state.

## Common interview questions

1. Why is `setCount(count + 1)` called twice not the same as `setCount(c => c + 1)` called twice?
2. Walk me through a race condition in a `useEffect` fetch and how to fix it.
3. When would you reach for `useReducer` over `useState`?
4. Give an example of a `useMemo` that is actively harmful.
5. What does `useSyncExternalStore` exist for? When did it become important?

## Answers

### 1. Why is `setCount(count + 1)` called twice not the same as `setCount(c => c + 1)` called twice?

`setCount(count + 1)` captures the value of `count` from the render in which the call is made. The second call captures the same value, because both happen synchronously inside the same render cycle and `count` does not change during a render. The result is that React enqueues two updates, both of which set the next state to `count + 1`, and the next render sees `count + 1` once rather than twice. The updater form `setCount(c => c + 1)` queues a function rather than a value; React applies the queued functions in order during the next render, so two calls produce two increments.

**How it works.** React batches state updates within a single event handler (and, since React 18, across most asynchronous boundaries). Each update is appended to the fiber's update queue. When the next render runs, React processes the queue: a value update overwrites the in-progress state with the queued value; an updater function is called with the in-progress state and its return value becomes the new in-progress state. Two value updates with the same value cancel out; two updater functions compose.

```tsx
const [count, setCount] = useState(0);

function bug() {
  setCount(count + 1); // queues set-to-1 (count was 0 at render time)
  setCount(count + 1); // queues set-to-1 again
  // next render: count is 1
}

function correct() {
  setCount((c) => c + 1); // queues "increment by 1"
  setCount((c) => c + 1); // queues "increment by 1"
  // next render: count is 2
}
```

**Trade-offs / when this fails.** The updater form is mandatory whenever the next state depends on the previous one, especially inside asynchronous callbacks where the captured `count` is more obviously stale. The value form is acceptable when the new state is a constant unrelated to the previous ([for example, `setOpen(true)`). The senior position is to default to the updater form for derived updates and to reach for the value form only when the new value is independent of the previous one.

### 2. Walk me through a race condition in a `useEffect` fetch and how to fix it.

The race condition occurs when the effect issues a request, the dependency changes before the response arrives, the effect issues a second request, and the responses arrive in the opposite order from the requests. Without a guard, the older response writes to state after the newer response, and the user interface displays stale data that does not match the current dependency. The fix is to ignore the older response on cleanup, either by setting a `cancelled` flag or, preferably, by aborting the older request with `AbortController` so the network round-trip is cancelled rather than wasted.

**How it works.** Every effect's cleanup function runs when the dependencies change, before the next effect runs. Setting `cancelled = true` in the cleanup, then checking it before `setState` in the effect, ensures that the older effect's `setState` is a no-op. Using `AbortController` is strictly better because it also frees the network resource: the older `fetch` rejects with `AbortError` and the browser closes the connection.

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => {
      if (e.name !== "AbortError") throw e;
    });
  return () => controller.abort();
}, [userId]);
```

**Trade-offs / when this fails.** The pattern fails for any side effect that is not idempotent — sending an analytics event, posting to an endpoint without an idempotency key, mutating a remote resource. For those, the right answer is to debounce the trigger so only the final value reaches the server, or to use a server-state library (TanStack Query) that handles cancellation, deduplication, and stale-while-revalidate semantics across the whole application. See [chapter 3.5](./05-state-management.md) for the case for TanStack Query over hand-written effects.

### 3. When would you reach for `useReducer` over `useState`?

Three situations make `useReducer` the better choice. The first is when several pieces of state must update atomically: a reducer guarantees that all fields move together as a function of one action, whereas `useState` requires the developer to remember to call every setter. The second is when the same state is updated from many places: the reducer becomes the single specification of valid transitions and the dispatch sites are reduced to "send an action and forget". The third is when the state machine is complex enough to benefit from explicit transitions — at that point a state-charts library such as XState becomes the next step up.

**How it works.** `useReducer` accepts a reducer (a pure function from `(state, action)` to `state`) and an initial state, and returns the current state plus a `dispatch` function. Each call to `dispatch` enqueues an action; React invokes the reducer during the next render and uses the result as the new state. Because the reducer is pure, the same action produces the same next state, which makes the reducer a natural fit for redux-devtools-style time travel and for serialisation in error reports.

```tsx
type State = { items: Item[]; status: "idle" | "loading" | "error" };
type Action =
  | { type: "load" }
  | { type: "loaded"; items: Item[] }
  | { type: "error" }
  | { type: "remove"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load": return { ...state, status: "loading" };
    case "loaded": return { items: action.items, status: "idle" };
    case "error": return { ...state, status: "error" };
    case "remove": return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}

const [state, dispatch] = useReducer(reducer, { items: [], status: "idle" });
```

**Trade-offs / when this fails.** A reducer adds boilerplate that does not pay for itself when the state is two unrelated booleans; for that, two `useState` calls are clearer. The reducer also obscures the dependency between actions and state for readers who are scanning the file for the first time. The senior framing is "use the reducer when the state machine is complex enough that the action vocabulary is the documentation".

### 4. Give an example of a `useMemo` that is actively harmful.

`useMemo(() => count * 2, [count])` is actively harmful: the multiplication is approximately one nanosecond and the memoisation overhead — the cache lookup, the dependency comparison, the closure allocation — is several nanoseconds. The memoised version is slower than the inline expression on every render, the function body is larger and noisier, and the developer has to remember to keep the dependencies in sync with the body when the formula changes.

**How it works.** `useMemo` is a cache: it stores the previous return value and the previous dependency array on the fiber, and on each render compares the current dependencies against the previous ones. If they match, it returns the cached value; if they differ, it calls the function and caches the new value. The cache hit pays for the equality check; the cache miss pays for the equality check plus the function call. For cheap computations the equality check itself dominates and the memoisation is a net loss.

```tsx
// Harmful: memoising a primitive that is cheap to compute.
const doubled = useMemo(() => count * 2, [count]);

// Useful: memoising the result of an expensive sort whose input rarely changes.
const sorted = useMemo(
  () => items.slice().sort((a, b) => a.priority - b.priority),
  [items],
);
```

**Trade-offs / when this fails.** The position is not "never use `useMemo`" but "use `useMemo` for genuinely expensive computations or for reference identity that flows into a memoised child or hook dependency". Profile-driven memoisation is the senior approach; ceremonial memoisation around every computation is the anti-pattern. The arrival of the React Compiler in 2026 reduces the manual workload — the compiler memoises automatically and idempotently — which is another reason to leave `useMemo` for the cases the compiler genuinely cannot reason about.

### 5. What does `useSyncExternalStore` exist for? When did it become important?

`useSyncExternalStore` exists to subscribe a component to an external store (a piece of state that React does not own — browser history, a Zustand store, a Web Worker channel, the clock) in a way that is safe under concurrent rendering. Before React 18, components could subscribe to external stores by wiring `useEffect` to add a listener and `useState` to hold the value, which was correct under synchronous rendering. Concurrent rendering can render a tree multiple times before committing, and during that window a hand-rolled subscription can produce a torn read in which different components in the same render see different values from the store.

**How it works.** The hook takes three arguments: a `subscribe(callback)` function that wires the callback into the external store and returns an unsubscribe, a `getSnapshot()` function that returns the current store value, and an optional `getServerSnapshot()` function that returns the server-side value during Server-Side Rendering. React calls `getSnapshot` during rendering to obtain a value and re-runs it whenever the subscription fires; if `getSnapshot` returns a different value than it did during the render that committed, React schedules a re-render. The crucial guarantee is that within one render, every call to `getSnapshot` returns the same value, eliminating tearing.

```tsx
const onlineStatus = useSyncExternalStore(
  (callback) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  },
  () => navigator.onLine,
  () => true, // SSR snapshot
);
```

**Trade-offs / when this fails.** `getSnapshot` must return a stable identity for unchanged data — returning a fresh array literal on every call defeats the equality check and triggers re-renders on every subscription event. The standard mitigation is to memoise the snapshot inside the store and to expose a `getSnapshot` that returns that memoised reference. Library authors should always use `useSyncExternalStore`; application authors typically encounter it only when integrating a non-React state library, because most libraries (Zustand, Jotai) wrap the hook for them.

## Further reading

- React docs: ["You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect) — required reading.
- Dan Abramov, ["A Complete Guide to useEffect"](https://overreacted.io/a-complete-guide-to-useeffect/).
- Kent C. Dodds, ["When to useMemo and useCallback"](https://kentcdodds.com/blog/usememo-and-usecallback).
