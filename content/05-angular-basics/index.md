---
title: "Angular Basics (Interview Survival)"
sidebar_label: "5. Angular Basics (Interview Survival)"
description: "The Angular concepts a senior frontend developer must be able to discuss, even from a React background."
sidebar_position: 0
---

Angular sits in second place behind React for new projects in 2026, but it remains in first place in mature enterprises — banks, telecommunications providers, and large Software-as-a-Service products that began their lives in the 2017-2020 window when Angular was the dominant choice. If a senior frontend candidate is interviewing at an organisation with an Angular codebase, or at an organisation whose interviewer wants to confirm the candidate could pick up Angular on joining, the material in this part is essential preparation.

This part is not a comprehensive Angular tutorial. It is a deliberately scoped senior-level survival kit covering four objectives. The vocabulary needed to converse fluently with a team that uses Angular daily — terms like dependency injection token, standalone component, observable, and signal. The conceptual mental model needed to read an Angular codebase and follow what is happening without translating every line. The mapping from React equivalents so the candidate can articulate analogies in either direction. And the modern Angular patterns that became the default in the 2024-2026 releases — standalone components, the `inject()` function, and signal-based reactivity — which an interviewer is increasingly likely to expect a candidate to be aware of even when they have not used Angular in production themselves.

Every chapter in this part includes a `## Common interview questions` section followed by an `## Answers` section with detailed, multi-paragraph answers a senior candidate would actually deliver in an interview. The answers focus on the conceptual mapping (this Angular concept corresponds to that React concept, and here is where the analogy breaks down), the operational implications (what the team should configure, how to spot common bugs), and the trade-offs an experienced engineer would name.

## Chapters in this part

1. [Components, modules, standalone](./01-components-modules.md) — the modern standalone-first component model and what `NgModule` was for.
2. [Dependency injection](./02-di.md) — the `inject()` function, providers, hierarchical injectors, and the resolution modifiers.
3. [RxJS essentials](./03-rxjs.md) — Observables, the operators that come up daily, Subject variants, and `takeUntilDestroyed`.
4. [Routing & guards](./04-routing.md) — lazy loading, function guards (`CanActivateFn`, `CanMatchFn`, …), resolvers, and component input binding.
5. [Forms (template-driven vs reactive)](./05-forms.md) — typed reactive forms, validators (sync, async, cross-field), and `updateOn`.
6. [HttpClient & interceptors](./06-http.md) — functional interceptors, `withFetch`, retry and tracing patterns, and `HttpTestingController`.
7. [Signals & modern reactivity](./07-signals.md) — `signal`, `computed`, `effect`, `linkedSignal`, and zoneless change detection.
8. [If you know React](./08-react-equivalent.md) — Angular concepts mapped to their React equivalents and where the analogy breaks down.
