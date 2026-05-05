---
title: "Micro-frontends"
sidebar_label: "6.5 Micro-frontends"
description: "Module Federation, single-spa, when iframes are still right, and the trade-offs against a monorepo."
sidebar_position: 5
---

The pitch for micro-frontends is concrete: independent teams ship features independently to one Uniform Resource Locator. The reality is that micro-frontends solve organisational problems first and technical problems second. A senior frontend engineer should know precisely when the pattern is justified, what it costs, and when a monorepo with aggressive code-splitting is the better shape.

> **Acronyms used in this chapter.** API: Application Programming Interface. CSP: Content Security Policy. CSS: Cascading Style Sheets. ESI: Edge Side Includes. JS: JavaScript. MFE: Micro-Frontend. SPA: Single-Page Application. UI: User Interface. URL: Uniform Resource Locator.

## When micro-frontends are the right answer

Three conditions justify the cost of micro-frontends; the team usually wants all three before adopting the pattern. The first is independent teams that ship on different cadences — a platform team can deploy hourly while the checkout team deploys weekly, and forcing them onto the same release cycle creates coordination overhead that micro-frontends eliminate. The second is different technology stacks required for legitimate reasons — a legacy Angular checkout that cannot be rewritten in a single release, alongside a modern React product surface, with neither stack able to subsume the other in the foreseeable future. The third is independent ownership of slices with hard organisational boundaries — different reporting lines, different on-call rotations, different release-approval processes.

For a team with one ownership scope or one technology stack, a monorepo with aggressive code-splitting is the better shape. The senior framing is that micro-frontends should not be reached for to feel "scalable" or to justify an architecture diagram; the operational cost is real, and the cost only pays back when the organisational reality genuinely demands the independence.

## The four delivery patterns

| Pattern | How | Use when |
| --- | --- | --- |
| **Build-time integration** | Each MFE published as an npm package; host imports them | You're really just doing components, not MFEs |
| **Iframes** | Each MFE is its own page in an iframe | Legacy app embedding, hard isolation, third parties |
| **Server-side composition** | A gateway (Edge Function, server) stitches HTML from multiple MFEs | Marketing sites, edge-rendered shells |
| **Module Federation** (Webpack/Rspack) | Runtime JS imports from another origin | True client-side micro-frontends sharing a shell |

Module Federation is the dominant client-side pattern in 2026.

## Module Federation in 5 minutes

A **host** consumes **remotes**. Each remote is built independently and deployed to its own URL. The host loads a small `remoteEntry.js` from each remote at runtime and dynamically imports modules.

```js
// host/webpack.config.js
const { ModuleFederationPlugin } = require("@module-federation/enhanced/webpack");

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "shell",
      remotes: {
        cart: "cart@https://cart.example.com/remoteEntry.js",
        checkout: "checkout@https://checkout.example.com/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
      },
    }),
  ],
};

// host/App.tsx
const Cart = lazy(() => import("cart/Cart"));

<Suspense fallback={<Spinner />}>
  <Cart />
</Suspense>
```

```js
// cart/webpack.config.js
new ModuleFederationPlugin({
  name: "cart",
  filename: "remoteEntry.js",
  exposes: { "./Cart": "./src/Cart.tsx" },
  shared: {
    react: { singleton: true, requiredVersion: "^19.0.0" },
    "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
  },
});
```

The non-negotiable setting is `shared` with `singleton: true` for React (and React DOM). Without it, the host and each remote each bundle their own React copy, and React's internal invariants — including the rule that hooks may only be called from one React copy — break at runtime with confusing errors that have no obvious connection to the federation configuration. The same applies to any state-holding library that uses module-scoped state, such as `react-router` or a global state container.

## What gets hard

### Version skew between shared dependencies

The application declares `react ^19.0.0`. The host deploys with 19.1, the cart Micro-Frontend was built against 19.0. They mostly work — until they do not, typically when a minor framework change breaks an internal contract one of them depends on. The mitigations are concrete: a shared-dependencies contract documented in writing and version-pinned across every MFE; a canary deployment plan so a bad cart deploy does not break the host's user base; and a per-MFE rollback mechanism that can revert one micro-frontend without redeploying the rest.

### Routing

Two options: the host owns the router and remotes own sub-trees, or each remote brings its own. The first is simpler to reason about; the second lets remotes truly be standalone apps.

### Shared state

Do not share React state across Micro-Frontends through React Context — even with `singleton: true`, the React tree boundaries do not align across federated modules cleanly, and the resulting bugs are subtle. Three viable patterns exist instead. Use the URL as the cheapest cross-MFE state; the URL is shared, the application's history listens for changes, and every MFE can read its current value. Use a shared event bus — either `window.dispatchEvent` with custom events, or a typed publisher-subscriber library — for cross-MFE coordination that is too granular for the URL. Use a shared store loaded as a federated module only as a last resort, because it couples the MFEs deeply and breaks the independence the pattern was meant to provide.

### Styles

Two Micro-Frontends with conflicting global CSS will fight, and the resulting visual bugs are some of the hardest to debug because the cause is often invisible to either team in isolation. Three mitigations together typically prevent the conflicts. Cascade layers (the CSS feature `@layer`) give each MFE its own ordered layer, with the shell controlling the layer order and ensuring no MFE can override another by accident. Component-scoped styles in every MFE — CSS Modules, Vanilla Extract, or another scoping mechanism — prevent any MFE's local styles from leaking. CSS resets live only in the shell, never in remotes; a remote that ships its own reset will fight with the shell's reset and produce inconsistent layouts.

### Security

Each remote is a piece of JavaScript loaded from another origin and executed inside the shell's origin's security context. The shell's Content Security Policy must allow the remote's origin in `script-src`, and the remote inherits the shell's permissions for cookies, `localStorage`, and same-origin API calls. A compromised remote is a compromised shell — there is no security boundary between them at the browser level. The team must review supply-chain controls (subresource integrity hashes, signed builds, dependency auditing) for every remote with the same rigour as for the shell itself.

## Single-spa

`single-spa` is an older meta-framework for orchestrating multiple SPAs on one page. You write a root config that maps URL paths to mounted MFEs. It supports React, Angular, Vue, etc., side by side.

```js
import { registerApplication, start } from "single-spa";

registerApplication({
  name: "@org/checkout",
  app: () => System.import("@org/checkout"),
  activeWhen: ["/checkout"],
});

start();
```

Reach for it if you have a true multi-framework reality (typically migration scenarios). For single-stack new builds, Module Federation is more idiomatic.

## When iframes are still right

Iframes have an unfair reputation as a deprecated pattern, but they remain the correct shape in three scenarios. When the embedded application requires hard isolation — a third-party widget, an untrusted plugin, a payment iframe whose security must be guaranteed by the browser rather than by the integration's correctness — iframes are the only browser primitive that provides that isolation by default. When the embedded application has no JavaScript-coordination needs with the host beyond `postMessage`, the iframe's isolation is a feature rather than a limitation. When the team wants independent deploys with no shared-dependencies contract at all — every iframe is its own document, with its own React copy and its own dependency tree — the iframe model removes the version-skew problem entirely.

The costs are layout coupling (sizing iframes responsively is awkward and requires `postMessage`-based height communication), styling (no parent CSS reaches into the iframe, so the design system's tokens must be re-applied inside), and discoverability (the browser's `Cmd+F` text search does not descend into iframes by default, which surprises users).

## Server-side composition

Instead of stitching at the browser, an Edge or server component fetches HTML from each MFE and composes the response.

Approaches:

- **Edge Side Includes (ESI)** — Fastly, Akamai, etc.
- **Astro islands** with each island fetched from a different origin.
- **A custom Next.js / Remix shell** doing `await fetch("https://cart.example.com/render?...")` in a server component.

This is great for marketing pages assembled from multiple teams' content. It's harder for highly interactive product surfaces.

## When NOT to do micro-frontends

Four situations make micro-frontends the wrong answer. A single team should use a monorepo with code-splitting; the operational overhead of micro-frontends is not justified when there is no organisational independence to capture. When simple feature flags would solve the deployment-cadence problem, feature flags are the correct tool — they let one team's risky change ship dark to production and roll out gradually without architectural restructuring. When the "isolation" need is actually a code-review or testing problem, the cure is to improve the process rather than to redesign the architecture. When the application has not shipped any version yet, the team should not pre-optimise the organisational structure; ship the application first, observe the friction, and reach for micro-frontends only when the organisational reality makes the friction concrete.

## Key takeaways

- Micro-frontends are an organisational pattern first; the cost is justified only when independent teams with different ship cadences create coordination overhead a monorepo cannot eliminate.
- Module Federation is the dominant client-side pattern in 2026 for true micro-frontends sharing a runtime shell.
- The `shared` configuration with `singleton: true` for React (and React DOM) is non-negotiable; without it, hooks break with confusing runtime errors.
- Cross-MFE state belongs in the URL or in a typed event bus; React Context across federated modules produces subtle bugs.
- Iframes remain correct when hard isolation is needed, when coordination is limited to `postMessage`, or when no shared-dependencies contract is acceptable.
- For a single team, a monorepo with code-splitting is almost always the better shape.

## Common interview questions

1. When are micro-frontends the right answer, and when are they cargo-culted?
2. Walk me through Module Federation. What does `shared` actually do?
3. How do you pass state between two micro-frontends?
4. What goes wrong with two MFEs loading different React versions?
5. When would you still reach for iframes?

## Answers

### 1. When are micro-frontends the right answer, and when are they cargo-culted?

Micro-frontends are the right answer when three organisational conditions are simultaneously present: independent teams that ship on materially different cadences, different technology stacks required for legitimate reasons (most commonly a legacy migration in progress), and hard organisational ownership boundaries with separate reporting lines and release approval. They are cargo-culted when the team adopts the pattern because it appears in conference talks, because the architecture diagram looks impressive, or because the team wants to feel "scalable" before any actual scaling problem has emerged.

**How it works.** The honest test is whether removing the micro-frontend architecture would create a coordination problem. If two teams currently ship to one application and would have to coordinate releases without micro-frontends, the pattern earns its keep. If the same team ships every component and would not need any coordination, the pattern is overhead with no offsetting benefit.

```text
// Justified: independent teams, different cadences, different stacks.
shell (platform team)
├── checkout (legacy Angular, weekly releases, separate org)
├── product surface (React, hourly releases, separate org)
└── search (Vue, daily releases, separate org)

// Cargo cult: one team, one stack, no real independence.
shell (single team)
├── header-mfe   (just a component split out for "scalability")
├── nav-mfe
└── content-mfe
```

**Trade-offs / when this fails.** The pattern fails most often when the team adopts it before the organisational scale demands it; the cure is to start with a monorepo and migrate to micro-frontends if and when the organisational reality changes. The pattern also fails when the team adopts it for the right reasons but underinvests in the operational tooling — the shared-dependencies contract, the canary process, the rollback mechanism — and ships a fragile system that breaks every time any MFE deploys. The senior framing is "the technical pattern follows the organisational shape, not the other way around".

### 2. Walk me through Module Federation. What does `shared` actually do?

Module Federation lets a host application load JavaScript modules from a remote application at runtime. The remote builds a small `remoteEntry.js` manifest that describes which modules it exposes; the host configures the URL of each remote and the names of the modules it wants to consume. At runtime, the host fetches the manifest, resolves the module's URL, downloads the module's chunks, and executes them in the host's context. The result is that the host can `import` from a remote that did not exist at the host's build time.

The `shared` configuration controls how dependencies common to the host and remotes are loaded. Without `shared`, every remote bundles its own copy of every dependency, and the application loads multiple copies of React (and any other shared library). With `shared` plus `singleton: true`, the host and every remote agree to use a single shared instance of the dependency — the first one loaded wins, and the others use that instance. This is what allows React's hook system, the framework's internal state, and any module-scoped shared state to work correctly across the federation.

**How it works.** The Module Federation runtime maintains a registry of shared dependencies indexed by name and version range. When a remote loads, the runtime checks whether the registry already contains a compatible version of each shared dependency; if so, the remote uses the registry's instance, otherwise the remote contributes its instance to the registry. The `singleton: true` flag enforces that only one instance can ever be in the registry, which is the requirement for React.

```js
// Host configuration.
new ModuleFederationPlugin({
  name: "shell",
  remotes: { cart: "cart@https://cart.example.com/remoteEntry.js" },
  shared: {
    react: { singleton: true, requiredVersion: "^19.0.0" },
    "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
  },
});

// Remote configuration — must match the host's shared contract.
new ModuleFederationPlugin({
  name: "cart",
  filename: "remoteEntry.js",
  exposes: { "./Cart": "./src/Cart.tsx" },
  shared: {
    react: { singleton: true, requiredVersion: "^19.0.0" },
    "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
  },
});
```

**Trade-offs / when this fails.** The pattern fails when the host and a remote declare incompatible version ranges for a shared dependency; the runtime warns about the mismatch and may break at runtime. The cure is the explicit shared-dependencies contract documented across teams. The pattern also fails when a library that uses module-scoped state is not declared as `singleton`; the cure is to identify every such library in the codebase and declare it in `shared`.

### 3. How do you pass state between two micro-frontends?

Three patterns are viable, in increasing order of coupling. The URL is the cheapest and most portable cross-MFE state — the URL is shared by every MFE, the browser's history listens for changes, and every MFE can read its current value via `URLSearchParams` or its router. A typed event bus — either `window.dispatchEvent` with custom events, or a small publisher-subscriber library — is the right shape for cross-MFE coordination that is too granular for the URL or that does not represent navigation. A shared store loaded as a federated module is the heaviest option and should be reached for only when the first two patterns genuinely do not fit, because it couples the MFEs deeply and breaks the independence the pattern was meant to provide.

**How it works.** The URL pattern uses the application's existing routing — every MFE reads the URL and updates its own state, with no direct coupling between MFEs. The event bus pattern uses a single global object that emits events; every MFE subscribes to the events it cares about and emits the events it produces. The shared-store pattern federates a state container module so every MFE imports the same instance.

```ts
// Pattern 1: URL state — the cheapest cross-MFE state.
const params = new URLSearchParams(window.location.search);
const userId = params.get("user");

// Pattern 2: typed event bus.
type AppEvents = {
  "cart:updated": { itemCount: number };
  "user:loggedOut": void;
};

const bus = {
  emit<K extends keyof AppEvents>(event: K, detail: AppEvents[K]) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  },
  on<K extends keyof AppEvents>(event: K, handler: (detail: AppEvents[K]) => void) {
    const wrapped = (e: Event) => handler((e as CustomEvent<AppEvents[K]>).detail);
    window.addEventListener(event, wrapped);
    return () => window.removeEventListener(event, wrapped);
  },
};

// Pattern 3 (last resort): shared store as a federated module.
// shared/store/cart.ts in the platform package, imported by every MFE.
```

**Trade-offs / when this fails.** The URL pattern is the right shape for navigation-shaped state (the current user, the current view, the current filter) but fails for high-frequency events. The event bus pattern is the right shape for coordination events (cart updated, user logged out) but fails when a new MFE needs to know the current state at mount time (because events are fire-and-forget). The shared-store pattern handles both cases but couples the MFEs to the store's API. The senior framing is "use the lightest pattern that fits the actual data flow, and resist the urge to centralise every shared state".

### 4. What goes wrong with two MFEs loading different React versions?

Two React copies in the same application break React's internal invariants. React maintains module-scoped state — the current dispatcher, the work-in-progress fibre, the hook list — and those references are tied to the specific React copy that owns them. A component rendered by host's React calling a hook from remote's React (or vice versa) reads the wrong dispatcher and the hook fails with errors like "Invalid hook call" or "Cannot read property 'memoizedState' of null". The errors have no obvious connection to the federation configuration, which makes them some of the most frustrating bugs to debug.

**How it works.** When React renders a component, it sets a module-scoped `currentDispatcher` reference that the hooks read. If the component is from one React copy and the hook implementation is from another, the dispatcher reference is read from the wrong copy and is `null`, producing the runtime error. The same problem applies to the rules of hooks (which depend on the hook order tracked in module-scoped state) and to context (which is keyed by the React copy's reference).

```js
// The fix: declare React as a singleton in every MFE's federation config.
new ModuleFederationPlugin({
  shared: {
    react: { singleton: true, requiredVersion: "^19.0.0" },
    "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
  },
});

// Without singleton: every MFE loads its own React copy.
// Result: any hook called across the boundary fails at runtime.
```

**Trade-offs / when this fails.** The cure is the `singleton: true` configuration plus a shared-dependencies contract that pins compatible version ranges across MFEs. The pattern fails when the team upgrades React in one MFE but not the others; the cure is to coordinate React upgrades across every MFE, treating the React version as a shared infrastructure concern rather than a per-MFE choice.

### 5. When would you still reach for iframes?

Iframes are the right answer when the application needs hard isolation that no JavaScript-level pattern can provide. The canonical examples are payment iframes (Stripe, Adyen, the customer's bank's hosted checkout) where the embedded application's security must be guaranteed by the browser's same-origin policy rather than by the integration's correctness; third-party widgets where the host cannot trust the embedded code (a customer-installed plugin, an analytics widget from an untrusted vendor); and embedded legacy applications that cannot be safely loaded into the host's runtime (a pre-React Angular application with global side effects, a Backbone application with conflicting jQuery versions).

**How it works.** The iframe creates a separate browsing context with its own document, its own JavaScript runtime, its own cookies (subject to the parent-frame policy), and its own security context. Communication with the host is limited to the structured `postMessage` channel and to the iframe's URL navigation. The browser's same-origin policy enforces the isolation, so a compromised iframe cannot access the host's DOM, cookies, or storage.

```ts
// Hosting an iframe with postMessage coordination.
const iframe = document.createElement("iframe");
iframe.src = "https://payments.example.com/checkout";
document.body.appendChild(iframe);

// Listen for messages from the iframe.
window.addEventListener("message", (event) => {
  if (event.origin !== "https://payments.example.com") return;   // verify the origin
  if (event.data.type === "PAYMENT_COMPLETE") {
    onPaymentSuccess(event.data.transactionId);
  }
});

// Send a message to the iframe (for example, to populate the form).
iframe.contentWindow?.postMessage(
  { type: "PRE_FILL", customerId: "c_123" },
  "https://payments.example.com",
);
```

**Trade-offs / when this fails.** The iframe pattern is the right shape for hard-isolation needs and is the wrong shape for tightly-coupled UI integrations. The pattern fails when the team uses iframes where Module Federation would have worked — the iframe's layout coupling, styling isolation, and discoverability problems become a chronic burden. The pattern also fails for accessibility when the iframe is part of a continuous keyboard-navigation flow with the host; the focus model across iframe boundaries is still an open problem in web platform design. The senior framing is "iframes for security, federation for sharing".

## Further reading

- [Module Federation docs](https://module-federation.io/).
- Cam Jackson, ["Micro Frontends"](https://martinfowler.com/articles/micro-frontends.html) on martinfowler.com.
- [single-spa](https://single-spa.js.org/) docs.
