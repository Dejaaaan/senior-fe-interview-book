---
title: "CSRF & SameSite"
sidebar_label: "11.3 CSRF & SameSite"
description: "Cross-site request forgery, SameSite cookies, and CSRF tokens in 2026."
sidebar_position: 3
---

Cross-Site Request Forgery is the attack class in which an adversary tricks a logged-in user's browser into making a state-changing request that the user did not intend. The browser dutifully attaches the user's authentication cookie because the browser knows nothing about the user's intent — it sees a request to a domain for which it holds a cookie and attaches the cookie. The server, in turn, sees a valid session and processes the request.

> **Acronyms used in this chapter.** AJAX: Asynchronous JavaScript and XML. API: Application Programming Interface. CORS: Cross-Origin Resource Sharing. CSRF: Cross-Site Request Forgery. HTTP: Hypertext Transfer Protocol. IdP: Identity Provider. JS: JavaScript. OAuth: Open Authorization. SPA: Single-Page Application. URL: Uniform Resource Locator. UUID: Universally Unique Identifier. WS: WebSocket. XSS: Cross-Site Scripting.

## The attack

The canonical attack is hosted on an attacker-controlled domain. The page contains a form whose action targets the victim site and whose fields encode the malicious intent; a small inline script auto-submits the form on page load.

```html
<!-- Hosted on evil.com -->
<form action="https://bank.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.forms[0].submit()</script>
```

If the user visits `evil.com` while logged in to `bank.com`, the browser sends `bank.com`'s cookie along with the cross-site `POST`. Without Cross-Site Request Forgery protection, the transfer succeeds and funds are stolen.

Several variants exist. A `<img src="https://bank.com/transfer?to=attacker&amount=10000">` element sends a `GET` request automatically when the image element is parsed; this requires the application to expose a state-changing `GET` endpoint, which is itself an antipattern but is common in legacy code. A `<form>` `POST` (above) requires no JavaScript to execute the submission. An Asynchronous JavaScript and XML request from `evil.com` is blocked by Cross-Origin Resource Sharing unless the server misconfigures the policy to permit credentials from arbitrary origins.

## SameSite cookies (the modern answer)

The `SameSite=Lax` value, which has been the Chromium default since 2020, means the cookie is not sent on cross-site `POST` requests, which neutralises classic Cross-Site Request Forgery for cookie-based authentication.

| Mode | Sent on top-level cross-site GET | Sent on cross-site POST | Sent in iframe |
| --- | --- | --- | --- |
| `Strict` | ❌ | ❌ | ❌ |
| `Lax` (default) | ✅ | ❌ | ❌ |
| `None` (requires `Secure`) | ✅ | ✅ | ✅ |

Set `SameSite=Lax` (or `Strict` for highly sensitive flows) on every authentication cookie. That single attribute provides approximately eighty percent of the Cross-Site Request Forgery defence the application needs.

## The remaining 20%: defence in depth

The `SameSite=Lax` attribute does not cover every Cross-Site Request Forgery vector. State-changing `GET` endpoints (which a well-designed Application Programming Interface should not have, but legacy code often does) are not protected because Lax cookies are sent on top-level cross-site `GET` navigations. Sub-origin attacks — a compromised `cdn.example.com` can attempt actions against `app.example.com` because they share the registrable domain — bypass `SameSite` entirely. Some older mobile browsers misimplement `SameSite` and silently fall back to `None`. The defence-in-depth layer is a Cross-Site Request Forgery token using one of two patterns.

### Synchronizer token pattern

The Synchronizer Token Pattern works as follows. The server issues a random token at session establishment and stores it in the session record. The server includes the token in forms (as a hidden field) or exposes it via an endpoint that the Single-Page Application can fetch. The browser sends the token back in a header (typically `X-CSRF-Token`) on every state-changing request. The server compares the header value against the session-stored value and rejects the request if they do not match.

```ts
import csurf from "csurf";

const csrfProtection = csurf({ cookie: true });

app.get("/form", csrfProtection, (req, res) => {
  res.render("form", { csrfToken: req.csrfToken() });
});

app.post("/transfer", csrfProtection, (req, res) => {
  // csurf has already checked req.body._csrf or X-CSRF-Token
});
```

### Double-submit cookie

The Double-Submit Cookie pattern is the stateless alternative. The server sets a random value in a non-`HttpOnly` cookie (`csrf=abc123`). The application's JavaScript reads the cookie and sends the same value as a header (`X-CSRF-Token: abc123`) on every state-changing request. The server compares the header value against the cookie value and rejects the request if they do not match.

The attacker on `evil.com` cannot read `bank.com`'s cookies because of the Same Origin Policy, so they cannot replicate the header. The pattern is stateless — no server-side storage is required, which makes it attractive for distributed systems where session storage is expensive.

```ts
app.use((req, res, next) => {
  if (!req.cookies.csrf) {
    res.cookie("csrf", crypto.randomUUID(), {
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }
  next();
});

function checkCsrf(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const header = req.header("x-csrf-token");
  if (!header || header !== req.cookies.csrf) {
    return res.status(403).json({ type: "/errors/csrf", title: "CSRF failed" });
  }
  next();
}
```

## When CSRF doesn't apply

If the application's authentication is purely `Authorization: Bearer ...` from a non-cookie source — for example, an access token stored in `localStorage` and attached on every `fetch` — browsers do not auto-attach the `Authorization` header on cross-site requests. Cross-Site Request Forgery is structurally impossible in that configuration.

However, storing the token in `localStorage` trades Cross-Site Request Forgery exposure for Cross-Site Scripting token-theft exposure, which is a worse position because Cross-Site Scripting bugs are more common than Cross-Site Request Forgery bugs and the impact of a stolen token is the same as a successful Cross-Site Request Forgery. The senior recommendation remains `HttpOnly` cookies plus `SameSite=Lax` plus an optional Double-Submit token for defence in depth.

## Form `<form action>` redirects from the IdP

When implementing OAuth callbacks, the Identity Provider redirects back to the application via `GET /callback?code=...`. This is a top-level cross-site navigation, which is permitted by `SameSite=Lax`. The defence is the `state` parameter — a random value generated per authorization request, stored server-side, and validated when the callback returns.

```ts
const state = crypto.randomBytes(16).toString("base64url");
session.oauthState = state;

const url = new URL(idpAuthorizeUrl);
url.searchParams.set("state", state);
res.redirect(url.toString());

// On callback:
if (req.query.state !== session.oauthState) {
  return res.status(400).send("CSRF on OAuth callback");
}
```

## SPA-without-cookies pattern

```ts
const csrfToken = crypto.randomUUID();
sessionStorage.setItem("csrf", csrfToken);
document.cookie = `csrf=${csrfToken}; SameSite=Lax; Secure; Path=/`;

await fetch("/api/transfer", {
  method: "POST",
  headers: { "X-CSRF-Token": csrfToken },
  body: JSON.stringify(payload),
  credentials: "include",
});
```

## CSRF in WebSockets

WebSockets do not carry cookies during the established connection in the same way as Hypertext Transfer Protocol requests, but the upgrade handshake itself does. A malicious page can open `new WebSocket("wss://api.example.com")` and the user's authentication cookie attaches to the upgrade request, allowing the attacker to establish an authenticated WebSocket session as the user.

The defence is to validate the `Origin` header during the WebSocket handshake and reject any origin not on the application's allowlist. The Same Origin Policy ensures the attacker cannot forge the `Origin` header from JavaScript, so the check is reliable.

```ts
io.engine.on("connection", (socket) => {
  const origin = socket.request.headers.origin;
  if (!ALLOWED_ORIGINS.has(origin)) {
    socket.close();
  }
});
```

## Key takeaways

The senior framing for Cross-Site Request Forgery: `SameSite=Lax` on authentication cookies blocks the bulk of classic Cross-Site Request Forgery attacks at the browser level. Cross-Site Request Forgery tokens (Synchronizer or Double-Submit) are the defence-in-depth layer. Bearer tokens in non-cookie storage are structurally immune to Cross-Site Request Forgery but vulnerable to Cross-Site Scripting token-theft, which is a worse trade-off in most threat models. OAuth callbacks need a `state` parameter to defend against forged callbacks. WebSockets must validate the `Origin` header during the handshake.

## Common interview questions

1. What is Cross-Site Request Forgery and why does it work?
2. What does `SameSite=Lax` change?
3. The difference between the Synchronizer Token Pattern and Double-Submit Cookie?
4. Cross-Site Request Forgery on a Single-Page Application using `Authorization: Bearer ...` — is it possible?
5. How can the OAuth callback be defended against Cross-Site Request Forgery?

## Answers

### 1. What is CSRF and why does it work?

Cross-Site Request Forgery is the attack where an adversary causes a logged-in user's browser to issue a state-changing request that the user did not intend. The attack works because of two browser behaviours: cookies are scoped by domain rather than by the page that issued the request, so a request originating from any page to the cookie's domain receives the cookie automatically; and many state-changing requests look like normal forms or `<img>` tags from the browser's perspective, so the browser issues them without prompting the user. The server sees a valid session cookie and processes the request as if the user had intended it.

**Trade-offs / when this fails.** The attack is most effective against state-changing operations that are easy to encode in a cross-site request: form `POST` with predictable body, `GET` with side effects, simple Application Programming Interface calls. Operations that require complex preconditions (a previous `GET`, a server-issued nonce, a multi-step confirmation) are intrinsically harder to forge. The `SameSite=Lax` cookie attribute eliminates most of the attack surface by refusing to attach the cookie to cross-site `POST` requests.

### 2. What does SameSite=Lax change?

`SameSite=Lax` changes when the browser attaches the cookie to outbound requests. Without `SameSite`, the browser attaches the cookie to every request to the cookie's domain, regardless of which page issued the request. With `SameSite=Lax`, the browser attaches the cookie only to top-level cross-site `GET` navigations (clicking a link from another site, for example) and to all same-site requests; it does not attach the cookie to cross-site `POST`, `PUT`, `DELETE`, to requests originating from `<iframe>`, `<img>`, or `<script>` elements, or to background `fetch` calls from another site.

The change neutralises classic Cross-Site Request Forgery for cookie-based authentication because the canonical attack — the auto-submitting `<form action="https://bank.com/transfer" method="POST">` — is a cross-site `POST` and the browser refuses to attach the cookie. The bank's server sees no session and rejects the request.

**Trade-offs / when this fails.** `SameSite=Lax` is now the default in Chromium, Firefox, and Safari for cookies that omit the attribute; explicit configuration is still recommended because the default behaviour varies across browser versions. Some legacy flows (some payment redirect patterns) require cross-site `POST` to carry the cookie; those flows must opt into `SameSite=None; Secure` and accept the broader exposure.

### 3. The difference between Synchronizer Token Pattern and Double-Submit Cookie?

Both patterns require the client to echo a server-issued token back on every state-changing request, but they differ in where the token lives. The Synchronizer Token Pattern stores the canonical token server-side in the session record; the server includes it in forms as a hidden field or exposes it via an endpoint, and validates the echoed value against the session-stored value. The Double-Submit Cookie pattern stores the token in a non-`HttpOnly` cookie that JavaScript can read; the JavaScript echoes the cookie value as a header on every state-changing request, and the server validates that the header matches the cookie. The Synchronizer Pattern requires server-side state; the Double-Submit Pattern is stateless.

```ts
// Double-Submit: validate header against cookie.
function checkCsrf(req: Request) {
  const fromHeader = req.header("x-csrf-token");
  const fromCookie = req.cookies.csrf;
  if (!fromHeader || fromHeader !== fromCookie) throw new HttpError(403, "CSRF failed");
}
```

**Trade-offs / when this fails.** The Double-Submit Pattern is more attractive for distributed systems because it does not require shared session state, but the cookie value must be unguessable and unique per session — a static cookie value defeats the protection. The Synchronizer Pattern is bulletproof but requires session storage; for applications already using server-side sessions, the cost is negligible. Both patterns require careful handling of the cookie's `SameSite` and `HttpOnly` attributes; the Cross-Site Request Forgery cookie itself is not `HttpOnly` because JavaScript must read it.

### 4. CSRF on a SPA using Authorization: Bearer — is it possible?

If the Single-Page Application sends `Authorization: Bearer ...` from a non-cookie source (an in-memory variable, `localStorage`, `sessionStorage`), browsers do not auto-attach the `Authorization` header on cross-site requests. An attacker on `evil.com` cannot cause the user's browser to send the header to the application's Application Programming Interface because the header is not present on the request the attacker can construct. Cross-Site Request Forgery is structurally impossible.

However, the trade-off is unfavourable. Storing the token in `localStorage` or `sessionStorage` exposes it to Cross-Site Scripting, and the impact of a stolen token is the same as a successful Cross-Site Request Forgery — the attacker mints requests as the user. Cross-Site Scripting bugs are more common than Cross-Site Request Forgery bugs, so the trade is usually a regression in security posture.

**Trade-offs / when this fails.** The senior recommendation remains `HttpOnly` cookies plus `SameSite=Lax` plus an optional Double-Submit token, even for Single-Page Applications. The in-memory token pattern from the [React client authentication chapter](../10-auth/08-react-client.md) provides a defensible alternative when no Backend-for-Frontend is available.

### 5. How can the OAuth callback be defended against CSRF?

The OAuth callback (`GET /callback?code=...`) is a top-level cross-site navigation from the Identity Provider back to the application; `SameSite=Lax` permits the cookie to attach. An attacker can construct a forged callback by initiating their own OAuth flow, capturing the resulting `code`, and inducing the victim to load the callback with the attacker's `code`; if the application accepts any incoming `code`, the victim's session is bound to the attacker's account.

The defence is the `state` parameter. Generate a high-entropy random value when initiating the OAuth flow, store it server-side keyed by the user's session, and include it in the authorization redirect. When the callback returns, compare the `state` parameter against the stored value. If they do not match, reject the callback. The pattern ensures that the callback is bound to a flow the legitimate user actually initiated.

```ts
const state = crypto.randomBytes(16).toString("base64url");
session.oauthState = state;
res.redirect(`${idpAuthorizeUrl}?state=${state}&...`);

// On callback:
if (req.query.state !== session.oauthState) {
  return res.status(400).send("CSRF on OAuth callback");
}
```

**Trade-offs / when this fails.** Reusing the same `state` value across flows defeats the protection; generate a fresh value per authorization request. Storing the value in a non-`HttpOnly` cookie defeats the protection because the attacker can read it; store it server-side or in a signed `HttpOnly` cookie. Auth.js, NextAuth, Passport, and similar libraries handle the `state` parameter automatically.

## Further reading

- [OWASP CSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value).
