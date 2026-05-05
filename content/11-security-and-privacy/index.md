---
title: "Security & Privacy"
sidebar_label: "11. Security & Privacy"
description: "OWASP Top 10, browser security, and privacy/GDPR concerns for the modern frontend."
sidebar_position: 0
---

The previous part addressed authentication and authorization — the question of who is allowed to do what. This part addresses two related but distinct concerns. Security covers how the application is kept from being weaponised against its users by attackers seeking to exfiltrate credentials, impersonate sessions, abuse trust, or compromise the supply chain. Privacy covers what data is collected, why it is collected, how it is stored, and what rights the user retains over it.

Senior frontend engineers are expected to be fluent in the OWASP Top Ten with concrete examples, to implement Content Security Policy headers that actually block Cross-Site Scripting in production rather than only on paper, to distinguish Cross-Origin Resource Sharing, Cross-Site Request Forgery, and Content Security Policy without confusing the three, to understand supply-chain risk in the JavaScript package ecosystem along with lockfile hygiene practices, and to build cookie banners and consent flows that comply with the General Data Protection Regulation, the California Consumer Privacy Act, the Lei Geral de Proteção de Dados, and similar emerging regimes.

Every chapter in this part includes detailed answers to common interview questions, so the chapters double as deliberate-practice material.

## Chapters in this part

1. [OWASP Top 10 for the frontend](./01-owasp.md) — the ten current risks with concrete frontend examples and how each one looks on the wire.
2. [XSS & Content Security Policy](./02-xss-csp.md) — sanitisation, Trusted Types, and a Content Security Policy that actually blocks Cross-Site Scripting.
3. [CSRF & SameSite](./03-csrf.md) — token-based, double-submit, and origin-check defences against Cross-Site Request Forgery.
4. [CORS in detail](./04-cors.md) — preflight requests, credentials mode, and the common Cross-Origin Resource Sharing misconfigurations.
5. [SSRF, prototype pollution, supply chain](./05-other-attacks.md) — the attacks that move beyond the browser, including lockfile hygiene.
6. [Secrets, TLS, rate limiting](./06-secrets-tls-rate-limiting.md) — secret management, Transport Layer Security configuration, request throttling.
7. [Privacy, GDPR, consent management](./07-privacy-gdpr.md) — Personally Identifiable Information handling, consent banners, data subject rights.
