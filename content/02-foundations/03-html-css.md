---
title: "Modern HTML & CSS"
sidebar_label: "2.3 Modern HTML & CSS"
description: "Semantic HTML, Flexbox, Grid, container queries, :has(), cascade layers, custom properties, and theming."
sidebar_position: 3
---

Modern frontend interviews still ask Cascading Style Sheets (CSS) questions, especially for senior roles where the implicit framing is "the design-system component you build needs to scale across products". This chapter is the working reference for the topics a senior is expected to be able to write on a whiteboard or explain aloud.

> **Acronyms used in this chapter.** ARIA: Accessible Rich Internet Applications. CSS: Cascading Style Sheets. HSL: Hue-Saturation-Lightness. HTML: HyperText Markup Language. JIT: Just-In-Time. JIT-compiled: Just-In-Time-compiled. JS: JavaScript. JSX: JavaScript XML. LTR: Left-to-Right. RSC: React Server Components. RTL: Right-to-Left. UI: User Interface.

## Semantic HTML is your free accessibility layer

Reach for the right element first; reach for ARIA last. The native element comes with keyboard semantics, focus management, and screen-reader announcements without any additional code. The principle is "use the platform" — the most senior candidates default to native elements and treat ARIA as the escape hatch for genuinely novel widgets.

| Use case | Right element |
| --- | --- |
| A page-level title | `<h1>` |
| A control that does something on click | `<button>` |
| A control that navigates | `<a href="...">` |
| A group of form controls | `<fieldset>` + `<legend>` |
| A section with a heading | `<section>` + `<h2>` |
| Sidebar / aside content | `<aside>` |
| Tabular data | `<table>` (with `<caption>`, `<thead>`, `<tbody>`) |
| Disclosure widget | `<details>` + `<summary>` |
| Modal dialog | `<dialog>` (now widely supported) |

A `<div onclick>` is never the right answer. The compositional cost of a semantic element is the same as a `div`; the accessibility cost of a `div` masquerading as a button is substantial because the developer must reimplement focus, keyboard, and assistive-technology semantics by hand and inevitably misses some.

## Flexbox versus Grid: when each is right

The senior framing is **Flex for one dimension, Grid for two dimensions**. Real layouts combine them: Grid for the page-level macro layout, Flex for the row of controls inside a header.

```css
/* Flexbox: a row of items with a gap, the title taking the remaining space. */
.toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.toolbar__title { flex: 1; }

/* Grid: a 2D layout with named regions. */
.app {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  height: 100vh;
}
.app__header { grid-area: header; }
.app__sidebar { grid-area: sidebar; }
.app__main { grid-area: main; overflow: auto; }
```

Two Grid features that senior candidates should know on sight:

- **`auto-fit` / `auto-fill` with `minmax`** for responsive grids that need no media queries. The track count adapts to the container width and each track sizes between the minimum and one fraction of the remaining space.

  ```css
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }
  ```

- **Subgrid** (Chromium, Firefox, Safari since 2024) for aligning nested children to the parent grid's tracks. Without subgrid, a card with an internal column of metadata could not align that column with sibling cards' metadata columns; with subgrid, the inner grid borrows the outer grid's tracks.

  ```css
  .cards { display: grid; grid-template-columns: 200px 1fr; gap: 1rem; }
  .card  { display: grid; grid-template-columns: subgrid; }
  ```

## Container queries

Media queries respond to the viewport. Container queries respond to the element's container — exactly what is needed when the same component is dropped into different layouts and is expected to adapt to the available room rather than the page width.

```css
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

.card { display: grid; gap: 0.5rem; }

@container card (min-width: 480px) {
  .card { grid-template-columns: 200px 1fr; }
}
```

The `.card` rearranges itself based on the container's width, not the viewport's. This is the modern answer to "how do you build truly reusable components" because the same `.card` placed in a 240-pixel sidebar renders as a single column and the same component placed in a 600-pixel main area renders with a thumbnail beside the body text. Before container queries, the only way to achieve this was a JavaScript `ResizeObserver`, which had observable performance and timing differences.

## `:has()` — the parent selector

CSS finally has a parent selector. Browsers support it everywhere as of 2024.

```css
/* Style a label that contains a required input. */
label:has(input:required) { font-weight: bold; }

/* Style the form when the email field is invalid. */
form:has(input[type="email"]:invalid) .submit { opacity: 0.5; }

/* Card with a badge inside gets extra top padding. */
.card:has(.badge) { padding-top: 2rem; }
```

`:has()` collapses use cases that previously required JavaScript or a state class on a parent. The most common production wins are forms (style the wrapper based on validity of its children) and cards (style the container based on which children are present). The performance characteristics are no worse than complex descendant selectors that were already common.

## Cascade layers (`@layer`)

Cascade layers solve the "is this Tailwind class going to win against my component CSS?" problem by giving the developer explicit control over the layer ordering, regardless of the specificity of the selectors involved.

```css
@layer reset, base, components, utilities;

@layer reset { /* Tailwind preflight, normalize, and other resets. */ }
@layer base { body { font-family: system-ui; } }
@layer components { .button { padding: 0.5rem 1rem; } }
@layer utilities { .p-2 { padding: 0.5rem; } }
```

Later layers always win. Within a layer, normal specificity rules apply. This is how Tailwind v3 and later orders rules internally, and it is the mechanism that lets a utility-first methodology coexist with bespoke components — the components live in their own layer, the utilities live in a later layer, and the utility class always wins on the rare occasion both apply.

## Custom properties and theming

Custom properties are runtime, cascading, and inheritable. They are the modern answer to dark mode and themes without a preprocessing step.

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111111;
  --color-accent: #2e7df6;
}

[data-theme="dark"] {
  --color-bg: #0c0f14;
  --color-text: #e8edf3;
  --color-accent: #6aa6ff;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
}

.button { background: var(--color-accent); }
```

Toggling `data-theme` on `<html>` switches the entire application's palette in one Document Object Model mutation, which is faster and more predictable than re-rendering a tree with a different theme provider value. Combine with the operating-system preference to honour the user's choice when no explicit override exists:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #0c0f14;
    --color-text: #e8edf3;
    --color-accent: #6aa6ff;
  }
}
```

The `:not([data-theme="light"])` exception is the "user has explicitly opted out of dark mode" case; without it, a user who toggled to light mode in the application would see dark mode anyway when the operating system was dark.

## Logical properties

Use **logical** properties when shipping anything that might be localised to Right-to-Left (RTL) languages. Logical properties name the axis (`block` for vertical in horizontal-writing scripts, `inline` for horizontal) rather than the absolute direction, so the same stylesheet mirrors automatically when the writing direction flips.

```css
/* Old: physical (LTR-only). */
.card { padding-left: 1rem; margin-right: 0.5rem; }

/* New: logical (LTR + RTL). */
.card { padding-inline-start: 1rem; margin-inline-end: 0.5rem; }
```

The mapping in horizontal scripts: `padding-inline-start` is `padding-left` in Left-to-Right and `padding-right` in Right-to-Left. Switching `dir="rtl"` then mirrors layouts automatically without a separate stylesheet. The pattern adds three or four characters per property and is the only way to reach a substantial fraction of the world without writing two stylesheets.

## Modern colour: `oklch()` and wide gamut

Browsers now support `oklch()`, `color()`, and the `color-mix()` function. `oklch` is the modern answer to "I want consistent perceived lightness across hues", which is the long-standing limitation of `hsl` for design systems — two `hsl` colours with the same `L` value can look very different in perceived brightness.

```css
:root {
  --brand: oklch(70% 0.15 250);          /* L=70%, C=0.15, H=250deg */
  --brand-hover: oklch(from var(--brand) calc(l - 8%) c h);
  --brand-text: color-mix(in oklab, var(--brand), white 80%);
}
```

The `oklch(from … calc(l - 8%) c h)` form is the relative-colour-syntax shorthand: take an existing colour, decompose it into lightness, chroma, and hue, and recombine with a modified lightness. It removes the historic need for a sass `darken()` function or a hand-curated palette. The pattern is increasingly common in design-token systems and is worth knowing for any interview that touches the design-systems area.

## Tailwind versus CSS-in-JS — the senior position

The dogmatic answer is wrong; the trade-offs answer is right. The four common approaches and their trade-offs:

| Approach | Pros | Cons |
| --- | --- | --- |
| Vanilla CSS / CSS Modules | Zero runtime, full power, no build coupling. | Naming things; convention drift over time. |
| Tailwind | Constraint via design tokens, near-zero runtime, JIT-compiled. | Long classnames; styling leaks into JSX. |
| CSS-in-JS (Emotion, styled-components) | Co-located with the component, dynamic styling. | Runtime cost; friction with React Server Components. |
| Zero-runtime CSS-in-JS (Vanilla Extract, Panda) | Type-safe tokens, no runtime cost. | Build complexity; smaller ecosystem. |

The 2026 consensus, articulated as a recommendation rather than a list:

- **Tailwind** for products that need to ship quickly with a constrained design system. The constraint of "you must pick a token" is the feature; the long classnames are the price.
- **CSS Modules + design tokens** for heavily themed component libraries that need to be consumed by other teams. The zero runtime and lack of build coupling matter more than the co-location.
- **Zero-runtime CSS-in-JS** when type-safe tokens matter and the team is willing to absorb the build complexity, typically in mature design-system codebases.
- **Avoid runtime CSS-in-JS in new React Server Components apps.** It composes poorly with streaming, requires a large client runtime, and the ecosystem is increasingly oriented toward zero-runtime alternatives.

## Responsive strategies, the short version

The senior strategy combines four techniques rather than choosing one.

- **Start mobile-first.** Override upward with `min-width` media queries. The mobile baseline is usually simpler and the overrides are additive rather than subtractive.
- **Use `clamp()` for fluid type and spacing.** A single rule replaces three or four media queries.

  ```css
  h1 { font-size: clamp(1.5rem, 1rem + 2.5vw, 2.5rem); }
  ```

- **Reach for container queries when the component is reused at different sizes.** This is increasingly the default for design-system components.
- **Use `<picture>` + `srcset` for art direction**, and `<img srcset>` + `sizes` for resolution-switching. The two are different problems with different markup answers.

## Key takeaways

- Use semantic HTML; reach for ARIA only when no native element fits.
- Flex is for one dimension, Grid is for two. `repeat(auto-fit, minmax(...))` gives responsive grids without media queries.
- Container queries make components truly reusable across layouts.
- `:has()` is the parent selector and it is universally supported. It collapses many cases that previously required JavaScript.
- `@layer` orders styles by intent, regardless of specificity. It is the mechanism behind Tailwind's coexistence with component CSS.
- Custom properties plus a `data-theme` attribute give dark mode in one DOM mutation.
- Always use logical properties if the application will ever ship in a Right-to-Left script.

## Common interview questions

1. When would you reach for Grid instead of Flexbox?
2. How do container queries differ from media queries, and what problem do they solve?
3. Walk me through implementing dark mode that respects the OS preference but lets the user override it.
4. What does `:has()` enable that previously required JavaScript?
5. Tailwind, CSS Modules, or CSS-in-JS — defend your choice for a new design system in 2026.
6. What is the cascade order rule with `@layer` and how does it interact with specificity?

## Answers

### 1. When would you reach for Grid instead of Flexbox?

Grid is the right tool for two-dimensional layouts where rows and columns are both meaningful — a page-level shell with sidebar, header, and main, a card grid that wraps and aligns across rows, a calendar, or a form whose labels and controls must align across rows. Flexbox is the right tool for one-dimensional layouts — a row of toolbar buttons, a navigation bar, a wrapping list of tags, or any layout where the items flow along one axis and the cross-axis sizing follows the items rather than driving them.

**How it works.** Grid lets the parent declare a structure (template columns, template rows, named areas) and place children into it explicitly with `grid-area`. Flex lets the parent declare a single direction (`flex-direction`) and the children negotiate space with `flex-grow`, `flex-shrink`, and `flex-basis`. The mental shorthand is "Grid is the parent in charge; Flex is the children in charge".

```css
/* Grid: parent dictates structure. */
.app { display: grid; grid-template-columns: 240px 1fr; }

/* Flex: children negotiate. */
.toolbar { display: flex; gap: 0.5rem; }
.toolbar__title { flex: 1; }
```

**Trade-offs / when this fails.** The two are not mutually exclusive — production layouts almost always combine them. The most common pitfall is using Flex for what should be Grid (a card grid laid out with `flex-wrap` will not align across rows because each row sizes its items independently); the inverse pitfall is using Grid for a one-dimensional row, where Flex is shorter and more obvious. The 2026 default for the page shell is Grid; the default for any "row of items" is Flex.

### 2. How do container queries differ from media queries, and what problem do they solve?

Media queries respond to the viewport. Container queries respond to the size of an ancestor element marked with `container-type`. The problem container queries solve is that the same component can be placed in different layout slots — a 240-pixel sidebar, a 600-pixel main area, a wide modal — and a media query cannot distinguish those cases because the viewport is the same. A container query reads the slot's width and adapts the component accordingly.

**How it works.** Marking an element with `container-type: inline-size` (or `size`) makes it a containment context. A `@container (min-width: 480px) { ... }` rule applies when that ancestor's inline size meets the condition. The component itself does not need to know about the page width or the surrounding layout; it only knows its own container.

```css
.card-wrapper { container-type: inline-size; container-name: card; }
.card { display: grid; gap: 0.5rem; }
@container card (min-width: 480px) {
  .card { grid-template-columns: 200px 1fr; }
}
```

**Trade-offs / when this fails.** `container-type: inline-size` enforces inline-axis containment, which has subtle layout implications (the element no longer participates in floats from outside, and its descendants cannot read its width via certain layout-sensitive APIs). The pre-2024 alternative was a JavaScript `ResizeObserver`, which had observable timing and performance differences. Today the recommendation is to use container queries by default for design-system components and to keep media queries for true viewport-level breakpoints (collapsing a multi-column layout to a single column at mobile widths).

### 3. Walk me through implementing dark mode that respects the OS preference but lets the user override it.

Three layers cooperate: a `data-theme` attribute on `<html>` controls the explicit user choice, a `prefers-color-scheme` media query carries the operating-system preference for the implicit default, and a small JavaScript snippet at the top of the document body ensures the correct theme is applied before the first paint to avoid a flash of incorrect theme.

**How it works.** The CSS defines variables for the light theme on `:root`, overrides them on `[data-theme="dark"]`, and conditionally overrides them inside a `prefers-color-scheme: dark` media query when the user has not made an explicit choice. The JavaScript reads a stored preference (or, if none, the OS preference) and sets `data-theme` on `<html>` synchronously during page load — the load happens in a small inline `<script>` so that the attribute is set before any styles paint.

```ts
const stored = localStorage.getItem("theme");           // "light" | "dark" | null
const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
const theme = stored ?? (prefersDark ? "dark" : "light");
document.documentElement.dataset.theme = theme;
```

```css
:root { --color-bg: #fff; --color-text: #111; }
[data-theme="dark"] { --color-bg: #0c0f14; --color-text: #e8edf3; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #0c0f14;
    --color-text: #e8edf3;
  }
}
```

**Trade-offs / when this fails.** Server-Side Rendering complicates the inline-script trick because the server cannot know the user's preference; the workaround is to render with a neutral theme and apply the correct theme in a blocking inline script before the first paint, which is what frameworks such as `next-themes` automate. The pattern also assumes a binary light/dark choice — if there is a high-contrast mode or a custom palette, the same `data-theme` attribute scales with additional values (`data-theme="high-contrast"`).

### 4. What does `:has()` enable that previously required JavaScript?

`:has()` lets a CSS rule depend on the presence or state of a descendant of the matched element. Without it, every "style this container based on a child" rule required either a JavaScript class flip on the parent or a duplicated wrapper element. The most common wins are forms (style the wrapper based on validity of its inner controls), cards (style the container based on which optional children exist), and disclosure widgets (style the parent based on whether the disclosure is open).

**How it works.** `:has()` is a relational pseudo-class. The selector `parent:has(.child)` matches any `parent` that has at least one descendant matching `.child`. The selector composes with other pseudo-classes (`:has(:invalid)`, `:has(:checked)`), so the form-validity case is a one-liner.

```css
/* Highlight a fieldset when any child is invalid. */
fieldset:has(:invalid) { border-color: red; }

/* Style the navigation when any link inside is the current page. */
nav:has([aria-current="page"]) { box-shadow: inset 0 -2px 0 var(--accent); }
```

**Trade-offs / when this fails.** Browser support became universal in 2024; older browsers fall through silently because the rule does not match, which is usually acceptable for cosmetic use cases. Performance is comparable to other descendant-driven selectors that were already common; the historic concern that `:has()` would be too expensive did not materialise in practice. The remaining limitation is that `:has()` cannot match against a sibling state outside the same parent — for cross-tree relationships, a CSS variable on a common ancestor is still the right tool.

### 5. Tailwind, CSS Modules, or CSS-in-JS — defend your choice for a new design system in 2026.

The defensible default in 2026 is **CSS Modules with design tokens for the design-system primitives, and Tailwind for application-level composition**. The reasoning is that a design system is consumed across products and teams, and the consumer wants the smallest possible runtime, the most stable selector contract, and zero coupling to a build tool that the consuming application may not use; CSS Modules deliver all three. The application that consumes the design system, however, benefits from Tailwind's constraint and JIT compilation, because the application code does not have the same stability requirements.

**How it works.** The design-system package ships compiled CSS Modules: each component has its own module, classnames are scoped at build time, and the public surface is the component, not the classname. Tokens are exposed both as CSS custom properties (so the consumer can theme them at runtime) and as TypeScript constants (so the consumer can read them in JavaScript). The application uses Tailwind for layout and one-off styling and reaches into the design-system components for composed primitives.

```tsx
// design-system: button.module.css
.root { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); }

// application: app.tsx
import { Button } from "@org/design-system";
<div className="grid grid-cols-3 gap-4">
  <Button>Save</Button>
</div>
```

**Trade-offs / when this fails.** CSS-in-JavaScript is rejected for new work in 2026 not because it cannot work but because the React Server Components ecosystem composes poorly with runtime CSS-in-JS. Zero-runtime CSS-in-JavaScript (Vanilla Extract, Panda) is a defensible choice for the design system if type-safe tokens are a hard requirement and the team will absorb the build complexity; the choice between zero-runtime CSS-in-JS and CSS Modules is a matter of team preference more than capability. The position is wrong only when the consumer base is so heterogeneous that the design system must ship as raw HTML/CSS without any build coupling at all, in which case vanilla CSS with custom properties is the only option.

### 6. What is the cascade order rule with `@layer` and how does it interact with specificity?

`@layer` introduces a layer of cascade priority that sits *above* specificity in the cascade order: a rule in a later-declared layer always wins over a rule in an earlier-declared layer, regardless of selector specificity. Within a single layer, the normal cascade rules apply (origin, specificity, source order). Unlayered rules count as a final implicit layer that is later than every named layer, which is why a stray un-`@layer`-wrapped rule can win against a heavily layered system unexpectedly.

**How it works.** The cascade has multiple stages: origin (user-agent, user, author), then `!important` (which inverts the origin order), then layers within the author origin, then specificity, then source order. `@layer` fits into the layers stage. Declaring `@layer reset, base, components, utilities;` at the top of the stylesheet establishes the order; later layer wins, regardless of how specific the selector inside it is.

```css
@layer base, components, utilities;
@layer base       { .card { color: red; } }                  /* specificity 0,1,0 */
@layer components { .card.featured { color: blue; } }        /* specificity 0,2,0 */
@layer utilities  { .text-green { color: green !important; } }
```

In the example, a `<div class="card featured text-green">` would normally let `.card.featured` (specificity 0,2,0) win over `.text-green` (0,1,0); but because `utilities` is declared after `components`, the layer order wins and the element is green. The `!important` flag interacts in the inverse direction within layers: an `!important` rule in an *earlier* layer beats an `!important` rule in a later one.

**Trade-offs / when this fails.** Adoption requires a project-wide order declaration at the top of the entry stylesheet; without it, layers default to source order and the win is not deterministic. The pattern's most useful application in 2026 is allowing Tailwind utilities to coexist with bespoke component CSS without a specificity arms race, which is exactly the use case Tailwind v3 documents and which is why the technique is now table stakes for any team using a utility framework alongside hand-authored CSS.

## Further reading

- MDN: [CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout) and [Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries).
- Josh Comeau, [The Surprising Truth About Pixels and Accessibility](https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/).
- web.dev, [Learn CSS](https://web.dev/learn/css).
