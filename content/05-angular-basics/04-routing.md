---
title: "Routing & guards"
sidebar_label: "5.4 Routing & guards"
description: "The Angular Router: configuration, lazy loading, function guards, and resolvers."
sidebar_position: 4
---

The Router is Angular's single-page navigation engine. It maps Uniform Resource Locators to components, manages browser history, lazy-loads features for code splitting, and provides hooks (guards and resolvers) for cross-cutting concerns such as authentication, feature flags, and pre-fetched route data.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. DI: Dependency Injection. SPA: Single-Page Application. URL: Uniform Resource Locator.

## Configuration

```ts
// app.routes.ts
import { Routes } from "@angular/router";
import { authGuard } from "./auth.guard";

export const routes: Routes = [
  { path: "", loadComponent: () => import("./home/home.component").then((m) => m.HomeComponent) },
  {
    path: "tasks",
    canActivate: [authGuard],
    loadChildren: () => import("./tasks/tasks.routes").then((m) => m.routes),
  },
  { path: "login", loadComponent: () => import("./auth/login.component").then((m) => m.LoginComponent) },
  { path: "**", redirectTo: "" },
];
```

`loadComponent` and `loadChildren` enable code-splitting per route — like React's `lazy()` but built in.

## Bootstrapping

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
  ],
});
```

`withComponentInputBinding()` is the modern way to map route params to component `input()` signals.

## RouterOutlet, RouterLink

```html
<nav>
  <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
  <a routerLink="/tasks" routerLinkActive="active">Tasks</a>
</nav>

<router-outlet></router-outlet>
```

`<router-outlet>` is where the matched component renders. `routerLink` is the equivalent of `<a href>` that doesn't full-reload.

## Route parameters

```ts
{ path: "tasks/:id", component: TaskDetailComponent }
```

```ts
import { Component, input } from "@angular/core";

@Component({ ... })
export class TaskDetailComponent {
  id = input.required<string>();   // bound from `:id` via withComponentInputBinding()

  task = computed(() => this.taskService.byId(this.id()));
}
```

For older code:

```ts
constructor(route: ActivatedRoute) {
  route.paramMap.subscribe((params) => {
    this.id = params.get("id")!;
  });
}
```

## Query params and fragments

```html
<a [routerLink]="['/tasks']" [queryParams]="{ status: 'open' }" fragment="filter">Open tasks</a>
```

```ts
route.queryParamMap.subscribe((q) => console.log(q.get("status")));
```

## Guards (function-based)

A guard decides whether a route can be visited.

```ts
import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "./auth.service";

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return router.parseUrl(`/login?from=${encodeURIComponent(state.url)}`);
};
```

Five guard flavours exist, all of them function-based in modern Angular. `CanActivateFn` decides whether navigation to the route should proceed — the typical authentication gate. `CanActivateChildFn` does the same check for any child route, useful for guarding an entire subtree without listing the guard on every child. `CanDeactivateFn<T>` decides whether the user can leave the current route, which is the standard dirty-form-check pattern (the guard receives the component instance and inspects whether the form is dirty). `CanMatchFn` decides whether a route definition is even considered during matching — lighter than `CanActivate` because it runs before the router commits to the route, which is the right shape for feature-flag-driven routing where a gated route should not even appear in the matching set. `CanLoadFn` is deprecated; new code should use `CanMatchFn` instead.

```ts
{
  path: "billing",
  canMatch: [hasFeatureFn("billing-v2")],
  loadComponent: () => import("./billing/billing.component").then((m) => m.BillingComponent),
}
```

## Resolvers

Pre-fetch data before activating a route. The component receives resolved data via the `data` map (or with `withComponentInputBinding()`, as inputs).

```ts
export const taskResolver: ResolveFn<Task> = (route) => {
  const id = route.paramMap.get("id")!;
  return inject(TasksService).get(id);
};

export const routes: Routes = [
  { path: "tasks/:id", component: TaskDetail, resolve: { task: taskResolver } },
];
```

```ts
@Component({ ... })
export class TaskDetail {
  task = input.required<Task>();
}
```

The router won't navigate (or will show a loading state via `<router-outlet>`'s observability) until the resolver completes. Good for "I need this data before rendering"; bad for "loading screens with placeholders" (use Suspense-like patterns instead).

## Nested routes

```ts
{
  path: "tasks",
  component: TasksLayout,           // a layout with its own <router-outlet>
  children: [
    { path: "", component: TaskList },
    { path: ":id", component: TaskDetail },
  ],
}
```

`TasksLayout` renders `<router-outlet>` for the children. Same pattern as Next.js layouts.

## NavigationEnd events

```ts
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";

const router = inject(Router);
router.events
  .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
  .subscribe((e) => analytics.pageview(e.urlAfterRedirects));
```

For analytics page views, scroll restoration, etc.

## Scroll restoration

```ts
provideRouter(routes, withInMemoryScrolling({
  scrollPositionRestoration: "enabled",
  anchorScrolling: "enabled",
}));
```

Restores scroll position on back-nav, scrolls to fragments on forward-nav.

## Preloading lazy routes

```ts
import { PreloadAllModules, withPreloading } from "@angular/router";

provideRouter(routes, withPreloading(PreloadAllModules));
```

`PreloadAllModules` downloads all lazy chunks after initial bundle, in the background. Or write a custom strategy that preloads only routes you predict the user will visit (e.g. based on hover).

## Common bugs

Four bugs surface routinely in Angular routing. Forgetting `<router-outlet>` in a child layout — the layout renders, but the matched child route renders nothing because there is no outlet for it. A resolver that hangs the navigation forever — typically because the resolver returned an Observable that never completes (a `Subject` with no `complete()` call) or because the upstream Application Programming Interface call never returns. Guards returning a `boolean` synchronously from an `async` function — the function returns a `Promise<boolean>`, but the developer treated it as a synchronous return; the cure is to declare the guard as returning `Observable<boolean | UrlTree>` or `Promise<boolean | UrlTree>`. `routerLink` bound to a non-string array without proper typing — the framework expects either a string path or an array of path segments, and a misshapen value can produce silent navigation failures.

## Key takeaways

- Function guards and resolvers paired with `inject()` are the 2026 standard, replacing the deprecated class-based forms.
- `loadComponent` and `loadChildren` enable code splitting per route, similar to React's `lazy()` but built into the framework.
- `withComponentInputBinding()` maps route parameters, data, and query parameters directly to component inputs, eliminating the need to subscribe to `ActivatedRoute` in most cases.
- `CanMatchFn` is the right guard for feature-flag-driven routing because it runs before the router commits to the route definition.
- Resolvers are the right shape for "I need this data before rendering"; for pages that should show a skeleton while data loads, use a Suspense-like pattern instead.

## Common interview questions

1. How does Angular lazy-load routes?
2. Difference between `CanActivate` and `CanMatch`?
3. What does `withComponentInputBinding()` do?
4. How would you implement an unsaved-changes warning?
5. When to use a resolver vs fetching in `ngOnInit`?

## Answers

### 1. How does Angular lazy-load routes?

Angular lazy-loads routes via `loadComponent` (for a single component) or `loadChildren` (for a child route configuration), each accepting a function that returns a dynamic `import()`. The bundler (esbuild or Webpack) treats each dynamic import as a code-split point, emitting the imported module as a separate chunk. When the user navigates to the lazy route, the runtime fetches the chunk over the network, evaluates it, and instantiates the component or child routes.

**How it works.** The dynamic `import()` returns a Promise that resolves to the module's exports. The router awaits the Promise during navigation, so the route is only considered "activated" once the chunk has loaded. The chunk is cached by the browser like any other resource, so subsequent navigations to the same lazy route do not re-fetch it.

```ts
export const routes: Routes = [
  // Lazy-load a single component.
  {
    path: "tasks",
    loadComponent: () => import("./tasks/tasks.component").then(m => m.TasksComponent),
  },
  // Lazy-load a child route configuration.
  {
    path: "billing",
    loadChildren: () => import("./billing/billing.routes").then(m => m.routes),
  },
];
```

**Trade-offs / when this fails.** Lazy loading reduces the initial bundle but adds a round-trip when the user first visits the lazy route. The cure for the round-trip is preloading: `withPreloading(PreloadAllModules)` downloads every lazy chunk in the background after the initial bundle loads, or a custom strategy preloads only routes the user is likely to visit (based on hover, viewport visibility, or business heuristics). The pattern fails when the lazy route is on the critical path for first-time users; for those, eager loading is the correct shape.

### 2. Difference between `CanActivate` and `CanMatch`?

`CanActivate` runs after the router has matched a route definition and is about to activate it; the guard's `false` return cancels the activation but the route definition itself was matched (which can affect URL parsing, sibling matching, and lazy-load triggering). `CanMatch` runs during the matching phase itself; the guard's `false` return causes the router to skip the route definition entirely and continue matching against the next definition. The two have different semantics for routes whose existence should be conditional rather than whose access should be conditional.

**How it works.** During navigation, the router walks the route tree, matches the URL against each route definition, and activates the matched one. `CanMatch` is consulted during the matching walk — a `false` return makes the router pretend the definition does not exist, so a wildcard or fallback definition further down the list can match instead. `CanActivate` is consulted after the matching walk — a `false` return cancels the activation but does not allow another definition to match.

```ts
// Authentication gate — the route exists, just not for this user.
{
  path: "dashboard",
  canActivate: [authGuard],
  loadComponent: () => import("./dashboard/dashboard.component").then(m => m.DashboardComponent),
}

// Feature flag — the route should not even be considered if the flag is off.
{
  path: "billing",
  canMatch: [hasFeatureFn("billing-v2")],
  loadComponent: () => import("./billing/billing.component").then(m => m.BillingComponent),
}
```

**Trade-offs / when this fails.** Use `CanActivate` for permission checks where the route exists for some users; use `CanMatch` for feature flags or A/B test variants where the route should be invisible if the flag is off. The pattern fails when the team uses `CanActivate` for feature flags — the route is matched, the lazy chunk is fetched, then the activation is cancelled, which wastes bandwidth and creates an awkward "I just navigated and was sent back" experience for the user.

### 3. What does `withComponentInputBinding()` do?

`withComponentInputBinding()` is a router feature that maps route parameters, query parameters, and resolved route data directly to component `input()` properties whose names match. The component reads the values via the same `input()` API it uses for any other input, with no need to inject `ActivatedRoute` and subscribe to `paramMap` or `queryParamMap`. The result is much less boilerplate for the common case of "this route has an `:id`, the component needs the `id`".

**How it works.** When the router activates a route, it walks the matched component's `input()` declarations and binds each input whose name matches a route parameter, query parameter, or resolved data key. The bindings are reactive — as the parameters change (for example, on a sibling navigation), the inputs update and the component re-renders.

```ts
// Configuration:
provideRouter(routes, withComponentInputBinding());

// Route — :id is the parameter name.
{ path: "tasks/:id", component: TaskDetailComponent }

// Component — the input named `id` is bound automatically.
@Component({ /* ... */ })
export class TaskDetailComponent {
  id = input.required<string>();           // bound from `:id`
  highlight = input<boolean>(false);       // bound from query param `?highlight=true`
  task = input.required<Task>();           // bound from resolver { task: ... }
}
```

**Trade-offs / when this fails.** The pattern is the recommended modern way to consume route parameters and is the senior expectation for new code. The pattern fails when the parameter name conflicts with an existing input (which is rare but worth being aware of) or when the component needs the full `ActivatedRoute` for advanced use cases (matrix parameters, parent route data); for those, fall back to `inject(ActivatedRoute)`.

### 4. How would you implement an unsaved-changes warning?

Use a `CanDeactivateFn<T>` guard on the route hosting the form. The guard receives the component instance as its first argument; it inspects whether the form is dirty and, if so, prompts the user to confirm. If the user confirms, the guard returns `true` and the navigation proceeds; if the user cancels, the guard returns `false` and the navigation is aborted, leaving the form intact.

**How it works.** The router invokes the deactivate guard before destroying the current route's component. The guard's return value (synchronous boolean, Promise, or Observable) determines whether the navigation proceeds. The pattern composes with the browser's `beforeunload` event for hard navigations (closing the tab, refreshing the page); the route guard handles in-application navigation, and the `beforeunload` listener handles browser-level navigation.

```ts
import { CanDeactivateFn } from "@angular/router";

export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const dirtyFormGuard: CanDeactivateFn<CanComponentDeactivate> =
  (component) => component.canDeactivate ? component.canDeactivate() : true;

// Component implements the contract.
@Component({ /* ... */ })
export class EditTaskComponent implements CanComponentDeactivate {
  form = new FormGroup({ /* ... */ });
  canDeactivate() {
    if (!this.form.dirty) return true;
    return confirm("You have unsaved changes. Leave anyway?");
  }
}

// Route wires the guard.
{ path: "tasks/:id/edit", component: EditTaskComponent, canDeactivate: [dirtyFormGuard] }
```

**Trade-offs / when this fails.** The browser's `confirm()` dialog is the simplest way to ask, but a real product typically uses a custom modal for accessibility and styling reasons; the cure is to inject a modal service and return a Promise that resolves with the user's choice. The pattern also does not protect against the user closing the tab or refreshing the page — that requires a `beforeunload` listener (with the browser-imposed limitation that the message text is not customisable in modern browsers). The combined pattern (route guard + `beforeunload`) is the senior expectation for any non-trivial form.

### 5. When to use a resolver vs fetching in `ngOnInit`?

Use a resolver when the route should not activate until the data is available — the user should not see the route's component until the data is ready. Use `ngOnInit` (or, preferably, the modern `effect()` triggered by an input signal) when the route should activate immediately and the component should show its own loading state while the data fetches. The choice expresses the user experience the team intends: "wait at the previous route until ready" versus "navigate now, show a skeleton".

**How it works.** A resolver runs as part of the navigation, blocking the route activation until its returned Observable or Promise resolves. The resolved data is passed to the component as input (with `withComponentInputBinding()`) or via `ActivatedRoute.snapshot.data`. Fetching in `ngOnInit` happens after the route activates, so the user sees the component immediately and the component is responsible for rendering a loading state until the fetch completes.

```ts
// Resolver — navigation waits for the data.
export const taskResolver: ResolveFn<Task> = (route) => {
  const id = route.paramMap.get("id")!;
  return inject(TasksService).get(id);
};

// In-component fetch — navigation completes immediately, component shows loading.
@Component({ /* ... */ })
export class TaskDetailComponent {
  id = input.required<string>();
  task = toSignal(toObservable(this.id).pipe(switchMap(id => inject(TasksService).get(id))));
  // template renders @if (task(); as t) { ... } @else { <spinner /> }
}
```

**Trade-offs / when this fails.** Resolvers are the right shape when the route is meaningless without the data (a task detail page with no task); they are the wrong shape when the data takes long enough to fetch that the user perceives the navigation as "stuck" with no feedback. The cure for the "stuck" case is to either show progress in the previous route's UI (the navigation is in progress) or to switch to the in-component pattern with a skeleton. The senior framing is "use a resolver for fast, must-have data; use in-component fetching with a skeleton for slow data or data that benefits from incremental render".

## Further reading

- [Angular Router guide](https://angular.dev/guide/routing).
- [Functional router guards](https://angular.dev/api/router/CanActivateFn).
