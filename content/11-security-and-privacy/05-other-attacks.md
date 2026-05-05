---
title: "SSRF, prototype pollution, supply chain"
sidebar_label: "11.5 SSRF, prototype pollution, supply chain"
description: "The classes of attack that do not fit the XSS/CSRF/CORS taxonomy but absolutely happen in production."
sidebar_position: 5
---

This is the "everything else" chapter — the attacks that succeed once the team has cleared the headline OWASP Top Ten items and assumed it is finished. Senior engineers are expected to recognise these classes by name and to have a defence pattern ready, because they appear repeatedly in incident reviews of mature products.

**Acronyms used in this chapter.** Application Programming Interface (API), Amazon Web Services (AWS), Content Delivery Network (CDN), Continuous Integration (CI), Cross-Site Scripting (XSS), Domain Name System (DNS), Identity and Access Management (IAM), Instance Metadata Service Version 2 (IMDSv2), Internet Protocol (IP), JavaScript (JS), Open Web Application Security Project (OWASP), Pull Request (PR), Regular Expression Denial of Service (ReDoS), Server-Side Request Forgery (SSRF), Sub-Resource Integrity (SRI), Supply-chain Levels for Software Artifacts (SLSA), Time-Of-Check to Time-Of-Use (TOCTOU), Uniform Resource Locator (URL).

## SSRF — Server-Side Request Forgery

Server-Side Request Forgery occurs when the server accepts a Uniform Resource Locator from the user and fetches it on behalf of the request. The attacker points the Uniform Resource Locator at internal infrastructure — the cloud metadata service, an internal database, a sibling service that trusts requests from the cluster.

```ts
app.post("/import", async (req, res) => {
  const r = await fetch(req.body.url);
  const data = await r.text();
  res.json({ data });
});
```

The attacker submits `url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/"` and the server returns the cloud instance's Identity and Access Management credentials, which the attacker then uses to enumerate the AWS account. Or the attacker submits `http://localhost:6379` to talk to an internal Redis instance, dumping cached sessions.

### Mitigation

The defence layers in priority order: maintain an allowlist of host patterns the application is willing to fetch (the user can fetch only from `https://*.trusted-cdn.com`); resolve the Domain Name System hostname before issuing the request and reject Internet Protocol addresses in loopback (127/8), link-local (169.254/16), and private ranges (10/8, 172.16/12, 192.168/16); disable redirects, or follow them with the same checks (an attacker can host a redirect that steers the request to an internal address); and on AWS, enforce the Instance Metadata Service Version 2 token-required endpoint, which prevents the trivial unauthenticated metadata fetch.

```ts
import { lookup } from "node:dns/promises";

async function safeFetch(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("https only");

  const { address } = await lookup(url.hostname);
  if (isPrivateOrLoopback(address)) throw new Error("blocked range");

  return fetch(url, { redirect: "manual" });
}

function isPrivateOrLoopback(ip: string): boolean {
  return (
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === "::1" ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd00:")
  );
}
```

A subtlety here is the Time-Of-Check to Time-Of-Use race: the Domain Name System lookup may resolve to a public Internet Protocol address, then re-resolve to a private address for the actual `fetch` (the attacker controls the authoritative server and returns different answers). The robust pattern is to pin the request to the resolved address and pass the original hostname via the `Host` header, so the server cannot redirect the connection to a different destination between the check and the fetch.

## Prototype pollution

Prototype pollution occurs when a property-merging function mutates `Object.prototype`, contaminating every object in the runtime. The classic vulnerable shape is a recursive merge that walks user-supplied data:

```ts
function merge(target: any, source: any) {
  for (const key in source) {
    if (typeof source[key] === "object") {
      target[key] = merge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

merge({}, JSON.parse('{"__proto__":{"isAdmin":true}}'));
// Now every {} has isAdmin === true.
```

The attacker writes a property to `Object.prototype`, and every subsequently created plain object inherits it. Authorisation checks that read `obj.isAdmin` start returning `true`, configuration objects acquire phantom flags, and template engines render attacker-controlled values into pages.

### Mitigation

The first defence is to reject the dangerous keys (`__proto__`, `prototype`, `constructor`) when parsing user input — Zod's `.strict()` mode rejects unknown fields, which catches this and many adjacent classes. The second is to use libraries that have already been hardened: lodash 4.17.21 and later defend against the documented payloads, and `Object.create(null)` produces an object with no prototype, which is the right structure for arbitrary key-value maps populated from user data.

```ts
const safe = Object.create(null);
safe[userInput.key] = userInput.value;
```

Affected packages have included `lodash`, `merge.recursive`, `mongoose`, and `node-mysql2`; the class is chronic and reappears in new packages every year. The discipline is to treat any function that walks user-supplied keys as suspect and to validate inputs with a strict schema before merging.

## Supply-chain attacks

The npm registry is an attack vector with a long history of incidents. The `event-stream` incident in 2018 saw a maintainer hand control to a contributor who added Bitcoin-stealing code to a transitive dependency used by millions of projects. The `ua-parser-js` incident in 2021 saw a maintainer's account hijacked, with new versions exfiltrating environment variables. The `colors` and `faker` incident in 2022 saw a maintainer self-sabotage with infinite loops, breaking thousands of downstream builds overnight.

### Mitigation

The defences are operational rather than purely technical. Commit the lockfile (`pnpm-lock.yaml`) so installs are reproducible — the exact versions and hashes resolved at install time are pinned, and a malicious version published later does not enter the build. Run Renovate or Dependabot with auto-merge for patch updates only after Continuous Integration passes; this gets security patches in quickly without granting unattended permission for major updates. Run `pnpm audit` in CI and gate releases on the absence of high-severity advisories. Apply a minimum-disclosure delay before pulling in new dependency versions — do not deploy a freshly published version five minutes after publish; wait twenty-four hours so the community has time to react to obvious malicious updates.

Provenance is the newer mechanism: GitHub Actions can attest "this package was built from this commit by this workflow", and `npm install --provenance` plus `npm audit signatures` verify the attestation. The remaining structural defence is to reduce dependencies — fewer micro-packages mean fewer attack surfaces and fewer maintainers whose accounts can be compromised.

For third-party scripts loaded directly from a Content Delivery Network, Sub-Resource Integrity guarantees the file the browser executes matches the hash the application expects:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-base64hash"
  crossorigin="anonymous"
></script>
```

If the Content Delivery Network is compromised and the file changes, the browser refuses to execute it.

### `package.json` hygiene

The choice of version range matters: use `^` for libraries that the team intends to receive patch and minor updates from, `~` for stricter (patch-only) updates, and exact pins for the most critical dependencies (cryptography libraries, authentication libraries, payment integrations). Run `pnpm dedupe` regularly to collapse duplicate copies of the same library — fewer copies mean a smaller attack surface and a smaller bundle. Audit `postinstall` scripts because that is where malicious dependencies execute arbitrary code on developer machines and Continuous Integration runners.

```bash
pnpm install --ignore-scripts
```

For paranoid environments, `--ignore-scripts` disables all install scripts; the team explicitly runs the install scripts it trusts.

## Insecure deserialization

Insecure deserialization is less common in JavaScript than in Java or Python because `JSON.parse` is safe — it does not execute code, only constructs values. The dangerous functions are `eval`, `vm.runInNewContext`, and `unserialize`-style libraries that reconstruct objects with custom logic; any of them, applied to attacker-controlled input, leads to arbitrary code execution.

`structuredClone` is safe and is the modern way to deep-clone values, including `Map`, `Set`, `Date`, `ArrayBuffer`, and circular references. It does not invoke any user-defined code.

## Path traversal

Path traversal occurs when the application constructs a filesystem path from user input without containing the result to the intended directory. The vulnerable shape is a single `path.join` against a user-supplied filename:

```ts
app.get("/files/:name", (req, res) => {
  res.sendFile(path.join("/uploads", req.params.name));
});
```

The attacker submits `req.params.name = "../../etc/passwd"`, and the server reads and returns the system password file. The mitigation is to strip directory components and verify the resolved path is contained within the intended directory:

```ts
const file = path.basename(req.params.name);
const full = path.resolve("/uploads", file);
if (!full.startsWith("/uploads/")) return res.sendStatus(400);
res.sendFile(full);
```

`path.basename` strips any directory traversal segments, `path.resolve` normalises the result against the base directory, and the explicit prefix check defends against any remaining edge case.

## ReDoS — regex denial of service

Regular Expression Denial of Service is caused by a regular expression with catastrophic backtracking applied to attacker-controlled input. The classic shape is nested quantifiers:

```ts
const re = /^(a+)+$/;
re.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"); // exponential time
```

The engine tries every combination of how to split the input across the nested groups, and the running time grows exponentially with input length. A single attacker request can hold a Node.js process at one hundred percent CPU for minutes.

The defences are to avoid nested quantifiers (`(a+)+`, `(.*)*`); to lint with `eslint-plugin-regexp` or `safe-regex`, which catch the dangerous shapes; to use linear-time engines such as `re2` for user-supplied patterns; and to time out long regular expression executions, so a single bad regex cannot starve the event loop indefinitely.

## Open redirects

Open redirects occur when the application redirects to an attacker-supplied destination without validation:

```ts
app.get("/oauth/callback", (req, res) => {
  res.redirect(req.query.return_to as string);
});
```

The attacker sends `?return_to=https://evil.com/login`, and now phishing emails carrying the application's domain redirect users to the attacker's site, which has the credibility of the original domain in the email preview. The mitigation is to validate the destination is on the application's domain or to use an allowlist of permitted paths.

## Clickjacking

Clickjacking occurs when the attacker embeds the application in an iframe and overlays invisible buttons that trick the user into clicking sensitive actions in the embedded application. The classic example is a "claim free prize" page that places an invisible "transfer funds" button under the cursor on the bank application.

The mitigation is `Content-Security-Policy: frame-ancestors 'none'` (or an explicit list of permitted embedders), which replaces the older `X-Frame-Options: DENY`. The Content Security Policy directive is more expressive — it accepts a list of origins and supports wildcards — and is the modern standard.

## Key takeaways

For Server-Side Request Forgery, validate Uniform Resource Locators, resolve Domain Name System to Internet Protocol addresses, block private ranges, disable redirects, and use Instance Metadata Service Version 2 on AWS. For prototype pollution, reject `__proto__` keys and use `Object.create(null)` for maps. For supply-chain risk, commit the lockfile, automate updates with a delay, audit signatures, and pin Sub-Resource Integrity for Content Delivery Network scripts. For path traversal, use `path.resolve` then check the prefix. For Regular Expression Denial of Service, avoid nested quantifiers and use `re2` for user input. For open redirects and clickjacking, validate destinations and set `frame-ancestors`.

## Common interview questions

1. What is SSRF and how do you defend against it on a Node API?
2. Show a prototype pollution payload and how you would block it.
3. How do you keep your npm dependencies safe?
4. What does Sub-Resource Integrity do?
5. Walk through clickjacking and the modern defence.

## Answers

### 1. What is SSRF and how do you defend against it on a Node API?

Server-Side Request Forgery is an attack where the application server fetches a Uniform Resource Locator chosen by the attacker, granting the attacker the server's network position. The classic exploit targets cloud metadata endpoints (`http://169.254.169.254/...`) to steal Identity and Access Management credentials, or internal services on private addresses (`http://10.0.0.5:6379`) to read databases the attacker cannot reach directly.

The defence layers: an allowlist of host patterns; Domain Name System resolution followed by an Internet Protocol address check that rejects loopback, link-local, and private ranges; disable redirects (or follow them with the same checks because the attacker can host a redirect that steers to an internal address); and on AWS specifically, enforce Instance Metadata Service Version 2, which requires a token and stops the trivial credential exfiltration.

```ts
const { address } = await lookup(url.hostname);
if (isPrivateOrLoopback(address)) throw new Error("blocked");
return fetch(url, { redirect: "manual" });
```

**Trade-offs / when this fails.** A Time-Of-Check to Time-Of-Use race exists between the lookup and the fetch — the attacker can return a public address for the lookup and a private one for the fetch. The mitigation is to pin the request to the resolved address and pass the hostname via the `Host` header.

### 2. Show a prototype pollution payload and how you would block it.

Prototype pollution writes to `Object.prototype` via an unsanitised merge of attacker-supplied keys. The payload `{"__proto__":{"isAdmin":true}}` parsed and merged into a plain object causes every subsequently created object to inherit `isAdmin === true`, defeating any authorisation check that reads the property from a generic object.

```ts
merge({}, JSON.parse('{"__proto__":{"isAdmin":true}}'));
({}).isAdmin; // true — every new object now has it
```

The defences are to reject `__proto__`, `prototype`, and `constructor` as keys when parsing untrusted input (Zod's `.strict()` mode achieves this for schema-validated inputs); to use `Object.create(null)` for any map-like structure populated from user data, which produces an object with no prototype to pollute; and to update vulnerable libraries (lodash 4.17.21+ defends against the canonical payloads).

**Trade-offs / when this fails.** New variants appear regularly because any deep-merge function can be vulnerable. The structural defence is to validate inputs with strict schemas at the boundary; the merge function should not be processing arbitrary user-supplied keys at all.

### 3. How do you keep your npm dependencies safe?

The defence is operational. Commit the lockfile so installs are reproducible — the exact versions and hashes resolved at install time are pinned, and a malicious version published later does not enter the build. Run Renovate or Dependabot with auto-merge for patch updates after Continuous Integration passes; this gets security patches in quickly without granting unattended permission for major updates. Apply a minimum-disclosure delay (typically twenty-four hours) before pulling in freshly published versions, so the community has time to react to obvious malicious updates. Audit `postinstall` scripts and consider `pnpm install --ignore-scripts` for the most sensitive environments. Reduce dependency count — fewer micro-packages mean fewer maintainers whose accounts can be compromised. For third-party scripts loaded from a Content Delivery Network, pin Sub-Resource Integrity hashes. Verify provenance attestations with `npm audit signatures` for packages that publish them.

**Trade-offs / when this fails.** No process catches a sufficiently determined targeted attack — a maintainer who is socially engineered into adding a malicious commit can defeat audit, provenance, and lockfile defences. The structural reduction (fewer dependencies) is the most resilient long-term posture, paired with monitoring for anomalous behaviour at runtime.

### 4. What does Sub-Resource Integrity do?

Sub-Resource Integrity is a browser feature that verifies the integrity of a script or stylesheet loaded from a third-party origin. The application includes the file's expected hash in the `integrity` attribute, and the browser computes the hash of the downloaded file and refuses to execute it if the hashes do not match. The `crossorigin` attribute is required so the browser receives the file with appropriate Cross-Origin Resource Sharing headers and can read the body for hashing.

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-base64hash"
  crossorigin="anonymous"
></script>
```

If the Content Delivery Network is compromised and serves a different file, the browser blocks execution; the application breaks visibly rather than silently running attacker code. The protection covers the specific file version pinned by the hash; updates to the file require updating the hash in the application.

**Trade-offs / when this fails.** Sub-Resource Integrity does not protect against a compromise of the application server itself — if the attacker can modify the application's own pages, they can replace the `integrity` attribute. The protection is targeted at the third-party script supply chain. For first-party assets served from the application's own origin, Content Security Policy and standard application security controls are the appropriate defences.

### 5. Walk through clickjacking and the modern defence.

Clickjacking is an attack where the attacker embeds the target application in an iframe on an attacker-controlled page and overlays invisible elements that trick the user into clicking sensitive actions in the embedded application. The classic demonstration is a "claim free prize" button that is positioned directly over an invisible "transfer funds" button on the bank application embedded as an iframe — the user clicks the visible button, but the click lands on the bank.

The modern defence is `Content-Security-Policy: frame-ancestors 'none'`, which forbids any page from embedding the application in a frame. If specific embedders are required, list them explicitly: `frame-ancestors https://partner.example.com`. The directive replaces the older `X-Frame-Options: DENY`, which allowed only `DENY`, `SAMEORIGIN`, or a single origin via `ALLOW-FROM`; the Content Security Policy directive is more expressive and is the modern standard.

```h
ttpContent-Security-Policy: frame-ancestors 'none'
```

**Trade-offs / when this fails.** `frame-ancestors` blocks embedding entirely, which breaks legitimate use cases such as embedding the application in a partner's portal. The `frame-ancestors` directive accepts an allowlist of permitted embedders; the team must enumerate them explicitly. For applications that legitimately allow embedding, the second line of defence is requiring user interaction (typing rather than just clicking) for sensitive actions, so an invisible button cannot complete the action by itself.

## Further reading

- [PortSwigger SSRF](https://portswigger.net/web-security/ssrf).
- [OWASP Prototype Pollution](https://owasp.org/www-community/vulnerabilities/Prototype_Pollution).
- [SLSA](https://slsa.dev/) — supply-chain integrity framework.
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements).
