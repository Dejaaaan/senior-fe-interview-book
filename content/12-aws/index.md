---
title: "AWS for Frontend Engineers"
sidebar_label: "12. AWS for Frontend Engineers"
description: "The core Amazon Web Services every senior frontend developer is expected to know."
sidebar_position: 0
---

A senior frontend developer in 2026 does not need to be an Amazon Web Services Solutions Architect, but is expected to read and write Identity and Access Management policies; deploy a static site to Simple Storage Service plus CloudFront; wire up a Lambda function behind Application Programming Interface Gateway; pick the right primitive for a use case (DynamoDB vs Relational Database Service, Simple Queue Service vs Simple Notification Service vs EventBridge); know what Cognito does and when it is not the right tool; reason about CloudWatch logs, metrics, and alarms; and use Secrets Manager and Systems Manager Parameter Store correctly.

This part covers the core services through that lens. The intent is not exhaustive coverage of Amazon Web Services — those services would each fill a book of their own — but rather the parts of Amazon Web Services that a frontend lead is expected to own and to defend in design review.

Each chapter ends with a "Common interview questions" section followed by an "Answers" section providing detailed model responses, mirroring the depth a senior candidate is expected to demonstrate when discussing infrastructure decisions.

## Chapters in this part

1. [IAM mental model](./01-iam.md) — principals, policies, roles, trust, least privilege, permission boundaries, OpenID Connect federation.
2. [S3 & static hosting](./02-s3.md) — static sites, presigned URLs, storage classes, versioning, Block Public Access.
3. [CloudFront, Route 53, ACM](./03-cloudfront-route53.md) — CDN distributions, Origin Access Control, DNS, TLS certificates.
4. [Lambda](./04-lambda.md) — cold starts, memory and CPU, bundling with esbuild, concurrency, Web Adapter, Function URLs.
5. [API Gateway](./05-api-gateway.md) — HTTP API vs REST API, integrations, authorizers, throttling, caching, usage plans.
6. [DynamoDB](./06-dynamodb.md) — single-table design, primary and sort keys, GSIs, query vs scan, capacity modes, transactions.
7. [Cognito](./07-cognito.md) — User Pools vs Identity Pools, the Hosted UI, JWT validation, Lambda triggers.
8. [Messaging: SQS, SNS, EventBridge, SES](./08-messaging.md) — picking the right primitive for each integration pattern.
9. [CloudWatch & X-Ray](./09-cloudwatch.md) — Logs, Metrics, Alarms, Embedded Metric Format, distributed tracing.
10. [Secrets Manager & SSM Parameter Store](./10-secrets-ssm.md) — when to pick which and how to consume each safely.
11. [End-to-end: Next.js + API + DynamoDB on AWS](./11-end-to-end.md) — a deployable reference architecture wiring the previous chapters together.
