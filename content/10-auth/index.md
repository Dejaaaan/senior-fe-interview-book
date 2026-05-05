---
title: "Authentication & Authorization"
sidebar_label: "10. Authentication & Authorization"
description: "AuthN vs AuthZ, sessions vs JWT, OAuth2/OIDC, cookies, refresh tokens, RBAC/ABAC."
sidebar_position: 9
---

Authentication and authorization appear in nearly every senior frontend interview. The reason is that the topic touches the frontend, the backend, the browser security model, and the application's threat model in equal measure, so it reveals breadth and depth quickly. A senior candidate is expected to articulate not only how a particular library works, but why the underlying design decisions were made and what fails when the chosen pattern is misapplied.

The chapters in this part cover the conceptual foundations first — the distinction between authentication (proving who the user is) and authorization (deciding what the user is allowed to do), the trade-offs between server-side sessions and JSON Web Tokens. They then proceed through the mechanisms in production use today: the OAuth 2.0 and OpenID Connect protocols, the browser cookie attributes that make session cookies safe, refresh-token rotation patterns, and the policy layer represented by Role-Based Access Control, Attribute-Based Access Control, and Relationship-Based Access Control. The part closes with concrete implementation chapters for Auth.js, NestJS with Passport, and Amazon Cognito, followed by a dedicated chapter on React client-side authentication patterns.

The companion concrete-implementation chapter for Next.js authentication lives in [Part 4](../04-nextjs/06-auth-integration.md). Every chapter in this part includes detailed answers to common interview questions to support deliberate practice.

## Chapters in this part

1. [AuthN vs. AuthZ, threat model](./01-authn-vs-authz.md) — the conceptual distinction and the threats each layer defends against.
2. [Sessions vs. JWT](./02-sessions-vs-jwt.md) — when stateful is right, when stateless is right, and the operational cost of each.
3. [OAuth 2.0 and OpenID Connect](./03-oauth-oidc.md) — Authorization Code with Proof Key for Code Exchange, the ID token, refresh flows.
4. [Cookies done right](./04-cookies.md) — `HttpOnly`, `Secure`, `SameSite`, the `__Host-` prefix, double-submit CSRF defence.
5. [Refresh tokens & rotation](./05-refresh-tokens.md) — rotation, reuse detection, sliding vs absolute lifetimes.
6. [RBAC, ABAC, ReBAC](./06-rbac-abac.md) — three policy models, when to combine them, how to express them in code.
7. [Concrete implementations](./07-implementations.md) — Auth.js, NestJS with Passport, and Amazon Cognito.
8. [React client authentication](./08-react-client.md) — token storage, the `useAuth` hook, route guards, `fetch` wrappers with silent refresh, cross-tab logout, pure-client OIDC with PKCE.
