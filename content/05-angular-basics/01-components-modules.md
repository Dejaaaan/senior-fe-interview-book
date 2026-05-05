---
title: "Components, modules, standalone"
sidebar_label: "5.1 Components, modules, standalone"
description: "How an Angular app is composed: components, modules (legacy), and standalone components (the 2026 default)."
sidebar_position: 1
---

Angular applications are trees of components. Each component is a coherent bundle of four parts: a TypeScript class that holds state and methods, a template (HTML, either in a separate file or inline) that renders the user interface, a stylesheet (CSS or Syntactically Awesome Style Sheets) scoped to the component by default, and a selector that names the component as a custom element so other templates can reference it.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. CLI: Command-Line Interface. CSS: Cascading Style Sheets. DI: Dependency Injection. DOM: Document Object Model. HTML: HyperText Markup Language. SaaS: Software-as-a-Service. SCSS: Syntactically Awesome Style Sheets. TS: TypeScript. UI: User Interface. XHR: XMLHttpRequest.

```ts
import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-counter",
  standalone: true,
  imports: [CommonModule],
  template: `
    <button (click)="dec()">−</button>
    <span>{{ count() }}</span>
    <button (click)="inc()">+</button>
  `,
  styles: [`button { padding: 0.25rem 0.5rem; } span { margin: 0 0.5rem; }`],
})
export class CounterComponent {
  count = signal(0);
  inc() { this.count.update((n) => n + 1); }
  dec() { this.count.update((n) => n - 1); }
}
```

## Decorators

Angular leans heavily on TypeScript decorators — `@Component`, `@Injectable`, `@NgModule`, `@Input`, `@Output`. The decorators are metadata that the Angular compiler reads at build time to wire Dependency Injection, configure Change Detection, and compile the template into instructions the runtime can execute. A senior coming from React should think of decorators as compile-time configuration analogous to React's higher-order components or `forwardRef` markers, but applied through TypeScript's decorator syntax rather than a function call.

The clear trend in 2024-2026 is for Angular to replace the decorator-based interfaces with function-like alternatives — `input()` instead of `@Input()`, `output()` instead of `@Output()`, `inject()` instead of constructor injection, `signal()` for reactive state. The function-based form has better TypeScript inference, can be called inside helper functions, and aligns Angular more closely with the rest of the JavaScript ecosystem.

## Templates

Angular's templates have their own mini-syntax:

| Syntax | Meaning |
| --- | --- |
| `{{ expression }}` | Interpolation |
| `[prop]="expr"` | Property binding (one-way to DOM) |
| `(event)="handler($event)"` | Event binding |
| `[(ngModel)]="prop"` | Two-way (banana-in-a-box) |
| `*ngIf`, `*ngFor` | Structural directives (legacy) |
| `@if`, `@for`, `@switch` | Built-in control flow (Angular 17+, the modern way) |
| `<ng-container>` | Logical wrapper, no DOM element |
| `<ng-template #ref>` | Inert template; render via directive |

The new control flow syntax (Angular 17+):

```html
@if (user(); as u) {
  <p>Hi, {{ u.name }}</p>
} @else {
  <a routerLink="/login">Sign in</a>
}

@for (task of tasks(); track task.id) {
  <li>{{ task.title }}</li>
} @empty {
  <li>No tasks yet.</li>
}
```

The new syntax is preferable to `*ngIf` and `*ngFor` for three concrete reasons. The TypeScript inference is materially better — narrowing inside an `@if` block recognises the condition without needing the `as` alias, and the body can directly reference the narrowed type. The `@for` form requires an explicit `track` expression, which forces the developer to think about identity and prevents the silent O(n²) re-render bug caused by missing `trackBy`. And the `@empty` block replaces the separate `<ng-template>` plumbing previously needed to render an empty-state alternative, which makes the empty state visible in the same place as the iteration logic.

Use the new syntax in any Angular 17+ codebase. The `@angular/cli` migration tool can convert existing `*ngIf` and `*ngFor` usages automatically with `ng generate @angular/core:control-flow`.

## Inputs and outputs (signal-based)

```ts
import { Component, input, output } from "@angular/core";

@Component({
  selector: "app-task",
  standalone: true,
  template: `
    <span [class.done]="task().done">{{ task().title }}</span>
    <button (click)="toggle.emit(task().id)">toggle</button>
  `,
})
export class TaskComponent {
  task = input.required<{ id: string; title: string; done: boolean }>();
  toggle = output<string>();
}
```

Old syntax (`@Input()`, `@Output()`) still works; `input()` / `output()` are the modern equivalents.

## Standalone components (the 2026 default)

Before Angular 15, every component had to belong to an `NgModule` — a separate file that declared which components were part of the module, which other modules it imported, which components it exported, and which providers it contributed to dependency injection. This indirection added boilerplate and a layer of mental indirection between "I want to use this component" and "the import that makes it available". For example:

```ts
@NgModule({
  declarations: [CounterComponent, TasksComponent],
  imports: [CommonModule, FormsModule],
  exports: [CounterComponent],
})
export class TasksModule {}
```

This boilerplate is deprecated as of Angular 19, and starting with Angular 19 every component is standalone by default. Modern Angular uses standalone components, where each component declares its own imports inline:

```ts
@Component({
  standalone: true,                                    // optional in 19+ (the default)
  imports: [CommonModule, FormsModule, OtherStandaloneComponent],
  selector: "app-tasks",
  template: `<!-- ... -->`,
})
```

Each component declares its own dependencies directly. There is no `NgModule` to maintain. The build's tree-shaker can prune unused exports more aggressively because the dependency graph is direct rather than mediated by module boundaries; bundles are smaller as a result. The mental model also collapses: "to use this component, import it" replaces "to use this component, import the module that declares it, then check that the module is imported by the module of the component that wants to use it".

Reading a legacy codebase will still encounter `NgModule` for years to come, because large enterprises do not migrate overnight. For new code in 2026, always standalone.

## Bootstrapping a standalone app

```ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
});
```

`bootstrapApplication` replaces `platformBrowserDynamic().bootstrapModule(AppModule)`.

## View encapsulation

Angular scopes component CSS by default using the `Emulated` encapsulation mode, which means styles declared in a component apply only to that component's Document Object Model subtree. The implementation rewrites every selector with a per-component attribute (`[_ngcontent-c0]`), so a `button` selector inside the component effectively becomes `button[_ngcontent-c0]` in the compiled CSS — preventing the styles from leaking to elements rendered by other components.

Several escape hatches exist when global or contextual styling is needed. `:host` selects the component's root element from inside its own stylesheet, which is the right place to set the component's outer-edge styles. `:host-context(.dark)` matches the component's root only when an ancestor matches the given selector, which is useful for theming. `::ng-deep` pierces the encapsulation boundary but is deprecated; the recommended replacement is to expose CSS custom properties (variables) at the component boundary so the parent can theme the component without reaching past its encapsulation. Setting `encapsulation: ViewEncapsulation.None` removes the encapsulation entirely for the component, which is occasionally appropriate for a global stylesheet host but rarely correct for a regular component.

## Change detection

When state in the application changes, Angular runs Change Detection across the component tree to determine which views need to re-render. By default the framework uses Zone.js to detect "something happened" — Zone.js patches every asynchronous primitive in the browser (`setTimeout`, `setInterval`, event listeners, `XMLHttpRequest`, `fetch`) and notifies the framework when any of them fire. The framework then walks the component tree, evaluates each binding, and updates the Document Object Model where values have changed.

The default mode (`Default`) re-evaluates every binding in every component on every Change Detection cycle, which is correct but expensive. The performance optimisation is `ChangeDetectionStrategy.OnPush`, which marks a component to re-render only under specific conditions: one of its `@Input` references changes (note: reference equality, not deep equality), the component dispatches an event handler, an observable subscribed via the `async` pipe emits, or a signal the component reads changes.

```ts
@Component({
  selector: "app-task-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<!-- ... -->`,
})
export class TaskListComponent {
  tasks = input.required<Task[]>();
}
```

The clear direction in 2024-2026 is the combination of Signals and zoneless Change Detection. Components subscribe implicitly to the specific signals they read, and the framework re-renders only the components whose signals have changed — without scanning the entire tree. The performance is closer to React with fine-grained reactivity, and removing Zone.js eliminates an entire class of subtle bugs caused by the patched async primitives interacting with third-party code.

## Lifecycle hooks

| Hook | When |
| --- | --- |
| `ngOnInit` | After first input binding |
| `ngOnChanges` | When inputs change (with `SimpleChanges`) |
| `ngAfterViewInit` | After child views initialised |
| `ngOnDestroy` | Before component destroyed (cleanup) |

For standalone + signals, prefer `effect()` and `afterNextRender()`/`afterRender()` over `ngOnInit`/`ngAfterViewInit`.

## Project structure

A standard Angular CLI app:

```text
src/
├── app/
│   ├── core/                 # singletons (auth service, interceptors)
│   ├── shared/               # reusable components/pipes
│   ├── features/
│   │   ├── tasks/
│   │   │   ├── tasks.component.ts
│   │   │   ├── task-list.component.ts
│   │   │   └── tasks.routes.ts
│   │   └── settings/...
│   ├── app.component.ts
│   ├── app.routes.ts
│   └── main.ts
├── environments/
└── index.html
```

Feature folders, lazy-loaded routes per feature, shared utilities in `core/` and `shared/`.

## Key takeaways

- Standalone components and the built-in control flow syntax (`@if`, `@for`, `@switch`) are the 2026 default; new code should use both, while reading skill in `NgModule`-based code remains necessary for legacy enterprise applications.
- The function-based APIs (`input()`, `output()`, `inject()`, `signal()`) are replacing the decorator-based equivalents (`@Input`, `@Output`, constructor injection); they offer materially better TypeScript inference and align Angular with the rest of the JavaScript ecosystem.
- View encapsulation scopes styles per component using compile-time selector rewriting; CSS custom properties are the recommended escape hatch for component-boundary theming.
- The combination of `OnPush` Change Detection and Signals delivers performance comparable to React with fine-grained reactivity, and zoneless Change Detection eliminates the entire class of bugs caused by Zone.js patching the global async primitives.
- Read `NgModule`-based codebases; write standalone code for everything new.

## Common interview questions

1. What's a standalone component and why does Angular have it?
2. Difference between `*ngIf` and `@if`?
3. How does Angular's change detection work?
4. What's `ChangeDetectionStrategy.OnPush`?
5. Why has the team moved away from `NgModule`?

## Answers

### 1. What's a standalone component and why does Angular have it?

A standalone component is a component that declares its own dependencies (other components, directives, pipes) directly via the `imports` array on its `@Component` decorator, without belonging to an `NgModule`. The framework introduced standalone components in Angular 14 (preview), made them stable in Angular 15, and made them the default in Angular 19. The motivation is to remove the `NgModule` indirection that had become the largest source of friction in Angular adoption — the boilerplate of declaring every component in a module, the mental indirection of "to use this, import the module that declares it", and the ceremony of arranging modules to support lazy loading.

**How it works.** A standalone component opts in via `standalone: true` (or, in Angular 19+, simply does not opt out of the new default). Its `imports` array names every other component, directive, pipe, or module the template uses; the compiler validates that each is available and emits a tree-shakable reference. The application bootstraps with `bootstrapApplication(RootComponent, { providers: [...] })` rather than `platformBrowserDynamic().bootstrapModule(AppModule)`, and lazy-loaded routes use `loadComponent: () => import("./feature.component").then(m => m.FeatureComponent)` rather than `loadChildren` pointing at a module.

```ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TaskComponent } from "./task.component";

@Component({
  standalone: true,
  selector: "app-task-list",
  imports: [CommonModule, TaskComponent],   // direct dependency declaration
  template: `@for (t of tasks; track t.id) { <app-task [task]="t" /> }`,
})
export class TaskListComponent {
  tasks = [/* ... */];
}
```

**Trade-offs / when this fails.** Standalone components require the developer to think about which dependencies each template uses, where previously a single shared `SharedModule` exported "everything we usually need" and most components imported it. The cure for the noise is to compose related dependencies into typed constants (`export const TASK_DEPS = [CommonModule, TaskComponent] as const`) that components can spread into their `imports`. The pattern fails for legacy applications mid-migration where some routes are still module-based; the cure is to migrate one route at a time using the framework's `ng generate @angular/core:standalone` schematic.

### 2. Difference between `*ngIf` and `@if`?

`*ngIf` is a structural directive that has been part of Angular since version 2; `@if` is a built-in control flow primitive introduced in Angular 17. Functionally they conditionally render their content, but `@if` is preferable in modern Angular because it has better TypeScript narrowing inside the block, requires no separate `<ng-template>` for the `else` branch, and avoids the structural-directive overhead of creating a hidden view container. The new syntax is also part of the framework's compiler rather than implemented as a directive, so the build can optimise it more aggressively.

**How it works.** The compiler translates `@if` into instructions that conditionally create or destroy the view, just as it does for `*ngIf`, but without the directive plumbing. The narrowing inside the block uses TypeScript's control-flow analysis to recognise that the condition is true within the block, so accessing properties on the narrowed value works without an `as` alias.

```html
<!-- *ngIf — older, requires `as` for narrowing, separate else template. -->
<div *ngIf="user$ | async as user; else guest">
  Hi, {{ user.name }}
</div>
<ng-template #guest><a routerLink="/login">Sign in</a></ng-template>

<!-- @if — modern, narrowing without `as`, inline else. -->
@if (user(); as u) {
  <div>Hi, {{ u.name }}</div>
} @else {
  <a routerLink="/login">Sign in</a>
}
```

**Trade-offs / when this fails.** `@if` requires Angular 17+; older codebases must continue using `*ngIf` until they upgrade. The migration is straightforward — `ng generate @angular/core:control-flow` converts existing usages — but mixing the two styles in the same file is confusing for readers and is best avoided. The pattern is wrong when an existing codebase has many directives that interact with `*ngIf` via structural directive composition; for those, migrate the directives first, then the conditionals.

### 3. How does Angular's change detection work?

Angular's Change Detection is the process by which the framework determines which views need to re-render and updates the Document Object Model accordingly. By default, Angular uses Zone.js to detect that something asynchronous has happened — Zone.js patches the global async primitives (`setTimeout`, `setInterval`, event listeners, `XMLHttpRequest`, `fetch`, `Promise.then`) and notifies the framework when any of them fire. On notification, the framework walks the component tree from root to leaves, evaluates every binding in every component, and updates any DOM property whose value has changed.

**How it works.** Each component has a Change Detector (`ChangeDetectorRef`) that knows how to evaluate its bindings. The default mode (`Default`) re-evaluates every binding on every cycle, which is correct because Angular cannot know which binding depends on which state without runtime analysis. The `OnPush` mode adds explicit triggers — input reference change, event handler dispatch, async pipe emission, signal change — and skips the component (and its descendants, unless they have their own triggers) on cycles where none of the triggers fired.

```ts
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";

@Component({
  selector: "app-counter",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button (click)="inc()">{{ count() }}</button>`,
})
export class CounterComponent {
  count = signal(0);                            // signal change triggers CD on this component
  inc() { this.count.update((n) => n + 1); }
}
```

**Trade-offs / when this fails.** The Default mode is simple but expensive on large trees; the OnPush mode is fast but requires the developer to use immutable updates for `@Input` references (a mutated array does not change reference and does not trigger CD) and to be aware of the trigger conditions. The Zone.js patching is elegant but can interact badly with third-party libraries that monkey-patch the same primitives; the cure is the zoneless mode, which removes Zone.js entirely and relies on signals and explicit `markForCheck()` calls. The pattern fails for legacy applications that depend on "any change anywhere triggers a re-render" semantics; migrating those to `OnPush` requires a careful audit of every input mutation.

### 4. What's `ChangeDetectionStrategy.OnPush`?

`ChangeDetectionStrategy.OnPush` is the opt-in performance mode that tells the framework to skip a component during Change Detection unless one of four specific triggers has occurred. The triggers are: an `@Input` reference changes (immutable update detected by reference equality), an event handler in the component fires, an observable subscribed via the `async` pipe emits a new value, or a signal the component reads changes value. Outside of these triggers, the framework leaves the component's bindings untouched, which can be the difference between a 16-millisecond and a 200-millisecond render on a large tree.

**How it works.** The framework marks each component as "checked" or "needs check". Default-strategy components are always marked "needs check" on every cycle. OnPush components are marked "needs check" only when one of the triggers fires; on cycles where they remain "checked", the framework skips them entirely and visits only their non-OnPush children (or descendants that have been explicitly marked via `markForCheck()`).

```ts
@Component({
  selector: "app-product",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2>{{ product().name }}</h2><p>{{ price() }}</p>`,
})
export class ProductComponent {
  product = input.required<Product>();           // reference change triggers CD
  price = computed(() => `$${this.product().price.toFixed(2)}`);
  // No event handlers, no signals beyond computed -> very few CD cycles.
}
```

**Trade-offs / when this fails.** OnPush requires immutable updates for `@Input` references; mutating an array in place (`.push()`) does not change the reference and does not trigger Change Detection on the OnPush child. The cure is to enforce immutable updates via spreading (`tasks = [...tasks, newTask]`) and, when the child does not see expected updates, to verify the parent is producing new references. The pattern also fails when a component reads from a service whose state is mutated externally; for those, subscribe to the service via the `async` pipe or migrate to signals so the component is correctly notified of changes.

### 5. Why has the team moved away from `NgModule`?

The Angular team moved away from `NgModule` because it had become the largest source of friction in Angular adoption and the largest source of accidental complexity in production codebases. Modules added boilerplate (every component had to be declared in some module), introduced an indirection layer (using a component required importing the module that declared it), made tree-shaking harder (the build had to reason about transitive module exports rather than direct dependencies), made lazy loading more verbose (each lazy route needed a module wrapping it), and contributed nothing the framework actually needed for the runtime — the metadata was a build-time organisational construct that did not survive into the running application.

**How it works.** Standalone components replace the module by letting each component declare its dependencies directly. The compiler validates the dependencies, the tree-shaker prunes unused exports based on direct import edges, and lazy loading uses dynamic `import()` with `loadComponent` rather than `loadChildren`. The framework's runtime is unchanged — the same Change Detection, Dependency Injection, and template compilation — but the surface the developer interacts with is materially smaller.

```ts
// Old: lazy-loaded module wrapping the feature.
const routes: Routes = [{
  path: "tasks",
  loadChildren: () => import("./tasks/tasks.module").then(m => m.TasksModule),
}];

// New: lazy-loaded standalone component directly.
const routes: Routes = [{
  path: "tasks",
  loadComponent: () => import("./tasks/tasks.component").then(m => m.TasksComponent),
}];
```

**Trade-offs / when this fails.** The migration is incremental — standalone components and `NgModule` can coexist in the same application — but a large legacy codebase will take months to convert. The cure is to migrate one route at a time using the official schematics, prioritising routes that are frequently modified. The pattern is wrong only when a third-party library still requires `NgModule`-based registration; for those, keep the module for the third-party integration and treat it as a leaf rather than as the structuring principle.

## Further reading

- [Angular standalone components](https://angular.dev/guide/components/importing).
- [Angular control flow syntax](https://angular.dev/guide/templates/control-flow).
- [Angular Signals overview](https://angular.dev/guide/signals).
