---
title: "API Gateway"
sidebar_label: "12.5 API Gateway"
description: "REST API vs HTTP API, integrations, authorizers, throttling, and the senior choice in 2026."
sidebar_position: 5
---

Application Programming Interface Gateway is the Hypertext Transfer Protocol front door for Lambda (and other backends). It comes in two flavours: REST API (the original, feature-rich, more expensive) and HTTP API (the modern, leaner, cheaper option).

**Acronyms used in this chapter.** Amazon Web Services (AWS), Amazon Web Services Certificate Manager (ACM), Application Programming Interface (API), Amazon Web Services Software Development Kit (AWS SDK), Application Load Balancer (ALB), Cloud Development Kit (CDK), Cross-Origin Resource Sharing (CORS), DynamoDB (DDB), Elastic Container Service (ECS), Hypertext Transfer Protocol (HTTP), Hypertext Transfer Protocol Secure (HTTPS), Identity and Access Management (IAM), JSON Web Key Set (JWKS), JSON Web Token (JWT), JavaScript Object Notation (JSON), OpenID Connect (OIDC), Representational State Transfer (REST), Requests Per Second (RPS), Signature Version 4 (SigV4), Simple Queue Service (SQS), Software Development Kit (SDK), Time-to-Live (TTL), Uniform Resource Locator (URL), Web Application Firewall (WAF), WebSocket (WS).

## REST API vs HTTP API

| Feature | REST API | HTTP API |
| --- | --- | --- |
| Cost | $3.50 / million | $1.00 / million |
| Latency | ~30ms overhead | ~10ms overhead |
| Features | Caching, request validation, request/response transformations, WAF, API keys, usage plans, SDK gen | Simpler set |
| JWT authorizer (built-in) | No (only Lambda authorizers) | Yes |
| WebSocket support | No | No (use WebSocket API) |
| Request/response model | Verbose | Lean |

**The 2026 senior default: HTTP API.** Pick REST API only if you need a feature HTTP API lacks (most often: API keys with usage plans, caching, or extensive transformations).

For WebSockets: WebSocket API (separate type).

## A minimal HTTP API in CDK

```ts
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

const api = new HttpApi(stack, "Api", {
  corsPreflight: {
    allowOrigins: ["https://app.example.com"],
    allowMethods: [
      CorsHttpMethod.GET,
      CorsHttpMethod.POST,
      CorsHttpMethod.PATCH,
      CorsHttpMethod.DELETE,
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowCredentials: true,
    maxAge: Duration.minutes(10),
  },
});

const authorizer = new HttpJwtAuthorizer(
  "CognitoAuth",
  `https://cognito-idp.eu-west-1.amazonaws.com/${userPoolId}`,
  {
    jwtAudience: [appClientId],
  }
);

api.addRoutes({
  path: "/tasks",
  methods: [HttpMethod.GET, HttpMethod.POST],
  integration: new HttpLambdaIntegration("TasksFn", tasksFn),
  authorizer,
});

api.addRoutes({
  path: "/tasks/{id}",
  methods: [HttpMethod.GET, HttpMethod.PATCH, HttpMethod.DELETE],
  integration: new HttpLambdaIntegration("TasksFn", tasksFn),
  authorizer,
});
```

## Integrations

Three flavours:

- **Lambda**: most common.
- **HTTP**: forward to any HTTP backend (ECS service, on-prem URL).
- **AWS service**: direct integration with DynamoDB, SQS, etc. — no Lambda needed for simple pass-through.

The "no-Lambda" pattern is great for "publish to SQS" or "put item to DynamoDB" endpoints. Lower latency, lower cost, no code to maintain.

```ts
import { HttpServiceIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

api.addRoutes({
  path: "/events",
  methods: [HttpMethod.POST],
  integration: new HttpServiceIntegration("PutEvent", {
    integrationSubtype: HttpIntegrationSubtype.SQS_SEND_MESSAGE,
    parameterMapping: ParameterMapping.fromObject({
      QueueUrl: MappingValue.custom(queue.queueUrl),
      MessageBody: MappingValue.custom("$request.body"),
    }),
    credentials: IntegrationCredentials.fromRole(role),
  }),
});
```

## Authorizers

| Type | When |
| --- | --- |
| **JWT authorizer (HTTP API)** | Verify a JWT against an OIDC issuer (Cognito, Auth0). Built-in caching. |
| **Lambda authorizer** | Custom logic (e.g. session cookie, custom claim transforms). Cacheable. |
| **IAM authorizer** | The caller signs the request with SigV4. For service-to-service. |
| **None** | Public endpoint. |

The JWT authorizer is the best default for any OIDC-backed setup. Configure once; API GW fetches JWKS, validates, caches.

## Throttling and quotas

API GW has account-level account throttle (default 10,000 RPS, burst 5,000) and per-route throttle.

- **Burst**: tokens in a bucket. Default 5,000.
- **Rate**: tokens added per second. Default 10,000.

For HTTP API, configure per-stage:

```ts
api.addStage("Prod", {
  throttle: { rateLimit: 200, burstLimit: 500 },
});
```

For per-route throttling: REST API only (or use AWS WAF).

## Request validation (REST API)

REST API can validate JSON body and headers/query params against JSON Schema before invoking Lambda. HTTP API doesn't; you validate in the Lambda (with Zod).

If you'd rather pay a bit more per request and get rejection at the edge, REST API + request validators saves Lambda invocation cost on bad input.

## Caching (REST API only)

Per-stage cache, sized 0.5 GB to 237 GB. Cache key includes path + selected headers/query params. TTL configurable. Costs hourly.

For most APIs, push caching to CloudFront in front of API GW instead — same effect, more flexible, often cheaper.

## CORS

API GW handles `OPTIONS` preflights for you when CORS is configured (above). Simple. The actual responses still need CORS headers, which the integration must produce — Lambda must set them, or use a response mapping.

## Usage plans + API keys (REST API only)

For B2B APIs:

- Generate per-customer API keys.
- Attach to a usage plan (e.g. 100k requests/month, 100 RPS).
- Customers send `x-api-key` header.

Charge by tier. HTTP API doesn't have built-in API keys; you'd implement in the authorizer.

## Logging, tracing

- **Access logs** to CloudWatch / Kinesis Firehose: per-request line.
- **Execution logs**: integration latency, errors.
- **X-Ray**: end-to-end tracing into Lambda → DDB.

Always enable access logs in production.

## Custom domain

Same flow as anything else: ACM cert in `us-east-1` (for edge-optimized) or in the API region (for regional), plus Route 53 alias to the API GW domain.

```ts
const domain = new DomainName(stack, "Domain", {
  domainName: "api.example.com",
  certificate,
});

new ApiMapping(stack, "Mapping", {
  api,
  domainName: domain,
  stage: api.defaultStage,
});

new ARecord(stack, "ApiAlias", {
  zone,
  recordName: "api",
  target: RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
});
```

## When NOT to use API Gateway

- **Very high Requests Per Second**: AppSync (GraphQL) or Application Load Balancer routing to Elastic Container Service may be cheaper at scale.
- **Long-running connections**: WebSocket API has its own quirks; consider AppSync subscriptions or running a WebSocket server on Fargate.
- **Streaming responses**: Lambda's response streaming is supported via Function URLs but not API GW HTTP API yet.

## Function URLs (the simpler alternative)

Direct HTTPS endpoints for a Lambda, no API GW. Cheap (no per-request fee), supports streaming responses. Limitations: no JWT authorizer (use IAM or Lambda's `authType: "NONE"`), no path-based routing (single function for all).

For an internal admin endpoint or a webhook receiver, Function URL + IAM auth is often the simplest.

```ts
const url = fn.addFunctionUrl({
  authType: FunctionUrlAuthType.AWS_IAM,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
```

## Key takeaways

The senior framing for Application Programming Interface Gateway: HTTP API by default; REST API only when its features matter. Use the JSON Web Token authorizer for OpenID Connect-backed authentication — cached and declarative, with no custom code to maintain. Service integrations skip Lambda for simple data-shipping endpoints, lowering cost and latency. Push caching to CloudFront rather than the Application Programming Interface Gateway cache. Function Uniform Resource Locators are the simpler alternative for trivial cases and support Lambda response streaming. Always enable access logs and X-Ray in production.

## Common interview questions

1. HTTP API vs REST API — when each?
2. How does the JWT authorizer work?
3. How would you rate-limit an unauthenticated endpoint?
4. Pros and cons of API GW caching vs CloudFront caching?
5. When would you use a Function URL instead of API GW?

## Answers

### 1. HTTP API vs REST API — when each?

HTTP API is the modern default for new Application Programming Interface Gateway deployments: it is approximately one-third the cost (one dollar per million requests versus three dollars fifty cents), has lower latency (about ten milliseconds of overhead versus thirty milliseconds), supports built-in JSON Web Token authorizers backed by OpenID Connect issuers, and uses a leaner request and response model. The trade-off is feature parity — HTTP API lacks request validation against JSON Schema, response transformations, the built-in cache, Application Programming Interface keys with usage plans, and Software Development Kit generation.

REST API is appropriate when the team needs one of the missing features. The most common reason is Application Programming Interface keys with usage plans for business-to-business products that meter and bill per customer. Other reasons include heavy request and response transformations (the team would otherwise need to do them in Lambda) and the built-in cache when CloudFront is not in front of the Application Programming Interface Gateway.

```ts
const api = new HttpApi(stack, "Api", {
  corsPreflight: { allowOrigins: ["https://app.example.com"], ... },
});
api.addRoutes({ path: "/tasks", methods: [HttpMethod.GET, HttpMethod.POST], integration, authorizer });
```

**Trade-offs / when this fails.** Migrating from REST API to HTTP API is non-trivial because the request and response models differ. Pick HTTP API for new projects unless a specific REST API feature is required; pick REST API only when the team has measured the need.

### 2. How does the JWT authorizer work?

The JSON Web Token authorizer for HTTP API validates a JSON Web Token in the `Authorization` header against an OpenID Connect issuer (Cognito, Auth0, Okta) before invoking the integration. The team configures the issuer URL and the expected audience claim; Application Programming Interface Gateway fetches the issuer's JSON Web Key Set, caches it, validates the token's signature on every request, and rejects expired or invalid tokens with `401 Unauthorized` before the integration runs.

```ts
const authorizer = new HttpJwtAuthorizer(
  "CognitoAuth",
  `https://cognito-idp.eu-west-1.amazonaws.com/${userPoolId}`,
  { jwtAudience: [appClientId] }
);

api.addRoutes({ path: "/tasks", methods: [HttpMethod.GET], integration, authorizer });
```

The validated token's claims are forwarded to the integration as `event.requestContext.authorizer.jwt.claims`, so the Lambda can read the `sub`, `email`, and custom claims without re-validating the token.

**Trade-offs / when this fails.** The JSON Web Token authorizer validates structure and signature but does not perform fine-grained authorisation — the Lambda still enforces "this user can edit this resource" decisions. For session cookies (rather than bearer tokens), use a Lambda authorizer instead because the JSON Web Token authorizer expects the `Authorization` header. The JSON Web Key Set fetch is cached, but a key rotation may take up to an hour to propagate; plan rotations accordingly.

### 3. How would you rate-limit an unauthenticated endpoint?

For an unauthenticated endpoint, the rate limit must use a non-identity key — typically the source Internet Protocol address. The mechanism varies by Application Programming Interface Gateway flavour: HTTP API supports per-stage throttling (rate and burst limits applied to all routes in the stage), but per-route or per-source throttling requires Web Application Firewall in front of the gateway.

The recommended pattern: place CloudFront with Web Application Firewall in front of Application Programming Interface Gateway, and use a Web Application Firewall rate-based rule that limits to two thousand requests per five minutes per source Internet Protocol address.

```ts
{
  name: "RateLimit",
  priority: 2,
  statement: {
    rateBasedStatement: {
      limit: 2000,
      aggregateKeyType: "IP",
    }
  },
  action: { block: {} },
  visibilityConfig: { ... }
}
```

The Web Application Firewall returns `403 Forbidden` to clients exceeding the limit. The same rule supports `aggregateKeyType: "IP"`, `"FORWARDED_IP"` (for trusted proxies), and `"CUSTOM_KEYS"` (for header-based keys when the application has a stable per-client identifier).

**Trade-offs / when this fails.** Internet Protocol-based limits suffer the standard limitations: Network Address Translation makes many users share an address, mobile networks rotate addresses between requests, and a botnet defeats per-Internet-Protocol limits. The structural defence for high-value unauthenticated endpoints is to require a CAPTCHA or proof-of-work that raises the cost per request, combined with monitoring for suspicious traffic patterns.

### 4. Pros and cons of API GW caching vs CloudFront caching?

Application Programming Interface Gateway caching (REST API only) is per-stage with a fixed cache size (0.5 gigabytes to 237 gigabytes) and per-route Time-to-Live configuration. The cache key includes the path plus selected headers and query parameters. The cost is hourly regardless of usage, which makes it expensive for low-traffic Application Programming Interfaces but predictable.

CloudFront caching is per-distribution with a globally distributed cache (every Point of Presence has its own cache), per-behaviour cache policy configuration, and edge-side rate limiting. The cost is per-request and per-data-transfer, which scales with usage. CloudFront also supports cache invalidation (Application Programming Interface Gateway requires waiting for the Time-to-Live to expire), CloudFront Functions for request rewriting, and Web Application Firewall integration.

For most Application Programming Interfaces, push caching to CloudFront in front of Application Programming Interface Gateway. The effect is the same — repeated requests for the same Uniform Resource Locator are served from cache without invoking the backend — but CloudFront is more flexible, the cache is geographically distributed (lower latency for global users), and the team can use one cache for both static assets and Application Programming Interface responses.

**Trade-offs / when this fails.** Application Programming Interface Gateway caching is appropriate when the application is regional (CloudFront's global distribution adds latency in this case), when the team needs request validation that REST API provides, or when the per-hour cache cost is cheaper than the per-request CloudFront cost at the application's specific traffic pattern.

### 5. When would you use a Function URL instead of API GW?

A Function Uniform Resource Locator is a direct Hypertext Transfer Protocol Secure endpoint for a Lambda function with no Application Programming Interface Gateway in between. It is appropriate when the application has a single Lambda handling all traffic (no path-based routing required), when authentication can be handled by Identity and Access Management (Signature Version 4 signed requests for service-to-service communication) or implemented inside the function, or when Lambda response streaming is required (Application Programming Interface Gateway HTTP API does not yet support streaming).

The benefits: no per-request Application Programming Interface Gateway fee (Function Uniform Resource Locators are free), simpler deployment (one resource instead of two), lower latency (no Application Programming Interface Gateway hop), and full streaming response support.

```ts
const url = fn.addFunctionUrl({
  authType: FunctionUrlAuthType.AWS_IAM,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
```

The limitations: no JSON Web Token authorizer (use Identity and Access Management or implement in the function); no path-based routing (one function handles all paths); no built-in throttling beyond Lambda's reserved concurrency (use CloudFront and Web Application Firewall for rate limiting); and no automatic Cross-Origin Resource Sharing handling (the function must produce Cross-Origin Resource Sharing headers itself).

**Trade-offs / when this fails.** Function Uniform Resource Locators are best for internal admin endpoints, webhook receivers, and AI streaming responses where the single-function model fits. For public Application Programming Interfaces with multiple routes and human-user authentication, Application Programming Interface Gateway HTTP API with the JSON Web Token authorizer remains the senior choice.

## Further reading

- [HTTP API vs REST API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html).
- [JWT authorizer for HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html).
