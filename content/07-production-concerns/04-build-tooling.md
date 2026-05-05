---
title: "Build tooling & monorepos"
sidebar_label: "7.4 Build tooling & monorepos"
description: "Vite, Turbopack, Rspack, esbuild, tree shaking, sideEffects, pnpm workspaces, Turborepo / Nx."
sidebar_position: 4
---

Senior interviews ask "which bundler are you using, and why?" not because a single correct answer exists but because the answer reveals whether the candidate understands the trade-offs between competing build tools and the operational realities of running them in production. The choice of bundler propagates into the team's developer experience (how fast does the dev server start?), the production bundle size (how aggressive is the tree-shaking?), and the ecosystem the team can draw on (which plugins are available?).

> **Acronyms used in this chapter.** API: Application Programming Interface. CI: Continuous Integration. CJS: CommonJS. CSS: Cascading Style Sheets. ECMAScript: European Computer Manufacturers Association Script. ESM: ECMAScript Modules. JS: JavaScript. JSON: JavaScript Object Notation. LCP: Largest Contentful Paint. PR: Pull Request. SPA: Single-Page Application. SSR: Server-Side Rendering. URL: Uniform Resource Locator. YAML: YAML Ain't Markup Language.

## The build tools that matter in 2026

| Tool | What it is | When to use |
| --- | --- | --- |
| **Vite** | Dev server + build (esbuild for dev, Rollup for prod) | SPAs, libraries, test runners. The default. |
| **Turbopack** | Next.js's built-in bundler (Rust) | Next.js apps; defaults in newer versions. |
| **Rspack** | Webpack-compatible bundler in Rust | Migrating large Webpack apps; module federation. |
| **esbuild** | Pure bundler/minifier (Go) | Server-side bundling, fast minification, libraries. |
| **Webpack** | The 2015–2022 default | Maintenance only; new projects pick another. |
| **Rollup** | Library bundler with great tree shaking | Publishing libraries to npm. |
| **Parcel** | Zero-config bundler | Hobby projects; less common at senior scale. |

The framing senior candidates typically present in 2026: Vite is the default for Single-Page Applications and libraries because its development server uses native ECMAScript Modules and starts almost instantly; Turbopack is the default for Next.js applications because it ships in the box and is purpose-built for the framework; Rspack is the right answer for teams stuck on a large existing Webpack configuration who want substantial speed improvements without rewriting the configuration; esbuild remains the right tool for one-off bundling jobs, server-side bundling, and library minification because it is the fastest and simplest of the bunch.

## Vite mental model

Vite separates the development workflow from the production build, and the separation is the key insight that makes Vite's developer experience so much faster than Webpack's. In development mode, Vite serves files as native ECMAScript Modules — the browser requests each module directly via its Uniform Resource Locator and Vite transforms each module on the fly with esbuild as it is requested. There is no whole-bundle build step at server start, so the dev server is responsive within hundreds of milliseconds even on large projects. In production mode, Vite bundles with Rollup, which produces a tree-shaken, code-split output suitable for serving from a Content Delivery Network.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          tanstack: ["@tanstack/react-query", "@tanstack/react-virtual"],
        },
      },
    },
  },
});
```

`manualChunks` gives you control over which libraries land in which bundle — useful for keeping framework code separately cacheable.

## Tree shaking, the senior take

Tree shaking only works if:

1. The module uses **ES modules** (not CommonJS).
2. The package declares **`"sideEffects": false`** (or a list of files with side effects) in `package.json`.
3. Your import is **named** (`import { foo } from "lib"`), not namespace (`import * as lib`).

```json
{
  "name": "my-lib",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "sideEffects": false
}
```

If a library doesn't tree-shake, look at its `package.json`. Common culprits: missing `sideEffects` flag, CJS-only build, or bundling everything into one file.

## Source maps

Three modes are worth knowing. The `source-map` mode produces a separate `.map` file alongside the bundle and adds a `# sourceMappingURL` comment to the bundle that points the browser at the map; this is suitable for production when the team is comfortable that any user can fetch and read the original source. The `hidden-source-map` mode produces the separate `.map` file but omits the `# sourceMappingURL` comment, so the browser does not load the map by default; the team uploads the map to its error tracker (Sentry, Datadog) so stack traces are de-minified server-side, but end users do not see the source. The `inline-source-map` mode embeds the map inside the bundle as a base64 data URL; this is appropriate for development because the round trip is faster, but unsuitable for production because it inflates the bundle.

For production, the recommended configuration is `hidden-source-map` plus upload to the error tracker. Do not ship `# sourceMappingURL` comments to end users unless the source code is intentionally public.

## Bundle analysis

Run on every meaningful change:

```bash
# Vite
pnpm vite build && npx vite-bundle-visualizer

# Rollup directly
rollup -c --plugin "rollup-plugin-visualizer"

# Next.js
ANALYZE=true pnpm next build
```

Three common findings deserve attention. A library that the team did not expect to be on the Largest Contentful Paint path is the most common surprise — usually a transitive dependency pulled in by a small utility, sometimes an entire icon library or markdown renderer that the team intended to lazy-load but forgot to. A polyfill that the team does not need (such as `core-js` shipping ECMAScript 5 polyfills to a target audience of modern browsers) wastes bytes on every load and is often introduced by a default Babel or browserslist configuration that targets older browsers than the team actually supports. Duplicate copies of a library at different versions inflate the bundle and may cause subtle bugs (two copies of React, for example, break the rules of hooks); the cure is to align versions through `pnpm overrides` or the equivalent.

## Monorepos: when and how

Reach for a monorepo when the project shape justifies the overhead. Three project shapes commonly justify it: multiple applications sharing a design system (so a single change to the design tokens propagates to every consumer in one Pull Request); a type-safe Application Programming Interface client generated from an OpenAPI specification and consumed by multiple applications (so a backend contract change is type-checked across every consumer in the same Pull Request); shared business logic such as validation schemas consumed by web, mobile, and serverless workers (so a regression in a shared validator fails the consumer's tests at the same time as the validator's).

The cost is build orchestration: the team needs a tool that understands which packages depend on which, runs builds in topological order, and caches outputs so unchanged packages do not rebuild on every Continuous Integration run. Two tools dominate the modern landscape.

### pnpm workspaces

The minimum: package manager + workspace config. Great for small monorepos.

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```bash
pnpm --filter @org/web build
pnpm -r build              # all packages, in topological order
```

### Turborepo

Adds a task graph and remote caching on top of any package manager. The killer feature: cached task outputs are shared across machines (dev laptops, CI). A second run of `turbo build` after an unchanged package is ~zero seconds.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

```bash
turbo build --filter=@org/web
turbo build test lint typecheck
```

### Nx

Heavier than Turborepo: code generators, dependency graph visualization, "computed type aliases", more opinionated. Worth it for large monorepos with many engineers; overkill for small teams.

## Layer rules

Whichever tool, enforce dependency rules so packages can't import from packages they shouldn't.

```js
// .eslintrc — using eslint-plugin-import
module.exports = {
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./packages/ui", from: "./apps" },
        { target: "./packages/api-client", from: "./packages/ui" },
      ],
    }],
  },
};
```

## Versioning packages

Two patterns are dominant. Fixed versioning means every package in the monorepo shares a single version number that is bumped together on every release; this is operationally simple, suits smaller monorepos with strongly coupled packages, and avoids the overhead of per-package versioning. Independent versioning with Changesets means each package carries its own version number and changesets — small markdown files committed alongside the change — describe what each Pull Request changed in each package; the standard tool is `@changesets/cli`. Independent versioning is the right pattern for monorepos that publish multiple libraries to npm with their own release cadences.

```bash
pnpm changeset
# pick which packages changed, what kind of bump, write changelog entry
pnpm changeset version    # bumps versions and updates changelogs
pnpm publish -r           # publishes
```

## CI for monorepos

The senior pattern is to test only what is affected by the change, rather than re-running every test in the monorepo on every Pull Request.

```bash
turbo test --filter='...[origin/main]'
```

Combined with remote caching, a typical Continuous Integration run takes one to two minutes for a small change in a 50-package monorepo, compared with twenty minutes if every package built and tested on every commit.

## Key takeaways

Vite is the default for Single-Page Applications and libraries; Turbopack ships in the box for Next.js; Rspack is the right tool for migrating large Webpack configurations without rewriting them; esbuild is the right tool for one-off bundling jobs. Tree shaking requires three preconditions to be effective: ECMAScript Modules (not CommonJS), `"sideEffects": false` declared in the library's `package.json`, and named imports rather than namespace imports. Use `hidden-source-map` in production and upload the maps to the team's error tracker so stack traces are readable without exposing source to end users. Run bundle analysis on every meaningful change to catch unexpected dependency growth. Reach for a monorepo when the project shape justifies the overhead — multiple applications sharing libraries, type-safe Application Programming Interface clients, shared business logic — not because monorepos are fashionable. Turborepo is the right pick for most monorepos because of its caching and task graph; Nx is the right pick for very large monorepos that justify the heavier opinionated tooling. Use Changesets when independent per-package versioning is required.

## Common interview questions

1. Why is Vite faster in dev than Webpack?
2. What does `"sideEffects": false` do?
3. When does a monorepo earn its overhead?
4. Walk me through what Turborepo's remote cache does.
5. Inline source maps in production: yes or no, and why?

## Answers

### 1. Why is Vite faster in dev than Webpack?

Vite is faster in development because it does not bundle in development mode. Webpack reads every entry point, every transitive dependency, and every loader transformation at startup, then constructs a complete bundle before serving the first request; on a large project this can take tens of seconds. Vite serves files as native ECMAScript Modules, which means the browser requests each module directly and Vite transforms each module on demand using esbuild, which is itself written in Go and an order of magnitude faster than the JavaScript-based loaders Webpack uses. The dev server is responsive within hundreds of milliseconds even on large projects, regardless of project size, because there is no whole-bundle work at startup.

**How it works.** When the browser loads `index.html`, it sees a `<script type="module">` referencing the entry. The browser requests that file from Vite; Vite reads the file from disk, transforms it with esbuild (TypeScript syntax, JSX, and so on), rewrites import specifiers to point at the dev server's URLs, and returns the result. The browser then requests each imported module the same way. Vite caches the transformed output keyed by file content, so subsequent requests for unchanged modules are instantaneous.

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

**Trade-offs / when this fails.** The native-ESM approach requires the browser to request every module individually, which on a large dependency graph is many hundreds of requests; this is fine for HTTP/2 over localhost but degrades on slower connections. Vite mitigates this with dependency pre-bundling: it scans imports at startup, pre-bundles `node_modules` dependencies with esbuild into a small number of files, and serves those bundles instead of the raw modules. The pre-bundling step is the only thing that takes meaningful time on Vite startup; the rest is on-demand.

### 2. What does `"sideEffects": false` do?

`"sideEffects": false` in a library's `package.json` tells the bundler that the library's modules have no side effects — that is, importing a module does not, by itself, change any program state — and therefore the bundler may remove any unused exports without affecting program behaviour. Without this declaration, the bundler must conservatively retain every module that was imported, even if no exported symbol from that module is used, because the import itself might have triggered a side effect the program depends on.

**How it works.** The bundler statically analyses the import graph and determines which exported symbols are reachable from the application's entry point. With `"sideEffects": false`, any unreachable export is removed from the bundle. With the declaration absent or set to `true`, the bundler retains every imported module to preserve any side effect the import might have triggered. The result is that a library that does not declare `"sideEffects": false` ships its entire surface to every consumer, while a library that declares it correctly ships only what each consumer actually uses.

```json
{
  "name": "my-lib",
  "type": "module",
  "main": "./dist/index.js",
  "sideEffects": false,
  "exports": { ".": "./dist/index.js" }
}
```

**Trade-offs / when this fails.** A library that has side effects but declares `"sideEffects": false` produces broken consumers, because the bundler removes modules whose side effects the program needed; the cure is to either accurately list the files with side effects (`"sideEffects": ["./src/polyfills.js", "*.css"]`) or to refactor the library to avoid module-level side effects. The declaration also has no effect on libraries that ship CommonJS rather than ECMAScript Modules, because CommonJS module evaluation cannot be statically analysed in the same way; the cure is to publish a dual ESM and CommonJS build with the `exports` map directing modern bundlers to the ESM build.

### 3. When does a monorepo earn its overhead?

A monorepo earns its overhead when the team has multiple deployable artifacts that share substantial code and need to evolve together. The clearest signals: a design system used by three or more applications, a type-safe Application Programming Interface client generated from an OpenAPI specification and consumed by multiple applications, business logic such as validation schemas that must be identical across web, mobile, and serverless workers. The monorepo lets a single Pull Request update the shared library and every consumer atomically, which is the property that makes the overhead worthwhile.

**How it works.** A monorepo with proper tooling — pnpm workspaces, Turborepo for caching and task orchestration, Changesets for versioning — gives the team atomic cross-package changes, dependency-graph-aware builds, and remote caching that makes Continuous Integration fast. The cost is build complexity: the team must understand the package boundaries, configure the task graph, and accept that local development now requires tooling beyond a single `npm install`.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Trade-offs / when this fails.** A monorepo does not earn its overhead when the team has a single application or when the shared code is small enough that copy-paste is cheaper than the build infrastructure. The overhead also compounds at large scale; a monorepo with hundreds of packages and thousands of contributors needs heavier tooling (Nx, the Bazel build system, internal infrastructure investments) than the small-team configuration. The senior framing in interviews is "monorepos are the right tool when the team needs atomic cross-package changes; they are the wrong tool when adopted because they are fashionable".

### 4. Walk me through what Turborepo's remote cache does.

Turborepo's remote cache stores the outputs of every task run — the build artifacts, the test results, the lint reports — keyed by a hash of the task's inputs (source files, dependencies, environment variables, the task's command). On a subsequent invocation of the same task with the same inputs, Turborepo computes the same hash, looks up the cached output, and replays it instead of running the task. The cache is shared across machines (a developer's laptop, the Continuous Integration runner, every other team member's laptop), so a build that one machine has done is essentially free for every other machine.

**How it works.** When `turbo build` runs, Turborepo computes a hash of the inputs to each task in the dependency graph. For each task, it queries the remote cache (or the local cache first); if there is a hit, it downloads and replays the cached output (typically the contents of the `outputs` directories declared in `turbo.json`). If there is a miss, it runs the task, writes the output to the local cache, and uploads the cache entry to the remote cache for the next consumer.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "env": ["NODE_ENV", "VERCEL_URL"]
    }
  }
}
```

**Trade-offs / when this fails.** The cache hit rate is the metric that determines whether the remote cache is worthwhile; a cache that misses on every run because the inputs are not deterministic provides no value and adds the overhead of computing hashes. The most common cause of poor hit rates is forgetting to declare environment variables that affect the build (`env` in the task configuration); a build that depends on `NODE_ENV` but does not declare it will produce different outputs in development and production but receive the same cache key, leading to incorrect cached outputs. The cache also exposes the team to a supply-chain risk: an attacker who can write to the remote cache can replace the output of any task with malicious content, so the cache should be treated as part of the team's deployment trust boundary.

### 5. Inline source maps in production: yes or no, and why?

No, do not ship inline source maps in production. The inline approach embeds the source map as a base64 data URL inside the bundle itself, which dramatically inflates the bundle size — a 200-kilobyte bundle becomes a 1-megabyte bundle once the inline source map is added — and ships the original source code to every user, with no opt-out. The recommended production configuration is `hidden-source-map`, which produces a separate map file but omits the `# sourceMappingURL` comment from the bundle; the team uploads the map to the error tracker so stack traces are de-minified server-side, but end users never download it.

**How it works.** When the browser encounters a `# sourceMappingURL` comment in a bundle, it fetches the referenced map (or decodes the inline data URL) and uses it to display the original source in the developer tools. With `hidden-source-map`, the comment is omitted, so the browser does not load the map; the developer tools show the minified source. The error tracker receives the minified stack trace and applies the uploaded map server-side to produce a readable trace.

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: "hidden",
  },
});
```

**Trade-offs / when this fails.** The `hidden-source-map` approach assumes the team has an error tracker that supports source-map upload; without one, a stack trace from production is unreadable. The approach also requires that the source-map upload is part of the build pipeline and atomically tied to the deploy; a deploy that completes before the source-map upload finishes produces a window during which errors fire with no readable trace. The cure is to make the upload a precondition for the deploy, not a parallel step.

## Further reading

- [Vite docs](https://vite.dev/).
- [Turborepo docs](https://turborepo.com/docs).
- [Changesets docs](https://github.com/changesets/changesets).
- [Module Federation](../06-fe-architecture/05-micro-frontends.md) — covered in Architecture.
