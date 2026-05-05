---
title: "If you know React"
sidebar_label: "5.8 If you know React"
description: "A side-by-side translation table from React idioms to Angular equivalents."
sidebar_position: 8
---

This chapter is the reference for the moment in an interview when the candidate is asked "show me how you would do this in Angular" and their brain is still in React mode. The chapter pairs every common React idiom with its Angular counterpart, includes side-by-side code examples, and ends with the framing a senior candidate can deliver to communicate "I can be productive in either framework, without overselling Angular as 'React with extra steps'".

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. CSS: Cascading Style Sheets. DI: Dependency Injection. DOM: Document Object Model. DSL: Domain-Specific Language. HTTP: HyperText Transfer Protocol. JSX: JavaScript XML. RxJS: Reactive Extensions for JavaScript.

## Concept map

| React | Angular |
| --- | --- |
| Function component | `@Component` (standalone) |
| Hook (`useState`) | `signal()` |
| Hook (`useMemo`) | `computed()` |
| Hook (`useEffect`) | `effect()` (or lifecycle hooks for legacy) |
| Hook (`useContext`) | DI (`inject(SomeService)`) |
| Hook (`useRef`) | `viewChild()` / `viewChildren()` / `ElementRef` |
| Custom hook | An injectable service (`@Injectable`) |
| `useReducer` | A service holding state + methods |
| `<Provider value={...}>` | `providers: [{ provide: TOKEN, useValue: ... }]` |
| `lazy(() => import(...))` | `loadComponent: () => import(...).then(m => m.X)` |
| React Router `<Route>` | `Routes` config + `<router-outlet>` |
| `useNavigate` | `inject(Router).navigate([...])` |
| `useParams` | `input.required<string>()` with `withComponentInputBinding()` |
| `<ErrorBoundary>` | `provideRouter(routes, withRouterErrorHandler(...))` and `ErrorHandler` |
| TanStack Query | `HttpClient` + signals (or `@tanstack/angular-query` if you really want) |
| Zustand / Redux | A signal-based service (the modern way) or NgRx |
| React Hook Form + Zod | Reactive Forms (typed); for Zod-style validation, `ngx-zod-forms` or custom validators |
| `dangerouslySetInnerHTML` | `[innerHTML]="..."` (sanitised by default) + `DomSanitizer` |
| `useTransition` | RxJS `debounceTime` / `throttleTime`, or Signals + `untracked` |
| Suspense | `@if (data())` + resolver-based loading; no built-in suspense yet |

## Common patterns side-by-side

### Counter

```tsx
import { useState } from "react";

export function Counter() {
  const [n, setN] = useState(0);
  return (
    <button onClick={() => setN(n + 1)}>{n}</button>
  );
}
```

```ts
import { Component, signal } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-counter",
  template: `<button (click)="n.set(n() + 1)">{{ n() }}</button>`,
})
export class CounterComponent {
  n = signal(0);
}
```

### Fetching a list

```tsx
import { useEffect, useState } from "react";

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then(setTasks);
  }, []);

  return (
    <ul>
      {tasks.map((t) => <li key={t.id}>{t.title}</li>)}
    </ul>
  );
}
```

```ts
import { Component, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Component({
  standalone: true,
  selector: "app-tasks",
  template: `
    <ul>
      @for (t of tasks(); track t.id) {
        <li>{{ t.title }}</li>
      }
    </ul>
  `,
})
export class TasksComponent {
  private http = inject(HttpClient);
  tasks = signal<Task[]>([]);

  constructor() {
    this.http.get<Task[]>("/api/tasks").subscribe((r) => this.tasks.set(r));
  }
}
```

### Forms

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const Schema = z.object({
  email: z.string().email(),
  message: z.string().min(10),
});

export function Contact() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(Schema),
  });

  return (
    <form onSubmit={handleSubmit(send)}>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}
      <textarea {...register("message")} />
      {errors.message && <p>{errors.message.message}</p>}
      <button>Send</button>
    </form>
  );
}
```

```ts
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="send()">
      <input formControlName="email" />
      @if (form.controls.email.invalid && form.controls.email.touched) {
        <p>Enter a valid email.</p>
      }
      <textarea formControlName="message"></textarea>
      <button [disabled]="form.invalid">Send</button>
    </form>
  `,
})
export class ContactComponent {
  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    message: ["", [Validators.required, Validators.minLength(10)]],
  });

  send() {
    if (this.form.valid) console.log(this.form.getRawValue());
  }
}
```

### Routing & params

```tsx
import { useParams } from "react-router-dom";

function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  return <p>Task {id}</p>;
}
```

```ts
@Component({
  standalone: true,
  template: `<p>Task {{ id() }}</p>`,
})
export class TaskDetailComponent {
  id = input.required<string>();
}
```

(With `withComponentInputBinding()` in the router providers, the route param `:id` becomes the `id` input.)

### Global state

```tsx
import { create } from "zustand";

const useTasks = create<{ list: Task[]; add: (t: Task) => void }>((set) => ({
  list: [],
  add: (t) => set((s) => ({ list: [...s.list, t] })),
}));
```

```ts
@Injectable({ providedIn: "root" })
export class TasksStore {
  list = signal<Task[]>([]);

  add(t: Task) {
    this.list.update((cur) => [...cur, t]);
  }
}

const store = inject(TasksStore);
store.list();    // read
store.add(t);
```

### Lazy routes

```tsx
const Tasks = lazy(() => import("./Tasks"));

<Routes>
  <Route path="tasks/*" element={<Suspense fallback={null}><Tasks /></Suspense>} />
</Routes>
```

```ts
{
  path: "tasks",
  loadChildren: () => import("./tasks/tasks.routes").then((m) => m.routes),
}
```

## Things to be careful about

Five differences are worth flagging explicitly because they trip up React developers in their first weeks of Angular. Templates are not JavaScript XML — the syntax `(click)`, `[disabled]`, `@for`, and `@if` is Angular's own template language with its own semantics, and trying to use JSX-like patterns inside a template produces compiler errors. Two-way binding (`[(ngModel)]`, `[(model)]`) does not have a direct React analogue; React forces the developer to pair `value` with `onChange` manually, which is the same mental model but more verbose. Decorators on classes are everywhere in Angular, and the "everything is a function" idiom of modern React does not apply — even the most function-flavoured Angular APIs (`signal`, `inject`) live inside class bodies. Dependency Injection is the right reach for cross-component state and services in nearly every case; teams arriving from React often reach for context-like patterns when DI would be cleaner. Change Detection with Signals is conceptually close to React 19 with fine-grained reactivity, but with Zone.js the model is materially different — every async event is a potential render trigger, which can be confusing if the developer expects React's "render only on state change" semantics.

## The framing senior candidates typically present in interviews

> "I would reach for Angular's primitives the same way I reach for React's: a `signal` where I would use `useState`, a `computed` where I would use `useMemo`, an `effect` where I would use `useEffect`, and an injected service where I would use a context. The two substantial differences that do not transfer one-for-one are Dependency Injection (much heavier in Angular, but in a way that materially helps testability) and the template syntax (it is its own Domain-Specific Language — about a week of practice to internalise)."

That answer demonstrates the candidate can be productive in either framework without overselling Angular as "React with extra steps".

## Key takeaways

- Hooks map to Signals plus `inject()`: `useState` → `signal`, `useMemo` → `computed`, `useEffect` → `effect`, `useContext` → `inject(SomeService)`.
- React Context maps to Angular Dependency Injection; the latter is heavier syntactically but materially better for testability and lifetime control.
- React Router maps to the Angular Router with `withComponentInputBinding()`, which provides the same "route params as component inputs" ergonomics as `useParams`.
- Zustand and Redux map to a signal-based service registered with `providedIn: "root"`; the same store pattern, expressed as a class with signal fields.
- Templates are a Domain-Specific Language; expect about a week to internalise the syntax of bindings, structural directives, and control-flow blocks.

## Common interview questions

1. How would you implement `useState` in Angular?
2. What's the Angular equivalent of `useEffect`?
3. How does Angular's DI replace React Context?
4. Two-way binding — where is the subtlety?
5. Walk me through migrating a small React component to Angular.

## Answers

### 1. How would you implement `useState` in Angular?

Use `signal()` from `@angular/core`. The function returns a writable signal with a current value, a setter, and an updater. Reading the signal in a template binding establishes a dependency, so the template re-renders when the signal changes; reading inside a `computed` or `effect` establishes the same dependency for derivations and side effects. The mental model is identical to `useState` in React 19 with the Signals proposal.

**How it works.** `signal(initial)` returns a function that, when called, returns the current value. The function exposes `.set(newValue)` for replacing the value and `.update((prev) => next)` for transformations on the previous value. The framework tracks reads inside the surrounding tracking context (a template binding, a `computed`, an `effect`) and invalidates the dependent computations when the signal changes.

```ts
// React: useState
const [count, setCount] = useState(0);
setCount(count + 1);
setCount((c) => c + 1);

// Angular: signal — same shape, slightly different syntax.
import { signal } from "@angular/core";

count = signal(0);
this.count.set(this.count() + 1);
this.count.update((c) => c + 1);
```

**Trade-offs / when this fails.** The pattern is the right shape for synchronous component state, the same situations where `useState` is right in React. The pattern fails for state that is fundamentally a stream over time (WebSocket messages, debounced inputs); for those, RxJS Observables remain the better fit, with `toSignal()` bridging into the Signal world when synchronous template reads are needed.

### 2. What's the Angular equivalent of `useEffect`?

Use `effect()` from `@angular/core`. The function takes a callback that reads signals (and optionally other reactive sources) and re-runs the callback whenever any of those reads change. The callback can return (or use the `onCleanup` parameter to register) a cleanup function that runs before the next execution and on disposal of the surrounding injector.

**How it works.** `effect(fn)` registers `fn` to run inside the framework's reactive tracking context. The first run captures the dependencies; subsequent runs are triggered by changes to any of those dependencies. The framework runs the cleanup function before each subsequent run and one final time when the component is destroyed. The pattern matches `useEffect` in React, with the difference that the dependency tracking is automatic — the developer does not maintain a manual dependency array.

```ts
// React: useEffect with explicit deps array.
useEffect(() => {
  document.title = `Count: ${count}`;
  return () => { /* cleanup */ };
}, [count]);

// Angular: effect — automatic dependency tracking via signal reads.
import { effect } from "@angular/core";

constructor() {
  effect((onCleanup) => {
    document.title = `Count: ${this.count()}`;
    onCleanup(() => { /* cleanup */ });
  });
}
```

**Trade-offs / when this fails.** `effect` must be created in an injector context (a constructor, a class field initialiser, a factory), so calling it later requires explicitly passing a `DestroyRef`. The framework forbids signal writes from inside an effect by default (because they commonly create feedback loops); use `allowSignalWrites: true` only with a clear reason. The pattern fails when the developer reaches for `effect` to compute a derived value that should be `computed` instead — the derivation is then not memoised and re-runs the side effect on every read.

### 3. How does Angular's DI replace React Context?

React Context provides a way for a parent component to make a value available to descendants without prop drilling; consumers read the value via `useContext(SomeContext)`. Angular's Dependency Injection provides the same capability with substantially more structure: services are registered at a chosen lifetime scope (root, route, component) via providers, and consumers read them via `inject(SomeService)`. The Angular form has more ceremony but offers concrete benefits — typed instances, swappable providers for testing, hierarchical scoping, and tree-shakeable singletons.

**How it works.** When a component or service requests a token via `inject(Token)`, the injector walks the hierarchy starting from the consumer's own injector, then climbing to parents until it finds a provider. The provider returns the instance, which the consumer captures in a class field. Substituting the implementation in tests is a matter of registering a different provider in the test bed; the consumer code is unchanged.

```ts
// React: Context provider + consumer.
const ThemeContext = createContext<Theme>("light");
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>
function MyComponent() {
  const theme = useContext(ThemeContext);
}

// Angular: service + DI.
@Injectable({ providedIn: "root" })
export class ThemeService {
  current = signal<Theme>("light");
}
@Component({ /* ... */ })
export class MyComponent {
  private theme = inject(ThemeService);
}
```

**Trade-offs / when this fails.** Angular's DI is the right shape for cross-component state and services in nearly every case. The pattern fails when the team reaches for context-like patterns (a global store smuggled through a `BehaviorSubject`) when a `providedIn: "root"` service would be cleaner. The pattern also has more setup cost than Context for small examples, but the cost amortises quickly across a real application.

### 4. Two-way binding — where is the subtlety?

Angular's two-way binding `[(model)]="value"` is syntactic sugar for `[model]="value" (modelChange)="value = $event"`. The subtlety is that the assignment on the right side of `(modelChange)` mutates the parent's bound expression directly, which works for simple property bindings but can produce unexpected behaviour when the bound expression is more complex — when the value lives inside a service, when the parent expects to intercept the change for validation, or when the parent uses a Signal and expects its updater function to run.

**How it works.** When the child emits `modelChange`, the framework runs the assignment expression (`value = $event`) in the parent's context. For a Signal-bound parent, this means the framework calls the signal's setter; for a `BehaviorSubject`-bound parent, this means the framework calls `next` on the subject. The pattern works when the parent's intent is exactly "store the value as-is"; it fails when the parent wants to validate, transform, or otherwise interpose on the change.

```html
<!-- Two-way binding — the cleaner-looking but less flexible form. -->
<app-task [(title)]="task.title" />

<!-- Equivalent explicit form — more flexible, intercepts the change. -->
<app-task [title]="task.title" (titleChange)="onTitleChange($event)" />
```

**Trade-offs / when this fails.** Two-way binding is the right shape for simple form fields where the parent does want to mirror the child's value exactly. The pattern fails when the parent needs to validate, transform, or react to the change beyond storing it; the cure is to use the explicit `[input] (inputChange)` form so the parent has full control. The pattern also fails when the value lives behind a Signal whose updater logic is non-trivial; the cure is again the explicit form so the handler can call `signal.update(...)` with the right transformation.

### 5. Walk me through migrating a small React component to Angular.

Start by identifying the React component's three responsibilities: the state it holds, the side effects it performs, and the user interface it renders. Each maps to a specific Angular primitive. The state becomes signal-backed component fields. The side effects become `effect()` calls in the constructor (or lifecycle hooks for legacy code that needs `ngOnInit` semantics). The user interface becomes a template using Angular's binding syntax (`{{}}` for interpolation, `[prop]` for property binding, `(event)` for event binding, `@if`/`@for` for control flow).

**How it works.** The migration is mostly mechanical for components without external dependencies. For a component that uses React Context, the corresponding Angular pattern is `inject(SomeService)` with the service registered at the appropriate lifetime scope. For a component that uses TanStack Query, the corresponding Angular pattern is an `HttpClient` call wrapped in `toSignal` (for synchronous template reads) or kept as an Observable bound via the `async` pipe (for the more streaming-oriented use cases).

```tsx
// React component to migrate.
function Counter({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => { document.title = `Count: ${count}`; }, [count]);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```ts
// Angular equivalent.
import { Component, effect, input, signal } from "@angular/core";

@Component({
  selector: "app-counter",
  standalone: true,
  template: `<button (click)="count.set(count() + 1)">{{ count() }}</button>`,
})
export class CounterComponent {
  initial = input.required<number>();
  count = signal(0);

  constructor() {
    effect(() => { this.count.set(this.initial()); });   // initial sync from input
    effect(() => { document.title = `Count: ${this.count()}`; });
  }
}
```

**Trade-offs / when this fails.** The migration is straightforward for self-contained components and components that read context-equivalent values. The migration is harder for components that depend on React-specific patterns — error boundaries, suspense, the React-Redux selector pattern; for those, the senior framing is "I would identify the pattern's intent, find the Angular primitive that expresses the same intent (an `ErrorHandler`, a resolver, a service exposing computed signals), and map the component's responsibilities accordingly". The pattern fails when the team tries to translate React idioms verbatim without considering the Angular conventions; the cure is to think in terms of intent rather than syntax.

## Further reading

- [Angular for React developers (2026 dev.to articles)](https://dev.to/) — search for current writeups.
- [Angular's official "what is Angular" page](https://angular.dev/overview).
