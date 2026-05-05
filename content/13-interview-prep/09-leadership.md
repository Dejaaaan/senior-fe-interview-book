---
title: "Senior leadership & soft skills"
sidebar_label: "13.9 Senior leadership & soft skills"
description: "Mentoring, code review culture, RFC writing, tech-lead expectations, estimation, influence, trade-off framing."
sidebar_position: 9
---

Senior is not "writes the most code". Senior is "makes the team better and the system more sustainable than they were yesterday". The interview will probe whether the candidate has the muscles for that, even if the candidate's day job has been individual-contributor heavy.

This chapter is opinionated. Candidates should bring their own experience and disagree where they must.

**Acronyms used in this chapter.** Application Programming Interface (API), Continuous Integration (CI), Database (DB), End of Day (EOD), Individual Contributor (IC), Lines of Code (LoC), Looks Good To Me (LGTM), Pull Request (PR), Request for Comments (RFC), Service Level Objective (SLO).

## Mentoring

Mentoring operates in two distinct modes, and senior engineers practise both.

### Direct mentoring (one-to-one)

Direct mentoring is a structured one-to-one relationship with a single mentee. The cadence is regular — typically thirty minutes, weekly or every other week. The mentee's agenda is heard first; the mentor's agenda is secondary. Topics include career goals, current blockers, problems the mentee is stuck on, and things the mentee wants to learn. The mentor does not solve the mentee's problems for them; the mentor asks "what have you tried?" and "what is the next step?" to develop the mentee's problem-solving capacity rather than substituting the mentor's. The mentor helps the mentee present their work — reviewing their Request for Comments documents, watching dry-runs of their technical talks, giving feedback on their writing. The mentor connects the mentee to people in the organisation outside the immediate team, broadening the mentee's network and exposure.

### Scaling mentoring (one-to-many)

Scaling mentoring is the mode where one mentor's investment reaches many learners. **Internal documentation** captures "how X works" so the next person does not need to ask the same question; the documentation outlives the mentor's tenure on the team. **Onboarding pairing** dedicates a week to a new joiner; the mentor catches process gaps and the new joiner ramps faster. **Technical talks at lunch** distribute knowledge to the team in a low-friction format; one quarterly talk is a reasonable cadence. **Code-review prose that teaches, not just gates** turns each review into a small lesson — "consider X because Y" rather than "fix this". **Public-by-default writing** — design documents, architecture decision records, postmortems — makes the mentor's reasoning visible to the entire organisation rather than only the immediate team.

The senior heuristic: every question someone asks the senior engineer twice should become a document.

## Code review culture

A poor Pull Request culture is a tax on every change. Senior engineers shape it deliberately, treating the review process as a system to be tuned rather than an inevitable friction.

### What good looks like

A healthy Pull Request culture has small Pull Requests (under four hundred Lines of Code), because large diffs receive only superficial review and become a vehicle for unintended changes. Pull Requests carry a clear description that addresses what was changed, why, how, and how it was tested; the reviewer should not need to reverse-engineer the intent from the diff. Comments are categorised — **must** (the change cannot ship without addressing this), **should** (the reviewer believes this is the right call but the author can override), **nit** (a small preference the reviewer mentions but does not block on). Reviewers are responsive (under one working day for the first response, under two hours for follow-up rounds), because slow review compounds into stalled work across the team. Approvals are deliberate ("I would ship this") rather than reflexive ("Looks Good To Me"). Disagreements that exceed three or four rounds of asynchronous comments escalate to a synchronous conversation; the asynchronous medium is not productive past that point.

### Reviewer mindset

The reviewer's mental questions are: "Can I run this in my head and predict the behaviour?" — if the answer is no, the change is too complex. "Will this cause confusion or bugs in the next person who reads it?" — readability is a property of the change, not just the original author. "Is this the right test surface for the risk?" — high-risk changes need integration tests; low-risk changes need only unit tests. "Could I write the same change in fewer concepts?" — simpler is better, and simpler can be requested.

### Author mindset

The author's posture is to anticipate the reviewer's questions and pre-empt them in the description, because every clarifying question is a round-trip. One concern per Pull Request: refactors are separate from features, which are separate from migrations; mixing them produces a diff that no reviewer can confidently approve. Every comment receives a reply (acknowledging, addressing, or pushing back); silently pushing changes without responding is dismissive. When the reviewer is right, the author acknowledges it explicitly — "good catch, fixed in the next commit" rather than silent change.

### Anti-patterns to challenge

Several patterns degrade Pull Request culture and should be challenged when they appear. **"Approve and move on" without reading** turns review into a rubber stamp. **Bikeshedding** — extended debate over stylistic preferences that should be enforced by linters — wastes time on the wrong axis. **Authority-based reviews** — "the senior said X, ship it" — replace argument with hierarchy and erode trust. **Two-hundred-line Pull Requests with one-line descriptions** put the entire burden of understanding on the reviewer. **Mixing migration, feature, and refactor in one diff** makes the Pull Request impossible to revert cleanly when one part needs to be undone.

## RFC writing

The senior writing artefact. Used for "this change is large enough to warrant disagreement before code".

### A great RFC has

1. **Title + status + author + date**.
2. **Problem statement** — what we're trying to solve, in one paragraph.
3. **Background** — context the reader needs.
4. **Goals & non-goals** — what's in scope, what isn't.
5. **Proposal** — the concrete design.
6. **Alternatives considered** — at least two, with why-rejected.
7. **Migration / rollout plan**.
8. **Risks & mitigations**.
9. **Open questions**.

### Tactics

- Write the executive summary last — once you know what you actually proposed.
- Diagrams (Mermaid, Excalidraw). One picture per major concept.
- Be explicit about what you're *not* doing.
- Surface the controversial choice early; don't bury the lede.
- Set a comment deadline ("decisions by Friday EOD").
- Move from doc to sync meeting only when comments stall.

### What to do with feedback

- Address every comment in writing in the doc (not just inline-resolve and forget).
- If you're rejecting a suggestion, write *why* — that's the durable value.
- Update the doc inline; don't require readers to scroll comments.

## Tech-lead expectations

Tech-lead isn't a manager; it's the senior IC on a team who owns the technical health.

Responsibilities:

- **Roadmap shape**: what we're working on this quarter, in what order, why.
- **Technical quality bar**: tests, observability, documentation, on-call hygiene.
- **Risk management**: what could go wrong; what's our plan when it does.
- **Mentoring**: described above.
- **Stakeholder communication**: translate engineering trade-offs into business language.
- **Hiring**: contribute to interviews; advocate for who you want.
- **Time-cost honesty**: push back on impossible scope; propose alternatives.

What tech-leads don't do:

- Take all the interesting work.
- Code-review without reviewing junior PRs.
- Make decisions in their head and announce them.
- Argue rather than escalate.

## Estimation & scoping

Engineers hate estimating because they get held to it as a deadline. Frame it as a forecast, not a commitment.

Senior estimation skills:

- Break the work into testable chunks (each chunk shippable independently).
- Identify the riskiest unknown; spike it first.
- Triple any estimate that involves a third party.
- Communicate ranges, not points: "2-4 weeks, depending on whether the API team can give us X."
- Update mid-project when reality diverges. Surprise is the failure mode.

A simple sizing rubric:

| Size | Time | Description |
| --- | --- | --- |
| XS | hours | Trivial |
| S | days | Single dev, no unknowns |
| M | 1-2 weeks | Single dev, some unknowns |
| L | 2-4 weeks | Possibly multi-dev, design needed |
| XL | >4 weeks | Needs RFC + breakdown |

## Influence without authority

The senior special.

- **Frame the trade-off, not the solution.** "We can pick A (2 weeks, kills the bug class) or B (3 days, tactical fix)" instead of "we should do A".
- **Bring data.** Profile, log, measure. "It's slow" is rejectable; "p95 is 1.4s, here's the trace" is not.
- **Make the better path the easier one.** Don't propose; build the prototype, share it.
- **Find a sponsor.** A staff/principal engineer who agrees with you can carry the proposal in rooms you're not in.
- **Be patient.** Influence accrues over months; reputation is what compounds.

## Trade-off framing

Every engineering decision is a trade-off. Senior engineers are explicit about the axes:

- Fast / cheap / good — pick two.
- Build / buy.
- Now / later.
- Coupled / decoupled.
- Shared / independent.
- Centralised / federated.
- Synchronous / asynchronous.
- Expressive / safe.

A senior decision doc says: "Axis: X vs Y. Picking X because A, B, C; accepting cost D, mitigated by E."

## Postmortems / blameless culture

When something breaks:

- The first 30 minutes: stop the bleeding, communicate to stakeholders.
- The first 24 hours: write the timeline, the impact, the root cause(s).
- The first week: action items with owners and dates.
- The first month: action items completed; review what's still in flight.

Senior engineers run postmortems that focus on **systems** ("the alert fired but went to a channel nobody watches; routing now goes to PagerDuty"), not **people** ("Bob deployed at 5pm without testing").

## Communication patterns

- **Async first.** Document; allow timezones; let people read at their own pace.
- **Sync when escalating.** A meeting is for unblocking, not for status.
- **Short messages.** Long Slack messages don't get read. Lead with the ask.
- **Reply with a decision, not a discussion.** "Going with A; reasons in doc; closing this thread."
- **Take notes in meetings**, share publicly. The meeting was for the people in the room; the notes are for the org.

## Saying no

Senior engineers say no, gracefully:

- "I can't do that this sprint; here's what I'd defer if you want it."
- "I'd rather not start that; here's the alternative I'd propose."
- "I think this is a bad idea, here's why; I'll go with the team's call but I want to register the disagreement."

Disagree-and-commit is a senior superpower. Stalling on a decision because you disagree is a junior anti-pattern.

## Senior-leveling buckets

Most companies' senior rubrics cluster on these axes; the interview will probe each:

- **Technical quality**: depth and breadth.
- **Scope**: team / cross-team / org / company.
- **Independence**: how much oversight needed.
- **Influence**: who follows your lead.
- **Mentorship**: how you grow others.
- **Communication**: written and verbal.
- **Judgment**: trade-off framing, risk assessment.

Practise placing your stories on these axes; the interviewer is mentally placing you.

## Key takeaways

- Mentoring is documentation that scales.
- Small PRs, deliberate review culture.
- RFCs for big decisions, with alternatives and migration.
- Tech-lead = technical health owner, not the sole coder.
- Estimate ranges, communicate when they shift.
- Influence with data + framing + patience.
- Postmortems blameless, focused on systems.
- Disagree and commit; saying no is a senior skill.

## Common interview questions

1. How would you scale mentoring beyond a single one-to-one?
2. Walk through how you would write an RFC.
3. How do you make a difficult call when the team disagrees?
4. What does a healthy code-review culture look like to you?
5. Tell me about influencing a team you do not lead.

## Answers

### 1. How would you scale mentoring beyond a single one-to-one?

The senior framing is that one-to-one mentoring caps at a handful of mentees per mentor (each takes structured time and emotional energy); to reach more engineers, the mentor must invest in artefacts that scale beyond direct interaction. The artefacts are documentation, talks, and culture — each compounds the mentor's investment over time.

The pattern in practice: every question the mentor answers twice becomes a document, so the third person reads the document rather than asking the mentor. Every recurring topic becomes a lunch talk or a recorded session, which N people watch instead of N one-to-ones. Every piece of code review prose teaches a small lesson that the author and the team learn from. Onboarding documentation captures the implicit knowledge that experienced engineers take for granted, so new joiners ramp without requiring the senior engineer's time.

```text
1:1 mentoring   ->  high-touch, deep, scales to ~5 mentees
1:N artefacts   ->  lower-touch, broader reach, scales to N=team or N=org
                   (documentation, recorded talks, ADRs, postmortems, code review prose)
```

**Trade-offs / when this fails.** The artefacts approach loses the personal relationship and the bidirectional feedback that one-to-one mentoring provides; some mentees genuinely benefit from the structured one-to-one and would be poorly served by a wiki page. The right balance is both: a small number of one-to-one relationships for high-investment growth, plus continuous artefact production that lifts the entire team. The mentor who refuses to do either is not exercising senior leadership.

### 2. Walk through how you would write an RFC.

The Request for Comments is the senior writing artefact. It is used for "this change is large enough that we should disagree before code, not during code review". The structure forces the author to articulate trade-offs explicitly rather than letting them emerge implicitly during implementation.

The structure: title, status, author, date; problem statement (one paragraph); background (the context the reader needs); goals and non-goals (what is in scope and, importantly, what is not); the proposal (the concrete design); alternatives considered (at least two, with explicit reasons for rejection); migration and rollout plan; risks and mitigations; open questions. The executive summary is written last, once the author knows what they actually proposed.

```text
# RFC: Migrate session storage from Redis to DynamoDB

Status: Draft -> Review -> Accepted/Rejected
Author: ...   Date: 2026-04-02

## Problem
...

## Background
...

## Goals / Non-goals
...

## Proposal
...

## Alternatives
1. Stay on Redis. Rejected because ...
2. Use Memcached. Rejected because ...

## Migration / Rollout
...

## Risks / Mitigations
...

## Open questions
...
```

The tactic that distinguishes good from great Requests for Comments: the author surfaces the controversial choice early (in the executive summary) and addresses every comment in writing in the document body, not just inline-resolved and forgotten. The document outlasts the discussion thread; the durable value is the captured reasoning.

**Trade-offs / when this fails.** Requests for Comments are heavy artefacts; using them for small decisions is wasteful and slows the team. The judgment call is whether a decision is large enough to warrant the structured discussion: if the decision is reversible in a day, do not write a Request for Comments; if the decision is reversible only with weeks of work, write one. Documents that go without a comment deadline drift; the author should set "decisions by Friday End of Day" and move from document to synchronous meeting only when comments stall.

### 3. How do you make a difficult call when the team disagrees?

The senior framing is that disagreement is healthy and the goal is not consensus — the goal is a decision that is well-reasoned, captured in writing, and that the team commits to even when individuals disagree.

The mechanism: surface the disagreement explicitly, frame the trade-off (what we gain with option A, what we lose; what we gain with option B, what we lose), invite each side to argue their strongest case, then make the call. The call is the senior engineer's responsibility when the team cannot reach consensus and the cost of non-decision exceeds the cost of the wrong decision. The decision is captured in writing — an architecture decision record or a Request for Comments — with the rejected alternatives and the reasons for rejection.

```text
Decision: Use server-side sessions, not stateless JWTs.
Date: 2026-04-15
Decider: <name>, with input from <list>

Trade-off: server-side sessions add infrastructure (a session store)
but enable instant revocation and finer-grained session tracking.
Stateless JWTs avoid the session store but cannot be revoked
without a denylist that re-introduces the session store anyway.

Rejected alternatives:
- Pure stateless JWT: rejected due to revocation requirements.
- Hybrid (JWT + denylist): rejected as the worst of both worlds.
```

The senior practise: disagree-and-commit. Once the call is made, the team moves forward together. Stalling on a decision because the engineer disagrees is a junior anti-pattern. The dissenting engineer registers the disagreement in the record (so the reasoning is captured if the decision is revisited), then commits to the decision and helps make it succeed.

**Trade-offs / when this fails.** Making the call too quickly without hearing the team is autocratic; making the call too slowly leaves the team in limbo. The judgement is to spend the right amount of time on the disagreement — proportional to the cost of being wrong — and then to decide. Documenting the rejected alternatives is the most under-invested-in part of decision-making; future engineers reading the record will be grateful.

### 4. What does a healthy code-review culture look like to you?

A healthy code-review culture has small Pull Requests (under four hundred Lines of Code), clear descriptions, categorised comments (must / should / nit), responsive reviewers (under one working day), and explicit approvals ("I would ship this"). Disagreements escalate to synchronous conversation after a few rounds of asynchronous comments. The author and reviewer both treat review as a collaborative improvement, not an adversarial gate.

The reviewer's mindset is "can I predict the behaviour from reading this?" — if the answer is no, the change is too complex and should be simplified or split. The author's mindset is "anticipate the reviewer's questions and pre-empt them in the description", because every clarifying question is a round-trip. Both author and reviewer separate concerns: the refactor goes in one Pull Request, the feature in another, the migration in a third; mixing them produces a diff that cannot be confidently approved or reverted.

```text
PR title: Add cursor pagination to /tasks
Description:
- Why: offset pagination broke at depth 10000 (DB scan).
- What: cursor uses (createdAt, id); base64-encoded.
- How: see encode/decode helpers in src/lib/cursor.ts
- Tested: unit tests for encode/decode; integration test for the
  endpoint; manual smoke against staging.
```

**Trade-offs / when this fails.** A culture that prioritises review velocity over depth ships fast but accumulates technical debt; a culture that prioritises depth over velocity stalls. The senior balance: small Pull Requests reviewed quickly and thoroughly; large Pull Requests are split or escalated to a synchronous walk-through. The senior engineer notices when the team's review culture is drifting toward either extreme and intervenes.

### 5. Tell me about influencing a team you do not lead.

The senior framing is that influence without authority comes from four moves: bringing data instead of opinions, making the better path the easier path (often by writing the prototype), finding a stakeholder whose pain matches the candidate's pain, and documenting the trade-offs publicly so the conversation moves to the document rather than the meeting.

> *"Our backend team owned an Application Programming Interface that my team consumed; we were experiencing intermittent five-second latencies that mapped to their P99. The backend team had bigger fish to fry and the latency was not on their roadmap. Rather than escalate, I spent a Friday afternoon writing a load profile against their staging endpoint, captured the slow path with a flame graph, and wrote a one-page document showing that a single Database Index would cut P99 from 5 seconds to 200 milliseconds. I shared the document with the backend team's tech lead with a 'no commitment expected, just sharing what I found' note. The tech lead replied that this was useful and that they could fit the index in the next week. They added the index; P99 dropped as predicted; my team's intermittent latencies disappeared. I did not own the change — they did — but the document moved the work from 'low priority' to 'well-scoped, low-risk'."*

The structural points: the candidate did the diagnostic work (the flame graph, the load profile) so the cost-of-doing was reduced for the other team. The candidate framed the request as "no commitment expected" rather than "you should do this", which preserved the other team's autonomy. The candidate did not need authority to drive the change; the artefact (the document) did the work.

**Trade-offs / when this fails.** Influence requires the time investment up front; not every problem is worth the diagnostic work. The senior judgement is to pick the changes whose impact justifies the investment, and to delegate or defer the rest. Influence that goes around the other team's leadership creates resentment; influence that flows through the other team's leadership creates allies.

## Further reading

- *Staff Engineer* — Will Larson.
- *The Manager's Path* — Camille Fournier (covers tech-lead).
- *An Elegant Puzzle* — Will Larson (org-design).
- *Principles* — Ray Dalio (decision frameworks).
- Camille Fournier's "Velocity over visibility" essays.
