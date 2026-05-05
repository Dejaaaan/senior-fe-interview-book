---
title: "Privacy, GDPR, consent management"
sidebar_label: "11.7 Privacy, GDPR, consent management"
description: "General Data Protection Regulation essentials, cookie banners that actually comply, Personally Identifiable Information handling on the frontend, and analytics done responsibly."
sidebar_position: 7
---

In 2026, the framing "I am just a frontend developer" does not exempt the team from privacy law. The cookie banner, the analytics Software Development Kit, the third-party script — those are engineering decisions, and getting them wrong results in regulatory fines for the company and reputational damage that long outlives any individual incident.

This chapter is not legal advice. The senior expectation is to know enough to ask the right questions, design defaults that do not create liability, and build the user-rights endpoints that the regulation requires.

**Acronyms used in this chapter.** Application Programming Interface (API), Brazilian General Data Protection Law (LGPD), California Consumer Privacy Act (CCPA), Children's Online Privacy Protection Act (COPPA), Consent Management Platform (CMP), Cross-Site Request Forgery (CSRF), Customer Relationship Management (CRM), Data Privacy Framework (DPF), Data Processing Agreement (DPA), European Union (EU), General Data Protection Regulation (GDPR), Google Analytics 4 (GA4), Google Tag Manager (GTM), Internet Protocol (IP), JavaScript (JS), Personally Identifiable Information (PII), Protection of Personal Information Act (POPIA), Standard Contractual Clauses (SCCs), Software Development Kit (SDK), Uniform Resource Locator (URL), United Kingdom (UK), United States (US), User Experience (UX).

## GDPR — the essentials

The European Union General Data Protection Regulation is the strictest baseline currently in widespread enforcement; many other regimes (United Kingdom General Data Protection Regulation, California Consumer Privacy Act, Brazilian General Data Protection Law, Protection of Personal Information Act) pattern themselves after it. Designing for the General Data Protection Regulation typically yields compliance with the others, with regional adjustments.

The six principles: lawfulness, fairness, and transparency (a legal basis exists and the user is informed); purpose limitation (data is collected for a specific purpose and cannot be silently repurposed); data minimisation (only what is necessary is collected); accuracy (the user can correct inaccurate data); storage limitation (data is deleted when no longer needed); and integrity and confidentiality (the data is secured against unauthorised access). Plus accountability — the organisation can prove it followed the principles.

### Lawful bases (exactly one is required for each processing activity)

Consent must be freely given, specific, informed, unambiguous, and withdrawable; the user actively agrees rather than failing to opt out. Contract is the basis for processing necessary to fulfil a contract with the user (a shipping address for an order). Legal obligation covers tax records, fraud prevention, and other regulatory requirements. Vital interests covers life-or-death emergencies. Public task covers government and public-authority work. Legitimate interests covers the controller's own interests, balanced against the user's rights — a low bar but not "anything goes"; the controller must perform and document a balancing test.

For analytics and marketing, consent is almost always required. Legitimate interest does not generally cover behavioural tracking for advertising purposes.

### User rights

The General Data Protection Regulation grants the data subject several rights: access ("what do you have on me?"), rectification (correct inaccurate data), erasure ("right to be forgotten" — delete the data), restriction (pause processing), portability (export in a machine-readable format), object (opt out of processing for direct marketing), and a right not to be subject to solely automated decisions with legal effect. Senior engineers are responsible for building the endpoints that fulfil these requests; "delete me" must actually delete (or pseudonymise) across every system, not just hide the row in the production database.

## PII — what counts?

Personally Identifiable Information includes direct identifiers (name, email, government identification number, address) and indirect identifiers (Internet Protocol address, device identifier, cookies, behavioural patterns that can be combined to identify someone). Sensitive Personally Identifiable Information (special category, Article 9 General Data Protection Regulation) includes health data, race, sexual orientation, political views, biometrics, and genetic data; explicit consent and tighter handling are required for this category, and many uses are prohibited outright.

## Frontend implications

### Cookie banners

The term "banner" is misleading. The user must be able to reject all non-essential cookies as easily as they accept (no dark patterns such as a prominent "Accept All" button next to a hidden "Manage Preferences" link); make granular choices (analytics yes, marketing no); and withdraw consent later (re-open settings from a persistent footer link). The technical attributes `SameSite`, `HttpOnly`, and `Secure` are about cookie security; the consent banner is about user choice and is a separate concern.

What is "essential" — the cookies that do not require consent — is generally limited to authentication session cookies, Cross-Site Request Forgery tokens, load balancer affinity cookies, and the cookie-consent cookie itself. What is not essential includes Google Analytics, Mixpanel, Amplitude, Meta and Google Ads pixels, Hotjar and FullStory session replay, Application/Behaviour testing tools, and most third-party fonts and scripts that profile users. The senior pattern is to default to "no" for each non-essential category and to require an active opt-in.

Ship a Consent Management Platform: OneTrust, Cookiebot, Iubenda, or open-source alternatives such as [Klaro](https://github.com/kiprotect/klaro). They handle the User Experience, the storage of consent state, and the audit trail that proves consent was obtained.

### The "load on consent" pattern

Do not load analytics scripts in `<head>` and rely on the Consent Management Platform to "block them later"; by the time the platform initialises, the page has already pinged the analytics server, and the data has already been collected. The correct pattern is to load the script only after consent is granted:

```ts
window.consent = {
  analytics: false,
  marketing: false,
};

window.addEventListener("consent:granted", (e) => {
  if (e.detail.analytics && !window.gtag) {
    const s = document.createElement("script");
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXX";
    document.head.appendChild(s);
  }
});
```

Analytics loads only after consent. The same pattern applies to every non-essential script.

### IP addresses

In the European Union, the Internet Protocol address is Personally Identifiable Information because it is an identifier that can be linked to an individual through subscriber records. Common mitigations: anonymise by dropping the last octet (`192.168.1.0`); hash with a salt (`SHA-256(IP + salt)`) so the value can be used for deduplication without retaining the original; or do not log it at all unless necessary for security or audit purposes.

### Server-side tagging

The trend in 2026 is to move analytics from client to server. The application's server forwards events to Google Analytics 4 or Mixpanel rather than the browser doing so directly. The benefits: the server can strip Personally Identifiable Information before forwarding, apply consent rules centrally, and avoid third-party cookies entirely (the analytics provider sees only requests from the application's own server). Tools include Google Tag Manager Server-Side, [Stape](https://stape.io/), and self-hosted alternatives such as Plausible and Umami.

### Session replay (FullStory, LogRocket, Hotjar)

Session replay tools record user sessions for debugging and User Experience analysis. They are a privacy minefield: passwords, credit cards, and internal data are all captured by default. Mandatory mitigations: mask all input fields (`data-private` or library-specific attributes); block sensitive pages entirely (`/account`, `/billing`); document what is captured in the privacy notice; and honour consent (do not record at all without it). The default configuration of the tool is almost never compliant; explicit configuration is required.

### PII in the URL

Personally Identifiable Information in the Uniform Resource Locator leaks into many places: the browser history, server access logs, `Referer` headers (sent to the next page's origin), analytics tools, and Sentry breadcrumbs. The pattern:

```text
/users/john.doe@example.com/orders
/reset-password?token=secret-token-here&email=user@example.com
```

The mitigation is to use opaque identifiers in Uniform Resource Locators and pass tokens as `POST` bodies rather than query strings. The application controls the mapping from opaque identifier to user record server-side.

## Data subject access / deletion endpoints

Build these as proper Application Programming Interface endpoints, not "email us and someone will handle it manually". The senior expectation:

```text
GET    /me/export               # download all data as JSON
DELETE /me                      # request deletion
```

Implementation challenges include identifying every system that holds the user's data (the production database, the analytics warehouse, the support tool, the Customer Relationship Management system, the billing system); choosing between soft delete and hard delete (most systems soft-delete, but the General Data Protection Regulation generally requires hard-delete or full pseudonymisation); reconciling legal-hold conflicts (if transaction records must be kept for seven years for tax purposes, pseudonymise the personal fields and keep the financial fields); and handling backups (if backups contain the data, they are in scope; document the rotation schedule and the policy for purging deleted data from older backups).

Use a workflow engine (Temporal, Step Functions) for the deletion orchestration so the process is reliable, auditable, and resumable when an individual subsystem temporarily fails.

## Data Processing Agreement (DPA) and Sub-Processors

Every third party that processes user data on the application's behalf needs a Data Processing Agreement. List them publicly (often at `/legal/sub-processors`):

| Sub-processor | Purpose | Region |
| --- | --- | --- |
| AWS | Hosting | eu-west-1 |
| Stripe | Payments | EU |
| SendGrid | Transactional email | US (Data Privacy Framework) |
| Sentry | Error monitoring | EU instance |

When picking Software Development Kits, ask: does the vendor have a European Union data residency option? Is there a Data Processing Agreement available? Is the data handled under Standard Contractual Clauses if it leaves the European Union? The answers are not always obvious from marketing pages and may require a sales conversation.

## Data residency

Some customers (or regulations) require data to stay in a specific region (European Union, United Kingdom, India, and others). Architect for it from day one: region-pinned databases (Aurora Global Database, DynamoDB Global Tables with region-restricted writes); region-routed Application Programming Interfaces (CloudFront with origin failover, regional Application Programming Interface endpoints); region-aware logging and monitoring. Retrofitting residency onto a global system is brutal — every assumption that "all data lives in one region" must be unwound — so design for it.

## Logging and PII

Do not log: passwords (for obvious reasons); full credit card numbers; `Authorization` headers; full request bodies on authentication endpoints. Use redaction in the logger:

```ts
import pino from "pino";

const logger = pino({
  redact: {
    paths: ["req.headers.authorization", "req.body.password", "*.creditCard"],
    censor: "[REDACTED]",
  },
});
```

For Sentry, configure scrubbing and use `beforeSend` to drop sensitive fields before the event leaves the application. The same discipline applies to any error or analytics service that ingests data from the frontend.

## Marketing emails / unsubscribe

If the application sends marketing email, it needs unambiguous opt-in (a pre-checked "subscribe to newsletter" checkbox is illegal in the European Union); one-click unsubscribe per RFC 8058 (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`); and the team must honour unsubscribes within ten business days under the Controlling the Assault of Non-Solicited Pornography And Marketing Act (CAN-SPAM Act) — immediately is the sane choice and matches user expectations.

## Children's data (COPPA / GDPR-K)

If the product might be used by users under thirteen years of age in the United States or under sixteen in the European Union (the exact age varies by member state), parental consent and stricter handling are required. Most business-to-consumer products dodge this requirement with an age gate at signup ("Must be 16+"); products that legitimately serve younger users must implement the parental-consent flow and verifiable parental authorisation.

## Senior framing in interviews

"Privacy by design" is a principle, not a one-time audit; new features include "what data are we collecting, why, where does it live, when do we delete it" as story acceptance criteria. The consent User Experience is a product concern, not solely a legal one — do not employ dark patterns, because regulators have begun fining for them specifically. Engineering builds the user-rights endpoints; product and customer success should not be hand-deleting users from spreadsheets. Sub-processors are documented and reviewed in security review. Region residency is an architecture decision, not a configuration flag flipped late.

## Key takeaways

The General Data Protection Regulation's six principles, lawful bases, and user rights are the headlines every senior engineer should know. Consent must be free, specific, informed, and withdrawable; reject must be as easy as accept. Do not load tracking scripts before consent. Internet Protocol addresses are Personally Identifiable Information in the European Union; anonymise. Session replay tools require masking and consent. Build data export and delete endpoints rather than relying on manual processes. Plan data residency early; retrofitting is brutal. Redact Personally Identifiable Information in logs and error reports.

## Common interview questions

1. What is the GDPR's lawful basis for analytics, typically?
2. Why is "reject all" needing more clicks than "accept all" non-compliant?
3. What does "right to erasure" mean for your system architecture?
4. Where would you mask PII in a logging pipeline?
5. What is a sub-processor and why does the customer care?

## Answers

### 1. What is the GDPR's lawful basis for analytics, typically?

The lawful basis for analytics is almost always consent, freely given and specific to the analytics purpose. Legitimate interest does not generally cover behavioural tracking for analytics or advertising — the controller must run the balancing test, and the test rarely concludes that the controller's interest in tracking outweighs the user's interest in not being tracked, especially given that analytics is non-essential to the service the user came for. The European Data Protection Board has been explicit on this point, and several national regulators have fined organisations that relied on legitimate interest for analytics without a defensible balancing test.

The practical implication is that analytics scripts must not load before the user actively consents, and the consent must be specific to analytics (a single "Accept all cookies" that bundles essential, analytics, and marketing into one click is not specific). Server-side analytics that strip Personally Identifiable Information before forwarding may operate under legitimate interest in some configurations, but the safer default remains consent.

**Trade-offs / when this fails.** Consent rates are low (often below twenty-five percent in regions with prominent banners), which means the analytics population is biased — the users who consent are not representative. Server-side analytics with aggressive Personally Identifiable Information stripping is one path forward; another is to accept the lower coverage and design analytics around aggregate trends rather than per-user behaviour.

### 2. Why is "reject all" needing more clicks than "accept all" non-compliant?

The General Data Protection Regulation requires that consent be freely given, and the European Data Protection Board's guidance explicitly states that consent is not freely given if rejecting is more burdensome than accepting. A prominent "Accept All" button next to a "Manage Preferences" link that opens a multi-tab dialogue and requires several clicks to reject is a dark pattern; the user experiences friction designed to nudge them toward acceptance, and several national regulators have fined organisations specifically for this design.

The compliant pattern is "Accept All" and "Reject All" as equally prominent buttons, with "Manage Preferences" as a third option for users who want granular control. The reject must be one click, not buried.

```html
<button class="primary">Accept All</button>
<button class="primary">Reject All</button>
<button class="secondary">Manage Preferences</button>
```

**Trade-offs / when this fails.** Compliance is sometimes in tension with business metrics that incentivise consent rates; the senior position is that the regulatory and reputational risk of a fine outweighs the analytics signal lost to lower consent. The team should treat consent as a product surface and design it to be honest rather than manipulative.

### 3. What does "right to erasure" mean for your system architecture?

The right to erasure (Article 17, "right to be forgotten") requires that the controller delete the user's personal data without undue delay when the user requests it (subject to limited exceptions for legal obligation, freedom of expression, and similar). Architecturally, this means the application must be able to enumerate every system that holds the user's data and delete or pseudonymise it across all of them — the production database, the analytics warehouse, the support tool, the Customer Relationship Management system, the billing system, log retention, and backups.

```text
DELETE /me
  -> trigger workflow:
     - mark user.deleted_at in primary DB
     - enqueue tasks: scrub analytics warehouse, scrub support tool, scrub CRM
     - schedule backup-retention purge
     - confirm completion to user via email
```

The senior pattern uses a workflow engine (Temporal, Step Functions) to orchestrate the deletion across subsystems, retrying transient failures and producing an audit trail of what was deleted when. Soft delete is rarely sufficient on its own; the General Data Protection Regulation generally requires either hard delete or pseudonymisation that breaks the link between the data and the individual.

**Trade-offs / when this fails.** Legal-hold conflicts are common — tax law may require seven-year retention of transaction records, which pseudonymisation can satisfy by stripping the personal fields and retaining only the financial fields. Backups are in scope; the team must document the rotation schedule and the policy for purging deleted data from older backups (typically the next backup cycle that occurs after the deletion request).

### 4. Where would you mask PII in a logging pipeline?

Mask Personally Identifiable Information at the source — in the logger configuration — so the sensitive value never reaches the log shipper, the storage backend, or any downstream system. The senior framing: by the time a log line has been written to disk or sent over the network, the unredacted value has already escaped, and any downstream redaction is a partial mitigation rather than a complete defence.

```ts
const logger = pino({
  redact: {
    paths: ["req.headers.authorization", "req.body.password", "*.creditCard"],
    censor: "[REDACTED]",
  },
});
```

For error tracking, configure Sentry's `beforeSend` and `beforeBreadcrumb` callbacks to drop or redact sensitive fields before the event leaves the application. For session replay, configure the masking rules so input fields and sensitive Document Object Model regions are blocked from capture. For analytics, the server-side pattern allows central enforcement of redaction rules.

**Trade-offs / when this fails.** Masking is only as good as the configured paths. New fields that contain sensitive data are not automatically masked; the team must update the configuration when adding fields. A periodic audit of log samples is the structural defence — review what the logging pipeline actually captures, not what the configuration claims to mask.

### 5. What is a sub-processor and why does the customer care?

A sub-processor is a third party that processes the customer's data on the application's behalf — the cloud hosting provider, the email delivery service, the error monitoring service, the analytics service. Under the General Data Protection Regulation, the application (the controller) is responsible for the processing performed by sub-processors, and the customer needs to know who handles their data and where because the customer has their own compliance obligations to their end users.

```text
| Sub-processor | Purpose             | Region                        |
| AWS           | Hosting             | eu-west-1                     |
| Stripe        | Payments            | EU                            |
| SendGrid      | Transactional email | US (Data Privacy Framework)   |
| Sentry        | Error monitoring    | EU instance                   |
```

A public sub-processor list (often at `/legal/sub-processors`) and a Data Processing Agreement template are standard requirements for selling to enterprise customers in the European Union. The customer cares because changing sub-processors typically requires their own internal review, and a sub-processor in a region without an adequacy decision (currently a small set) requires Standard Contractual Clauses or other safeguards.

**Trade-offs / when this fails.** Adding a new sub-processor often requires customer notification with a notice period (typically thirty days), during which the customer can object. The team should plan sub-processor changes ahead of time and bundle multiple changes into one notice rather than issuing many small notices that wear out customer attention.

## Further reading

- [GDPR full text](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- [ICO Cookie guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/).
- [Privacy by Design (Cavoukian)](https://www.ipc.on.ca/wp-content/uploads/Resources/7foundationalprinciples.pdf).
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/).
