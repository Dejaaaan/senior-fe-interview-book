---
title: "Take-home guidelines & code review etiquette"
sidebar_label: "13.10 Take-home guidelines & code review etiquette"
description: "How to nail a take-home assignment and how to come across well in PR reviews."
sidebar_position: 10
---

Two artefacts that appear in nearly every senior interview loop: a take-home (or pair-programming) coding exercise, and a code-review round (often based on the take-home, or a constructed Pull Request the interviewer shows the candidate).

Both are scored on **engineering judgement**, not merely on code that compiles.

**Acronyms used in this chapter.** American Standard Code for Information Interchange (ASCII), Application Programming Interface (API), Continuous Integration (CI), Chief Technology Officer (CTO), Database (DB), End-to-End (E2E), Hypertext Transfer Protocol (HTTP), Insecure Direct Object Reference (IDOR), Pull Request (PR), Representational State Transfer (REST), TypeScript (TS), User Interface (UI), Uniform Resource Locator (URL), Visual Studio Code (VS Code), Work In Progress (WIP).

## The take-home

A take-home is "show me what production code looks like in the candidate's head". The common pitfall is to treat it like an algorithmic puzzle and produce a single-file two-hundred-line snake-cased stream of consciousness.

The senior take-home rubric breaks into nine concrete practises. **Read the brief twice and confirm scope before writing a line of code** — many interviewers leave deliberate ambiguity to see whether the candidate asks. **Time-box to the duration the brief specifies**; if the brief says four hours, target four hours, and if the candidate exceeds the limit, note it explicitly in the README rather than silently delivering more. **Choose the smallest scope that demonstrates the skills the brief is testing**; the candidate does not need a deployable application to demonstrate "implement a search box". **Write the README first**, before submission and ideally near the start, covering what was built, how to run it, the decisions and their trade-offs, and what the candidate would do next with more time. **Treat the commit history as a narrative**; five focused commits convey design intent more clearly than one "Work In Progress" commit at the end. **Add tests for the interesting parts** rather than chasing coverage — the tests that capture the requirements, not the tests that exercise every getter. **Keep linting and formatting clean** so the reviewer is not distracted by trivial inconsistencies. **Use strict TypeScript settings** so the type system carries information rather than escaping into `any`. **Consider error handling with intent** — do not wrap every operation in `try`/`catch`, but do handle the specific failure mode the brief implies. **Provide an accessibility baseline if the brief has a User Interface** (semantic Hypertext Markup Language, label associations, keyboard navigation).

### Avoid gold-plating

The opposite mistake to under-delivering is gold-plating — adding tooling and abstraction that the brief did not request. **Storybook for a single component** is a wasted hour that the reviewer will see as judgement failure. **Docker when the brief did not ask** suggests the candidate cannot scope. **End-to-End tests when there is no User Interface** signal that the candidate added them out of habit rather than need. **Refactoring "for the hypothetical follow-up"** demonstrates that the candidate cannot resist over-engineering.

The interviewer's question is "did the candidate scope sensibly, and is the code calm and clear?". Over-engineering reads as junior, not senior — a junior engineer demonstrates skills they have; a senior engineer demonstrates the skill of not deploying every skill they have.

### What to put in the README

```markdown
# Take-home: Tasks API

## Run
- `pnpm install`
- `pnpm dev` then `curl http://localhost:3000/tasks`

## Stack & decisions
- Express + Zod: minimal API, keeps the focus on design.
- In-memory store: the brief didn't require persistence; would swap for Postgres.
- Validation in routes: simple; if the API grew, I'd extract a service layer.

## What I deferred
- Auth (out of scope per brief).
- Pagination (one endpoint; fewer than 50 items in the seed).
- Persistence.

## With more time
- Add OpenAPI generation from the Zod schemas.
- Replace in-memory store with Postgres + Drizzle.
- Add CI (GitHub Actions, run lint + test on PR).

## Trade-offs
- Picked Express over Fastify because the brief mentioned middleware patterns specifically; Fastify would be ~25% faster but the request was about clarity.
- Used a single test file; for a real codebase I'd colocate per-module.

## Time
~3.5h.
```

This is what a senior submission looks like: explicit, confident, opinionated, and honest about scope.

### How to handle "we'll discuss your code"

Often a follow-up call. Prepare to:

- Walk through the architecture in 2 minutes.
- Defend each decision; revise when challenged with a better one.
- Show that you'd be able to extend it (live, sometimes).

Don't be precious. "Yeah, you're right, that's better" is a strong senior signal. So is "I considered that and went the other way because X — does that change with the constraint Y you mentioned?"

## Pair or live coding

When the interview is a pair-programming session rather than a take-home, the senior practises shift from "deliver a polished artefact" to "demonstrate productive collaboration in real time".

**Narrate trade-offs out loud** rather than silently choosing. "I am tempted to use a Map here for constant-time lookup, but with twenty elements it does not matter, so I will keep it as an array for clarity" reveals reasoning that the interviewer would otherwise have to infer. **Ask before assuming.** "Should I handle the empty case?" is a better signal than silently handling it (or silently not handling it). **Pick a stack quickly** rather than burning five minutes on `npx create-...`; use a starter or sandbox the candidate has practised in. **Test as the candidate goes**, even crudely; a `console.log` that confirms a hypothesis is acceptable, but a small Vitest case is better. **Do not pretend to know.** "I usually look this up — let me check the documentation" is acceptable and even respected; "I will wing it" is not. **Manage time.** Confirm priorities every ten minutes so the session does not drift away from the interviewer's actual evaluation criteria.

## Code-review interviews

A growing pattern: they show you a PR (real or constructed) and ask you to review it.

What they're looking for:

1. Do you spot bugs?
2. Do you raise design concerns?
3. Do you communicate them well?
4. Do you triage (must-fix vs nice-to-have)?

### A walkthrough

Imagine the diff:

```diff
+ async function getTasks(userId, status = "all") {
+   const url = "/api/tasks?status=" + status + "&userId=" + userId;
+   const res = await fetch(url);
+   const data = await res.json();
+   return data;
+ }
```

A senior review:

> **Must:**
> - URL params not encoded — `userId` could break for non-ASCII or special chars. Use `URLSearchParams`.
> - No error handling — a 500 response will surface as `data` being `null` or an error object, not a thrown error. Suggest `if (!res.ok) throw new ApiError(...)`.
> - Sending `userId` as a query param implies the server doesn't authenticate the request — confirming, but if so, this is an IDOR risk; the server should derive `userId` from the session.
>
> **Should:**
> - Type the return: `Promise<Task[]>`.
> - Function name `getTasks` is fine but consider `listTasks` for parity with REST verb (`POST /tasks` would be `createTask`, etc.).
>
> **Nit:**
> - Use template literals for URL building; cleaner than string concat.

Five points, prioritised, specific, with reasoning. That's the senior signal.

### Tone

- "This will fail when..." (factual) > "This is wrong" (judgmental).
- "Consider X because Y" (suggestion) > "Use X" (command).
- Acknowledge what's good; don't only critique.
- Use "I" or "we"; avoid passive voice that implies blame ("there's a bug here" → "this can throw on null input").
- Limit emoji and inside jokes; the PR will be read by interns and your CTO.

### Categorisation

Always tag: `[blocker]`, `[suggestion]`, `[question]`, `[nit]`.

```[blocker] Race condition: two requests can both pass the guard before either writes.
[suggestion] We could memoise this; not necessary but cheap.
[question] Why are we throwing here vs returning a Result?
[nit] Trailing whitespace.
```

Reduces churn; the author knows what to fix vs file.

### Mentioning style

If the codebase has style rules, link to them; don't argue style preferences. If it doesn't have rules but should, propose adding the rule, don't litigate one PR at a time.

## Senior framing in interviews

> "On take-homes I treat the README as the most important file — it shows scope judgement, trade-off framing, and what I'd do next, which is what an interviewer can't see in the diff. On code reviews I categorise by blocker / suggestion / question / nit and lead with the *why* — that's how I want my own PRs reviewed and it sets the tone for everyone else's."

## Key takeaways

- Take-home = "production code in your head"; scope tightly, README hard.
- Don't gold-plate; over-engineering is a junior signal.
- Pair programming: narrate, ask, test as you go.
- Code review: categorise (blocker / suggestion / question / nit), lead with the *why*.
- Tone matters more than the cleverness of the catch.

## Common interview questions

1. Walk through your last take-home. What would you do differently?
2. How do you decide what is a blocker versus a nit in a Pull Request review?
3. What is your default review tone?
4. How long should a take-home take?
5. How do you handle a Pull Request that is too big to review well?

## Answers

### 1. Walk through your last take-home. What would you do differently?

The expectation is reflective answers, not justifications. A senior candidate identifies one or two specific improvements they would make in retrospect — not generic ones, and not ones that excuse decisions that were correct at the time.

> *"My last take-home was a four-hour task to build a Tasks Application Programming Interface in TypeScript. I scoped it to Express plus Zod with an in-memory store; I wrote a five-commit history with focused commits, a README with the trade-offs and what I deferred, and tests for the validation and the route handlers. What I would do differently: I burned forty-five minutes on a Postgres integration that I ended up reverting because the brief did not require persistence. I should have stayed in-memory from the start and noted the database choice in 'with more time'. I also wrote a custom error class that I used in three places; if I had time-pressured myself harder, I would have skipped the abstraction. The README captured both decisions, so the interviewer could see I noticed."*

The structural points: the candidate is concrete (forty-five minutes wasted on Postgres, custom error class), the candidate caught their own over-engineering, and the candidate captured the reflection in the README rather than hiding it. Reflection in writing — visible to the reviewer — is a senior signal.

**Trade-offs / when this fails.** Saying "I would not change anything" reads as either dishonest or uncritical; both are weaker signals than naming a specific improvement. Saying "I should have done more" reads as not having scoped tightly; the right answer is "I should have done less and noted what I deferred". The reviewer is looking for judgement, and judgement is most visible in the things the candidate decided not to do.

### 2. How do you decide what is a blocker versus a nit in a Pull Request review?

A blocker is a comment that the change cannot ship without addressing — a correctness bug, a security issue, a contract violation, a missing piece of the brief, an Insecure Direct Object Reference risk, an unhandled error path that the brief implied. A nit is a small preference that the reviewer mentions for the author's awareness but does not block on — formatting, naming preferences, micro-optimisations that the author can reasonably ignore. The middle category — **suggestion** — is something the reviewer believes is the right call but the author can override with reasoning.

```text
[blocker]    URL params not encoded; userId can break for non-ASCII inputs.
[suggestion] Prefer `URLSearchParams` over manual string concatenation; cleaner intent.
[question]   Are we handling the case where status is invalid?
[nit]        Trailing whitespace on line 47.
```

The categorisation discipline matters because it tells the author exactly what is required (the blockers) and what is optional (the suggestions and nits). Without the discipline, the author treats every comment as equal weight and either over-rotates on nits or under-addresses blockers.

**Trade-offs / when this fails.** The categorisation breaks down when the reviewer has authority bias ("the senior said it; it must be a blocker") or when the categories drift in meaning across the team. The cure is to write the categories down in the team's review guide and to enforce them consistently. The senior reviewer who categorises sets a tone for the team that improves review quality across every Pull Request.

### 3. What is your default review tone?

The default tone is collaborative, factual, and specific. **"This will fail when..."** is factual; **"this is wrong"** is judgemental. **"Consider X because Y"** is a suggestion; **"use X"** is a command. The reviewer acknowledges what is good in the change rather than only critiquing — a "nice clean validation layer" comment costs nothing and improves the relationship.

```text
[suggestion] Consider deriving userId from the session here rather than the
query param. The current shape is technically open to IDOR if the route is
ever moved off the authenticated middleware. Happy to discuss either way.
```

The tone choices in the example: "consider" rather than "use", "the current shape is technically open to" rather than "this is broken", "happy to discuss" rather than silent ultimatum. The reviewer's language preserves the author's autonomy and invites conversation.

**Trade-offs / when this fails.** Excessively soft tone is also a problem — "maybe consider possibly looking at" wastes everyone's time and obscures the actual point. The senior balance is direct without being harsh. The reviewer who is consistently direct, specific, and respectful builds the trust that lets them be terse when terseness is appropriate ("blocker: this throws on null") without coming across as adversarial.

### 4. How long should a take-home take?

A take-home should take the time the brief allots, plus a small buffer for the README and self-review. If the brief says four hours, four hours is the target; six hours produces a more polished artefact but signals that the candidate cannot scope, which is a junior signal rather than a senior one. The senior practise is to deliver less, write the README explaining what was deferred and why, and let the trade-off conversation happen in the follow-up call.

The structural rule: if the candidate finds themselves at the time limit with significant work remaining, the candidate should write the README explaining the current state and submit; the candidate should not work for an additional four hours and pretend it took four. Interviewers who specify a time limit and accept twelve-hour submissions are testing whether the candidate respects the limit; the candidates who do are weighted more favourably.

**Trade-offs / when this fails.** Some interviewers explicitly say "take as long as you need" — in that case, the candidate should set their own reasonable budget and stick to it, and should still document what was deferred. Some take-homes are deliberately under-scoped to test whether the candidate notices the ambiguity and asks; some are deliberately over-scoped to test whether the candidate can prune. Reading the brief twice and asking clarifying questions before coding is the universal first step.

### 5. How do you handle a Pull Request that is too big to review well?

The senior approach is to refuse the review until the Pull Request is split — politely, with a clear explanation of why the size impedes review quality. Reviewing a thousand-line Pull Request superficially is worse than refusing; the rubber-stamp approval is a misleading signal both to the author (who learns that big Pull Requests are acceptable) and to the team (who lose trust in the review process).

```text
This Pull Request is significant — about 1,200 lines spanning a refactor, a
feature, and a test rewrite. I would like to give it a thorough review, but
at this size I would either miss issues or take a week. Could we split it
into three:

1. The interface refactor (mechanical, safe to land first).
2. The new feature (needs design discussion in the description).
3. The test rewrite (depends on 2).

Happy to walk through which commits to keep together.
```

The senior framing is collaborative — the reviewer offers to help split rather than just rejecting the work. The author often appreciates the structure once it is named; the temptation to ship one big Pull Request usually comes from tooling friction (rebase complexity) rather than design intent, and the structure helps the author too.

**Trade-offs / when this fails.** Sometimes the work is genuinely indivisible — a database migration that touches every file consistently, a framework upgrade that is one big change. In those cases, the reviewer schedules a synchronous walk-through with the author rather than reviewing asynchronously; the walk-through is faster and more accurate than a thousand-line asynchronous review. The senior judgement is to recognise which case applies and to choose the right review medium accordingly.

## Further reading

- [Conventional Comments](https://conventionalcomments.org/) — the [blocker]/[suggestion] system.
- *Code Reading: The Open Source Perspective* — Diomidis Spinellis.
- *The Pragmatic Programmer*.
