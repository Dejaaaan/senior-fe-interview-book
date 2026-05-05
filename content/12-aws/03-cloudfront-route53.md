---
title: "CloudFront, Route 53, ACM"
sidebar_label: "12.3 CloudFront, Route 53, ACM"
description: "The CDN, DNS, and TLS-cert primitives you'll wire up on every project."
sidebar_position: 3
---

Three services always come together to deliver any production frontend on Amazon Web Services: a domain managed by Route 53, a Transport Layer Security certificate issued by Amazon Web Services Certificate Manager, and a Content Delivery Network operated by CloudFront. Once the team has assembled this trio twice, the deployment becomes a twenty-minute task that the senior engineer can perform from memory.

**Acronyms used in this chapter.** Amazon Web Services (AWS), Amazon Web Services Certificate Manager (ACM), Application Load Balancer (ALB), Application Programming Interface (API), Content Delivery Network (CDN), Content Security Policy (CSP), Cross-Origin Resource Sharing (CORS), Domain Name System (DNS), Hypertext Transfer Protocol (HTTP), Hypertext Transfer Protocol Secure (HTTPS), Hypertext Transfer Protocol Strict Transport Security (HSTS), Identity and Access Management (IAM), Input/Output (I/O), Internet Protocol (IP), Origin Access Control (OAC), Origin Access Identity (OAI), OWASP Open Web Application Security Project, Point of Presence (POP), Single-Page Application (SPA), Simple Storage Service (S3), Transport Layer Security (TLS), Uniform Resource Locator (URL), Web Application Firewall (WAF).

## Route 53 — DNS

Route 53 is the Amazon Web Services authoritative Domain Name System service. A **hosted zone** is a domain (`example.com`) with its records. **Records** include the standard A, AAAA, CNAME, MX, TXT, NS, and SOA types plus Amazon-Web-Services-specific **Alias** records. Alias records resolve to Amazon Web Services resources (a CloudFront distribution, an Application Load Balancer, a Simple Storage Service website endpoint) at zero query cost; the team should prefer them over CNAME records for any Amazon Web Services target because they are cheaper, faster, and work at the apex domain (where CNAMEs cannot be used per RFC).

```text
example.com.              A     ALIAS to d111111abcdef8.cloudfront.net.
www.example.com.          A     ALIAS to d111111abcdef8.cloudfront.net.
api.example.com.          A     ALIAS to my-api.example.com (ALB)
```

### Routing policies

Route 53 supports several routing policies for shaping how Domain Name System answers are returned. **Simple** returns one answer and is the default for single-region applications. **Weighted** splits traffic between targets according to assigned weights, used for canary deployments where a fraction of traffic is sent to a new release. **Latency-based** returns the answer for the region closest to the client, optimising for response time in multi-region deployments. **Geo** routes by the client's country, used for compliance ("European Union users go to the European Union region") or content localisation. **Failover** returns the primary target while a health check is healthy and the secondary when it fails. **Multi-value** returns several healthy Internet Protocol addresses so the client can pick.

For a single-region site, Simple is correct. For a multi-region deployment, the senior pattern combines latency-based routing for normal traffic with failover for resilience against a regional outage.

### Health checks

Route 53 can ping an endpoint and fail traffic over if unhealthy:

```text
URL:        https://api.example.com/health
Threshold:  3 consecutive failures
Interval:   30s
Regions:    [eu-west-1, us-east-1, ap-southeast-1]
```

Wire this into a failover record set so DNS automatically points to the secondary region.

## ACM — TLS certificates

Free, auto-renewed TLS certs for AWS services.

```ts
const cert = new Certificate(stack, "Cert", {
  domainName: "example.com",
  subjectAlternativeNames: ["www.example.com", "*.example.com"],
  validation: CertificateValidation.fromDns(zone),
});
```

Two important quirks:

1. For **CloudFront**, the cert MUST be in `us-east-1` regardless of where your CloudFront distribution serves from. CloudFront is a global service backed by us-east-1.
2. Validation: pick **DNS validation** (auto-renewing if you keep the CNAME). Email validation is fragile.

## CloudFront — CDN

A managed CDN with 600+ POPs in 2026.

### Distributions

Has one or more **origins** (S3 bucket, ALB, custom HTTP origin) and **cache behaviours** (path-based rules).

```ts
const dist = new Distribution(stack, "Site", {
  defaultBehavior: {
    origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    compress: true,
    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
    responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
  },
  additionalBehaviors: {
    "/api/*": {
      origin: new HttpOrigin("api.example.com"),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      allowedMethods: AllowedMethods.ALLOW_ALL,
    },
  },
  domainNames: ["example.com", "www.example.com"],
  certificate: cert,
  minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
  httpVersion: HttpVersion.HTTP2_AND_3,
  priceClass: PriceClass.PRICE_CLASS_100,
});
```

### Origin Access Control (OAC)

The 2026 way to lock S3 origins to CloudFront. Replaces legacy OAI. The bucket policy permits only the CloudFront distribution.

### Cache key

What CloudFront uses to look up cached responses. By default: URL only. To vary by header (e.g. `Accept-Language`):

```ts
new CachePolicy(stack, "PerLocale", {
  queryStringBehavior: CacheQueryStringBehavior.none(),
  headerBehavior: CacheHeaderBehavior.allowList("Accept-Language"),
  cookieBehavior: CacheCookieBehavior.none(),
});
```

Be careful: every dimension you include reduces hit rate. Common antipattern: caching by all cookies and wondering why hit rate is 0%.

### Cache invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id E123EXAMPLE \
  --paths "/index.html" "/sitemap.xml"
```

Free for 1000 paths/month, then ~$0.005 per path. **Don't** invalidate everything on every deploy:

- Use immutable filenames for assets (`/assets/app.abc123.js`) so cache stays warm.
- Invalidate just `/index.html` (and maybe `/manifest.json`, `/robots.txt`).

### CloudFront Functions vs Lambda@Edge

Two ways to run code at the edge:

- **CloudFront Functions**: JavaScript only, sub-millisecond cold start, no I/O. For URL rewrites, header manipulation, A/B routing. Cheapest.
- **Lambda@Edge**: Node/Python, full Lambda capabilities, milliseconds, can do I/O. For more complex logic (auth, dynamic responses).

For static hosting / SPA routing, CF Functions are right.

```js
function handler(event) {
  var req = event.request;
  if (req.uri === "/") req.uri = "/index.html";
  return req;
}
```

### Security headers

CloudFront has a managed `SecurityHeadersPolicy` that adds HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy. Use it as a starting point and customise via a `ResponseHeadersPolicy` to add CSP.

### Signed URLs / cookies

For paywalled content (e.g. a private video):

- **Signed URL**: one URL, one user, one expiry. Easy.
- **Signed cookie**: covers many URLs (whole prefix), one expiry. Better for video streaming with many segments.

```ts
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const url = getSignedUrl({
  url: "https://media.example.com/private/video.m3u8",
  keyPairId: "K1ABCDEF",
  privateKey: process.env.CF_PRIVATE_KEY!,
  dateLessThan: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
```

## WAF integration

For abuse protection: AWS WAF in front of CloudFront. Managed rule groups for OWASP top 10, bot control, account takeover protection.

```ts
new wafv2.CfnWebACL(stack, "WebAcl", {
  scope: "CLOUDFRONT",
  defaultAction: { allow: {} },
  visibilityConfig: { ... },
  rules: [
    { name: "AWS-CommonRuleSet", priority: 0, statement: { managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesCommonRuleSet" } }, overrideAction: { none: {} }, visibilityConfig: { ... } },
    { name: "AWS-KnownBadInputs", priority: 1, ... },
    { name: "RateLimit", priority: 2, statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: "IP" } }, action: { block: {} }, visibilityConfig: { ... } },
  ],
});
```

Then associate the Web ACL with the CloudFront distribution.

## Common bugs

- **Cert in wrong region**: CloudFront needs us-east-1.
- **`d111...cloudfront.net` not resolving**: distribution still deploying (5-15 min).
- **CSS/JS 404 after deploy**: invalidated `index.html` but the new bundle name doesn't exist yet (race during deploy). Upload `assets/*` first, `index.html` last.
- **API behind CloudFront returns 403**: forgot to forward `Authorization` header in cache policy. Use `ALL_VIEWER` for API paths.

## Key takeaways

The senior framing for the deploy trio: Route 53 plus Amazon Web Services Certificate Manager plus CloudFront is the standard combination for any frontend on Amazon Web Services. Use Alias records (not CNAME) for Amazon Web Services targets. The Amazon Web Services Certificate Manager certificate for CloudFront must live in `us-east-1` regardless of the distribution's edge locations. Use immutable asset names and invalidate only `/index.html` on deploy. Use CloudFront Functions for routing and header manipulation; reserve Lambda@Edge for logic that requires Input/Output. Use Web Application Firewall for abuse control with managed rule groups as the starting point.

## Common interview questions

1. Why does the ACM cert for CloudFront have to be in us-east-1?
2. What is an Alias record and when is it better than a CNAME?
3. How do you serve a SPA's deep links via CloudFront?
4. CloudFront Functions vs Lambda@Edge?
5. How would you cache an API response while keeping the auth header through?

## Answers

### 1. Why does the ACM cert for CloudFront have to be in us-east-1?

CloudFront is a global service backed by control-plane infrastructure that lives in the `us-east-1` region. When CloudFront edges around the world serve traffic for a distribution, they fetch the Transport Layer Security certificate from this control plane, and the certificate must be issued in `us-east-1` for the edges to find it. Certificates issued in any other region are invisible to CloudFront, regardless of where the distribution serves from.

```ts
// CDK: explicitly create the certificate in us-east-1
const cert = new Certificate(stack, "Cert", {
  domainName: "example.com",
  validation: CertificateValidation.fromDns(zone),
  // stack must be deployed to us-east-1 for CloudFront use
});
```

The same constraint applies to certificates for Web Application Firewall web Access Control Lists scoped to CloudFront — they too must live in `us-east-1`. For Application Load Balancers and other regional services, the certificate lives in the same region as the resource.

**Trade-offs / when this fails.** Forgetting this is one of the most common Amazon Web Services pitfalls. The error manifests as "Certificate not found" when associating the certificate with the distribution. The fix is to issue a fresh certificate in `us-east-1`; certificates cannot be moved between regions.

### 2. What is an Alias record and when is it better than a CNAME?

An Alias record is an Amazon-Web-Services-specific Domain Name System record that resolves to an Amazon Web Services resource (a CloudFront distribution, an Application Load Balancer, a Simple Storage Service website endpoint, an Amazon Web Services Application Programming Interface Gateway endpoint) at zero query cost. The record looks like an A or AAAA record to clients but is resolved by Route 53 directly to the resource's current Internet Protocol addresses, which Amazon Web Services updates as the underlying resources scale or change.

The CNAME record is the standard Domain Name System mechanism for aliasing one hostname to another, but it has two limitations: it cannot be used at the apex of a domain (`example.com` cannot be a CNAME, only `www.example.com`), and Route 53 charges per query for CNAME resolution. Alias records work at the apex and are free.

```text
example.com.              A     ALIAS to d111111abcdef8.cloudfront.net.
www.example.com.          A     ALIAS to d111111abcdef8.cloudfront.net.
```

**Trade-offs / when this fails.** Alias records work only for Amazon Web Services targets; for non-Amazon-Web-Services targets, the team must use CNAME (or move the apex to a Route 53-managed zone with a redirect). The free query cost is a small but real saving on high-traffic domains.

### 3. How do you serve a SPA's deep links via CloudFront?

A Single-Page Application uses client-side routing — the browser fetches `index.html` once and the client JavaScript handles every subsequent navigation. When a user opens a deep link directly (`/users/123/profile`), the browser issues a `GET /users/123/profile` to the origin, which has no object at that key.

The fix is a CloudFront Function that rewrites unknown paths to `/index.html` so the browser receives the application shell, and the client router renders the correct view based on the original Uniform Resource Locator preserved in `location`:

```js
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.endsWith("/")) req.uri = uri + "index.html";
  else if (!uri.includes(".")) req.uri = "/index.html";
  return req;
}
```

**Trade-offs / when this fails.** The alternative — mapping `403`/`404` error responses to `/index.html` with status `200` via the CloudFront error-response configuration — is simpler but breaks legitimate `404`s for missing assets. The function approach distinguishes "no extension" (route) from "has extension" (asset that should `404` if missing) and is the senior choice. CloudFront Functions are inexpensive (sub-millisecond execution, fractional cents per million invocations) and run synchronously at the edge.

### 4. CloudFront Functions vs Lambda@Edge?

CloudFront Functions and Lambda@Edge both run code at CloudFront edges, but at different points in the request lifecycle and with different capabilities. CloudFront Functions are a JavaScript-only runtime with sub-millisecond cold start, no network or filesystem Input/Output, and a maximum execution time of one millisecond; they run on viewer-request and viewer-response events. They are appropriate for Uniform Resource Locator rewrites, header manipulation, redirects based on geography or device, and Application/Behaviour test routing.

```js
// CloudFront Function: redirect mobile users to /m
function handler(event) {
  var ua = event.request.headers["user-agent"]?.value || "";
  if (/Mobile/.test(ua) && !event.request.uri.startsWith("/m")) {
    return { statusCode: 302, headers: { location: { value: "/m" + event.request.uri } } };
  }
  return event.request;
}
```

Lambda@Edge runs Node.js or Python with full Lambda capabilities, including network Input/Output, package dependencies, and longer execution times (up to thirty seconds for origin events, five seconds for viewer events). It runs on origin-request and origin-response events in addition to viewer events. It is appropriate for authentication checks against an external service, dynamic content composition, and any logic that requires fetching from a database or another Application Programming Interface.

**Trade-offs / when this fails.** CloudFront Functions cost approximately one-sixth of Lambda@Edge for the same volume and have lower latency. Reach for Lambda@Edge only when CloudFront Functions cannot do the job. For Single-Page Application routing and security headers, CloudFront Functions are the correct choice.

### 5. How would you cache an API response while keeping the auth header through?

The default CloudFront cache key includes only the Uniform Resource Locator path; it does not include headers or cookies. To cache an Application Programming Interface response per user, the cache key must include a per-user dimension (the `Authorization` header or a session cookie), and the origin request policy must forward the header to the origin so the origin can authenticate the request.

```ts
new CachePolicy(stack, "ApiPerUser", {
  queryStringBehavior: CacheQueryStringBehavior.all(),
  headerBehavior: CacheHeaderBehavior.allowList("Authorization"),
  cookieBehavior: CacheCookieBehavior.none(),
});

new OriginRequestPolicy(stack, "ApiOrigin", {
  headerBehavior: OriginRequestHeaderBehavior.allowList(
    "Authorization",
    "Content-Type",
  ),
});
```

The cache key now includes the `Authorization` header, so each user gets their own cache entry; the origin request policy ensures the header reaches the origin so the origin can authenticate. The Cross-Origin Resource Sharing-relevant headers must also be forwarded if the origin needs them.

**Trade-offs / when this fails.** Caching per user is inefficient — each user has their own cache entries, defeating the point of a shared cache. The pattern is appropriate for responses that are personalised but expensive to compute (the cache amortises the computation across multiple requests by the same user). For public Application Programming Interfaces, do not include the `Authorization` header in the cache key; serve a single shared response to all users. For a mix, use multiple cache behaviours (one for `/api/me/*` with per-user caching, one for `/api/public/*` with shared caching).

## Further reading

- [CloudFront cache key best practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cache-key.html).
- [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html).
- [AWS WAF Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html).
