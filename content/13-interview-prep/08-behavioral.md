---
title: "Behavioral interviewing"
sidebar_label: "13.8 Behavioral interviewing"
description: "STAR/SBI structures, the questions you'll be asked, and how senior-leveling rubrics work."
sidebar_position: 8
---

The behavioral round (sometimes labelled "values" or "leadership principles") is where most senior offers are decided. Strong technical performance combined with a weak behavioral round rarely yields a senior offer; the reverse — competent technical performance with a strong behavioral round — frequently does.

**Acronyms used in this chapter.** Application Programming Interface (API), Continuous Integration (CI), Database (DB), Direct Message (DM), General Availability (GA), Identity Provider (IdP), Global Secondary Index (GSI), Minimum Viable Product (MVP), Pull Request (PR), Single Sign-On (SSO), Situation-Behavior-Impact (SBI), Situation-Task-Action-Result (STAR), Universal Coded Character Set Transformation Format — 8-bit (UTF-8).

## Structure: STAR or SBI

Both structures work; pick one and apply it consistently.

### STAR

The STAR structure breaks each story into four parts: the **Situation** (when, where, and the context the listener needs to follow the story), the **Task** (what the candidate was specifically responsible for in that situation), the **Action** (what the candidate personally did, articulated in the first person rather than the team's collective "we"), and the **Result** (the measurable outcome, with numbers wherever possible).

### SBI (preferred for shorter answers)

The SBI structure is more compact and is preferred when the interviewer asks rapid-fire questions or when stories must fit a tight time budget. **Situation / Background** is a brief context paragraph (under thirty seconds). **Behavior** is what the candidate actually did. **Impact** is the result and what changed downstream. The structure compresses STAR's four sections into three by folding "Task" into "Situation".

Both structures provide the interviewer with a clean, scoreable narrative. Without structure, candidates ramble; with structure, candidates sound senior. The choice between them is personal preference; the consistency is what matters.

## The questions you will be asked

In some form:

1. Tell me about a time you disagreed with a teammate / manager.
2. Tell me about a project that failed.
3. Tell me about a time you delivered under pressure / ambiguous scope.
4. Tell me about giving difficult feedback.
5. Tell me about mentoring someone.
6. Tell me about influencing without authority.
7. Tell me about a technical decision you made and how you defended it.
8. Tell me about scaling something — team, system, process.
9. Tell me about a time you said no.
10. Tell me about owning something outside your job description.

Have **two stories per category**, prepared. They should be:

- True.
- About **you** (not your team's win).
- Senior-flavoured (cross-team, ambiguous, with stakeholder management).
- Recent (last 1-2 years).
- Concrete on metrics (not "improved performance" — "cut p95 from 1.4s to 280ms").

## Senior-leveling rubrics

What separates a senior story from a mid-level story:

| Mid story | Senior story |
| --- | --- |
| "I built a feature." | "I scoped, designed, mentored implementation, drove rollout, owned post-launch." |
| "My manager asked me to..." | "I noticed the gap, proposed the work, got buy-in, delivered." |
| "We decided to..." | "I framed the trade-offs and we picked X, here's why." |
| "I fixed the bug." | "I diagnosed it, fixed it, then added tests + monitoring + a postmortem to prevent the class of bug." |
| Single team scope. | Cross-team / cross-org collaboration. |
| Outcome was a feature ship. | Outcome includes business / metric impact. |

Practise reframing your stories until they pass this test.

## Mistakes to avoid

- **"We" instead of "I"**. The interviewer is hiring *you*. Be precise about your role.
- **Long context, no action**. 30s context, 2min action, 30s impact.
- **Conflict story without resolution**. The point isn't the disagreement; it's how you resolved it productively.
- **Project-failure story where it wasn't your fault**. The interviewer wants to see ownership and learning, not blame.
- **Negativity about people / employers**. Always neutral or charitable.
- **No specifics**. "Improved page speed a lot" → bombs. "P95 from 1.4s to 280ms; bounce rate dropped 12%" → lands.

## "Tell me about a time you disagreed" — worked example

> *"At [past role], we were planning the next quarter and the consensus was to ship a new dashboard MVP in 6 weeks. I'd been on-call for the existing dashboard the previous quarter and I was sceptical the underlying API would survive doubling its query load.*
>
> *Rather than push back in the meeting, I spent two days running synthetic load against the API and showed the load curves to the tech lead. P95 went from 220ms to 1.8s at 2x load; we were already at 60% of CPU on the DB.*
>
> *I proposed a 1-week investment in caching + a new GSI before the dashboard work. The lead initially pushed back on the slip, so I broke down the new dashboard into two chunks where the cheaper one could ship first while the API work continued in parallel.*
>
> *We went with that plan. The dashboard launched a week later than originally scoped, but the API stayed under 400ms p95 and we avoided an incident that would've cost us the whole quarter. After that, I started a 'load model' template for upcoming features — became a small team practice."*

Notice:

- "I" throughout.
- Specific numbers.
- Action: investigated, proposed, restructured.
- Impact: avoided incident, established a practice.
- Learning: the load-model template became a lasting artifact.

## "Tell me about a project that failed"

The interviewer wants to know:

1. You can recognise failure.
2. You didn't blame others.
3. You learned and applied the learning.

> *"We launched a new auth flow that broke for users with corporate SSO IdPs that returned non-ASCII characters in claims. We had ~3% of new sign-ups failing for two weeks before our metrics surfaced it.*
>
> *Looking back: our test matrix had Google + Microsoft, both well-behaved with ASCII. We didn't have a synthetic for an Okta-with-quirks customer.*
>
> *I owned the postmortem. The fix was small (proper UTF-8 decode); the systemic fix was a pre-launch checklist for auth changes that includes 'simulate at least one customer's actual IdP response'. I also added a metric on auth-error rate, broken down by IdP, with an alert at >0.5%. Since then, we've caught two similar issues in canary."*

The story isn't "the bug"; it's "the new test matrix and metric that catches this class of bug forever".

## "Tell me about mentoring"

Senior interviews look for active mentoring, not just answering questions:

- Set up regular 1:1s with a junior.
- Pair on something they own.
- Wrote a doc / talk that scaled your knowledge to N people instead of 1.
- Created onboarding material.

A great answer ties their growth to a *measurable outcome*: "after 4 months they were leading a feature; one year later they got promoted."

## "Influence without authority"

This is the senior special: how does the candidate get teams over which they have no formal power to do what the candidate believes is right?

The senior playbook for influence without authority rests on four moves. **First, bring data, not opinions.** Senior peers respect a chart and a measurement; they tune out preferences. **Second, make the change easy.** Writing the migration, the codemod, the proof-of-concept removes the largest barrier — "we don't have time" becomes "the work is already done; review it". **Third, find the stakeholder whose pain matches the candidate's pain and start there.** A coalition of two engineers makes a stronger case than one engineer alone. **Fourth, document the trade-offs publicly** so the conversation moves to a written document rather than a meeting; the document outlasts the meeting and becomes the artefact others reference.

> *"I noticed the team's CI was 22 minutes; nobody had the bandwidth to fix it. I spent a Friday afternoon profiling, identified two slow integration tests we could parallelise, and submitted a PR. CI dropped to 11 minutes. I sent a one-paragraph note in the team channel. Two engineers DM'd me with their own slow-CI peeves; I created a 'CI hygiene' doc, and over the next quarter we got it under 5 minutes — a third of which I did, two-thirds were others copying the pattern."*

Influence = make the better path the easier path; let credit fall where it falls.

## Practice loop

1. List 8 categories.
2. Write 2 stories per category as bullet points (Situation, Behavior, Impact, plus Learning).
3. Time yourself: 90-180 seconds per story max.
4. Practise out loud with a friend / partner / mirror; record + review.
5. After each interview, note which question caught you off-guard; build a story for it.

## Key takeaways

- STAR or SBI structure — pick one, use it consistently.
- Two stories per category; recent, concrete, "I"-led.
- Senior stories show cross-team scope, ownership, and learning.
- Mistakes: "we", no specifics, conflict without resolution, blame.
- Practice out loud; tighten to under three minutes.

## Common interview questions

1. Tell me about a project that failed.
2. Tell me about a time you disagreed with your manager.
3. Tell me about mentoring someone.
4. Tell me about influencing without authority.
5. Tell me about owning something outside your job description.

## Answers

### 1. Tell me about a project that failed.

The interviewer wants to hear three things: the candidate can recognise failure, the candidate did not blame others, and the candidate learned from the experience and applied the learning to prevent recurrence. The story should pick a real failure (one with measurable negative outcome) and walk through it with ownership.

> *"We launched a new authentication flow that broke for users with corporate Single Sign-On Identity Providers that returned non-American Standard Code for Information Interchange characters in claims. Approximately three percent of new sign-ups failed for two weeks before our metrics surfaced the issue. Looking back, our test matrix had Google and Microsoft as Identity Providers, both well-behaved with American Standard Code for Information Interchange characters; we did not have a synthetic for an Okta-with-quirks customer. I owned the postmortem. The fix was small (proper Universal Coded Character Set Transformation Format — 8-bit decode); the systemic fix was a pre-launch checklist for authentication changes that includes 'simulate at least one customer's actual Identity Provider response'. I also added a metric on authentication-error rate, broken down by Identity Provider, with an alert at over half a percent. Since then, we have caught two similar issues in canary."*

The structural points: the failure is named and quantified (three percent for two weeks), the fix is described (the small fix and the systemic fix), and the learning is captured as a permanent change (test matrix, metric, alert). The story is not "the bug" — it is "the new test matrix and metric that catches this class of bug forever".

**Trade-offs / when this fails.** Avoid stories where the candidate was not at fault and the failure was someone else's; the interviewer reads this as evasion. Avoid stories where the candidate was the only one who saw the failure and quietly fixed it; the interviewer wants to see organisational change, not heroics. The best stories show the candidate driving systemic improvements that survive after the candidate has moved on.

### 2. Tell me about a time you disagreed with your manager.

The interviewer is testing whether the candidate can disagree productively, hold their ground when warranted, and yield gracefully when the manager's position is correct. A story where the candidate disagreed and was wrong is acceptable — humility is a senior trait. A story where the candidate disagreed and "won" by being right is also acceptable, provided the candidate did not damage the relationship.

> *"At a past role, we were planning the next quarter and the consensus was to ship a new dashboard Minimum Viable Product in six weeks. I had been on-call for the existing dashboard the previous quarter and I was sceptical the underlying Application Programming Interface would survive doubling its query load. Rather than push back in the meeting, I spent two days running synthetic load against the Application Programming Interface and showed the load curves to the tech lead. P95 went from 220 milliseconds to 1.8 seconds at twice the load; we were already at sixty percent of Central Processing Unit on the Database. I proposed a one-week investment in caching and a new Global Secondary Index before the dashboard work. The lead initially pushed back on the slip, so I broke down the new dashboard into two chunks where the cheaper one could ship first while the Application Programming Interface work continued in parallel. We went with that plan. The dashboard launched a week later than originally scoped, but the Application Programming Interface stayed under 400 milliseconds P95 and we avoided an incident that would have cost us the whole quarter."*

The structural points: the disagreement was substantive (a concrete prediction with data), the candidate did not escalate publicly (the conversation happened with the lead, not the room), the resolution was a compromise (slip the dashboard, not abandon it), and the result was measurable (avoided incident, P95 stayed in budget).

**Trade-offs / when this fails.** Avoid stories where the candidate "won" by going around the manager; the interviewer reads this as a coordination failure. Avoid stories where the disagreement was emotional (personal, not technical); senior candidates disagree on the merits. The best disagreement stories show the candidate bringing data, framing trade-offs, and reaching a productive resolution.

### 3. Tell me about mentoring someone.

The interviewer is testing whether the candidate actively grows other engineers (a senior expectation) or merely answers questions when asked. The story should show ongoing investment, a concrete relationship, and a measurable growth outcome.

> *"I mentored a mid-level engineer who joined our team and wanted to grow into a senior role. We set up weekly thirty-minute one-on-ones for six months. In the first month, we focused on the team's codebase — I paired with them on their first feature, walked through the architecture, and reviewed their pull requests with detailed feedback. In months two through four, I started giving them stretch assignments — the new payments integration, which crossed three teams. I shadowed their design review and gave them feedback on framing and audience. In months five and six, I stepped back; they led the project, ran the design review, and onboarded the next new engineer. They were promoted to senior the following cycle."*

The story is not "I answered their questions"; it is "I structured their growth over a six-month period and stepped back as they grew". The promotion is the measurable outcome that ties the mentoring to a concrete result.

**Trade-offs / when this fails.** Avoid stories where the mentee's growth is unclear; "they got better at the codebase" is not measurable. Avoid stories where the candidate did all the work for the mentee; mentoring is teaching, not delegating away from the mentee. The best mentoring stories show the candidate stepping back as the mentee grows, with the mentee taking ownership of progressively larger work.

### 4. Tell me about influencing without authority.

The interviewer is testing whether the candidate can drive change in places where they have no formal power — across teams, across the organisation, or up the management chain. The story should show a coalition built from peers' shared pain rather than a top-down mandate.

> *"I noticed the team's Continuous Integration was twenty-two minutes; nobody had the bandwidth to fix it. I spent a Friday afternoon profiling, identified two slow integration tests we could parallelise, and submitted a Pull Request. Continuous Integration dropped to eleven minutes. I sent a one-paragraph note in the team channel. Two engineers Direct-Messaged me with their own slow-Continuous Integration grievances; I created a 'Continuous Integration hygiene' document, and over the next quarter we got it under five minutes — a third of which I did, two-thirds were others copying the pattern."*

The structural points: the candidate did not propose the work (proposing is cheap); the candidate did the work first (a working Pull Request is a much stronger artefact than a proposal). The candidate then created an artefact (the hygiene document) that others could follow without further coordination. Credit was distributed; the candidate did not claim the full quarter's improvement.

**Trade-offs / when this fails.** Avoid stories where the candidate convinced a manager and the manager mandated the change; that is not influence without authority, that is escalation. Avoid stories where the candidate was the sole contributor; senior influence multiplies through others. The best influence stories show the candidate seeding a small change that grows into a team-wide or org-wide practice.

### 5. Tell me about owning something outside your job description.

The interviewer is testing whether the candidate sees their job as "the things on my ticket queue" or "the system I am responsible for". Senior candidates routinely own things that span their formal scope — incident response, on-call rotation health, hiring, documentation, mentoring.

> *"Our team's on-call rotation was painful — pages happened nightly, runbooks were stale, and rotation ownership rotated weekly with no continuity. None of this was my formal responsibility, but I had been on-call enough to see the pattern. I spent two weeks classifying the past quarter's pages: forty percent were noise (over-aggressive alarms), thirty percent were known issues with documented workarounds, twenty percent were genuine bugs, and ten percent were customer-impacting incidents. I tightened the noisy alarms (cut paging volume by half), wrote runbooks for the top ten known issues, and proposed a rotation lead who carried context across weeks. Six months later, our paging rate was a quarter of what it had been; on-call became survivable. None of this was on my ticket queue."*

The structural points: the work was unscoped (no manager assigned it), the candidate identified the problem from data (page classification), and the resolution was systemic (alarms, runbooks, rotation lead) rather than heroic. The measurable outcome (paging rate reduced to a quarter) ties the work to a concrete improvement.

**Trade-offs / when this fails.** Avoid stories where the candidate did the work without coordination and stepped on others' toes; ownership is not unilateral. Avoid stories where the candidate did the work in their personal time at the expense of their formal work; senior candidates negotiate scope rather than over-extending. The best ownership stories show the candidate identifying a gap, getting tacit buy-in, and delivering systemic improvement that outlasts their personal effort.

## Further reading

- Cracking the Coding Interview, behavioral chapter (still relevant).
- Amazon's Leadership Principles (good question generator even outside Amazon).
- *Staff Engineer* by Will Larson — the senior+ leveling expectations.
