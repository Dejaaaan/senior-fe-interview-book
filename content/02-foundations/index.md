---
title: "Foundations"
sidebar_label: "2. Foundations"
description: "TypeScript, modern JavaScript, HTML/CSS, accessibility, and browser APIs."
sidebar_position: 1
---

Senior frontend interviews almost always test that the candidate actually understands the platform underneath the framework, not only the framework that the candidate ships in. This part covers the foundations that come up regardless of whether the loop is React-shaped, Angular-shaped, or framework-agnostic.

If you have shipped React for years, the temptation is to skip these chapters. Resist it: at minimum, skim the `Key takeaways` and `Answers` sections of each chapter. Most "I knew that but could not articulate it" moments in interviews are the residue of skipped fundamentals — closures, the event loop, the `this` rules, the cascade — that experienced engineers stop thinking about consciously and therefore stop being able to teach on a whiteboard.

Each chapter ends with `Common interview questions` followed by detailed `Answers` written at the depth a senior candidate would actually deliver under interview conditions.

## Chapters in this part

1. [TypeScript deep-dive](./01-typescript.md) — strictness flags, generics with constraints, conditional and mapped types, exhaustive narrowing, branded types, and declaration files.
2. [JavaScript fundamentals (browser)](./02-javascript-browser.md) — closures, prototypes, `this`-binding, ESM vs CommonJS, the event loop and the microtask queue, the `Promise` combinators, async iterators.
3. [Modern HTML & CSS](./03-html-css.md) — semantic HTML, Flexbox vs Grid, container queries, the `:has()` selector, cascade layers, custom properties, logical properties, `oklch()`.
4. [Accessibility (WCAG 2.2)](./04-accessibility.md) — POUR principles, keyboard navigation, focus management, ARIA, accessible forms, contrast, reduced motion, and `axe-core` in CI.
5. [Browser & Web Platform APIs](./05-browser-apis.md) — `fetch` with `AbortController`, the storage hierarchy, Service Workers, Web Workers, the observer family, History and Navigation, Web Crypto, `BroadcastChannel`, Page Lifecycle.
