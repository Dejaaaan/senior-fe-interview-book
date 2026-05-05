---
title: "Cookies done right"
sidebar_label: "10.4 Cookies done right"
description: "HttpOnly, Secure, SameSite, domain scoping, and the cookie attributes that prevent the bugs."
sidebar_position: 4
---

Cookies are an old browser technology that teams routinely misconfigure. Configuring them correctly removes most of the recurring authentication pitfalls.

> **Acronyms used in this chapter.** API: Application Programming Interface. BFF: Backend-for-Frontend. CDN: Content Delivery Network. CNAME: Canonical Name (DNS record). CORS: Cross-Origin Resource Sharing. CSRF: Cross-Site Request Forgery. DNS: Domain Name System. HTTP: Hypertext Transfer Protocol. HTTPS: HTTP Secure. ITP: Intelligent Tracking Prevention. JS: JavaScript. JWT: JSON Web Token. RFC: Request for Comments. SPA: Single-Page Application. UI: User Interface. URL: Uniform Resource Locator. XSS: Cross-Site Scripting.

## The attributes that matter

```h
ttpSet-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000; Domain=example.com
```

| Attribute | What it does | When to use |
| --- | --- | --- |
| `HttpOnly` | JS cannot read the cookie via `document.cookie` | Always for auth cookies |
| `Secure` | Only sent over HTTPS | Always (in production) |
| `SameSite=Strict` | Never sent on cross-site requests | Banking-grade; breaks "follow link from email" |
| `SameSite=Lax` | Sent on top-level GET cross-site nav, not on POST/iframe/`<img>` | Default for auth cookies in 2026 |
| `SameSite=None` | Sent on all cross-site requests; **requires `Secure`** | Embedded widgets, third-party iframes |
| `Path=/` | Cookie scoped to whole site | Almost always `/` |
| `Domain=example.com` | Sent to all subdomains too | Single-sign-on across `app.example.com` and `api.example.com` |
| `Max-Age=N` | Lives for N seconds | Set explicitly; default is "session" (lost on browser close) |
| `Expires=...` | Older equivalent | Use `Max-Age` |

The rule of thumb for authentication cookies in 2026: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`. Set the `Domain` attribute only when cross-subdomain sharing is required.

## SameSite explained with an example

Imagine the user is browsing `evil.com` and the page contains the following markup:

```html
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

Without `SameSite`, the browser sends `bank.com`'s cookie along with the cross-site POST and the transfer succeeds. Funds are stolen. This is the canonical Cross-Site Request Forgery attack.

With `SameSite=Lax`, the browser does not send the cookie on cross-site `POST` requests. The attack is neutralised for state-changing methods.

With `SameSite=Strict`, the browser does not send the cookie even when the user clicks a link from a different site to `bank.com` — the user would appear logged out until they navigate within `bank.com`. The protection is stronger but the User Interface is more disruptive.

For nearly every authentication cookie, `SameSite=Lax` is the right default; it provides the protection without the friction.

## `__Host-` and `__Secure-` prefixes

Browsers enforce additional constraints on cookies whose names start with the `__Host-` or `__Secure-` prefixes. A `__Secure-` cookie must include the `Secure` attribute; the browser refuses to set it otherwise. A `__Host-` cookie must include `Secure`, must use `Path=/`, and must not include `Domain`; the browser refuses otherwise.

These prefixes prevent subdomain-injection attacks. A compromised `cdn.example.com` cannot set a `__Host-` cookie that affects `app.example.com` because the prefix forbids the `Domain` attribute that would be required for cross-subdomain reach.

```h
ttpSet-Cookie: __Host-sid=abc; HttpOnly; Secure; SameSite=Lax; Path=/
```

Use these prefixes for new authentication cookies whenever the application's deployment topology permits.

## CSRF mitigation in 2026

The defence has two layers. The first layer is `SameSite=Lax` (or `Strict`), which eliminates nearly all classic Cross-Site Request Forgery attacks because the cookie is not sent on cross-site `POST` requests. The second layer is a Cross-Site Request Forgery token — either the Synchronizer Token Pattern, where the server issues a per-session token that the client echoes in a header or hidden field, or the Double-Submit Cookie Pattern, where the server issues a token in a non-`HttpOnly` cookie and requires the client to echo it in a header. The second layer provides defence in depth, particularly for state-changing `GET` requests (which a well-designed Application Programming Interface should not have, but legacy code often does).

For pure Application Programming Interface Single-Page Applications that send `Authorization: Bearer ...` instead of cookies, Cross-Site Request Forgery does not apply because browsers do not auto-attach `Authorization` headers to cross-site requests. The authentication cookie itself, however, still needs `SameSite=Lax`.

## Cross-domain auth (the painful case)

If the frontend is `https://app.example.com` and the Application Programming Interface is `https://api.example.com`, both share the same registrable domain (`example.com`), so the cookie can be scoped to the parent domain:

```ts
res.setHeader(
  "Set-Cookie",
  "sid=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=example.com"
);
```

If the frontend is `https://app.acme.com` and the Application Programming Interface is `https://api.bigcorp.com`, the two are different registrable sites and the constraints are stricter. A single cookie cannot be shared because the browser will not send `bigcorp.com`'s cookie on a request originating from `acme.com`. Cross-origin authentication requires `SameSite=None; Secure` on the cookie and Cross-Origin Resource Sharing with `credentials: include` on the `fetch` call. The senior pattern is to avoid this configuration entirely by implementing OpenID Connect with a Backend-for-Frontend on `app.acme.com` so the browser only deals with one origin's cookies.

## CORS + credentials

For the cookie to ride along on cross-origin `fetch`:

```ts
fetch("https://api.example.com/me", { credentials: "include" });
```

And the API must respond with:

```h
ttpAccess-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

Two constraints apply. First, when `Access-Control-Allow-Credentials: true` is present, `Access-Control-Allow-Origin` cannot be `*`; it must be the explicit origin. Browsers reject the response otherwise. Second, preflighted requests — anything beyond simple `GET` and `POST` with permitted content types — require an `OPTIONS` handler on the server that returns the appropriate Cross-Origin Resource Sharing headers.

## Common cookie bugs

| Bug | Symptom | Fix |
| --- | --- | --- |
| No `Secure` in production | Cookies leak over HTTP downgrade attacks | Always `Secure` |
| No `HttpOnly` on auth cookie | `document.cookie` exfiltrates session via XSS | `HttpOnly` |
| `SameSite` left as default `Lax` but cookie set in iframe | Cookie not set when site is iframed | `SameSite=None; Secure` (or stop iframing) |
| Cookie set on `app.example.com` but read on `api.example.com` | Cookie not sent | Set `Domain=example.com` (parent domain) |
| Cookie domain set to `.example.co.uk` | Browser refuses (public suffix list) | Use the registrable domain |
| Cookie used in third-party context (e.g. analytics in iframe) | Blocked by ITP/3rd-party-cookie deprecation | Move to first-party (CNAME or BFF) |

## The 2026 reality: third-party cookies are gone (mostly)

Safari's Intelligent Tracking Prevention, Firefox's Enhanced Tracking Protection, and Chrome's third-party cookie deprecation have all converged on blocking or restricting third-party cookies. Applications shipped in 2026 should not depend on third-party cookies. Analytics or authentication flows that previously used third-party cookies must move to first-party deployments (a Canonical Name DNS record on the application's own domain) or a Backend-for-Frontend pattern.

## Cookie size limits

The browser's cookie store has hard limits that authentication payloads can quickly exhaust. Each individual cookie is limited to approximately four kilobytes including name, value, and attributes. Each domain may hold approximately fifty cookies totalling approximately eighty kilobytes. Long JSON Web Tokens in cookies consume this budget rapidly, which is yet another reason to prefer opaque session identifiers over self-contained tokens.

## Setting cookies in each backend framework

The cookie configuration looks similar across Express, Fastify, and Next.js, but each framework has its own ergonomic differences worth knowing.

```ts
res.cookie("sid", id, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
```

```ts
reply.setCookie("sid", id, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
});
```

```ts
res.cookie("sid", id, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
```

## Key takeaways

The senior framing for cookies: the default for an authentication cookie is `HttpOnly; Secure; SameSite=Lax; Path=/`, with the `__Host-` prefix added whenever the deployment topology permits. `SameSite=Lax` is the primary Cross-Site Request Forgery mitigation; Cross-Site Request Forgery tokens are defence in depth. Never store a JSON Web Token in `localStorage`; use `HttpOnly` cookies or an in-memory variable. Cross-origin authentication requires `SameSite=None; Secure`, Cross-Origin Resource Sharing with `Allow-Credentials: true`, and an explicit origin. Third-party cookies are effectively gone in 2026 — do not design new applications around them.

## Common interview questions

1. What is the default `SameSite` value and what does `Lax` mean?
2. Why is `HttpOnly` important?
3. What is the `__Host-` prefix and what does it guarantee?
4. Cross-Origin Resource Sharing plus cookies: what is the minimum configuration?
5. Walk through a Cross-Site Request Forgery attack and how `SameSite=Lax` blocks it.

## Answers

### 1. What is the default SameSite value and what does Lax mean?

In modern browsers, the default `SameSite` value for cookies that do not specify one is `Lax`. The `Lax` value means the browser sends the cookie on top-level cross-site `GET` navigations (clicking a link from another site, for example) but does not send it on cross-site `POST`, `PUT`, `DELETE` requests, on requests originating from `<iframe>`, `<img>`, or `<script>` elements, or on background `fetch` calls from another site. The pattern preserves the user-experience expectation that following a link logs the user in correctly while blocking the request shapes that Cross-Site Request Forgery attacks rely on.

**Trade-offs / when this fails.** Some legacy patterns depend on cross-site `POST` carrying the cookie (some payment redirect flows, for example). Those flows must explicitly opt into `SameSite=None; Secure` and live with the broader exposure. The default `Lax` setting is a sensible safe default; only override it when the use case requires it and the threat is mitigated by other means.

### 2. Why is HttpOnly important?

The `HttpOnly` attribute makes the cookie invisible to JavaScript via `document.cookie`. The protection matters because the most common way an attacker exfiltrates session credentials is through Cross-Site Scripting: a single injected `<script>` tag that runs on the application's origin can read every accessible cookie and send the values to an attacker-controlled endpoint. With `HttpOnly`, the same Cross-Site Scripting payload cannot read the session cookie at all, dramatically reducing the impact of the vulnerability.

```h
ttpSet-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Trade-offs / when this fails.** `HttpOnly` does not protect against every Cross-Site Scripting attack — an attacker can still issue authenticated requests on the user's behalf because the browser attaches the cookie to in-page requests automatically. The cure for that residual risk is a strong Content Security Policy that prevents the Cross-Site Scripting from running in the first place. `HttpOnly` is necessary but not sufficient; treat it as one layer of a defence-in-depth strategy.

### 3. What is the __Host- prefix and what does it guarantee?

The `__Host-` prefix is a browser-enforced cookie naming convention that prevents subdomain-injection attacks. A cookie whose name starts with `__Host-` is rejected by the browser unless three conditions are met: the `Secure` attribute is set, the `Path` attribute is `/`, and the `Domain` attribute is omitted entirely. The omission of `Domain` ensures the cookie cannot be set by a sibling subdomain — a compromised `cdn.example.com` cannot set a `__Host-session` cookie that the browser would later send to `app.example.com`, because the prefix forbids the cross-subdomain reach.

**Trade-offs / when this fails.** The `__Host-` constraints are strict and incompatible with deployments that legitimately need cross-subdomain cookies. For single-sign-on across `app.example.com` and `api.example.com`, a `Domain=example.com` cookie is required and the `__Host-` prefix cannot be used. The `__Secure-` prefix is a less strict alternative that requires only `Secure` and is appropriate when cross-subdomain reach is needed.

### 4. CORS + cookies: what is the minimum configuration?

The browser must be told to attach cookies to the cross-origin request, and the server must respond with explicit Cross-Origin Resource Sharing headers permitting credentials. On the client, the `fetch` call uses `credentials: "include"` (or the equivalent on `XMLHttpRequest` and `axios`). On the server, the response must include `Access-Control-Allow-Origin` set to the specific requesting origin (not the wildcard `*`, which is incompatible with credentials), `Access-Control-Allow-Credentials: true`, and the appropriate `Vary: Origin` to prevent cache poisoning across origins.

```ts
fetch("https://api.example.com/me", { credentials: "include" });
```

```h
ttpAccess-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

**Trade-offs / when this fails.** Forgetting `Vary: Origin` allows a Content Delivery Network to cache one origin's response and serve it to another origin, which is a privacy leak. Wildcard `Access-Control-Allow-Origin` with `Allow-Credentials: true` is rejected by the browser entirely. For preflighted requests, the `OPTIONS` response must also include the credentials-related headers, otherwise the actual request never fires.

### 5. Walk through a CSRF attack and how SameSite=Lax blocks it.

The classic Cross-Site Request Forgery attack works as follows. A user is logged into `bank.com` and holds an authentication cookie. The user visits `evil.com`, which contains a hidden form that auto-submits a `POST` to `bank.com/transfer`. The browser, by default, attaches `bank.com`'s cookie to the cross-site `POST` because the cookie is scoped to `bank.com`'s domain. The bank's server sees a valid session cookie, processes the transfer, and the funds are stolen. The user never knew the request was made.

The `SameSite=Lax` attribute on the bank's authentication cookie blocks this attack at the browser level. Lax cookies are sent on top-level cross-site `GET` navigations (so following a link from another site to `bank.com` still works) but are not sent on cross-site `POST` requests. The attacker's auto-submitting form fails because the cookie is not attached, the bank's server sees no session, the request is rejected with `401`, and no transfer occurs.

```h
ttpSet-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Trade-offs / when this fails.** `SameSite=Lax` does not protect cross-site `GET` requests that have side effects, which is one reason state-changing `GET` is an antipattern. For applications with legacy state-changing `GET` endpoints, additional Cross-Site Request Forgery tokens are required. Some browsers default to `SameSite=Lax` for cookies that omit the attribute, but the application should set the attribute explicitly because the default behaviour varies across browser versions.

## Further reading

- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie).
- [RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis) — the modern cookie specification.
- [OWASP CSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
