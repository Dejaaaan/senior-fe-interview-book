---
title: "CloudWatch & X-Ray"
sidebar_label: "12.9 CloudWatch & X-Ray"
description: "Logs, metrics, alarms, and distributed tracing — the AWS-native observability stack."
sidebar_position: 9
---

CloudWatch and X-Ray are the Amazon-Web-Services-native observability stack. The native toolkit is functional and inexpensive; third-party offerings (Datadog, Honeycomb) provide better User Experience, but senior interviewers expect candidates to know the native tools because most production Amazon Web Services workloads use them at least as a baseline.

**Acronyms used in this chapter.** Amazon Web Services (AWS), Amazon Web Services Distro for OpenTelemetry (ADOT), Application Programming Interface (API), Cloud Development Kit (CDK), Central Processing Unit (CPU), DynamoDB (DDB), Elastic Compute Cloud (EC2), Elastic Container Service (ECS), Elastic Kubernetes Service (EKS), Embedded Metric Format (EMF), Hypertext Transfer Protocol (HTTP), JavaScript Object Notation (JSON), JavaScript (JS), OpenTelemetry (OTel), OpenTelemetry Protocol (OTLP), Real User Monitoring (RUM), Service Level Objective (SLO), Site Reliability Engineering (SRE), Simple Notification Service (SNS), Simple Queue Service (SQS), Uniform Resource Locator (URL).

## CloudWatch Logs

Every AWS service logs to CloudWatch Logs:

- Lambda: `console.log` writes to `/aws/lambda/<function-name>`.
- API Gateway: access logs and execution logs (configure both).
- ECS: container logs via `awslogs` driver.

### Log Groups & Streams

- **Log Group**: container; per-service or per-environment. Retention configurable (1 day to never; default never = expensive).
- **Log Stream**: append-only sequence within a group; one per Lambda container, one per ECS task, etc.

Set retention on every group. Default-forever logs are a recurring cost-creep source.

```ts
new LogGroup(stack, "ApiLogs", {
  retention: RetentionDays.ONE_MONTH,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

### Structured logging

Don't:

```ts
console.log("user " + userId + " did thing");
```

Do:

```ts
console.log(JSON.stringify({ level: "info", msg: "user did thing", userId, traceId }));
```

CloudWatch Logs Insights can query JSON natively:

```text
fields @timestamp, level, msg, userId
| filter level = "error" and userId = "usr_123"
| sort @timestamp desc
| limit 100
```

### Logs Insights

A purpose-built query language for ad-hoc log queries. Common patterns:

```text
# Lambda errors over time
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)

# Slow API requests
filter @type = "REPORT"
| stats max(@duration), avg(@duration), pct(@duration, 95) by bin(5m)
```

### CloudWatch Logs subscriptions

Stream logs in real-time to Lambda / Kinesis Firehose / OpenSearch. The pattern: ship to Datadog or self-hosted observability stack via Firehose.

## Metrics

CloudWatch Metrics is a time-series store. Built-in metrics for all AWS services. Custom metrics via API or "Embedded Metric Format" (EMF) in Lambda logs.

### EMF — write metrics from log lines

```ts
console.log(JSON.stringify({
  _aws: {
    Timestamp: Date.now(),
    CloudWatchMetrics: [
      {
        Namespace: "Shop/Orders",
        Dimensions: [["Region"]],
        Metrics: [
          { Name: "OrderTotal", Unit: "None" },
          { Name: "ProcessingTimeMs", Unit: "Milliseconds" },
        ],
      },
    ],
  },
  Region: "eu-west-1",
  OrderTotal: 49.99,
  ProcessingTimeMs: 245,
  orderId: "ord_123",
}));
```

CloudWatch parses these out of your Lambda's logs and stores them as metrics — no separate API call, no extra cost. The log line still contains the high-cardinality fields (`orderId`) for debugging.

### Dashboards

CloudWatch dashboards show metric graphs. Create one per service. Alternative (better): Grafana with the CloudWatch data source.

## Alarms

```ts
new Alarm(stack, "ApiHighErrorRate", {
  metric: api.metricError({ statistic: "Sum", period: Duration.minutes(5) }),
  threshold: 5,
  evaluationPeriods: 2,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
  alarmDescription: "5+ API errors in 5 minutes, twice in a row",
}).addAlarmAction(new SnsAction(opsTopic));
```

Senior practice: alert on **symptoms**, not causes. ("Error rate >0.5%" is a symptom; "CPU >80%" is a cause that may not matter to users.)

Multi-window, multi-burn-rate alerting (Google SRE workbook) for SLOs:

- "Burned 2% of monthly error budget in last hour" → page.
- "Burned 5% in last 6 hours" → ticket.

## X-Ray — distributed tracing

Generate trace IDs at the entry, propagate to every downstream service, sample, store, query.

### Enabling

```ts
new NodejsFunction(stack, "Fn", {
  ...,
  tracing: Tracing.ACTIVE,
});
```

In your code:

```ts
import { captureAWSv3Client } from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const ddb = captureAWSv3Client(new DynamoDBClient({}));
```

X-Ray now wraps every DDB call, recording latency. The trace shows the API request → Lambda → DDB chain end-to-end.

### Sampling

Default: 1 request per second + 5% of additional. Tune the `default-sampling-rule` for high-traffic prod.

### OpenTelemetry vs X-Ray

OTel is the open standard. AWS Distro for OpenTelemetry (ADOT) writes both X-Ray and any OTLP-compatible backend (Datadog, Honeycomb, Tempo).

In 2026 senior teams use OTel everywhere; X-Ray as one of the receivers. This makes "swap to Honeycomb" a config change, not a re-instrumentation.

## CloudWatch Synthetics & RUM

- **Synthetics**: scripted Playwright/Puppeteer canaries that hit your URLs every N minutes from AWS regions. Detects breakage before users do.
- **CloudWatch RUM**: Real User Monitoring snippet for browsers. Captures Core Web Vitals, JS errors, page loads. Comparable to Datadog RUM but cheaper.

```html
<script>
  (function (n, i, v, r, s, c, x, z) {
    x = window.AwsRumClient = { q: [], n: n, i: i, v: v, r: r, c: c };
    window[n] = function (c, p) { x.q.push({ c: c, p: p }); };
    z = document.createElement("script");
    z.async = true; z.src = s;
    document.head.insertBefore(z, document.head.getElementsByTagName("script")[0]);
  })(
    "cwr", "00000000-0000-0000-0000-000000000000",
    "1.0.0", "eu-west-1",
    "https://client.rum.us-east-1.amazonaws.com/1.x/cwr.js",
    { sessionSampleRate: 1, telemetries: ["performance", "errors", "http"], ... }
  );
</script>
```

## Cost watch

Native: AWS Cost Anomaly Detection sends alerts when a service's spend deviates. Set thresholds per environment.

CloudWatch metrics for cost: `AWS/Billing/EstimatedCharges` (us-east-1 only, despite global).

## CloudWatch Container Insights / Lambda Insights

For ECS/EKS: Container Insights gathers per-container CPU/mem/network. For Lambda: Lambda Insights captures memory utilisation, init duration. Both add a cost; turn on for production high-traffic services.

## Common bugs

- **CloudWatch retention "never"**: bills creep up forever. Set retention.
- **Logs subscription Lambda errored**: fix it; otherwise logs back up and CloudWatch returns errors to publishers.
- **No structured logging**: queries are full-text scans, slow and expensive.
- **Alerts on noisy thresholds**: page fatigue. Tune.
- **Custom metric pricing**: $0.30/metric/month adds up; prefer EMF for high-cardinality.

## Key takeaways

The senior framing for native observability: CloudWatch Logs with structured JSON and explicit retention; Embedded Metric Format for metrics emitted from log lines (one log line, one metric, no separate API call); alarms on symptoms with multi-burn-rate alerting for Service Level Objectives; X-Ray for Amazon-Web-Services-native distributed traces, OpenTelemetry for portability across vendors; CloudWatch Synthetics and Real User Monitoring for proactive synthetic and real-user monitoring.

## Common interview questions

1. How do you ship structured logs from a Lambda?
2. What is EMF and why use it?
3. Difference between symptom-based and cause-based alerts?
4. How do you trace a request across Lambda → DDB → SQS → another Lambda?
5. What is the cost trap with CloudWatch Logs?

## Answers

### 1. How do you ship structured logs from a Lambda?

The pattern is to emit JavaScript Object Notation log lines via `console.log` and rely on CloudWatch Logs to capture them; the Lambda runtime forwards `stdout` to CloudWatch automatically. Each log line is a single JavaScript Object Notation document with consistent fields (`level`, `msg`, `timestamp`, request identifiers, business identifiers).

```ts
console.log(JSON.stringify({
  level: "info",
  msg: "user did thing",
  userId,
  traceId: process.env._X_AMZN_TRACE_ID,
}));
```

CloudWatch Logs Insights can query the structured fields directly without parsing — `filter level = "error" and userId = "usr_123"` runs against the parsed JavaScript Object Notation. The benefit over plain text logging is substantial: queries are fast and accurate, dashboards can aggregate by field, and downstream tools (Datadog, Honeycomb) ingest the structure without further parsing.

**Trade-offs / when this fails.** Stringification is a per-invocation cost; for very high-volume functions, a logger that supports asynchronous serialisation (Pino, for example) is faster than `JSON.stringify` per line. Sensitive fields must be redacted at the source; do not rely on downstream redaction.

### 2. What is EMF and why use it?

Embedded Metric Format is a CloudWatch convention for emitting metrics inside structured log lines. Instead of calling the CloudWatch `PutMetricData` Application Programming Interface (which is rate-limited, slow, and incurs separate charges), the Lambda emits a JavaScript Object Notation log line containing a special `_aws.CloudWatchMetrics` block; CloudWatch parses the log lines and stores the named values as metrics, while the rest of the log line remains queryable for debugging.

```ts
console.log(JSON.stringify({
  _aws: {
    Timestamp: Date.now(),
    CloudWatchMetrics: [{
      Namespace: "Shop/Orders",
      Dimensions: [["Region"]],
      Metrics: [{ Name: "OrderTotal", Unit: "None" }],
    }],
  },
  Region: "eu-west-1",
  OrderTotal: 49.99,
  orderId: "ord_123",
}));
```

The benefits: the metric and the high-cardinality debugging fields (`orderId`) are emitted together; there is no separate Application Programming Interface call, so cold starts are unaffected; high-cardinality dimensions can be added without paying the per-metric custom-metric cost (CloudWatch metric pricing is per metric per month, while log-derived metrics cost only the log-ingestion fee).

**Trade-offs / when this fails.** Embedded Metric Format metrics appear in CloudWatch with a few seconds of delay (the log line must be ingested and parsed); for hard real-time decisions, the synchronous Application Programming Interface remains necessary. The format is verbose; a small library (`aws-embedded-metrics`) simplifies the emission.

### 3. Difference between symptom-based and cause-based alerts?

Symptom-based alerts fire on observable user impact: error rate above 0.5%, p95 latency above 1 second, Service Level Objective burn above the budget. Cause-based alerts fire on internal conditions that may or may not affect users: Central Processing Unit above 80%, memory above 90%, queue depth above 1,000.

The senior practice is to alert on symptoms and use causes as diagnostic data. Central Processing Unit at 90% is not a problem if requests are still completing in under 100 milliseconds; the symptom-based alert ensures the team is paged only when users are actually affected. Cause-based alerts produce page fatigue because they fire on conditions that are not actually problems (a transient Central Processing Unit spike, a queue depth that the consumer is about to drain).

```ts
// Symptom: API error rate
new Alarm(stack, "ApiHighErrorRate", {
  metric: api.metricError({ statistic: "Sum", period: Duration.minutes(5) }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: "5+ API errors in 5 minutes, twice in a row",
});
```

Multi-burn-rate alerting (Google Site Reliability Engineering workbook) is the senior pattern for Service Level Objective alerting: a fast burn ("burned 2% of monthly budget in the last hour") pages immediately; a slower burn ("burned 5% in the last six hours") creates a ticket. The thresholds are calibrated to catch real degradation without firing on transient spikes.

**Trade-offs / when this fails.** Symptom-based alerting requires that the team has defined what "user impact" means — the Service Level Objective itself. Without an Service Level Objective, the team falls back to cause-based alerting and the page fatigue that comes with it.

### 4. How do you trace a request across Lambda → DDB → SQS → another Lambda?

X-Ray (or OpenTelemetry, the more portable choice) generates a trace identifier at the entry point and propagates it through every downstream call. The trace identifier is carried in headers (Hypertext Transfer Protocol calls) or in message attributes (Simple Queue Service messages). Each service emits spans tagged with the trace identifier; X-Ray (or the chosen backend) reassembles the spans into a complete trace.

For the Lambda → DynamoDB call, wrap the Software Development Kit client with the X-Ray Software Development Kit so X-Ray records each DynamoDB call as a span:

```ts
import { captureAWSv3Client } from "aws-xray-sdk-core";
const ddb = captureAWSv3Client(new DynamoDBClient({}));
```

For the Lambda → Simple Queue Service → Lambda chain, the X-Ray trace identifier is automatically propagated as a Simple Queue Service message attribute, and the consuming Lambda's tracing picks it up. The end-to-end trace shows the original request, the DynamoDB call, the Simple Queue Service publish, and the consumer's processing of the message — all in one waterfall view.

**Trade-offs / when this fails.** The 1-request-per-second-plus-5%-of-additional default sampling is sufficient for most workloads; for high-traffic production, tune the sampling rule. OpenTelemetry is the open standard and provides vendor portability; Amazon Web Services Distro for OpenTelemetry can write to both X-Ray and OpenTelemetry Protocol-compatible backends (Datadog, Honeycomb, Tempo), so the team can swap backends without re-instrumenting.

### 5. What is the cost trap with CloudWatch Logs?

The default log retention is "Never expire". Every log line accumulates indefinitely, and the storage cost compounds month over month. A high-traffic Lambda can produce gigabytes of logs per day; over a year, the storage cost dominates the application's CloudWatch bill.

The fix is to set explicit retention on every log group at creation time:

```ts
new LogGroup(stack, "ApiLogs", {
  retention: RetentionDays.ONE_MONTH,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

The senior practice: thirty-day retention for application logs, ninety-day for audit logs that satisfy regulatory requirements (export to Simple Storage Service Glacier for longer-term retention if needed), and never log secrets or high-cardinality identifiers that bloat the storage. The custom metric pricing is the secondary trap — at $0.30 per metric per month, high-cardinality custom metrics add up; prefer Embedded Metric Format (log-derived) over `PutMetricData` for high-cardinality dimensions.

**Trade-offs / when this fails.** Auditing typically requires logs to be retained for a regulated period (typically one to seven years); use Simple Storage Service archive (much cheaper than CloudWatch Logs storage) for the long tail. CloudWatch Logs subscriptions can stream logs to Simple Storage Service via Kinesis Firehose for archival, then short retention on the CloudWatch side.

## Further reading

- [Embedded Metric Format spec](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html).
- [AWS Distro for OpenTelemetry](https://aws-otel.github.io/).
- [Google SRE Workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/).
