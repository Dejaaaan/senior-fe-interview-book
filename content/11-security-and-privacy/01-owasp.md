---
title: "OWASP Top 10 for the frontend"
sidebar_label: "11.1 OWASP Top 10 for the frontend"
description: "The OWASP Top 10 (2021), what each item looks like in a modern web app, and the senior mitigations."
sidebar_position: 1
---

The [OWASP Top Ten](https://owasp.org/Top10/) is the canonical list of web application security risks, maintained by the Open Worldwide Application Security Project. Every senior interview probes a few of these items; memorising the headings and understanding the framing senior candidates typically present is the bar.

> **Acronyms used in this chapter.** API: Application Programming Interface. CDN: Content Delivery Network. CI: Continuous Integration. CD: Continuous Delivery. CSP: Content Security Policy. CSRF: Cross-Site Request Forgery. DOM: Document Object Model. DoS: Denial of Service. HIBP: HaveIBeenPwned. HTTP: Hypertext Transfer Protocol. HTTPS: HTTP Secure. HSTS: HTTP Strict Transport Security. IDOR: Insecure Direct Object Reference. IMDSv2: Instance Metadata Service version 2. IP: Internet Protocol. JS: JavaScript. LDAP: Lightweight Directory Access Protocol. MFA: Multi-Factor Authentication. NoSQL: Not-only Structured Query Language. OS: Operating System. OWASP: Open Worldwide Application Security Project. RSS: Really Simple Syndication. SHA: Secure Hash Algorithm. SIEM: Security Information and Event Management. SLSA: Supply-chain Levels for Software Artifacts. SQL: Structured Query Language. SRI: Subresource Integrity. SSRF: Server-Side Request Forgery. STRIDE: Spoofing, Tampering, Repudiation, Information disclosure, Denial of Service, Elevation of privilege. TLS: Transport Layer Security. TOTP: Time-based One-Time Password. UI: User Interface. URL: Uniform Resource Locator. WebAuthn: Web Authentication. XSS: Cross-Site Scripting.

## A01:2021 — Broken Access Control

The number-one risk. Examples encountered through the frontend include Insecure Direct Object Reference, where `GET /api/orders/123` returns any order if the identifier is changed because the server fails to verify ownership; a hidden "administrator" button in the User Interface paired with an Application Programming Interface endpoint that does not enforce the same restriction; and mass assignment, where `PATCH /users/me` blindly accepts any field in the body, including privileged ones such as `isAdmin`.

The mitigation has four parts. Enforce authorization on the server, always; the User Interface is for affordance, not enforcement. Validate ownership on every read as well as every write — listing endpoints leak data when they forget the ownership filter just as much as write endpoints do. Use allowlists for the fields the server accepts (Zod schemas with `.strict()`, `class-validator` with `whitelist: true`, NestJS's `ValidationPipe` with `forbidNonWhitelisted`). Centralise authorization through a policy engine (CASL, Cedar, OpenFGA) so that audits and changes have a single point of contact.

## A02:2021 — Cryptographic Failures

Sensitive data exposed in transit or at rest. The recurring failure modes are using HTTP instead of HTTP Secure; weak cipher suites permitted by misconfigured servers; storing passwords with reversible encryption rather than a one-way hash with a slow function such as Argon2id or bcrypt; embedding secrets in client-side JavaScript or `localStorage`; and logging secrets in plaintext where access controls are weaker than the credential storage they protect.

The mitigation is the modern security baseline: Transport Layer Security everywhere with HTTP Strict Transport Security; Argon2id (preferred) or bcrypt (with cost factor at least twelve) for password hashing; reliance on Web Crypto, libsodium, or the language's standard library rather than rolling cryptographic primitives by hand. Automated certificate management through ACME and Let's Encrypt removes the operational excuse for skipping Transport Layer Security.

## A03:2021 — Injection

Structured Query Language, Not-only Structured Query Language, Lightweight Directory Access Protocol, Operating System command, and log injection vulnerabilities. The frontend-relevant variants include server-side template injection (rare in modern stacks but possible when a templating engine evaluates user input as code); Document Object Model-based injection, which substitutes for Cross-Site Scripting using non-`innerHTML` sinks such as `<img src=...>`; and log injection, where a user-supplied string containing newlines forges fake log entries that confuse incident-response.

The mitigation pattern combines parameterised queries through Object Relational Mappers (Drizzle, Prisma, Kysely) with explicit schema validation through Zod and content sanitisation through DOMPurify before any user-controlled HyperText Markup Language is rendered. Strip `\r\n` from any string before it reaches a log sink.

## A04:2021 — Insecure Design

A broad category that covers missing rate limiting, missing Multi-Factor Authentication, and the absence of threat modelling at design time. The mitigation is to threat-model new features explicitly using a framework such as STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of Service, Elevation of privilege), to build security into user stories rather than treating it as a separate phase, and to write "abuse cases" alongside the conventional use cases.

## A05:2021 — Security Misconfiguration

The biggest production hit-list: default credentials in production, verbose error pages that expose stack traces and database details, cloud storage buckets open to the internet, disabled security headers, and outdated dependencies. The mitigation is Infrastructure-as-Code (Terraform, CDK) with security checklists enforced in code review; cloud security scanners such as Prowler, ScoutSuite, or AWS Security Hub running on a schedule; disabled verbose error pages in production; and the security headers established in the next chapter.

## A06:2021 — Vulnerable and Outdated Components

The npm ecosystem's perennial pain point. A typical Next.js application has more than fifteen hundred transitive dependencies, each one a potential supply-chain attack vector. The mitigation pattern uses Dependabot or Renovate to automate dependency updates, runs `pnpm audit` in Continuous Integration with build failures on high-severity issues, runs `pnpm dedupe` to flatten the dependency graph and reduce the attack surface, pins lockfiles (`pnpm-lock.yaml` committed to source control), avoids micro-packages where reasonable alternatives exist, and uses `pnpm` overrides to pin known-bad versions when an upstream maintainer publishes a malicious release.

## A07:2021 — Identification and Authentication Failures

Weak password policies, credential stuffing without rate limiting, missing Multi-Factor Authentication, and session fixation. The frontend-relevant failures include auto-login after registration without rotating the session identifier (a session-fixation risk) and session identifiers in the Uniform Resource Locator that leak through Referer headers. The mitigation is the entire [Part 10 (Authentication & Authorization)](../10-auth/index.md) of this book plus password-breach detection through the HaveIBeenPwned Application Programming Interface, rate limiting on `/login`, `/register`, and `/reset-password`, and Multi-Factor Authentication through Web Authentication or Time-based One-Time Password for sensitive accounts.

## A08:2021 — Software and Data Integrity Failures

Tampering with code or data in the Continuous Integration/Continuous Delivery pipeline or supply chain. The failure modes include unsigned packages, Continuous Integration/Continuous Delivery configurations where contributors with write permissions can push poisoned builds, and auto-update mechanisms without signature verification. The mitigation pattern signs artifacts (cosign, Sigstore), generates provenance attestations following the Supply-chain Levels for Software Artifacts framework, pins GitHub Actions to commit SHAs rather than `@v3` tags (which can be moved by the action's owner), and applies Subresource Integrity hashes on `<script>` and `<link>` elements that load from Content Delivery Networks.

## A09:2021 — Security Logging and Monitoring Failures

The team cannot respond to what it cannot see. The failure modes are missing login and logout audit trails, no alerts on authentication anomalies (for example, ten failed logins per minute from one Internet Protocol address), and logs that are not forwarded off-host where they can survive a host compromise. The mitigation is audit logs for all privileged actions kept separate from operational logs; forwarding to a Security Information and Event Management platform (Datadog, Splunk, Sentinel); alerts on authentication anomalies; and frontend errors funnelled through Sentry or Datadog with source maps for actionable stack traces.

## A10:2021 — Server-Side Request Forgery (SSRF)

The server fetches a Uniform Resource Locator that the user provided — for example, "import this Really Simple Syndication feed" or "fetch this avatar Uniform Resource Locator" — and the attacker points it at internal infrastructure (a classic example is `http://169.254.169.254/latest/meta-data`, the Amazon Web Services instance metadata endpoint). The mitigation maintains an allowlist of permitted host patterns, resolves the Domain Name System and validates that the resolved Internet Protocol address is not private or link-local, disables redirects (or follows them with the same checks reapplied), and on Amazon Web Services uses Instance Metadata Service version 2 (token-required) instead of the legacy version 1 metadata endpoint.

## Senior framing in interviews

When asked "what security concerns matter to a frontend engineer?", do not simply recite the list; frame it. A senior answer might run:

"On the frontend, my responsibilities split into three. First, protecting users from script execution we do not control — Content Security Policy, output sanitisation, careful use of `dangerouslySetInnerHTML`. Second, ensuring the Application Programming Interface enforces every authorization decision regardless of what the User Interface shows, so a privileged endpoint cannot be reached by guessing the path. Third, keeping the supply chain clean — lockfiles, automated dependency updates, Subresource Integrity on third-party scripts. Cross-cutting concerns are Transport Layer Security everywhere, the standard security headers, and comprehensive audit logging."

That answer treats the OWASP Top Ten as context rather than as a recital, which is the framing senior interviewers reward.

## Key takeaways

The senior framing for the OWASP Top Ten: memorise the headings, but understand the framing more than the recitation. A01 (Broken Access Control) is the number-one risk and is mostly an Application Programming Interface problem that the frontend surfaces. A06 (vulnerable dependencies) is the npm ecosystem's chronic operational hazard; automate updates. The senior framing is "protect users, enforce on the server, keep the supply chain clean".

## Common interview questions

1. What is the OWASP Top Ten? Walk through it.
2. Examples of broken access control on a frontend.
3. How can vulnerable dependencies be kept under control?
4. What is Server-Side Request Forgery and why does the frontend care?
5. The difference between authentication failures (A07) and access-control failures (A01)?

## Answers

### 1. What is the OWASP Top Ten? Walk through it.

The OWASP Top Ten is the canonical, periodically refreshed list of the most common and impactful web application security risks, maintained by the Open Worldwide Application Security Project. The 2021 edition lists, in order: A01 Broken Access Control (the number-one risk in modern applications); A02 Cryptographic Failures (data exposed in transit or at rest); A03 Injection (Structured Query Language, Not-only Structured Query Language, Document Object Model, log injection); A04 Insecure Design (missing rate limiting, missing Multi-Factor Authentication, no threat modelling); A05 Security Misconfiguration (default credentials, verbose errors, missing headers); A06 Vulnerable and Outdated Components (the npm dependency problem); A07 Identification and Authentication Failures (weak passwords, credential stuffing, missing Multi-Factor Authentication); A08 Software and Data Integrity Failures (unsigned packages, poisoned Continuous Integration); A09 Security Logging and Monitoring Failures (no audit trail, no alerts); A10 Server-Side Request Forgery (server fetches user-supplied URLs against internal infrastructure).

**Trade-offs / when this fails.** The Top Ten is a starting point, not an exhaustive checklist; production threat models include items not in the list (denial of service, business-logic abuse, insider risk). Use the Top Ten as the shared vocabulary in interviews and code reviews, then extend with application-specific concerns.

### 2. Examples of broken access control on a frontend.

The frontend exposes Broken Access Control through several recurring patterns. Insecure Direct Object Reference appears when `GET /api/orders/123` returns any order if the identifier is changed; the fix is to verify ownership in the handler regardless of what the User Interface displayed. Hidden administrator buttons in the User Interface paired with unguarded Application Programming Interface endpoints create a privilege-escalation path because the User Interface cannot prevent direct calls. Mass assignment, where `PATCH /users/me` blindly accepts any field in the body, allows the user to set `isAdmin: true` if the field is not explicitly excluded. Listing endpoints that forget the ownership filter leak data just as readily as write endpoints; "list my tasks" must include `WHERE owner_id = $1`, not just rely on a User Interface filter.

```ts
app.patch("/users/me", async (req, res) => {
  const session = await authenticate(req);
  const allowed = z.object({ name: z.string(), avatarUrl: z.string().optional() }).strict();
  const data = allowed.parse(req.body); // throws on extra fields
  await db.users.update({ id: session.userId, ...data });
  res.json({ ok: true });
});
```

**Trade-offs / when this fails.** Strict allowlists are easy to forget when a new field is added; the CI guard is to require schemas with `.strict()` so that any unmapped field surfaces as a validation error rather than being silently accepted.

### 3. How can vulnerable dependencies be kept under control?

The recommended pattern combines automation with discipline. Configure Dependabot or Renovate to open pull requests for every minor and patch update, with automatic merging when the test suite passes. Run `pnpm audit --audit-level=high` in Continuous Integration and fail the build on high-severity findings. Pin transitive dependencies through `pnpm overrides` when an upstream version is known to be malicious. Avoid micro-packages (single-function packages) where a small in-repository utility would suffice; every dependency is a supply-chain attack surface. Commit the lockfile (`pnpm-lock.yaml`) so every install is reproducible.

```bash
pnpm audit --audit-level=high
pnpm dedupe
```

**Trade-offs / when this fails.** Aggressive automatic merging breaks builds when an upstream dependency ships a regression; the mitigation is a comprehensive test suite. Manual review of every update is unsustainable for a Next.js application with fifteen hundred dependencies; the discipline is to trust the test suite and the audit results, not to review every bump by hand.

### 4. What is SSRF and why does the frontend care?

Server-Side Request Forgery occurs when the server fetches a Uniform Resource Locator that the user provided and the attacker exploits this to reach internal infrastructure. The frontend cares because frontend features routinely involve user-supplied Uniform Resource Locators: "import this Really Simple Syndication feed", "fetch the metadata for this URL preview", "import an avatar from this URL". An unprotected backend endpoint that fetches the supplied URL on behalf of the user is exactly the Server-Side Request Forgery primitive an attacker needs to reach `http://169.254.169.254/latest/meta-data` (the Amazon Web Services instance metadata endpoint), `http://localhost:6379` (a Redis instance bound to localhost), or any internal service that trusts requests from the application server.

**Trade-offs / when this fails.** The mitigation has three layers: an allowlist of host patterns the server will fetch; Domain Name System resolution followed by Internet Protocol address validation against a denylist of private and link-local ranges; and disabled redirects (or redirects followed with the same checks reapplied). On Amazon Web Services, Instance Metadata Service version 2 — which requires a token obtained via a session-init request — eliminates the worst Server-Side Request Forgery target.

### 5. The difference between authentication failures (A07) and access-control failures (A01)?

A07 covers failures in proving who the user is — weak passwords, credential stuffing without rate limiting, missing Multi-Factor Authentication, session fixation, predictable session identifiers. The mitigations live in the authentication layer: stronger credentials, rate limiting, Multi-Factor Authentication, session rotation. A01 covers failures in deciding what the authenticated user is allowed to do — Insecure Direct Object Reference, missing ownership checks, mass assignment, privilege escalation. The mitigations live in the authorization layer: per-request authorization checks, allowlisted fields, centralised policy.

**Trade-offs / when this fails.** Conflating the two leads to ineffective fixes. Adding Multi-Factor Authentication does not solve Insecure Direct Object Reference (the user is correctly authenticated and is still able to fetch other users' data). Adding ownership checks does not solve credential stuffing (the attacker still gains valid sessions). The senior framing is to address each layer with the mitigations that fit it.

## Further reading

- [OWASP Top Ten (2021)](https://owasp.org/Top10/).
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/).
- [SLSA framework](https://slsa.dev/).
