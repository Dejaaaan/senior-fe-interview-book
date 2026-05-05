---
title: "RxJS essentials"
sidebar_label: "5.3 RxJS essentials"
description: "Observables, the operators you must know, and the senior take on RxJS in modern Angular."
sidebar_position: 3
---

Reactive Extensions for JavaScript (RxJS) is the reactive programming library Angular uses for its asynchronous primitives. It models streams of values over time, composed via operators. Angular built its asynchronous story on RxJS — `HttpClient`, the Router, and the Forms module all return Observables — so even teams that prefer Signals for UI state must read and write Observable code routinely.

In 2026 the honest answer to "do I need to learn RxJS?" is "yes, but less than you used to". Signals are taking over UI state inside the component, where their fine-grained reactivity is a better fit. RxJS retains its dominance in three areas: data fetching with cancellation (the `switchMap` autocomplete pattern), real-time streams (WebSocket subscriptions, Server-Sent Events), and complex async flows that need operators like `debounceTime`, `combineLatest`, or `retryWhen`.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. DOM: Document Object Model. HTTP: HyperText Transfer Protocol. RxJS: Reactive Extensions for JavaScript. SSE: Server-Sent Events. UI: User Interface. URL: Uniform Resource Locator.

## The mental model

An **Observable** is a function you call with an observer; it pushes values until it completes or errors. Lazy: nothing happens until subscribed.

```ts
import { Observable } from "rxjs";

const ticks$ = new Observable<number>((subscriber) => {
  let i = 0;
  const id = setInterval(() => subscriber.next(i++), 1000);
  return () => clearInterval(id);
});

const sub = ticks$.subscribe((n) => console.log(n));
setTimeout(() => sub.unsubscribe(), 5000);
```

`$` suffix is convention for Observable variables.

## Three guarantees

Three properties characterise an Observable's contract. The push model says the producer emits when it has data, rather than the consumer asking for it; this aligns with how the underlying systems (timers, event sources, HTTP responses) actually behave. The cold-by-default property says each subscription starts a fresh execution of the producer; subscribing twice to an HTTP-returning Observable issues two HTTP requests. The cancellation property says unsubscribing tears down the underlying resources synchronously — the timer is cleared, the event listener is removed, the HTTP request is aborted. The combination is what makes Observables more powerful than Promises for async work that might need to be cancelled or shared.

## Creation operators

| Operator | Use |
| --- | --- |
| `of(1, 2, 3)` | Synchronous values |
| `from(arrayOrPromise)` | From an iterable / promise |
| `interval(ms)` | Periodic ticks |
| `timer(delay, period?)` | Delayed start, optional repeat |
| `fromEvent(target, "click")` | DOM/event-source events |
| `defer(() => obs)` | Lazy creation per subscription |

## Pipeable operators (the must-knows)

```ts
import { fromEvent, debounceTime, distinctUntilChanged, map, switchMap } from "rxjs";

const input = document.querySelector("input")!;

const search$ = fromEvent<InputEvent>(input, "input").pipe(
  map(() => input.value),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((q) => fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json())),
);

search$.subscribe(console.log);
```

The senior shortlist:

| Operator | When |
| --- | --- |
| `map` | Transform each value |
| `filter` | Drop unwanted values |
| `tap` | Side effects (logging, debug) |
| `take(n)`, `first()`, `last()` | Take a few |
| `debounceTime(ms)` | Wait for a quiet period |
| `throttleTime(ms)` | Cap frequency |
| `distinctUntilChanged()` | Drop consecutive duplicates |
| `switchMap` | Cancel in-flight when new value arrives (autocomplete) |
| `mergeMap` | Run all, in parallel |
| `concatMap` | Run sequentially |
| `exhaustMap` | Drop new values while one is in flight (login button) |
| `combineLatest`, `zip`, `forkJoin` | Combine multiple streams |
| `withLatestFrom` | Pair with another stream's latest |
| `catchError` | Recover from errors |
| `retry`, `retryWhen` | Retry on error |
| `shareReplay(n)` | Multicast and replay last `n` to new subscribers |
| `takeUntil(destroy$)` | Auto-unsubscribe pattern |

The four higher-order mapping operators (`switchMap`, `mergeMap`, `concatMap`, `exhaustMap`) are the most-tested topic in any RxJS interview because they decide what happens when a new value arrives while a previous inner Observable is still in flight. `switchMap` cancels the previous inner Observable and switches to the new one — the right choice for autocomplete (only the latest query matters), search (only the latest result is shown), and any "latest-only" navigation. `mergeMap` runs every inner Observable in parallel and merges their emissions — the right choice for bulk uploads where every file's upload should proceed concurrently. `concatMap` queues the inner Observables and runs them sequentially, in order — the right choice for ordered writes that must not interleave (a sequence of dependent state mutations). `exhaustMap` ignores new outer values while an inner Observable is still in flight — the right choice for preventing double-submission on a button (every click while the request is in flight is dropped).

Picking the wrong operator produces race conditions, dropped events, or unexpected duplicate calls. The interview-grade heuristic is to ask "what should happen if a new outer value arrives while a previous inner is still running?" and pick the operator whose semantics match the answer.

## Subjects

A **Subject** is both Observable and Observer. Multicasts. Useful for event buses and bridging between callback and Observable code.

```ts
import { Subject, BehaviorSubject, ReplaySubject } from "rxjs";

const bus$ = new Subject<string>();
bus$.subscribe((m) => console.log("A:", m));
bus$.next("hello");

const state$ = new BehaviorSubject({ count: 0 });
state$.subscribe((s) => console.log(s));
state$.next({ count: 1 });

const replay$ = new ReplaySubject<string>(2);
replay$.next("a"); replay$.next("b"); replay$.next("c");
replay$.subscribe(console.log);
```

The four Subject variants differ in their replay semantics. A plain `Subject` has no initial value and no replay buffer — late subscribers see only emissions that occur after they subscribe. A `BehaviorSubject` requires an initial value and replays the most recent value to every new subscriber, which is the right shape for a state container (the consumer always sees the current state). A `ReplaySubject(n)` replays the last `n` emissions to new subscribers, which is useful for event buses where late subscribers should see recent history. An `AsyncSubject` emits only the last value, and only when the source completes, which is useful for one-shot async results that should be cached for late subscribers.

## Memory leaks: unsubscribe!

Every subscription must end, or the producer (timer, event listener, HTTP socket) leaks.

Patterns:

### `takeUntil(destroy$)`

```ts
import { Subject, takeUntil } from "rxjs";

@Component({ ... })
export class TasksComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.tasks.list().pipe(takeUntil(this.destroy$)).subscribe(...);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### `takeUntilDestroyed()` (Angular 16+, preferred)

```ts
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

constructor() {
  this.tasks.list().pipe(takeUntilDestroyed()).subscribe(...);
}
```

Cleanup is handled automatically when the injector is destroyed.

### `async` pipe

The cleanest of all: subscribe in the template, Angular handles the lifecycle.

```ts
@Component({
  template: `
    @if (tasks$ | async; as tasks) {
      @for (t of tasks; track t.id) { <li>{{ t.title }}</li> }
    }
  `,
})
export class TasksComponent {
  tasks$ = this.svc.list();
}
```

When the component destroys, the pipe unsubscribes.

## Hot vs cold

**Cold**: each subscription triggers a new producer execution (e.g. an HTTP call). `HttpClient` Observables are cold.

**Hot**: the producer runs once; subscribers attach to the live stream (e.g. `Subject`, `fromEvent` on a DOM element).

`shareReplay` turns cold into hot:

```ts
const user$ = http.get<User>("/api/me").pipe(
  shareReplay({ bufferSize: 1, refCount: true })
);
```

Now multiple consumers share a single HTTP call (and replay the last value to late subscribers). `refCount: true` re-fetches when all unsubscribe and re-subscribe later.

## RxJS ↔ Signals interop

```ts
import { toSignal, toObservable } from "@angular/core/rxjs-interop";

const tasks = toSignal(this.svc.list(), { initialValue: [] });

const search = signal("");
const search$ = toObservable(search);
search$.pipe(debounceTime(300)).subscribe(...);
```

This is how modern Angular bridges old Observable code to the Signals world.

## Anti-patterns

Four anti-patterns appear often enough to be worth naming. Nested `subscribe` calls (subscribing inside another subscription's callback) produce unmanaged subscriptions and race conditions; the cure is to compose with `switchMap` or `mergeMap` so the outer subscription manages the inner. Manually subscribing and unsubscribing across many components creates lifecycle bugs; the cure is to prefer the `async` pipe in templates and `takeUntilDestroyed()` for direct subscriptions. Performing side effects in `map` (logging, mutation, navigation) misuses the operator and breaks the "transformation is pure" expectation; the cure is `tap` for side effects. Forgetting `.pipe()` and chaining operators directly on the Observable is a common syntactic error — operators are not methods on Observable, they are functions composed via `pipe()`.

## Key takeaways

- Observables are lazy, push-based, cancellable streams; the contract is what makes them more powerful than Promises for cancellable or shared async work.
- Master the four higher-order mapping operators (`switchMap`, `mergeMap`, `concatMap`, `exhaustMap`); pick by cancellation semantics, not by what feels familiar.
- Always end subscriptions with `takeUntilDestroyed()` (Angular 16+) or by binding via the `async` pipe in the template; manual unsubscription should be a last resort.
- Use `shareReplay` to multicast a cold Observable into a hot one for shared caches across multiple consumers.
- Signals are taking over UI state inside the component; RxJS still owns asynchronous and streaming use cases — data fetching with cancellation, real-time streams, complex composition.

## Common interview questions

1. `switchMap` vs `mergeMap` vs `concatMap` vs `exhaustMap`?
2. How do you avoid memory leaks with subscriptions?
3. When would you use a `BehaviorSubject` vs `Subject`?
4. What's the `async` pipe and what does it do?
5. How do you bridge an Observable into a Signal?

## Answers

### 1. `switchMap` vs `mergeMap` vs `concatMap` vs `exhaustMap`?

The four higher-order mapping operators differ entirely in what they do when a new outer value arrives while a previous inner Observable is still in flight. `switchMap` cancels the previous inner Observable and subscribes to the new one — only the latest matters, and the previous result is discarded. `mergeMap` keeps the previous inner Observable running and subscribes to the new one in parallel — every inner result eventually emerges. `concatMap` queues the new outer value and waits for the previous inner Observable to complete before subscribing to the new one — order is preserved at the cost of latency. `exhaustMap` ignores the new outer value entirely while the previous inner Observable is in flight — only the first wins, subsequent values during the in-flight window are dropped.

**How it works.** Each operator manages a buffer of pending outer values and a state of "is an inner currently in flight". `switchMap` unsubscribes from the in-flight inner the moment a new outer arrives, which is the cancellation that makes it safe for HTTP-backed autocompletes. `mergeMap` does no buffering at all; every outer value spawns a parallel inner. `concatMap` keeps a queue and processes one inner at a time. `exhaustMap` simply discards outer values during the in-flight window.

```ts
// Autocomplete — only the latest query matters; cancel any earlier in-flight call.
search$.pipe(
  debounceTime(300),
  switchMap((q) => http.get(`/search?q=${q}`)),
);

// Bulk upload — every file's upload should run concurrently.
uploadClicks$.pipe(
  mergeMap((file) => http.post("/upload", file)),
);

// Ordered write — every write must apply in order, even at the cost of latency.
writeQueue$.pipe(
  concatMap((change) => http.post("/api/changes", change)),
);

// Submit button — ignore double-clicks while the first request is in flight.
submitClicks$.pipe(
  exhaustMap(() => http.post("/api/orders", order)),
);
```

**Trade-offs / when this fails.** Picking the wrong operator produces race conditions (`mergeMap` for autocomplete shows results from the previous query if it resolves last), dropped events (`exhaustMap` where the user reasonably expects every click to register), or unbounded latency (`concatMap` on a queue that never drains). The interview-grade heuristic is to ask "what should happen when a new outer value arrives while a previous inner is still running?" and pick the operator whose semantics match the desired answer.

### 2. How do you avoid memory leaks with subscriptions?

Every active subscription holds references to the producer (a timer, an event listener, an HTTP request) and to the subscriber's callback. If the subscription is never ended, the references prevent the producer from being garbage-collected and the callback continues to fire after the consumer is gone — a classic memory leak that also produces incorrect behaviour (state updates after the component unmounts, navigation in response to events the user has long stopped caring about). Three patterns end subscriptions correctly: the `takeUntilDestroyed()` operator (Angular 16+, the recommended modern form), the `async` pipe in templates (handles the lifecycle automatically), and the `takeUntil(destroy$)` pattern paired with a `Subject` driven by `ngOnDestroy` (the legacy form for codebases pre-16).

**How it works.** `takeUntilDestroyed()` reads the surrounding injector context to find a `DestroyRef` and registers a teardown that completes the Observable when the injector is destroyed. The `async` pipe subscribes when the template is evaluated and unsubscribes when the binding is destroyed — both lifecycle events the framework already manages. The `takeUntil(destroy$)` form completes the source when `destroy$` emits, which the component must arrange in `ngOnDestroy`.

```ts
// Modern (Angular 16+):
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

constructor() {
  this.tasks.list().pipe(takeUntilDestroyed()).subscribe(...);
}

// Best of all: the async pipe — no manual subscription at all.
@Component({
  template: `@for (t of tasks$ | async; track t.id) { <li>{{ t.title }}</li> }`,
})
export class TaskListComponent {
  tasks$ = inject(TasksService).list();
}
```

**Trade-offs / when this fails.** `takeUntilDestroyed()` requires being called in an injector context — typically the constructor or a class field initialiser. Calling it from a regular method later in the lifecycle requires explicitly passing a `DestroyRef`. The `async` pipe is the cleanest choice but introduces a subscription per binding, which can produce duplicate HTTP calls if the same Observable is bound twice; the cure is `shareReplay` upstream of the bindings.

### 3. When would you use a `BehaviorSubject` vs `Subject`?

`BehaviorSubject` is the right choice when the consumer needs to know the current value of the stream at any moment, including the moment of subscription. The classic example is a state container — every new subscriber should see the current state immediately, not have to wait for the next update. `Subject` is the right choice when the stream represents events with no meaningful "current value" — clicks, server-pushed notifications, internal triggers — where late subscribers should see only future emissions and the concept of a "current click" makes no sense.

**How it works.** `BehaviorSubject` requires an initial value at construction and stores the latest emitted value internally; on subscription, it synchronously emits the stored value before any further updates. `Subject` has no internal storage; on subscription, it returns a connection to future emissions only.

```ts
// State container — every subscriber sees the current state.
const state$ = new BehaviorSubject<{ user: User | null }>({ user: null });
state$.subscribe((s) => console.log("seen:", s));   // logs immediately
state$.next({ user: { id: "u1", name: "Ana" } });  // logs again

// Event bus — only future events matter.
const clicks$ = new Subject<void>();
clicks$.subscribe(() => console.log("click"));     // hears only future clicks
clicks$.next();
```

**Trade-offs / when this fails.** `BehaviorSubject` is the right shape when the "current value" is a meaningful concept; using it for an event stream wastes memory (the framework holds the last emission unnecessarily) and can lead to surprising behaviour when a new subscriber receives a stale event. The cure is to choose the variant by what the consumer actually needs at subscription time. The pattern fails when the team uses `BehaviorSubject` as a general-purpose state container without considering the alternatives — Signals are typically a better fit for component-local state in modern Angular.

### 4. What's the `async` pipe and what does it do?

The `async` pipe is a built-in template pipe that subscribes to an Observable (or Promise) when the template is rendered and unsubscribes when the binding is destroyed. The pipe also calls `markForCheck()` on the component when the source emits, ensuring `OnPush` components re-render when the bound stream produces a new value. The result is a clean, lifecycle-correct way to bind an Observable to the template without manually subscribing or unsubscribing.

**How it works.** When the framework evaluates the template binding `tasks$ | async`, it instantiates an `AsyncPipe`, subscribes to the source, and returns the latest emitted value (or `null` until the first emission). On destruction, the pipe unsubscribes. On every new emission, the pipe stores the value and triggers a Change Detection cycle so the template re-renders. The pipe transparently handles both Observables and Promises, with the same lifecycle guarantees.

```ts
@Component({
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (user$ | async; as user) {
      <p>Hello, {{ user.name }}</p>
    } @else {
      <p>Loading...</p>
    }
  `,
})
export class UserBadgeComponent {
  user$ = inject(UserService).me();   // cold HTTP Observable
}
```

**Trade-offs / when this fails.** The pipe is the cleanest way to bind a stream to a template, but it creates a subscription per binding — binding the same Observable twice produces two subscriptions and, for cold Observables backed by HTTP, two requests. The cure is `shareReplay({ bufferSize: 1, refCount: true })` upstream of the bindings so the request is shared. The pipe also masks errors silently — an error in the source surfaces as a thrown error in the template, which can be confusing to debug; the cure is `catchError` upstream to map errors to a sentinel value the template can handle.

### 5. How do you bridge an Observable into a Signal?

Use `toSignal()` from `@angular/core/rxjs-interop`. The function takes an Observable, returns a Signal that emits the Observable's latest value, and handles the lifecycle automatically — subscribing on creation and unsubscribing when the surrounding injector is destroyed. The returned Signal can be read inside templates and `computed()` expressions exactly like any other signal, which is how modern Angular bridges legacy Observable-returning APIs (`HttpClient`, third-party RxJS libraries) into the Signal-based reactivity model.

**How it works.** `toSignal()` subscribes to the source Observable, stores the latest emitted value in a `signal()`, and updates the signal on every emission. The first read of the signal returns the configured `initialValue` (or `undefined`) until the source emits. The reverse direction — `toObservable(signal)` — observes the signal via `effect()` and emits a new value every time the signal changes, which is useful when an Observable-based operator (such as `debounceTime`) is needed downstream of a signal.

```ts
import { toSignal, toObservable } from "@angular/core/rxjs-interop";

@Component({ /* ... */ })
export class TasksComponent {
  // Observable -> Signal: bind the HTTP stream as a signal for the template.
  tasks = toSignal(inject(TasksService).list(), { initialValue: [] });

  // Signal -> Observable: debounce the search signal via RxJS, then back.
  search = signal("");
  results = toSignal(
    toObservable(this.search).pipe(
      debounceTime(300),
      switchMap((q) => inject(SearchService).query(q)),
    ),
    { initialValue: [] },
  );
}
```

**Trade-offs / when this fails.** `toSignal()` requires an initial value (or accepts `undefined` as the implicit initial), which means the consumer must handle the loading state explicitly. The bridge also assumes the Observable emits synchronously enough to be useful in the template; for a long-running Observable that only emits after a delay, the consumer must show a loading state until the first emission. The pattern fails for Observables that emit at very high frequency, because every emission triggers a Change Detection cycle; the cure is to debounce or sample upstream of `toSignal`.

## Further reading

- [RxJS docs](https://rxjs.dev/).
- [Angular RxJS interop](https://angular.dev/guide/signals/rxjs-interop).
- Ben Lesh's talks on schedulers and the four `*Map` operators.
