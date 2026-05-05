---
title: "Performance — first principles"
sidebar_label: "3.7 Performance — first principles"
description: "How to think about React performance: render cost, memoization done right, code splitting, virtualization, and the React Compiler."
sidebar_position: 7
---

This is the React-specific introduction. The full Core Web Vitals, loading, and Real User Monitoring coverage lives in [Production Concerns: Performance](../07-production-concerns/01-performance.md).

> **Acronyms used in this chapter.** API: Application Programming Interface. CLS: Cumulative Layout Shift. CSS: Cascading Style Sheets. CWV: Core Web Vitals. DOM: Document Object Model. JS: JavaScript. JSX: JavaScript XML. RUM: Real User Monitoring. SSR: Server-Side Rendering. UI: User Interface.

## Measure first

Before optimising anything, profile. Three tools cover the ninety per cent case for React performance work. **React DevTools Profiler** produces a flame graph of every render with the reason each component re-rendered, which is the fastest way to identify a re-render storm. **The browser Performance panel** confirms whether renders correlate with the long tasks that hurt Interaction to Next Paint. **The React `<Profiler>` component** captures programmatic measurements that can be shipped to Real User Monitoring (RUM) so the same numbers gathered locally are available from production.

```tsx
<Profiler id="Dashboard" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 16) trackSlowRender({ id, phase, actualDuration });
}}>
  <Dashboard />
</Profiler>
```

Without numbers, the work is guessing. Most "slow React app" diagnoses turn out to be one of three causes: a re-render storm from Context, a heavy synchronous computation, or a bundle-size problem masquerading as a runtime problem. The three sections below cover each in turn with a recommended fix.

## The three real causes of slow renders

### 1. Re-render storm

A parent re-renders, every unmemoised child re-renders, even though the props are unchanged. The three fixes, in increasing order of effort:

- **Move state down**. The closer state lives to where it is used, the smaller the re-render scope. A piece of state that is only read by one leaf belongs in that leaf, not in a parent or in a context.
- **Split contexts**. A single context with `{ user, theme, route }` re-renders every consumer when any field changes; splitting it into `UserContext`, `ThemeContext`, and `RouteContext` reduces the blast radius of a change to one of them.
- **`React.memo`** on heavy children that take stable props. Memoisation only helps if the parent's renders are frequent and the child's render cost is non-trivial; profile first.

```tsx
const Row = memo(function Row({ item }: { item: Item }) {
  return <li>{item.title}</li>;
});
```

### 2. Heavy synchronous computation

Filtering a fifty-thousand-row list on every keystroke is the canonical example. Three fixes, applied in combination on real workloads:

- **`useMemo`** for the computation, so the work runs only when the dependencies change rather than every render.
- **`useDeferredValue` or `startTransition`** to make the consequent render interruptible, which keeps the input responsive even when the list update is heavy.
- **Virtualisation** — only render the visible rows. Substituting a virtualiser for a hand-rendered list is usually the largest single win for any list with more than a few hundred items.

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 32,
  overscan: 8,
});

return (
  <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((v) => (
        <div key={v.key} style={{ position: "absolute", top: v.start, height: v.size }}>
          {rows[v.index].title}
        </div>
      ))}
    </div>
  </div>
);
```

Ten thousand rows render in roughly zero milliseconds when only twenty are in the DOM at any time. The remaining cost is the scroll handler, which the virtualiser keeps cheap by binding to `scroll` only on the scroll container.

### 3. Bundle bloat

The user downloads and parses two megabytes of JavaScript before they see anything. Three layers of code splitting reduce the initial bundle, each catching a different category of unused code:

- **Route-level code splitting** via `React.lazy` plus `<Suspense>`. Next.js does this automatically per route; in a plain Single-Page Application the application opts into it explicitly.
- **Lazy loading of non-critical user interface elements** such as modals, charts, and the comment thread, so they download only on the route or interaction that needs them.
- **Dynamic imports of heavy libraries** — for example, loading `pdf-lib` only when the user clicks "Export PDF" rather than including it in the main bundle.

```tsx
const Chart = lazy(() => import("./HeavyChart"));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Chart data={data} />
    </Suspense>
  );
}
```

## Memoisation, the right way

The senior position is to **memoise the inputs that matter, not everything**. The three rules:

- `React.memo(Component)` helps only if the parent re-renders frequently *and* the props stay referentially stable across those renders. A parent that passes `{ onClick: () => ... }` inline defeats the memo because each render gives `onClick` a new reference; the cure is to wrap the handler in `useCallback`.
- `useCallback` is for functions passed to memoised children or used as dependencies of another hook, so the function's reference is stable across renders.
- `useMemo` is for *expensive* computations (sorting, parsing, filtering large data sets) or for objects and arrays whose identity needs to be stable as a downstream dependency.

The React Compiler (rolling out across the ecosystem in 2026) auto-memoises automatically. When it ships in the team's stack, **delete most manual `useMemo` and `useCallback`** — they become noise that the compiler would otherwise handle.

## Concurrent features for perceived performance

Even when the work cannot be made faster, it can be reordered so the user perceives the page as more responsive. Three concurrent primitives accomplish this:

- **`startTransition`** keeps inputs responsive while a heavy update happens in the background, by marking the heavy update as interruptible.
- **`useDeferredValue`** lets the page render with the previous value first and then re-render with the latest value when the consequent computation finishes.
- **`<Suspense>` plus streaming Server-Side Rendering** flushes above-the-fold content to the wire before the slower data has resolved, which produces a faster Largest Contentful Paint without sacrificing dynamic data.

These primitives do not reduce total work. They reorder it so the user perceives speed.

## Code splitting at scale

Three levels of code splitting cover the substantial majority of bundle-size wins. **Route-level splitting** makes each route its own bundle — free in Next.js, opt-in in a plain Single-Page Application. **Component-level splitting** wraps a heavy modal or dashboard panel in `lazy()` so it downloads only when used. **Library-level splitting** uses a dynamic `import()` of a large library only when the feature that needs it is invoked.

Test in Chrome DevTools' **Coverage** tab — it shows which JavaScript was actually executed versus which was shipped on a given page. The common surprise is that more than sixty per cent of the bundled JavaScript is not executed on the landing page, which is the exact gap that lazy loading captures.

## Image and media

Images are usually the heaviest assets on a page. Five rules cover the senior baseline. Use modern formats (AVIF and WebP with a `<picture>` fallback) so the browser receives the smallest acceptable file. Use responsive images via `srcset` and `sizes` so the browser downloads a file appropriate to the device. Use `loading="lazy"` for below-the-fold images so the initial network budget is reserved for above-the-fold content. Set explicit `width` and `height` attributes on every image to reserve layout space and prevent Cumulative Layout Shift. In Next.js, the `<Image>` component handles most of these by default — the manual checklist is the right baseline for plain Single-Page Applications without an image framework.

## Key takeaways

- Profile first. Most React perf complaints have one of three causes: re-render storms, heavy sync work, or bundle bloat.
- Split contexts; move state down; memoize only when measured.
- Virtualize long lists. The savings are substantial.
- Code-split at route, component, and library levels — coverage tab shows the wins.
- Concurrent features (`startTransition`, `useDeferredValue`, Suspense) trade total work for perceived speed.
- The React Compiler will retire most manual memoization. Don't pre-emptively scatter `useMemo`.

## Common interview questions

1. A page is sluggish. What are your first three steps?
2. Why might `React.memo` not help, even though props "look the same"?
3. When does `useDeferredValue` improve perceived performance?
4. How does virtualisation actually work, and what does it cost?
5. What does the React Compiler change about how you write components?

## Answers

### 1. A page is sluggish. What are your first three steps?

The first step is to record a profile of the slow interaction in React DevTools Profiler with "record why each component rendered" enabled. The flame graph reveals which components are rendering, which are rendering more often than expected, and which renders are dominating the wall-clock cost. The second step is to record the same interaction in the browser Performance panel to confirm whether the React work correlates with long tasks (longer than fifty milliseconds), with paint cost, or with network activity — the cause of the perceived slowness is one of those three. The third step is to triage based on what the profile shows: a re-render storm means moving state down or splitting context; a heavy synchronous computation means memoising, virtualising, or deferring; a long task with little React work means the bottleneck is probably JavaScript outside React (a synchronous parser, a third-party library) or a large bundle parse on first load.

**How it works.** The React Profiler records every render with its commit time and reason. The browser Performance panel records every long task on the main thread with its source. Together they answer the two questions that diagnose any sluggish page: which renders are the cost, and what work is the main thread doing besides React. Once the answers are known, the fix is mechanical.

```ts
// React Profiler — programmatic capture for production RUM.
<Profiler id="Dashboard" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 16) trackSlowRender({ id, phase, actualDuration });
}}>
  <Dashboard />
</Profiler>
```

**Trade-offs / when this fails.** Profiling on a fast developer laptop can hide problems that only appear on a low-end mobile device, which is why the Performance panel's "CPU throttling" option is non-optional for diagnosing real-user issues. The pattern is also wrong if the slowness is initial-load rather than interaction; in that case the right tool is Lighthouse or web.dev/measure plus the bundle analyser. See [chapter 7.1](../07-production-concerns/01-performance.md) for the loading-performance discussion.

### 2. Why might `React.memo` not help, even though props "look the same"?

Because `React.memo` performs a *shallow* equality check on the props. Two object literals or function literals that look identical in source are different references at runtime, so the shallow check fails and the memoised component re-renders anyway. The most common offender is an inline function: a parent that passes `onClick={() => doThing()}` creates a new function on every render, the memo's shallow check sees two different references, and the child re-renders despite the source being identical.

**How it works.** `React.memo` stores the previous props on the fiber. On the next render, it compares each property of the new props to the previous one with `Object.is`. Primitive props compare by value; object and function props compare by reference. The cure for the inline-function case is `useCallback` to stabilise the function reference; the cure for the inline-object case is `useMemo` (or, more often, lifting the object out of the render so it is constructed once at module scope).

```tsx
const Cheap = React.memo(function Cheap({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click</button>;
});

function Parent() {
  // BAD: memo defeated: new function on every render.
  return <Cheap onClick={() => console.log("hi")} />;
}

function ParentFixed() {
  // OK: stable reference; the memo holds.
  const onClick = useCallback(() => console.log("hi"), []);
  return <Cheap onClick={onClick} />;
}
```

**Trade-offs / when this fails.** Wrapping every callback in `useCallback` and every object in `useMemo` is itself a performance pitfall — the memoisation overhead exceeds the avoided render cost for cheap children. The senior position is "memoise hot paths only, after profiling". The React Compiler removes the manual memoisation burden in 2026; once it ships in the team's stack, most manual `useCallback` and `useMemo` becomes redundant.

### 3. When does `useDeferredValue` improve perceived performance?

When a component receives a prop whose downstream computation is expensive, and the user would prefer to see the previous result immediately rather than wait for the new one to render. The hook returns a deferred copy of the value: during the render that triggered by the prop change, the deferred value is still the previous value, and the expensive consequent render runs at transition priority in the background. The user sees the input or trigger update immediately and the consequent display update follows when it is ready.

**How it works.** The hook is the consumer-side counterpart to `startTransition`. It works by returning the previous value during the urgent render and triggering a second render at transition priority with the new value. The transition render is interruptible — if a newer value arrives, the in-flight render is discarded — and yields to higher-priority work such as user input. The component can read both `value` (current) and `useDeferredValue(value)` (lagging) and render a "stale" indicator when they differ.

```tsx
function ResultsPanel({ query }: { query: string }) {
  const dq = useDeferredValue(query);
  const results = useMemo(() => search(dq), [dq]);
  return <Results items={results} stale={query !== dq} />;
}
```

**Trade-offs / when this fails.** The hook does not make the work cheaper; it makes the consequent render interruptible. If the work itself is fast, the hook is unnecessary; if the work is slow because of a single CPU-bound function, the right cure is to move the work off the main thread (a Web Worker) or to make the algorithm cheaper. The pattern is also incorrect for values whose update the user is waiting for synchronously (a clock, a progress bar), because the deferred value will lag visibly behind the source of truth.

### 4. How does virtualisation actually work, and what does it cost?

A virtualiser renders only the rows that are currently visible in the scroll viewport, plus a small overscan margin. The container reserves a tall scrollable area whose height matches the total content height, so the scroll bar behaves correctly. As the user scrolls, the virtualiser computes which rows are inside the visible window, mounts those rows (or recycles existing ones), and unmounts the rows that are no longer visible. The cost is one scroll-event handler per scroll container plus a small layout cost per visible row, both of which are small compared with rendering ten thousand rows at once.

**How it works.** The virtualiser maintains an estimate of each row's size and computes the visible window by walking the size estimates from the top. For uniform-size rows the computation is constant time; for variable-size rows the virtualiser measures rows on first render and stores the measured size for use in subsequent computations. The visible rows are positioned absolutely inside the container, so the layout work scales with the number of visible rows rather than the total row count.

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const v = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 32,
  overscan: 8,
});

return (
  <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
    <div style={{ height: v.getTotalSize(), position: "relative" }}>
      {v.getVirtualItems().map((vi) => (
        <div key={vi.key} style={{ position: "absolute", top: vi.start, height: vi.size }}>
          {rows[vi.index].title}
        </div>
      ))}
    </div>
  </div>
);
```

**Trade-offs / when this fails.** Virtualisation costs accessibility unless implemented carefully: the screen reader cannot read rows that are not in the DOM, so jump-to-keyboard navigation or "find on page" misses the unmounted rows. The mitigations are to use ARIA `aria-rowcount` and `aria-rowindex` to communicate the virtual size, and to keep the focused row in the DOM even when scrolled out of view. The pattern is also unnecessary for lists short enough to render in a single frame; the rule of thumb is to virtualise above a hundred or so rows.

### 5. What does the React Compiler change about how you write components?

The React Compiler memoises components, hooks, and intermediate values automatically, with a precision that is hard to reach by hand. Once it is in the build, almost every manual `useMemo` and `useCallback` becomes redundant, and `React.memo` is needed only at boundaries that genuinely benefit from the explicit cache. The component code becomes cleaner — no `useCallback` wrappers around inline handlers, no `useMemo` around derived values, no array-dependency lists to keep in sync — and the runtime behaviour is at least as fast as the hand-memoised version.

**How it works.** The compiler analyses the component's source to identify which values change on each render and inserts memoisation at the right granularity. The approach uses static analysis plus React's rules-of-hooks invariants to prove which expressions can be cached. The output is regular React code that uses `useMemoCache` (an internal hook) to hold cached values on the fiber, so existing tooling and DevTools continue to work.

```tsx
// Before the compiler — manual memoisation.
function Item({ row }: { row: Row }) {
  const formatted = useMemo(() => formatRow(row), [row]);
  const onClick = useCallback(() => select(row.id), [row.id]);
  return <li onClick={onClick}>{formatted}</li>;
}

// After the compiler — the same component, written naturally.
function Item({ row }: { row: Row }) {
  const formatted = formatRow(row);
  const onClick = () => select(row.id);
  return <li onClick={onClick}>{formatted}</li>;
}
```

**Trade-offs / when this fails.** The compiler relies on the rules of hooks; components that violate the rules (conditional hooks, hooks in loops) are skipped and emit a warning. The compiler also cannot reason across module boundaries about the purity of imported functions, so memoisation around a side-effect-prone function is not generated automatically. The pattern is wrong to fight: if the compiler is in the build, lean on it; if it is not yet in the build, hand-memoise hot paths only. Adoption is gradual — the compiler can be enabled per-file or per-directory, so a team can roll it out incrementally.

## Further reading

- React docs: [Profiler](https://react.dev/reference/react/Profiler).
- TanStack Virtual [docs](https://tanstack.com/virtual/latest).
- Web.dev [How to make your site faster](https://web.dev/articles/fast).
