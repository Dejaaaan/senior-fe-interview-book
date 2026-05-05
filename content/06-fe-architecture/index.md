---
title: "Frontend Architecture"
sidebar_label: "6. Frontend Architecture"
description: "Component patterns, design systems, state machines, project structure, and micro-frontends."
sidebar_position: 5
---

This is the part where senior interviews diverge most clearly from mid-level ones. The questions are no longer "how do hooks work?". They become "how would you structure a User Interface library used by twelve product teams?", "how do you keep a design system consistent across thirty applications?", "how would you split a monolithic frontend into independently-shippable units?". The answers involve choices about component shape, design tokens, state coordination, project layout, and how independent teams ship without breaking each other's work.

The five chapters in this part cover patterns that pay back at scale, with concrete examples drawn from libraries the candidate is likely to know — Radix and shadcn/ui for headless component patterns, XState for state machines, Module Federation for micro-frontends. Each chapter includes a `## Common interview questions` section followed by a `## Answers` section with detailed, multi-paragraph answers a senior candidate would deliver in an interview, focused on the trade-offs an experienced engineer would name and the operational considerations the team would actually face.

## Chapters in this part

1. [Component patterns](./01-component-patterns.md) — Compound, Headless (Radix, React Aria), Render Props vs hooks-as-API, Polymorphic, and the Slot (`asChild`) pattern.
2. [Design systems](./02-design-systems.md) — the five layers (tokens, primitives, patterns, templates, products), semantic naming, Storybook, visual regression, deprecation strategy.
3. [State machines (XState)](./03-state-machines.md) — when a reducer is not enough, hierarchical and parallel states, guards, entry and exit actions, visualisation.
4. [Project structure](./04-project-structure.md) — by-feature vs by-type, Feature-Sliced Design, Hexagonal-on-Frontend, ESLint import boundaries, monorepos.
5. [Micro-frontends](./05-micro-frontends.md) — Module Federation (host and remote, `singleton: true`), single-spa, iframes, server-side composition.
