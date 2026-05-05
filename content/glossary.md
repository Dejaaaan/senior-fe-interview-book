---
title: "Glossary"
description: "Quick definitions of acronyms, jargon, and concepts used throughout the book."
sidebar_position: 99
---

A senior interview surfaces acronyms in rapid succession. Use this glossary as a quick-reference refresher; the chapters provide the full treatment, including mechanism, trade-offs, and worked examples. Each entry includes the expansion, a short definition, and a cross-link to the chapter where the concept is covered in depth.

## A

**ABAC** — Attribute-Based Access Control. Permissions decided by attributes of subject/action/resource/environment. See [Part 10 ch. 6](./10-auth/06-rbac-abac.md).

**ACL** — Access Control List. Per-resource list of who can do what.

**ACM** — AWS Certificate Manager. Free TLS certs for AWS services. See [Part 12 ch. 3](./12-aws/03-cloudfront-route53.md).

**ADOT** — AWS Distro for OpenTelemetry. AWS's distribution of OTel collectors and SDKs.

**Alias record** — Route 53 record type that resolves to an AWS resource at zero query cost. Prefer over CNAME for AWS targets.

**API Gateway (HTTP API / REST API)** — AWS's HTTP front door for Lambda. HTTP API is the cheaper, simpler 2026 default. See [Part 12 ch. 5](./12-aws/05-api-gateway.md).

**ARIA** — Accessible Rich Internet Applications. Set of attributes (roles, states, properties) that improve assistive-tech understanding of HTML. See [Part 2 ch. 4](./02-foundations/04-accessibility.md).

**AuthN / AuthZ** — Authentication / Authorization. Different things; different failure codes (401 vs 403). See [Part 10](./10-auth/01-authn-vs-authz.md).

## B

**BFF** — Backend for Frontend. A server that mediates between a SPA / mobile app and a heterogeneous set of services; in 2026, also where OIDC tokens live so the browser only ever sees an HttpOnly cookie. See [Part 10 ch. 3](./10-auth/03-oauth-oidc.md).

**BroadcastChannel** — Browser API providing same-origin pub/sub between tabs and workers. The standard primitive for cross-tab logout in a SPA. See [Part 10 ch. 8](./10-auth/08-react-client.md).

**Brotli / zstd** — Modern HTTP compression algorithms. Better than gzip for textual content.

## C

**CDK** — AWS Cloud Development Kit. IaC in TypeScript/Python/Java/Go that synthesizes CloudFormation. See [Part 12 ch. 11](./12-aws/11-end-to-end.md).

**CDN** — Content Delivery Network. Edge caches that serve content from the POP closest to the user.

**Change detection** — Angular's process of finding and applying view updates after state changes. Default uses Zone.js; OnPush + Signals is the modern fast path.

**CLS** — Cumulative Layout Shift. Core Web Vital measuring visual stability. Target: under 0.1.

**Cognito** — AWS managed user directory + auth + Hosted UI. See [Part 12 ch. 7](./12-aws/07-cognito.md).

**CORS** — Cross-Origin Resource Sharing. Opt-in mechanism around the Same-Origin Policy. See [Part 11 ch. 4](./11-security-and-privacy/04-cors.md).

**CRDT** — Conflict-free Replicated Data Type. Data structure where concurrent edits converge without coordination. Y.js, Automerge are popular implementations.

**CRP** — Critical Rendering Path. Steps the browser takes from receiving HTML to first paint. The thing you optimise for fast first render.

**CSP** — Content Security Policy. Browser-enforced policy that limits what the page can load/execute; primary XSS defence in depth. See [Part 11 ch. 2](./11-security-and-privacy/02-xss-csp.md).

**CSR** — Client-Side Rendering. The browser does the DOM construction; the HTML payload is mostly empty.

**CSRF** — Cross-Site Request Forgery. Attacker tricks logged-in user into making an unintended state-changing request. SameSite=Lax + token defence. See [Part 11 ch. 3](./11-security-and-privacy/03-csrf.md).

## D

**Dependency Injection (DI)** — Pattern where dependencies are provided rather than instantiated. Angular's core idiom. See [Part 5 ch. 2](./05-angular-basics/02-di.md).

**DLQ** — Dead-Letter Queue. SQS queue that receives messages a consumer failed to process N times. See [Part 12 ch. 8](./12-aws/08-messaging.md).

**DynamoDB** — AWS managed NoSQL key-value + document store. Single-table design is the native pattern. See [Part 12 ch. 6](./12-aws/06-dynamodb.md).

## E

**Edge runtime** — Code that runs at the CDN edge (CloudFront Functions, Lambda@Edge, Vercel Edge). Sub-50ms latency, limited capabilities.

**EMF** — Embedded Metric Format. Write CloudWatch metrics from log lines without a separate API call. See [Part 12 ch. 9](./12-aws/09-cloudwatch.md).

**ESM / CJS** — ECMAScript Modules / CommonJS. The two JS module systems. ESM is the modern default.

**ETag** — HTTP entity tag. An opaque hash of the resource version; used in conditional requests for caching. See [Part 9 ch. 6](./09-rest-and-networking/06-http-and-tls.md).

**EventBridge** — AWS event bus with content-based routing, filtering, scheduling. See [Part 12 ch. 8](./12-aws/08-messaging.md).

## F

**Feature flag** — Runtime toggle to enable/disable features without redeploying. LaunchDarkly, Unleash, GrowthBook. See [Part 7 ch. 5](./07-production-concerns/05-cicd-feature-flags.md).

**FCP / LCP** — First Contentful Paint / Largest Contentful Paint. Performance metrics; LCP is a Core Web Vital (target under 2.5 seconds).

**FormBuilder** — Angular helper for constructing typed reactive forms. See [Part 5 ch. 5](./05-angular-basics/05-forms.md).

## G

**GDPR** — EU General Data Protection Regulation. The privacy law that defines lawful bases, user rights, and processor responsibilities. See [Part 11 ch. 7](./11-security-and-privacy/07-privacy-gdpr.md).

**GSI** — Global Secondary Index (DynamoDB). A copy of the table sorted by different keys; enables additional access patterns.

## H

**Headless component** — UI component that provides behaviour and accessibility without imposing styling (Radix, Headless UI). See [Part 6 ch. 1](./06-fe-architecture/01-component-patterns.md).

**HSTS** — HTTP Strict Transport Security. Header telling the browser "always use HTTPS for this domain".

**HTTP/2 / HTTP/3** — Modern HTTP versions. /2 uses multiplexed streams over TCP; /3 uses QUIC over UDP for better mobile / lossy-network performance.

## I

**IAM** — Identity and Access Management. AWS's authorization system. See [Part 12 ch. 1](./12-aws/01-iam.md).

**IDOR** — Insecure Direct Object Reference. The "you can read /orders/N for any N" bug class.

**Idempotency key** — Client-supplied identifier on a request so the server can de-duplicate retried writes. See [Part 9 ch. 3](./09-rest-and-networking/03-versioning-idempotency.md).

**INP** — Interaction to Next Paint. Core Web Vital that replaced FID; measures responsiveness during interactions. Target: under 200 milliseconds.

## J

**JWT** — JSON Web Token. A signed (and optionally encrypted) JSON payload. Stateless, hard to revoke, easily misused. See [Part 10 ch. 2](./10-auth/02-sessions-vs-jwt.md).

**JWKS** — JSON Web Key Set. The endpoint where an issuer publishes its public keys for JWT verification.

## K

**KMS** — AWS Key Management Service. Manages encryption keys; integrated with most AWS services.

## L

**Lambda** — AWS Functions-as-a-Service compute. Pay per invocation + execution time. See [Part 12 ch. 4](./12-aws/04-lambda.md).

**LCP** — see Core Web Vitals above.

**LSI** — Local Secondary Index (DynamoDB). Same partition key, different sort key. Created at table creation only.

## M

**Module Federation** — Webpack/Rspack feature for runtime code sharing across separately-deployed apps. The basis of Module-Federation-style micro-frontends.

**MSW** — Mock Service Worker. Library that intercepts requests at the network level for testing.

**mTLS** — Mutual TLS. Both client and server present certificates for verification. Used in zero-trust service meshes.

## N

**NestJS** — Opinionated Node framework with DI, decorators, modules. See [Part 8 ch. 5](./08-nodejs-backend/05-nestjs.md).

**NgRx** — Redux-style state management for Angular. Heavyweight; for large apps. Signals + a simple service is the lighter modern alternative.

## O

**OAC** — Origin Access Control. The 2026 way to lock S3 origins to a specific CloudFront distribution. Replaces legacy OAI.

**OIDC** — OpenID Connect. Authentication layer on top of OAuth 2.0; introduces the `id_token`. See [Part 10 ch. 3](./10-auth/03-oauth-oidc.md).

**OnPush** — Angular `ChangeDetectionStrategy.OnPush`. Component re-renders only when inputs change or the component dispatches an event.

**OpenAPI** — Specification format for HTTP APIs. Generates client SDKs and docs. See [Part 9 ch. 5](./09-rest-and-networking/05-openapi.md).

**OWASP Top 10** — Industry list of top web app risks; updated periodically. See [Part 11 ch. 1](./11-security-and-privacy/01-owasp.md).

## P

**PKCE** — Proof Key for Code Exchange. Extension to OAuth 2.0 Authorization Code flow that prevents code-interception attacks. Mandatory for SPAs. See [Part 10 ch. 3](./10-auth/03-oauth-oidc.md).

**PII** — Personally Identifiable Information. Anything that can identify a person.

**Presigned URL** — Time-limited, signed URL that grants access to an S3 object without AWS credentials.

**ProseMirror** — Editor framework that powers Tiptap and many collaborative editors.

**PWA** — Progressive Web App. Web app with service worker + manifest; installable, offline-capable. See [Part 7 ch. 7](./07-production-concerns/07-pwa-offline.md).

## R

**RBAC** — Role-Based Access Control. Users have roles; roles have permissions. The simplest authz model. See [Part 10 ch. 6](./10-auth/06-rbac-abac.md).

**ReBAC** — Relationship-Based Access Control. Permissions follow a graph of relationships. Zanzibar / SpiceDB / OpenFGA.

**RFC 7807** — `application/problem+json`. The standard error envelope for HTTP APIs. See [Part 9 ch. 4](./09-rest-and-networking/04-errors.md).

**RLS** — Row-Level Security. Postgres feature that enforces row visibility per session. The senior tenant-isolation pattern.

**RSC** — React Server Components. Components that render on the server, never sent to the client as JS.

**RUM** — Real User Monitoring. Capturing performance metrics from real visitors (vs synthetic monitoring).

**RxJS** — Reactive Extensions for JavaScript. Observable-based async; pervasive in Angular. See [Part 5 ch. 3](./05-angular-basics/03-rxjs.md).

## S

**SameSite** — Cookie attribute that controls cross-site sending. `Lax` is the default and the CSRF defence. See [Part 10 ch. 4](./10-auth/04-cookies.md).

**SES** — AWS Simple Email Service. Outbound (and limited inbound) email. See [Part 12 ch. 8](./12-aws/08-messaging.md).

**Service Worker** — A worker script that sits between the page and the network; powers offline-first PWAs. See [Part 2 ch. 5](./02-foundations/05-browser-apis.md).

**Signal** — Angular's fine-grained reactivity primitive. The Signals API replaces RxJS-heavy state management for UI. See [Part 5 ch. 7](./05-angular-basics/07-signals.md).

**SLA / SLO / SLI** — Service Level Agreement / Objective / Indicator. The triad of "what we promised", "what we aim for internally", "what we measure".

**SNS** — AWS Simple Notification Service. Pub-sub for fan-out to many subscribers. See [Part 12 ch. 8](./12-aws/08-messaging.md).

**SOP** — Same-Origin Policy. The browser security boundary that CORS opts out of. See [Part 11 ch. 4](./11-security-and-privacy/04-cors.md).

**SPA** — Single-Page Application. App where the browser renders subsequent pages via JS, not full reloads.

**SQS** — AWS Simple Queue Service. Managed message queue. See [Part 12 ch. 8](./12-aws/08-messaging.md).

**SRI** — Sub-Resource Integrity. Hash attribute on `<script>`/`<link>` that the browser verifies before executing.

**SSE** — Server-Sent Events. One-way HTTP streaming from server to client. See [Part 9 ch. 7](./09-rest-and-networking/07-realtime.md).

**SSR** — Server-Side Rendering. Initial HTML rendered on the server.

**SSRF** — Server-Side Request Forgery. Attacker makes the server fetch a URL on their behalf, often to internal infra. See [Part 11 ch. 5](./11-security-and-privacy/05-other-attacks.md).

**SSM Parameter Store** — AWS configuration store; cheaper than Secrets Manager for non-secret config. See [Part 12 ch. 10](./12-aws/10-secrets-ssm.md).

**Suspense** — React feature for declaratively waiting for async resources. See [Part 3 ch. 3](./03-react/03-suspense-concurrent.md).

## T

**TanStack Query** — Server-state management library (formerly React Query). The standard for fetch + cache + invalidate.

**TLS 1.3** — Modern transport encryption; one round-trip handshake. See [Part 9 ch. 6](./09-rest-and-networking/06-http-and-tls.md).

**Tiptap** — Editor framework on top of ProseMirror; popular Y.js binding for collaborative editing.

**tRPC** — TypeScript RPC framework; end-to-end types between client and server without code generation. See [Part 9 ch. 8](./09-rest-and-networking/08-graphql-trpc.md).

**TTFB** — Time to First Byte. Network metric; included in Core Web Vitals indirectly via LCP.

## V

**Virtualization** — Rendering only the items currently visible in a long list (TanStack Virtual, react-virtuoso). See [Part 7 ch. 1](./07-production-concerns/01-performance.md).

## W

**WAF** — Web Application Firewall. Rule-based filtering at the edge (AWS WAF, Cloudflare). See [Part 12 ch. 3](./12-aws/03-cloudfront-route53.md).

**WCAG** — Web Content Accessibility Guidelines. WCAG 2.2 AA is the typical compliance target. See [Part 2 ch. 4](./02-foundations/04-accessibility.md).

**WebAuthn / Passkeys** — Public-key authentication via the user's device, replacing passwords. Phishing-resistant.

**WebSocket** — Bidirectional, persistent TCP connection over an HTTP upgrade. See [Part 9 ch. 7](./09-rest-and-networking/07-realtime.md).

**Web Worker** — Background JS thread; no DOM access. For CPU-heavy work that would block the main thread. See [Part 2 ch. 5](./02-foundations/05-browser-apis.md).

## X

**X-Ray** — AWS distributed tracing. See [Part 12 ch. 9](./12-aws/09-cloudwatch.md).

**XSS** — Cross-Site Scripting. Attacker-supplied script executes with your page's privileges. CSP + escaping defences. See [Part 11 ch. 2](./11-security-and-privacy/02-xss-csp.md).

**XState** — Library implementing statecharts in JavaScript. See [Part 6 ch. 3](./06-fe-architecture/03-state-machines.md).

## Y

**Y.js** — Popular CRDT library; the basis for many collaborative editors.

## Z

**Zod** — TypeScript-first schema validator; pervasive in this book's examples.

**Zoneless** — Angular running without Zone.js. Made viable by Signals; recommended for new apps.
