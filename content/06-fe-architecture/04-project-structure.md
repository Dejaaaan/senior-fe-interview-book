---
title: "Project structure"
sidebar_label: "6.4 Project structure"
description: "Feature-sliced design, hexagonal-on-FE, and where to put hooks, services, and types."
sidebar_position: 4
---

A team has effectively one chance to set the directory structure of a frontend codebase well. Two years later it costs more to refactor the structure than to start over from scratch, because every existing import path, every developer's muscle memory, and every documentation reference must change in lockstep. Senior interviews probe whether the candidate can articulate a structure that scales past the toy application — past the initial fifty files into the hundreds and thousands that real products eventually contain.

> **Acronyms used in this chapter.** API: Application Programming Interface. CSS: Cascading Style Sheets. HTTP: HyperText Transfer Protocol. OpenAPI: OpenAPI Specification. UI: User Interface.

## The "by type" trap

Most React tutorials teach this:

```text
src/
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   └── UserList.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useUsers.ts
├── services/
│   ├── api.ts
│   └── analytics.ts
├── types/
│   └── User.ts
└── pages/
    ├── Home.tsx
    └── Profile.tsx
```

This shape works at ten files; at five hundred it becomes a serious operational problem. Three concrete failure modes recur. Touching one feature requires editing files scattered across `components/`, `hooks/`, `services/`, and `types/`, which makes pull requests cross-cutting and hard to review. It is invisible from the file system which files belong together, so a new engineer reading `UserList.tsx` cannot tell at a glance which hooks, services, and types form the cohesive unit the component belongs to. New engineers cannot find anything without grep, because the structure does not encode the intent — they have to learn the codebase's mental map separately from its physical layout.

## "By feature" structure

Group by the feature, not the file kind:

```text
src/
├── shared/                   # truly cross-feature
│   ├── ui/                   # design system primitives
│   ├── lib/                  # utilities
│   └── api/                  # http client, base config
├── features/
│   ├── auth/
│   │   ├── ui/               # LoginForm, SignupForm
│   │   ├── api/              # auth client + types
│   │   ├── model/            # state, hooks, validators
│   │   └── index.ts          # public exports
│   └── posts/
│       ├── ui/
│       ├── api/
│       ├── model/
│       └── index.ts
└── app/                      # routing, layout, providers
    ├── layout.tsx
    ├── page.tsx
    └── posts/page.tsx
```

The `index.ts` in each feature acts as a **public API barrel** — anything not exported from there is internal. Lint rules can enforce this.

## Feature-sliced design

A more opinionated take popular in 2024+: [feature-sliced design](https://feature-sliced.design/). Layers in dependency order:

```text
src/
├── app/        # composition: providers, routes, global styles
├── pages/      # page-level compositions
├── widgets/    # reusable cross-feature blocks (Header, Sidebar)
├── features/   # actions a user can perform (login, addToCart)
├── entities/   # business entities (User, Product, Cart)
└── shared/     # truly generic (UI kit, lib, api client)
```

The rule: **a layer can only import from layers below it**. `entities` doesn't know about `features`; `features` don't know about `widgets`. Enforced with ESLint or a custom checker.

This is overkill for small apps. For a 50-engineer codebase, it pays back the discipline tax.

## Hexagonal on the frontend

Borrowing from backend hexagonal architecture: separate **domain** (pure business logic) from **adapters** (HTTP, React, storage).

```text
features/cart/
├── domain/                  # pure functions and types — no React, no fetch
│   ├── cart.ts              # type Cart, addItem, removeItem, total
│   └── cart.test.ts
├── adapters/
│   ├── api.ts               # serialize/deserialize, HTTP calls
│   └── storage.ts           # IndexedDB persistence
├── ui/
│   ├── CartView.tsx
│   └── CartItem.tsx
└── model/
    ├── useCart.ts           # the hook that wires it all together
    └── cartStore.ts
```

Three benefits make this shape worthwhile for non-trivial features. The domain logic is pure (no React, no `fetch`, no `localStorage`), so it can be unit-tested without rendering anything and remains framework-agnostic — the same logic could be ported to a different UI framework or to a server-side worker without rewriting the business rules. Swapping the persistence layer (for example, replacing IndexedDB with a server-backed store) requires changing one file in the adapters layer; the domain and the UI are unaffected. The UI does not know how the data is fetched or stored, so the presentation can be tested with mocked adapters and the UI evolution does not require corresponding domain changes.

For purely presentational features (a static marketing page, a simple contact form), this layering is over-engineering. The honest test is "would I want to test this without React?" — if yes, the hexagonal split pays back; if no, a simpler structure is fine.

## Where to put...

| Thing | Goes |
| --- | --- |
| `Button`, `Input`, `Dialog` | `shared/ui/` |
| `useDebounce`, `useLocalStorage` | `shared/lib/hooks/` |
| `formatCurrency`, `parseDate` | `shared/lib/format/` |
| `Header`, `Sidebar`, `EmptyState` | `widgets/` (or `shared/ui/` if simple) |
| `LoginForm`, `useLogin` | `features/auth/` |
| `User` type, `getUserById` | `entities/user/` |
| API client + interceptors | `shared/api/` |
| Domain logic (e.g. cart math) | `features/cart/domain/` |
| Routing | `app/routes/` (or `app/` for Next.js) |

## Boundaries enforced by tooling

The rules above only stick if a machine enforces them. Two common approaches:

```js
// .eslintrc — restrict imports between layers
module.exports = {
  plugins: ["import"],
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./src/entities", from: "./src/features" },
        { target: "./src/features", from: "./src/widgets" },
        { target: "./src/shared", from: "./src/app" },
      ],
    }],
  },
};
```

Or use a dedicated tool like `dependency-cruiser` or `eslint-plugin-boundaries` for richer rules.

## Monorepo or not?

For a single application, a single repository is simpler — there is no build orchestration, no inter-package versioning, no cross-package import tooling. A monorepo (managed by Nx, Turborepo, or pnpm workspaces) earns its overhead when the team has at least one of three concrete needs: a shared design system consumed by multiple applications, where keeping the design system in lockstep with its consumers is critical; a shared API client generated from an OpenAPI Specification document, where the client must be versioned and consumed identically by every application; multiple deployable targets that share substantial code (a web application, a marketing site, a mobile application via React Native plus Expo), where duplicating the shared code across repositories would create drift and inconsistency.

```text
repo/
├── apps/
│   ├── web/
│   ├── marketing/
│   └── mobile/
├── packages/
│   ├── ui/                   # design system
│   ├── api-client/
│   └── analytics/
└── pnpm-workspace.yaml
```

The cost is build orchestration — Turborepo / Nx solve this with caching and task graphs. We cover this in [Build tooling & monorepos](../07-production-concerns/04-build-tooling.md).

## Naming

Two conventions are worth adopting universally. PascalCase for components and component-shaped types, camelCase for everything else (functions, variables, file names of non-component modules), and SCREAMING_SNAKE_CASE for environment-constant identifiers. Co-locate tests with the code they test (`Foo.tsx` next to `Foo.test.tsx`); the test belongs with the implementation, not in a parallel `__tests__/` mirror that drifts and forces engineers to navigate two trees in parallel.

## Key takeaways

- Do not structure by file kind (components, hooks, services); structure by feature, with each feature directory holding all the files that make up the feature.
- Feature-sliced design is over-engineered at small scale and valuable above approximately fifty engineers; the layer discipline becomes a substantial productivity gain at that size.
- Hexagonal-on-frontend separates domain (pure business logic) from adapters (HTTP, storage, UI); the split is worth it for non-trivial features and over-engineering for purely presentational ones.
- Layer boundaries are only meaningful if they are enforced by tooling — ESLint's `import/no-restricted-paths` or `dependency-cruiser` is the recommended approach.
- Monorepos earn their overhead when the team has multiple applications sharing libraries; for a single application, a single repository is simpler.
- Co-locate tests with the code they test; the parallel `__tests__/` mirror is an outdated pattern that causes drift.

## Common interview questions

1. Why is "by type" structure (`components/`, `hooks/`, `services/`) the wrong default for a large app?
2. How would you enforce that `entities/` can't import from `features/`?
3. When would you reach for hexagonal architecture on the frontend?
4. When does a monorepo earn its overhead?
5. Walk me through the file layout you'd propose for a new product team's repo.

## Answers

### 1. Why is "by type" structure (`components/`, `hooks/`, `services/`) the wrong default for a large app?

The "by type" structure groups files by what they are (a component, a hook, a service) rather than by what they belong to (a feature, a business capability). At small scale this is fine — there are few files per directory, and the structure is intuitive for newcomers familiar with the React ecosystem's conventions. At scale it becomes hostile: every feature is scattered across multiple directories, and the developer must hold the mental map of "which files in `components/`, `hooks/`, `services/`, and `types/` together implement the auth feature?". Touching one feature requires editing files in four directories, which makes pull requests cross-cutting and code review harder.

**How it works.** The "by feature" alternative groups every file that implements a feature in one directory. The auth feature owns its components, hooks, services, and types in `features/auth/`, with a public API exposed via `features/auth/index.ts`. Touching the feature means working in one directory; the cohesion is visible in the file system; and the public API surface is explicit rather than implicit.

```text
// Wrong shape: scattered across type-based directories.
components/LoginForm.tsx
hooks/useLogin.ts
services/authApi.ts
types/User.ts

// Right shape: cohesive feature directory.
features/auth/
├── ui/LoginForm.tsx
├── model/useLogin.ts
├── api/authApi.ts
├── types.ts
└── index.ts        // public API
```

**Trade-offs / when this fails.** The "by type" structure is appropriate at very small scale (under fifty files) where the overhead of organising by feature is not yet justified. The pattern fails when the codebase grows past that point and the team continues with the type-based shape; the cure is to migrate one feature at a time to the by-feature structure rather than attempting a big-bang rewrite. The senior framing is "the directory structure should reflect the cohesion of the code, not the categorisation of file kinds".

### 2. How would you enforce that `entities/` can't import from `features/`?

Enforce the rule with ESLint's `import/no-restricted-paths` rule or with a dedicated tool such as `dependency-cruiser` or `eslint-plugin-boundaries`. The rule defines layer boundaries declaratively (every import from `entities/` to `features/` is forbidden) and the linter rejects pull requests that violate the rule. The enforcement is critical because conventions that depend on developer discipline alone drift over time — a junior developer adds an import that "feels right", the reviewer does not catch it, and the layering erodes one PR at a time.

**How it works.** ESLint's `import/no-restricted-paths` rule lets the project declare zones with a `target` (the path the rule applies to) and a `from` (the path imports from `target` cannot reach). The rule runs on every file and reports any forbidden import as an error. Continuous Integration fails the build, so the rule is enforced before the code merges.

```js
// .eslintrc — block imports from features into entities.
module.exports = {
  plugins: ["import"],
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./src/entities", from: "./src/features",
          message: "entities/ may not import from features/." },
        { target: "./src/entities", from: "./src/widgets" },
        { target: "./src/features", from: "./src/widgets" },
        { target: "./src/shared", from: "./src/app" },
      ],
    }],
  },
};
```

**Trade-offs / when this fails.** The rule has zero runtime cost but adds a small amount of friction when the team genuinely needs to refactor — the rule rejects the import, and the developer must either lift the imported code to a lower layer or restructure the dependency. The pattern fails when the team disables the rule for "convenience" and the layering degrades; the cure is a project convention that disabling the rule requires a senior reviewer's explicit approval and a corresponding refactor ticket.

### 3. When would you reach for hexagonal architecture on the frontend?

Reach for hexagonal architecture when the feature has substantial business logic that is independent of the user interface and the persistence layer — anything you would want to test without rendering anything, anything that should survive a full UI rewrite, anything that the team genuinely owns the rules for (cart pricing, booking availability, search ranking, real-time collaboration logic). Stick with a simpler structure when the feature is purely presentational, when the business logic is trivially "send this form to the API", or when the feature is a thin shell over a library's primitives.

**How it works.** The hexagonal shape splits the feature into three layers. The domain holds pure functions and types — no React, no `fetch`, no global mutable state. The adapters translate between the domain and external systems — an HTTP adapter, a storage adapter, a Web Socket adapter. The UI consumes the domain through a thin model layer (a hook, a service) that orchestrates the adapters and exposes the domain's operations to the React tree. Testing the domain is fast (no rendering); testing the adapters is straightforward (mock the underlying API); the UI is simple (it just calls the model layer).

```text
features/cart/
├── domain/                  # pure: type Cart, addItem(cart, product), total(cart)
├── adapters/
│   ├── api.ts               # HTTP serialisation
│   └── storage.ts           # IndexedDB persistence
├── ui/                      # CartView.tsx, CartItem.tsx
└── model/useCart.ts         # the hook that wires domain + adapters + UI
```

**Trade-offs / when this fails.** The pattern adds three directories of structure to every feature that uses it, which is overhead. The pattern is the right shape when the domain logic is genuinely substantial and the team will benefit from the testability and the decoupling. The pattern is wrong when applied to features that have no real domain (a settings page, a profile editor); for those, a simpler shape is more honest. The senior framing is "use hexagonal where the domain logic exists; do not invent domain logic to justify the pattern".

### 4. When does a monorepo earn its overhead?

A monorepo earns its overhead when the team has at least one of three concrete needs that a multi-repo setup makes meaningfully harder. A shared design system consumed by multiple applications, where keeping the design system and its consumers in lockstep is critical and the multi-repo equivalent requires publishing every change to a registry and coordinating upgrades across repositories. A shared API client (typically generated from OpenAPI), where the client must be versioned and consumed identically by every application, and where a multi-repo setup creates drift between the schema and the consumers. Multiple deployable targets that share substantial code — a web application, a marketing site, a mobile application — where duplicating the shared code across repositories would lead to bug fixes that have to be ported manually.

**How it works.** A monorepo (managed by Nx, Turborepo, or pnpm workspaces) holds every package in one repository, with the package manager linking them via the workspace protocol. Changes to a shared package are immediately visible to every consumer, the type checker validates the consumers against the new shape, and the test suite runs against the actual integration. The cost is build orchestration — the build must understand which packages depend on which and rebuild only the affected ones, which Nx and Turborepo solve with caching and task graphs.

```text
repo/
├── apps/
│   ├── web/                # Next.js application
│   ├── marketing/          # Astro marketing site
│   └── mobile/             # React Native + Expo
├── packages/
│   ├── ui/                 # design system
│   ├── api-client/         # generated from OpenAPI
│   └── analytics/          # shared analytics wrapper
└── pnpm-workspace.yaml
```

**Trade-offs / when this fails.** The pattern adds tooling complexity that is unnecessary for a single application; the cure is to start with a single repository and migrate to a monorepo when the second deployable target appears. The pattern fails when the team adopts a monorepo prematurely and pays the orchestration cost without having the cross-package needs that justify it; the cure is to wait until the need is concrete. The senior framing is "monorepos for multi-package needs, single repos for single-package projects".

### 5. Walk me through the file layout you'd propose for a new product team's repo.

For a new product team starting a single Next.js application, the recommended layout is feature-by-feature with a `shared/` directory for cross-cutting code, an `app/` directory for routing and composition, and explicit feature boundaries enforced by ESLint. Below that, each feature directory holds its UI, model, API, and types in subdirectories, with an `index.ts` exposing the feature's public API. For complex features, add the hexagonal split (domain, adapters, model, UI). For a multi-application setup, add the monorepo at the top level.

**How it works.** The structure encodes intent at every level: the top-level directories tell the reader "these are features, this is shared code, this is the application shell"; the feature subdirectories tell the reader "this is the cohesive unit"; the `index.ts` files make the public API explicit. Newcomers can navigate the codebase without grep, code reviews are scoped to single directories, and refactoring a feature is a contained operation.

```text
src/
├── app/                    # routing, layout, providers (Next.js App Router)
│   ├── layout.tsx
│   └── (dashboard)/...
├── shared/
│   ├── ui/                 # design system primitives
│   ├── lib/                # utilities (formatters, hooks)
│   └── api/                # base HTTP client, error mapper
└── features/
    ├── auth/
    │   ├── ui/             # LoginForm, etc.
    │   ├── model/          # useAuth, useLogin
    │   ├── api/            # auth client
    │   └── index.ts        # public API barrel
    └── posts/
        ├── ui/
        ├── model/
        ├── api/
        └── index.ts
// .eslintrc enforces: features/* may import shared/* but not other features/*
```

**Trade-offs / when this fails.** The pattern is a sensible default but should be adapted to the team's actual needs — a smaller team may not need every feature to have all four subdirectories, and a larger team may benefit from the full feature-sliced design with widgets and entities layers. The pattern fails when the team imposes the structure rigidly without considering the application's actual shape; the cure is to start with the recommended default and let the structure evolve as the codebase grows.

## Further reading

- [Feature-Sliced Design](https://feature-sliced.design/).
- Kent C. Dodds, ["Colocation"](https://kentcdodds.com/blog/colocation).
- Adam Boutin, ["Hexagonal architecture in React"](https://blog.boutin.dev/posts/hexagonal-architecture-react/).
