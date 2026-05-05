---
title: "Study plan"
sidebar_label: "1.2 Study plan"
description: "Time-boxed plans for the loop you actually have."
sidebar_position: 2
---

Preparation discipline is half the value of a study plan and the other half is restraint: deciding not to read a chapter so that the chapters you do read receive enough attention. Pick the timeline closest to the time you actually have and follow the schedule. Each block is approximately two focused hours of reading plus exercises.

> **Acronyms used in this chapter.** API: Application Programming Interface. AWS: Amazon Web Services. CSS: Cascading Style Sheets. FE: Frontend. JWT: JSON Web Token. OAuth: Open Authorization. OIDC: OpenID Connect. PKCE: Proof Key for Code Exchange. SBI: Situation-Behaviour-Impact. STAR: Situation-Task-Action-Result. TS: TypeScript.

All three plans share the same shape: a `Period | Focus | Chapters` table. Chapter numbers use the printed-edition format `<part>.<chapter>` — for example `2.1` is part 2 (Foundations), chapter 1 (TypeScript deep-dive). Each number links to the chapter.

## You have one week

The goal of the one-week plan is to refresh, not to learn. The plan trusts your existing experience and patches the gaps that interviewers usually probe. It assumes that you can already write idiomatic React and that the production-engineering vocabulary is at least familiar.

| Day | Focus | Chapters |
| --- | --- | --- |
| Mon | TypeScript and JavaScript fundamentals — generics, narrowing, the event loop. | [2.1](../02-foundations/01-typescript.md), [2.2](../02-foundations/02-javascript-browser.md) |
| Tue | React mental model and hooks subtleties — referential identity, effects, context. | [3.1](../03-react/01-mental-model.md), [3.2](../03-react/02-hooks-deep-dive.md) |
| Wed | Next.js App Router and Server Components — caching, Server Actions, streaming. | [4.1](../04-nextjs/01-app-vs-pages.md), [4.2](../04-nextjs/02-layouts-routing.md), [4.3](../04-nextjs/03-data-fetching-caching.md) |
| Thu | REST and Auth — sessions versus JWT, OAuth/PKCE, cookies. | [9.1](../09-rest-and-networking/01-rest-principles.md)–[9.5](../09-rest-and-networking/05-openapi.md), [10.1](../10-auth/01-authn-vs-authz.md)–[10.4](../10-auth/04-cookies.md) |
| Fri | Security essentials and AWS core — IAM, S3, CloudFront, Lambda, API Gateway. | [11.1](../11-security-and-privacy/01-owasp.md)–[11.4](../11-security-and-privacy/04-cors.md), [12.1](../12-aws/01-iam.md), [12.2](../12-aws/02-s3.md), [12.3](../12-aws/03-cloudfront-route53.md), [12.5](../12-aws/05-api-gateway.md), [12.6](../12-aws/06-dynamodb.md) |
| Sat | Frontend system-design framework and two worked prompts. | [13.1](../13-interview-prep/01-system-design-framework.md), [13.2](../13-interview-prep/02-worked-chat.md), [13.4](../13-interview-prep/04-worked-feed.md) |
| Sun | Behavioural and senior leadership; a mock loop. | [13.8](../13-interview-prep/08-behavioral.md), [13.9](../13-interview-prep/09-leadership.md) |

Each block ends with a single exercise: write a one-paragraph summary of what you just read, from memory. If the summary is shorter than three sentences or omits the trade-offs, re-read the chapter before continuing.

## You have one month

The one-month plan adds the architecture and production-concerns chapters, the full Node.js backend trio, the Angular basics chapter if you are interviewing anywhere with an Angular component to the stack, and the remaining system-design prompts. Each row below is approximately one chapter per weekday plus a longer block on the weekend.

| Week | Focus | Chapters |
| --- | --- | --- |
| 1 | Foundations and Modern React; build each `code/*` package as you read its companion chapter. | [2.1](../02-foundations/01-typescript.md)–[2.5](../02-foundations/05-browser-apis.md), [3.1](../03-react/01-mental-model.md)–[3.8](../03-react/08-testing-intro.md) |
| 2 | Next.js, frontend architecture, and a design-system mini-project; extract two or three primitive components into a small package with tokens, variants, and a Storybook story by the end of the week. | [4.1](../04-nextjs/01-app-vs-pages.md)–[4.7](../04-nextjs/07-deployment.md), [6.1](../06-fe-architecture/01-component-patterns.md)–[6.5](../06-fe-architecture/05-micro-frontends.md) |
| 3 | Production concerns and the Node.js backend trio. Build the Tasks API in Express, Fastify, and NestJS yourself — the muscle memory only forms when you type it. | [7.1](../07-production-concerns/01-performance.md)–[7.8](../07-production-concerns/08-ai-features.md), [8.1](../08-nodejs-backend/01-node-fundamentals.md)–[8.6](../08-nodejs-backend/06-comparison.md) |
| 4 | REST, Auth, Security, AWS end-to-end, and the interview-prep toolkit. Deploy one of the Tasks APIs via the [`code/aws-samples`](https://github.com/Dejaaaan/senior-fe-interview-book/tree/main/code/aws-samples) Cloud Development Kit stacks as the synthesis exercise that exposes which concepts are still fuzzy. | [9.1](../09-rest-and-networking/01-rest-principles.md)–[9.8](../09-rest-and-networking/08-graphql-trpc.md), [10.1](../10-auth/01-authn-vs-authz.md)–[10.8](../10-auth/08-react-client.md), [11.1](../11-security-and-privacy/01-owasp.md)–[11.7](../11-security-and-privacy/07-privacy-gdpr.md), [12.1](../12-aws/01-iam.md)–[12.11](../12-aws/11-end-to-end.md), [13.1](../13-interview-prep/01-system-design-framework.md)–[13.10](../13-interview-prep/10-take-home-and-review.md) |

If Angular is not on your loop, drop the Angular row from the schedule entirely. Otherwise, fit it inside the Week 2 block by trading half a day from the design-system mini-project.

## You have three months

The three-month plan is to read the book cover to cover, build every code sample yourself, and after each part write a one-page cheat-sheet from memory. If you cannot write the cheat-sheet, re-read the chapter; the gap between recognition and recall is the gap between a mid-level and a senior interview signal. Durations are approximate and assume two focused hours per day on weekdays plus a longer block on the weekend; flex any single row by a day or two without abandoning the plan.

| Week | Focus | Chapters |
| --- | --- | --- |
| 1–2 | Foundations: TypeScript, JavaScript, HTML/CSS, accessibility, Browser APIs. | [2.1](../02-foundations/01-typescript.md)–[2.5](../02-foundations/05-browser-apis.md) |
| 3–4 | Modern React: mental model, hooks, Suspense, server vs. client, state, forms, performance, testing. | [3.1](../03-react/01-mental-model.md)–[3.8](../03-react/08-testing-intro.md) |
| 5 | Next.js: App Router, layouts, data fetching, Server Actions, middleware, auth, deployment. | [4.1](../04-nextjs/01-app-vs-pages.md)–[4.7](../04-nextjs/07-deployment.md) |
| 6 | Angular basics (only if Angular is on the loop) and frontend architecture: component patterns, design systems, state machines, project structure, micro-frontends. | [5.1](../05-angular-basics/01-components-modules.md)–[5.8](../05-angular-basics/08-react-equivalent.md), [6.1](../06-fe-architecture/01-component-patterns.md)–[6.5](../06-fe-architecture/05-micro-frontends.md) |
| 7–8 | Production concerns: performance, testing, observability, build tooling, CI/CD, i18n, PWA, AI features. | [7.1](../07-production-concerns/01-performance.md)–[7.8](../07-production-concerns/08-ai-features.md) |
| 9 | Node.js backends: the same Tasks API built in Express, Fastify, and NestJS. | [8.1](../08-nodejs-backend/01-node-fundamentals.md)–[8.6](../08-nodejs-backend/06-comparison.md) |
| 10 | REST APIs & Networking and Authentication & Authorization. | [9.1](../09-rest-and-networking/01-rest-principles.md)–[9.8](../09-rest-and-networking/08-graphql-trpc.md), [10.1](../10-auth/01-authn-vs-authz.md)–[10.8](../10-auth/08-react-client.md) |
| 11 | Security & Privacy and the AWS core (IAM, S3, CloudFront, Lambda, API Gateway, DynamoDB, Cognito, messaging, observability, secrets, end-to-end deployment). | [11.1](../11-security-and-privacy/01-owasp.md)–[11.7](../11-security-and-privacy/07-privacy-gdpr.md), [12.1](../12-aws/01-iam.md)–[12.11](../12-aws/11-end-to-end.md) |
| 12 | Interview-prep toolkit: system-design framework, worked prompts, behavioural, leadership, take-home & code review. | [13.1](../13-interview-prep/01-system-design-framework.md)–[13.10](../13-interview-prep/10-take-home-and-review.md) |

## Mock loops

Reading is not enough. Schedule at least three mock interviews before the real loop. The cheapest formats:

- **Coding.** Pair with a friend on a medium LeetCode problem, then refactor the solution to "interview quality" together. Discuss the trade-offs you skipped under time pressure rather than just the correct answer; the trade-off conversation is the senior signal interviewers are scoring.
- **Frontend system design.** Pick a prompt from [Part 13](../13-interview-prep/index.md) and explain it to a rubber duck for forty-five minutes uninterrupted. Then read the corresponding chapter and grade your own answer against the structure recommended in the [system-design framework chapter](../13-interview-prep/01-system-design-framework.md). The act of grading is more instructive than the talking-through.

  ```ts
  const prompt = "Design an autocomplete component with debounced fetch, cancellation, keyboard navigation, and accessibility.";
  // Run the framework: 1) clarify scope, 2) sketch components, 3) draw data flow,
  // 4) discuss perf budgets, 5) discuss accessibility, 6) discuss failure modes.
  ```

- **Behavioural.** Write three Situation-Task-Action-Result (STAR) stories per levelling rubric in [chapter 13.8](../13-interview-prep/08-behavioral.md). Rehearse them aloud — written stories sound canned when delivered verbatim, and the rehearsal exposes the parts of the story that need a one-sentence "why this mattered" coda.

## Key takeaways

- Pick the plan that matches your real timeline. Overcommitting and abandoning a plan halfway is worse than starting with a smaller plan and finishing it.
- The two cross-cutting topics — Auth and Security — are the cheapest wins because they appear in almost every loop and are short relative to their interview yield.
- Mock loops are non-negotiable. Reading a chapter is recognition; explaining it under time pressure is recall, and only the latter survives an interview.
