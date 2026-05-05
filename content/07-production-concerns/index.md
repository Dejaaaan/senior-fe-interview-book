---
title: "Production Concerns"
sidebar_label: "7. Production Concerns"
description: "Performance, testing, observability, build tooling, CI/CD, i18n, PWA, AI features."
sidebar_position: 6
---

This is the most distinguishing part of the book at the senior level. Mid-level engineers are asked "can you build the feature?". Senior engineers are asked "can you ship it, measure it, evolve it, and not regret it in eighteen months?". The answers live in this part.

Eight chapters cover everything that comes after "the feature works on my machine" — the operational, observational, and organisational concerns that distinguish a feature from a product. Each chapter includes a `## Common interview questions` section followed by an `## Answers` section with detailed, multi-paragraph answers a senior candidate would deliver in an interview, focusing on the operational trade-offs an experienced engineer would name and the production hazards a team would actually encounter.

## Chapters in this part

1. [Performance & Core Web Vitals](./01-performance.md) — measurement and optimisation at the platform level (Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift).
2. [Testing strategy](./02-testing-strategy.md) — the full pyramid, Mock Service Worker, Playwright, visual regression, accessibility.
3. [Observability](./03-observability.md) — Sentry, Real User Monitoring, the `web-vitals` library, distributed tracing.
4. [Build tooling & monorepos](./04-build-tooling.md) — Vite, Turbopack, Rspack, esbuild, Turborepo, bundle analysis.
5. [CI/CD & feature flags](./05-cicd-feature-flags.md) — preview deployments, semantic-release, canaries, feature-flag platforms.
6. [Internationalization](./06-i18n.md) — the `Intl` APIs, ICU MessageFormat, right-to-left support, translation workflows.
7. [PWA & offline-first](./07-pwa-offline.md) — Service Worker strategies, Background Sync, offline storage, the offline-first libraries.
8. [AI features in frontend apps](./08-ai-features.md) — streaming UI, tool calls, retrieval-augmented generation UX, optimistic UI for AI.
