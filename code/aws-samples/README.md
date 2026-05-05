# aws-samples

CDK + Lambda code for the [AWS for Frontend Engineers](../../content/12-aws/) part of the book.

## What's here

- `cdk/` — two stacks: `TasksData` (DynamoDB single-table + Cognito User Pool) and `TasksApi` (HTTP API + Lambda).
- `api/src/` — the Tasks API Lambda handler + DynamoDB repository.

## Deploy

Bootstrap once per account/region:

```bash
pnpm install --frozen-lockfile
pnpm exec cdk bootstrap
```

Synth & deploy:

```bash
pnpm exec cdk synth
pnpm exec cdk deploy --all
```

## Tear down

```bash
pnpm exec cdk destroy --all
```

(The DynamoDB table and Cognito User Pool have `RemovalPolicy.RETAIN` and won't be deleted automatically — drop them via the AWS console if you really want to.)

## Notes

- IaC for the Next.js web stack lives outside this package (use OpenNext + CDK or Vercel).
- For production, layer in WAF on CloudFront and CloudWatch Alarms with SNS targets.
- See [End-to-end](../../content/12-aws/11-end-to-end.md) for the full architecture overview.
