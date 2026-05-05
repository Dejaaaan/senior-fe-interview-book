---
title: "Signals & modern reactivity"
sidebar_label: "5.7 Signals & modern reactivity"
description: "Angular Signals, computed, effect, and the road to zoneless change detection."
sidebar_position: 7
---

Signals (introduced in Angular 16, stable from Angular 17) are the new reactivity model. They provide fine-grained reactivity at the level of individual values, eliminate the need for explicit `OnPush` boilerplate in most cases (because the framework can infer dependency relationships from signal reads), and pave the way to zoneless Change Detection. The combination is what brings Angular's runtime performance characteristics close to React with fine-grained reactivity primitives.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. DI: Dependency Injection. HTTP: HyperText Transfer Protocol. RxJS: Reactive Extensions for JavaScript. UI: User Interface.

## The three primitives

```ts
import { signal, computed, effect } from "@angular/core";

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(`count=${count()}, doubled=${doubled()}`);
});

count.set(1);
count.update((n) => n + 10);
```

The three primitives form the entire Signals API surface. `signal(initial)` creates a writable container for a value; reading it via `count()` registers a dependency in any surrounding `computed` or `effect`. `computed(fn)` creates a derived value that recomputes when any signal it reads changes; the result is memoised, so consecutive reads with unchanged dependencies return the cached value without re-running the function. `effect(fn)` registers a side effect that runs initially and re-runs whenever any signal it reads changes; effects are the right place for synchronisation with the Document Object Model, the document's `title`, browser storage, or any external system.

Reading is always a function call (`count()`); writing is always via `.set(newValue)` or `.update(prev => next)`. The distinction between read (call) and write (method) is what makes the dependency tracking work — the framework wraps the read with the surrounding tracking context, so it knows which `computed` or `effect` depends on which signal.

## Why?

Before Signals, Angular re-checked the entire component tree when "anything happened" — Zone.js detected an event, a timer fired, or an HTTP response arrived, and the framework walked the tree to evaluate every binding. The `OnPush` Change Detection strategy paired with `async` pipes could optimise this by skipping components whose inputs had not changed, but the model was fragile: a missed `markForCheck()` call, a mutated array that did not change reference, or a third-party library that bypassed the strategy could all break the optimisation silently.

Signals are fine-grained at the value level. A component re-renders only when a specific signal it reads changes; sibling signals do not trigger a re-render even if they live in the same component. The result is faster updates, smaller render scopes, and no Zone.js dependency needed.

In 2026, new components should use Signals as the default. Existing components can migrate piecemeal — the framework supports mixed Signal-and-Observable code in the same component, and the bridges (`toSignal`, `toObservable`) make the migration incremental.

## Component example

```ts
import { Component, signal, computed, inject } from "@angular/core";
import { TasksApi } from "./tasks.api";

@Component({
  selector: "app-tasks",
  standalone: true,
  template: `
    <input [value]="filter()" (input)="filter.set($any($event.target).value)" />

    @for (t of filtered(); track t.id) {
      <li [class.done]="t.done">{{ t.title }}</li>
    }

    <p>{{ filtered().length }} of {{ all().length }} tasks</p>
  `,
})
export class TasksComponent {
  private api = inject(TasksApi);

  filter = signal("");
  all = signal<Task[]>([]);

  filtered = computed(() => {
    const q = this.filter().toLowerCase();
    if (!q) return this.all();
    return this.all().filter((t) => t.title.toLowerCase().includes(q));
  });

  constructor() {
    this.api.list().subscribe((tasks) => this.all.set(tasks));
  }
}
```

`filtered` recomputes only when `filter` or `all` changes. The template re-renders only the parts that read changed signals.

## `effect()`: side effects, not data flow

```ts
effect(() => {
  document.title = `Tasks (${count()})`;
});
```

Runs initially, then whenever `count()` changes.

Rules:

- `effect()` must be created in an injection context (component constructor, factory).
- Cleanup: pass a function to `onCleanup`:

```ts
effect((onCleanup) => {
  const id = setTimeout(() => doSomething(), 1000);
  onCleanup(() => clearTimeout(id));
});
```

- Don't write signals from an effect — by default Angular forbids it (it's confusing reactive code). Use `effect(..., { allowSignalWrites: true })` if you really must.

## `linkedSignal()` (Angular 19+)

A signal whose value derives from another but stays editable:

```ts
const country = signal("US");
const language = linkedSignal(() => defaultLanguageFor(country()));

language.set("en");                     // user override
country.set("FR");                      // resets language to French default
```

Useful for "form preselection that follows another field but the user can override".

## `inputSignal()` and `modelSignal()`

`input()` and `model()` create signal-backed component inputs/two-way bindings:

```ts
import { Component, input, model, output } from "@angular/core";

@Component({
  selector: "app-task",
  template: `
    <input [value]="title()" (input)="title.set($any($event.target).value)" />
    <input type="checkbox" [checked]="done()" (change)="done.set($any($event.target).checked)" />
    <button (click)="remove.emit()">Remove</button>
  `,
})
export class TaskComponent {
  title = model.required<string>();   // two-way: parent's [title]/[(title)]
  done = model(false);
  remove = output<void>();
}
```

```html
<app-task [(title)]="taskTitle" [(done)]="taskDone" (remove)="onRemove()" />
```

## Interop with RxJS

```ts
import { toSignal, toObservable } from "@angular/core/rxjs-interop";

const tasks = toSignal(this.api.list(), { initialValue: [] });

const search = signal("");
const search$ = toObservable(search);
const results = toSignal(
  search$.pipe(
    debounceTime(300),
    switchMap((q) => this.api.search(q))
  ),
  { initialValue: [] }
);
```

`toSignal` turns Observables into Signals (handles cleanup). `toObservable` turns Signals into Observables (useful for operators like `debounceTime`).

## `untracked()`

Reading a signal inside an effect/computed creates a dependency. To read without subscribing:

```ts
import { untracked } from "@angular/core";

effect(() => {
  const v = filter();
  const cached = untracked(() => cacheFor(v));
});
```

## Zoneless change detection

With Signals, Angular can run **without Zone.js**:

```ts
bootstrapApplication(App, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    ...
  ],
});
```

Smaller bundle (drops Zone.js), no monkey-patching of timers / fetch, predictable updates triggered only by signal writes.

In 2026 zoneless is the recommended default for new apps; existing apps need migration of any code that relies on Zone (third-party libraries, certain testing utilities).

## Migration tips

The pragmatic migration path replaces `BehaviorSubject` with `signal` for any synchronous state container, replaces `combineLatest` with `map` chains by `computed` for derivations, and replaces `.subscribe(...)` for user-interface side effects with `effect`. Keep Reactive Extensions for JavaScript for the use cases it handles uniquely well — HTTP cancellation, WebSocket streams, debouncing, complex multi-stream composition — and use `toSignal` to bridge async sources into the Signal world for template consumption. Do not migrate everything at once; the two systems coexist cleanly, and a forced migration risks breaking working code for marginal benefit.

## Anti-patterns

Four anti-patterns recur in Signal code. Writing signals inside `effect` without `allowSignalWrites: true` and a clear reason creates feedback loops and makes the reactive flow hard to reason about; the framework forbids the write by default specifically to surface this issue. Replacing every Observable with a signal — RxJS remains the better choice for asynchronous streams, especially anything involving cancellation or composition. Computed signals doing expensive work that should be memoised at a higher level (a sort of a thousand items every time any item changes) — the cure is to push the memoisation up and have the computed read the cached result. Reading non-signal values in templates as if they were signals — calling a non-function value in a template produces the value's `toString()`, which is rarely what the developer intended; the cure is a project convention of suffixing signal-typed fields (no convention exists in the framework, but teams often use no suffix for signals and `_$` for Observables to distinguish them).

## Key takeaways

- Signals provide fine-grained reactivity at the value level, producing faster and smaller updates than Zone-driven Change Detection and eliminating the need for explicit `OnPush` boilerplate in most cases.
- The three primitives `signal`, `computed`, and `effect` cover the substantial majority of needs; the remaining edge cases are addressed by `linkedSignal`, `untracked`, and the RxJS interop helpers.
- `model()` and `input()` (signal-backed component inputs and two-way bindings) are the new component API and are the recommended form for new components.
- Bridge to Reactive Extensions for JavaScript via `toSignal` (Observable → Signal) and `toObservable` (Signal → Observable) when async composition or operators are needed.
- Zoneless Change Detection is the recommended direction for new applications; it eliminates the Zone.js dependency, reduces bundle size, and removes the entire class of bugs caused by Zone's monkey-patching of global async primitives.

## Common interview questions

1. What problem do Signals solve that OnPush didn't?
2. Difference between `computed` and `effect`?
3. When would you use `toSignal` vs `toObservable`?
4. What's zoneless change detection?
5. When NOT to use a Signal?

## Answers

### 1. What problem do Signals solve that OnPush didn't?

Signals solve fine-grained dependency tracking at the value level, which `OnPush` cannot. `OnPush` is a coarse opt-in: a component re-renders when any of its trigger conditions fires (input reference change, event handler, async pipe emission). Within a re-rendering component, every binding is re-evaluated, even bindings whose inputs have not changed. Signals track dependencies at the level of individual values: only the bindings that read a changed signal are re-evaluated, and only the components affected by the change re-render. The result is materially smaller render scopes, faster updates, and a model that is easier to reason about because the reactive graph is explicit.

**How it works.** When a binding reads a signal via `value()`, the framework records the dependency in the surrounding tracking context. When the signal changes, the framework invalidates only the dependent computations and bindings, leaving everything else untouched. The dependency graph is built dynamically from actual reads, so adding a new binding that reads a signal automatically subscribes it without any explicit registration.

```ts
@Component({
  selector: "app-cart",
  standalone: true,
  template: `
    <p>Items: {{ items().length }}</p>
    <p>Total: {{ total() }}</p>
    <button (click)="add()">Add</button>
  `,
})
export class CartComponent {
  items = signal<{ price: number }[]>([]);
  total = computed(() => this.items().reduce((s, i) => s + i.price, 0));
  add() { this.items.update((curr) => [...curr, { price: 10 }]); }
}
// Adding an item invalidates `total`, re-renders only the bindings that read items() and total().
```

**Trade-offs / when this fails.** Signals are not a free upgrade — adopting them properly requires the team to think about which state is reactive and to use `signal`/`computed`/`effect` consistently. A codebase that mixes Signals and `OnPush` arbitrarily can be harder to reason about than either alone. The pattern fails when the team replaces Observables that genuinely benefit from RxJS operators (cancellation, composition) with Signals; for those, the bridge via `toSignal` keeps the right tool for the right job.

### 2. Difference between `computed` and `effect`?

`computed` produces a derived value that other computations and bindings can read; `effect` produces a side effect that runs for its observable behaviour outside the reactive graph. `computed` is pure (it should not produce side effects, only return a value), memoised (it caches the result and recomputes only when dependencies change), and lazy (it does not run until something reads it). `effect` is the opposite: it is impure (its purpose is the side effect — DOM manipulation, logging, persistence), eager (it runs at least once on registration), and not cached (it runs every time its dependencies change).

**How it works.** `computed(fn)` returns a read-only signal whose value is the result of `fn`. The framework runs `fn` once on first read, caches the result, and re-runs `fn` whenever any signal `fn` reads changes. `effect(fn)` registers `fn` to be called whenever any signal `fn` reads changes; the framework runs `fn` once on registration to capture initial dependencies, then again on every dependency change.

```ts
const count = signal(0);

// computed — pure, memoised, lazy.
const doubled = computed(() => count() * 2);
console.log(doubled());   // runs and caches
console.log(doubled());   // returns cached value

// effect — impure, eager, runs on every dependency change.
effect(() => {
  document.title = `Count: ${count()}`;       // side effect
});
count.set(1);                                  // effect runs again
```

**Trade-offs / when this fails.** Use `computed` for derivations that other parts of the application read; use `effect` for synchronisation with external systems. The pattern fails when the developer reaches for `effect` to compute a value (which then needs to be stored in a signal manually); the cure is to use `computed` for the derivation. The pattern also fails when the developer writes signals from inside an `effect` without thinking; the framework forbids this by default because it commonly produces feedback loops.

### 3. When would you use `toSignal` vs `toObservable`?

Use `toSignal` to consume an Observable as a Signal — typically when the Observable's value should be readable in a template or in a `computed`, and the consumer does not need RxJS operators. Use `toObservable` to expose a Signal as an Observable — typically when a downstream consumer needs RxJS operators (debouncing, switching, combining with other Observables) that the Signal API does not provide.

**How it works.** `toSignal(observable)` subscribes to the source on creation, stores the latest emission in a signal, and unsubscribes when the surrounding injector is destroyed. `toObservable(signal)` registers an `effect` that reads the signal and emits its value on a `Subject`-like Observable, with the Observable completing when the surrounding injector is destroyed.

```ts
import { toSignal, toObservable } from "@angular/core/rxjs-interop";

// Observable -> Signal: bind an HTTP stream as a signal for the template.
tasks = toSignal(inject(TasksService).list(), { initialValue: [] });

// Signal -> Observable: debounce the search signal via RxJS, then bridge back.
search = signal("");
results = toSignal(
  toObservable(this.search).pipe(
    debounceTime(300),
    switchMap((q) => inject(SearchService).query(q)),
  ),
  { initialValue: [] },
);
```

**Trade-offs / when this fails.** `toSignal` requires an initial value (or accepts `undefined` implicitly), which means the consumer must handle the loading state explicitly. `toObservable` triggers a Change Detection cycle on every signal change, so debouncing or sampling upstream is essential for high-frequency signals. The pattern fails when the team treats every Observable as something to bridge to a Signal; for streams that are inherently reactive (real-time updates, WebSocket events), keeping the Observable form and using the `async` pipe is often clearer.

### 4. What's zoneless change detection?

Zoneless Change Detection runs Angular without Zone.js. Instead of detecting "something happened" via Zone's monkey-patching of every async primitive, the framework triggers Change Detection only when something the framework knows about changes — a signal write, a `markForCheck()` call, an event handler, an `async` pipe emission, or an `HttpClient` response. The result is a smaller bundle (Zone.js is dropped), no monkey-patching of `setTimeout`, `fetch`, and friends, and a more predictable reactive flow.

**How it works.** The application opts in via `provideExperimentalZonelessChangeDetection()` (the API is still marked experimental in some versions but is the recommended direction). The framework's Change Detection is then driven by explicit triggers rather than by Zone's "anything happened" notifications. Components that use Signals automatically benefit because signal writes are explicit triggers; components that use Observables benefit when bound via the `async` pipe (which calls `markForCheck()` on emission); components that use direct DOM event handlers benefit because the framework wires its own listeners for declared bindings.

```ts
bootstrapApplication(App, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
});
```

**Trade-offs / when this fails.** Zoneless requires every reactive update to come through a known trigger; code that mutates state outside the framework's awareness (a timer that updates a class field directly, a third-party library that calls back without going through the framework) will not trigger a re-render. The cure is to update through a signal or to call `markForCheck()` explicitly. The pattern is also still labelled experimental in some framework versions, so the team should verify the version's stability story before adopting it for production.

### 5. When NOT to use a Signal?

Do not use a Signal for state that is fundamentally a stream — values arriving over time with cancellation, composition, or back-pressure semantics. WebSocket messages, real-time event feeds, complex async coordination (debouncing, switching, combining multiple sources) all belong in RxJS Observables. Do not use a Signal for state that lives outside the component (a global event bus that many parts of the application listen to); the cure is an injectable service that exposes the state, which can itself use a Signal internally if synchronous reads suit it.

**How it works.** The decision rule is "does the consumer need to read the current value synchronously?". If yes, a Signal is the right shape. If no — the consumer reacts to events as they arrive, with operators for transformation — an Observable is the right shape. The two systems are complementary, not competing; modern Angular code uses both, with the bridges making the transitions seamless.

```ts
// Signal — synchronous read, fine-grained reactivity.
count = signal(0);

// Observable — async stream, RxJS operators, multiple subscribers.
incomingMessages$ = this.ws.messages$;

// Bridge when needed:
unread = toSignal(this.incomingMessages$.pipe(scan((n) => n + 1, 0)), { initialValue: 0 });
```

**Trade-offs / when this fails.** The senior framing is "Signals for synchronous state, Observables for async streams". The pattern fails when the team forces every piece of state into Signals because the API is new and shiny; the cure is to keep RxJS for the cases where its operators genuinely simplify the code and to use Signals where the synchronous-read property matters.

## Further reading

- [Angular Signals guide](https://angular.dev/guide/signals).
- [RxJS interop](https://angular.dev/guide/signals/rxjs-interop).
- [Zoneless change detection](https://angular.dev/guide/experimental/zoneless).
