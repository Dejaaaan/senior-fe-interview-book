---
title: "Secrets Manager & SSM Parameter Store"
sidebar_label: "12.10 Secrets Manager & SSM Parameter Store"
description: "Where secrets and configuration live. The senior take on which to pick."
sidebar_position: 10
---

Two Amazon Web Services services exist for storing configuration and secrets: Secrets Manager and Systems Manager Parameter Store. The two services overlap in function but differ in pricing, features, and intended use cases. Senior engineers are expected to know the differences and to pick deliberately.

**Acronyms used in this chapter.** Amazon Web Services (AWS), Application Programming Interface (API), Cloud Development Kit (CDK), Customer Managed Key (CMK), Database (DB), Do It Yourself (DIY), Hypertext Transfer Protocol (HTTP), Identity and Access Management (IAM), JavaScript Object Notation (JSON), Key Management Service (KMS), Relational Database Service (RDS), Requests Per Second (RPS), Software Development Kit (SDK), Systems Manager (SSM).

## Quick comparison

| Feature | Secrets Manager | SSM Parameter Store |
| --- | --- | --- |
| Encryption | KMS by default | Optional (`SecureString` type) |
| Rotation | Built-in (Lambda-driven) | DIY |
| Cross-region replication | Native | DIY |
| Cost | $0.40/secret/month + $0.05/10k API calls | Free for Standard; $0.05/advanced/month |
| Max value size | 64 KB | 4 KB (Standard); 8 KB (Advanced) |
| Audit | CloudTrail + Manager-specific events | CloudTrail |
| Versioning | Yes | Yes (Advanced) |
| Use case | DB credentials, API keys | Config + non-sensitive params |

**Senior rule of thumb**: Secrets Manager for things that should be rotated (DB creds, API keys); Parameter Store for configuration (feature flag values, endpoints, non-sensitive constants).

## Secrets Manager

```ts
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient({});

const cached: { value?: string; ts?: number } = {};

export async function getSecret(name: string): Promise<string> {
  const now = Date.now();
  if (cached.value && now - (cached.ts ?? 0) < 5 * 60_000) return cached.value;

  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: name })
  );
  if (!SecretString) throw new Error("secret missing");

  cached.value = SecretString;
  cached.ts = now;
  return SecretString;
}
```

Cache for ~5 minutes to limit API calls (and cost).

### Auto-rotation

For RDS, Secrets Manager runs a Lambda that:

1. Creates a new password.
2. Updates the DB user.
3. Updates the secret.
4. Tests the new credential.

Configure once; never rotate manually again.

```ts
new Secret(stack, "DbCreds", {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: "app" }),
    generateStringKey: "password",
    excludePunctuation: true,
    passwordLength: 32,
  },
});
db.addRotationSingleUser({ automaticallyAfter: Duration.days(30) });
```

### Reading from Lambda

Two patterns:

1. **SDK call** at runtime, cached. Above.
2. **Lambda extension** (Secrets Manager and Parameter Store Extension): a side-car process exposes a localhost HTTP cache; the Lambda fetches via `localhost:2773`. Lower per-invocation cost; first-invocation latency.

## Parameter Store

```ts
import { SSMClient, GetParameterCommand, GetParametersCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

export async function getParameter(name: string, decrypt = false) {
  const r = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }));
  return r.Parameter?.Value;
}
```

### Hierarchy

Parameters can be organised in a hierarchy:

```text
/myapp/prod/db/host
/myapp/prod/db/port
/myapp/prod/feature-flags/new-checkout
/myapp/staging/db/host
```

Fetch all under a prefix:

```ts
import { GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const r = await ssm.send(
  new GetParametersByPathCommand({
    Path: "/myapp/prod/",
    Recursive: true,
    WithDecryption: true,
  })
);

const params = Object.fromEntries((r.Parameters ?? []).map((p) => [p.Name!, p.Value!]));
```

This is the "load all my config at boot" pattern.

### Parameter types

- `String`: plain.
- `StringList`: comma-separated, accessed as a list.
- `SecureString`: encrypted with a KMS key.

## App-level config patterns

### Pattern A: Env vars from CDK

Read SSM/Secrets Manager during `cdk synth`/`cdk deploy`:

```ts
new NodejsFunction(stack, "Fn", {
  environment: {
    DB_URL: StringParameter.valueForStringParameter(stack, "/myapp/prod/db/url"),
  },
});
```

Pro: zero runtime calls, simplest. Con: requires re-deploy to change.

### Pattern B: Runtime fetch with caching

The function reads the secret on cold start (or first use), caches in memory.

Pro: rotates without re-deploy. Con: first request pays the latency.

### Pattern C: Lambda extension

The extension polls Parameter Store / Secrets Manager and serves cached values via HTTP localhost.

Pro: sub-ms reads after warm-up; no SDK init in your function code. Con: another moving part.

### Pattern D: AppConfig (the senior FF/config service)

AWS AppConfig is the third option, designed for **dynamic, validated** application configuration with safe rollouts:

- Validators (JSON schema or Lambda).
- Deployment strategies (linear, canary).
- Automatic rollback on alarm.

Use AppConfig for feature flags / runtime config; Parameter Store for static config; Secrets Manager for credentials.

## KMS — the encryption substrate

Both Secrets Manager and SSM SecureString use AWS KMS. Best practice:

- Use a **customer-managed key** (CMK) per environment. AWS-managed default keys are simpler but you can't audit access.
- Grant decrypt permission to specific roles only (least privilege).
- Enable KMS key rotation (yearly).

```json
{
  "Effect": "Allow",
  "Action": "kms:Decrypt",
  "Resource": "arn:aws:kms:eu-west-1:123:key/abc-...",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.eu-west-1.amazonaws.com"
    }
  }
}
```

Only allow KMS decrypt when going through Secrets Manager — prevents direct ciphertext fetch + decrypt sneaking past the Secrets Manager audit log.

## Common bugs

- **Lambda IAM doesn't have `secretsmanager:GetSecretValue`**: 403. Common on first deploy.
- **Reading a SecureString without `WithDecryption: true`**: returns the ciphertext.
- **Cold-start latency**: every cold start fetches the secret. Use the Lambda extension.
- **Rate limit**: Secrets Manager has API throttle (400 RPS). Cache.
- **Cost surprise**: Secrets Manager at $0.40/secret + per-call adds up if you have 100 secrets and aggressive caching is off.

## Key takeaways

The senior framing for storing secrets and configuration on Amazon Web Services: Secrets Manager for secrets that should be rotated; Systems Manager Parameter Store for static configuration; AppConfig for dynamic and validated configuration including feature flags. Use a Customer Managed Key in Key Management Service per environment. Cache reads in the Lambda or use the Lambda extension to amortise the read across invocations. Apply Identity and Access Management least privilege on `secretsmanager:GetSecretValue` and `kms:Decrypt`.

## Common interview questions

1. Secrets Manager vs SSM Parameter Store — when each?
2. How do you rotate a database password automatically?
3. What is a customer-managed KMS key and why prefer it?
4. How do you read config in a Lambda without paying SSM API on every invocation?
5. What is AWS AppConfig and how does it differ from the other two?

## Answers

### 1. Secrets Manager vs SSM Parameter Store — when each?

Secrets Manager is the right choice for values that should be rotated automatically — database credentials, third-party Application Programming Interface keys, OAuth client secrets. The service has built-in Lambda-driven rotation for Relational Database Service credentials and an extensible rotation mechanism for arbitrary secrets, plus native cross-region replication and richer auditing through service-specific events. The cost is $0.40 per secret per month plus per-Application Programming Interface-call charges; for a small set of secrets, this is negligible.

Systems Manager Parameter Store is the right choice for configuration values — feature flag toggles, endpoint Uniform Resource Locators, non-sensitive constants. The Standard tier is free for normal use (up to ten thousand parameters at four kilobytes each); the Advanced tier supports eight-kilobyte values, parameter policies, and higher request rates for $0.05 per parameter per month. Parameter Store also supports `SecureString` for encrypted values when the team wants encryption without paying for full Secrets Manager features.

```text
Secrets Manager  — Rotated credentials, expensive, audited.
Parameter Store  — Static config, cheap, simple.
```

**Trade-offs / when this fails.** A large number of small secrets in Secrets Manager becomes expensive at scale (a hundred secrets is forty dollars a month before Application Programming Interface calls); Parameter Store is the better fit when there are many low-sensitivity values. Conversely, using Parameter Store for credentials means the team builds rotation themselves, which is operationally heavier than Secrets Manager's built-in rotation.

### 2. How do you rotate a database password automatically?

For Relational Database Service, Secrets Manager has built-in rotation that runs a Lambda function on a schedule. The Lambda creates a new password, updates the database user, updates the secret, tests the new credential, and switches over. The application reads the secret on each cold start (or on each request, with caching) and gets the current password without re-deploying.

```ts
new Secret(stack, "DbCreds", {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: "app" }),
    generateStringKey: "password",
    excludePunctuation: true,
    passwordLength: 32,
  },
});
db.addRotationSingleUser({ automaticallyAfter: Duration.days(30) });
```

For other targets (third-party Application Programming Interfaces, internal services), the team writes a custom rotation Lambda that knows how to update the credential at the issuing service. The senior pattern is rotation every thirty to ninety days for sensitive credentials, with the application caching the credential for five minutes and re-reading on cache miss to pick up rotations.

**Trade-offs / when this fails.** Single-user rotation has a brief window during which old and new credentials may both be in flight; for zero-downtime rotation, use the two-user pattern (alternate between two users on a schedule). Rotation Lambda failures must be alarmed because a stuck rotation produces a stale credential that may eventually expire.

### 3. What is a customer-managed KMS key and why prefer it?

Key Management Service supports two kinds of keys: Amazon-Web-Services-managed keys (created automatically when a service first uses encryption, owned by Amazon Web Services, free) and Customer Managed Keys (created by the customer, owned by the customer, $1 per month per key plus per-request charges). The default is Amazon-Web-Services-managed keys, but the senior practice is Customer Managed Keys per environment for any production data.

The reasons: Customer Managed Keys can have explicit Identity and Access Management policies attached, granting decrypt permission only to specific roles; Amazon-Web-Services-managed keys cannot be tightly scoped. Customer Managed Keys can have rotation enabled (yearly automatic rotation of the key material). Customer Managed Keys can be deleted (with a waiting period) to make encrypted data unrecoverable, which is the structural defence against subpoenas in some jurisdictions. Customer Managed Keys produce CloudTrail events for every decrypt call, which is the audit trail Amazon-Web-Services-managed keys do not provide.

```json
{
  "Effect": "Allow",
  "Action": "kms:Decrypt",
  "Resource": "arn:aws:kms:eu-west-1:123:key/abc-...",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "secretsmanager.eu-west-1.amazonaws.com"
    }
  }
}
```

The condition restricts decrypt to requests routed through Secrets Manager, preventing a direct ciphertext fetch followed by a decrypt that would bypass the Secrets Manager audit log.

**Trade-offs / when this fails.** Customer Managed Keys cost a small monthly fee per key (one dollar per key per month at typical pricing) plus per-decrypt costs; for accounts with many keys, this adds up. The benefits — audit, scoped access, controlled rotation — are worth the cost for production workloads.

### 4. How do you read config in a Lambda without paying SSM API on every invocation?

Three patterns. The first is to read the configuration once on cold start and cache it in module-top-level state; subsequent warm invocations reuse the cached value without an Application Programming Interface call. This is the simplest pattern.

```ts
const cached: { value?: string; ts?: number } = {};
export async function getSecret(name: string): Promise<string> {
  const now = Date.now();
  if (cached.value && now - (cached.ts ?? 0) < 5 * 60_000) return cached.value;
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  cached.value = SecretString!;
  cached.ts = now;
  return SecretString!;
}
```

The second is the Lambda extension (Secrets Manager and Parameter Store Extension), which runs a side-car process that polls the upstream service and exposes a localhost Hypertext Transfer Protocol cache; the Lambda fetches via `localhost:2773`. The benefit is sub-millisecond reads after warm-up and no Software Development Kit initialisation in the function code.

The third is to bake the configuration into the Lambda environment variables at deploy time using the Cloud Development Kit or Terraform, reading Parameter Store at synthesis. This eliminates runtime reads entirely but requires a re-deploy to change.

**Trade-offs / when this fails.** Caching for too long makes secret rotation appear stale to the application; a five-minute cache plus rotation on a longer cadence is the conservative default. The Lambda extension adds operational complexity (another moving part to monitor) but is the right choice for high-traffic functions where the per-invocation cost matters.

### 5. What is AWS AppConfig and how does it differ from the other two?

AWS AppConfig is a third configuration service designed for dynamic, validated application configuration with safe rollouts. It treats configuration as a deployable artifact: the team defines a configuration profile, validators (JSON Schema or Lambda functions that verify the configuration is well-formed), and a deployment strategy (linear over time, canary to a subset, all-at-once). The application polls AppConfig for the current configuration, and AppConfig serves the active version for the deployment stage.

The key features that distinguish AppConfig from Secrets Manager and Parameter Store: validators run before deployment, catching syntactically invalid configuration before it reaches production; deployment strategies enable safe rollouts ("ten percent of traffic for ten minutes, then twenty percent, then full rollout"); CloudWatch Alarm integration triggers automatic rollback if metrics degrade during deployment; and the configuration is versioned with full history.

```text
AppConfig         — Dynamic config, validated, safe deployments, feature flags.
Secrets Manager   — Rotated credentials, audited, expensive.
Parameter Store   — Static config, cheap, simple.
```

The senior pattern for feature flags and dynamic configuration uses AppConfig, sometimes alongside a dedicated feature-flag service such as LaunchDarkly or Unleash for richer targeting. Parameter Store is for static configuration the application reads at boot. Secrets Manager is for credentials.

**Trade-offs / when this fails.** AppConfig's deployment model is a higher-overhead pattern than Parameter Store's "set the value and it takes effect immediately" — it is appropriate for configuration that must be rolled out carefully, less appropriate for trivial knobs the team adjusts frequently. The validator step is valuable for any configuration that the application parses (a malformed JavaScript Object Notation document deployed to production crashes the application; the validator catches it).

## Further reading

- [Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html).
- [AWS AppConfig](https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html).
- [AWS Lambda Powertools — Parameters](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/parameters/).
