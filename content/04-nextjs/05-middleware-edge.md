---
title: "Middleware, Edge runtime, and image/font optimization"
sidebar_label: "4.5 Middleware, Edge runtime, and image/font optimization"
description: "Where middleware runs, what it can do, when to choose Edge vs Node, and what next/image and next/font give you."
sidebar_position: 5
---

These three topics share one chapter because they all answer the same operational question: "what runs where" in a Next.js application. Middleware runs at the very edge of the request path, the runtime split decides whether a route handler runs on a lightweight V8 isolate or a full Node.js process, and the image and font optimisations decide how heavy the static assets are when they reach the browser.

> **Acronyms used in this chapter.** API: Application Programming Interface. AVIF: AV1 Image File Format. CDN: Content Delivery Network. CLS: Cumulative Layout Shift. CSS: Cascading Style Sheets. DB: Database. FOIT: Flash of Invisible Text. FOUT: Flash of Unstyled Text. HTML: HyperText Markup Language. HTTP: HyperText Transfer Protocol. LCP: Largest Contentful Paint. POP: Point of Presence. UI: User Interface. URL: Uniform Resource Locator.

## Middleware

`middleware.ts` at the project root runs **before** a matched request hits a route handler or server component.

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/private/:path*"],
};
```

Middleware is well suited to a small set of operations: redirecting or rewriting based on cookies, headers, or geolocation; adding or removing headers on the response; setting cookies; and blocking a request entirely by returning a `Response` with a 403 (forbidden) or 429 (rate-limited) status code. The framing here is "shape the request before any route sees it".

The constraints are equally important. Middleware sits on the hot path of every matched request, so the budget is small — keep it under approximately 50 milliseconds, because the latency adds to every navigation. It runs on the Edge runtime by default, so Node-only APIs (`fs`, `child_process`, native modules) are unavailable unless the runtime is overridden. And it sees the request only, not the rendered HTML response body, so transformations of the rendered output belong in a route handler or a server component, not in middleware.

The single most common use case is authentication gating: redirect unauthenticated users away from protected routes before any data fetching occurs. The single most common bug is forgetting the `matcher` and running middleware on every static asset (`.js`, `.css`, `_next/image`), which can double or triple the latency of every navigation. The cure is to be explicit about which paths the middleware applies to:

```ts
// middleware.ts — restrict to dashboard and private API only.
export const config = {
  matcher: ["/dashboard/:path*", "/api/private/:path*"],
};
```

## Edge vs. Node runtime

Routes can run in two runtimes:

| | Edge | Node (default) |
| --- | --- | --- |
| Where | Vercel/Cloudflare/Netlify edge POPs (V8 isolates) | Lambda or container |
| Cold start | ~milliseconds | ~hundreds of ms |
| API surface | Web standard (`fetch`, `Request`, `Response`, Web Crypto) | Full Node API (fs, child_process, native modules) |
| Memory | Small (~128 MB) | Larger |
| Use case | Auth checks, A/B tests, simple proxy/transform, geolocation | Heavy compute, DB connections, native deps |

Opt into Edge per route or for all middleware:

```ts
// app/api/echo/route.ts
export const runtime = "edge";

export async function GET(request: Request) {
  return new Response(JSON.stringify({ ip: request.headers.get("x-forwarded-for") }));
}
```

The recommended heuristic is to default to the Node runtime. Choose Edge only when the application measurably benefits from low latency for a small, fast handler — authentication middleware, A/B test redirects, geolocation-based routing. Avoid placing a database-backed dashboard query on Edge unless the database has Edge-friendly access patterns (for example, the PlanetScale serverless driver or Neon over HTTP); the Edge runtime cannot open long-lived TCP connections, so a traditional Postgres connection pool is unavailable, and a per-request HTTPS round-trip to a database that is not optimised for it can be slower than the Node alternative.

## `next/image`

Unoptimised images are usually the heaviest assets on a page, and they directly impact Largest Contentful Paint and total page weight. `next/image` does five things at once that a hand-rolled `<img>` does not:

1. **Lazy loading** for below-the-fold images by default, so off-screen images do not block initial render.
2. **Responsive `srcset`** generation based on the `sizes` attribute, so each viewport gets an appropriately sized asset rather than the largest available.
3. **Modern formats** (AV1 Image File Format, WebP) with browser-driven content negotiation via the `Accept` header, so a Chrome browser receives AVIF while older browsers fall back to JPEG or PNG.
4. **Cumulative Layout Shift prevention** by reserving the image's space using the `width` and `height` attributes, so the surrounding content does not jump as the image loads.
5. **Caching** at the framework's optimiser cache and at the Content Delivery Network layer, so the optimisation cost is paid once per asset variant rather than per request.

```tsx
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Mountains at sunrise"
  width={1600}
  height={900}
  sizes="(min-width: 1024px) 1200px, 100vw"
  priority
/>
```

Two details a senior candidate is expected to articulate. First, the `priority` prop disables lazy loading and adds a `<link rel="preload">` to the document head, instructing the browser to fetch the image early. Use it for the Largest Contentful Paint image (the hero, the above-the-fold banner) and nowhere else; adding it everywhere defeats the optimisation by saturating the browser's connection budget on images that are not actually critical. Second, the `sizes` attribute is required for responsive images and for the correct selection of the served source. Without `sizes`, the browser does not know the rendered width of the image and downloads the largest variant, defeating the responsive-source optimisation.

For images you don't host yourself, configure `images.remotePatterns` in `next.config.js`:

```js
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.example.com", pathname: "/images/**" },
    ],
  },
};
```

For a purely static export (`output: "export"`), the optimizer is unavailable; ship pre-optimized assets or use a third-party loader.

## `next/font`

`next/font` self-hosts fonts at build time and inlines the CSS — eliminating the FOIT/FOUT flash and the privacy concern of loading from a CDN.

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

For local fonts:

```tsx
import localFont from "next/font/local";

const display = localFont({
  src: "./SF-Pro-Display.woff2",
  display: "swap",
  variable: "--font-display",
});
```

Three properties of this approach matter. First, no external request to `fonts.google.com` is made at runtime — the font files are downloaded at build time, served from the application's own origin, and never touch a third-party network. This eliminates a third-party dependency on the critical path and addresses the privacy regulators' increasing scrutiny of font-loading from external services under the General Data Protection Regulation. Second, subsetting by character range (`subsets: ["latin"]`) cuts file size dramatically by stripping glyphs the application will never use; a font with all Unicode ranges can be hundreds of kilobytes, while a Latin-only subset is typically twenty to fifty kilobytes. Third, `display: "swap"` ensures the browser shows the page's text in a fallback font while the web font loads, eliminating the Flash of Invisible Text and ensuring the user can read content immediately.

## Key takeaways

- Middleware runs on the Edge runtime by default, sits before route handlers, and applies only to matched requests; the latency it adds is paid on every navigation, so the budget is small (~50 ms) and `matcher` is mandatory to avoid running on static assets.
- Choose the Node runtime by default for route handlers; choose Edge only for low-latency, light handlers (authentication checks, A/B redirects, geolocation routing) and only when the dependencies (database driver, third-party SDK) actually support the Edge runtime's constraints.
- `next/image` provides lazy loading, responsive `srcset` generation, modern format negotiation, Cumulative Layout Shift prevention, and CDN caching in a single component; the `priority` prop should be used only for the Largest Contentful Paint image.
- `next/font` self-hosts and inlines fonts at build time, eliminating the font flash, the external dependency on `fonts.google.com`, and the privacy concern of loading fonts from a third-party origin.

## Common interview questions

1. What runs in middleware vs. an API route handler? When would you reach for which?
2. When would you choose Edge runtime over Node?
3. What does `next/image` do that a hand-rolled `<img>` doesn't?
4. Why is the `priority` prop on `next/image` not "always on"?
5. Why is `next/font` better than a `<link rel="stylesheet">` to Google Fonts?

## Answers

### 1. What runs in middleware vs. an API route handler? When would you reach for which?

Middleware runs before any route is matched, sees only the request (not the rendered response body), and is intended for cross-cutting concerns: authentication gating, cookie-based redirects, A/B test routing, header manipulation, request blocking. An API route handler (`route.ts`) runs after the route is matched, sees the full request, and is the right place for any operation that needs to read or write data, return a response body, or implement an HTTP contract.

**How it works.** The framework's request pipeline is: receive request → apply middleware (if matched) → match route → render server components or invoke route handler → emit response. Middleware can short-circuit the pipeline by returning a `Response` directly (for example, a redirect or a 403), or it can fall through to the route by returning `NextResponse.next()` after optionally modifying headers or cookies on the request and response.

```ts
// middleware.ts — short-circuits unauthenticated dashboard access.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const session = request.cookies.get("session")?.value;
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// app/api/posts/route.ts — the actual data operation.
export async function POST(req: Request) {
  const body = await req.json();
  const post = await db.post.insert(body);
  return Response.json({ post }, { status: 201 });
}
```

**Trade-offs / when this fails.** Putting heavy logic in middleware adds latency to every matched request because middleware sits on the critical path. The cure is to keep middleware to lightweight checks and push heavy logic into the route handler, which runs only when the route is actually requested. The opposite mistake — putting authentication logic in every route handler instead of in middleware — leads to inconsistent enforcement and bypasses; middleware is the right place for cross-cutting checks because it runs uniformly across the matched paths.

### 2. When would you choose Edge runtime over Node?

Choose Edge when the operation is latency-sensitive, lightweight, and uses only Web Standard APIs. Authentication middleware that checks a JWT signature, an A/B test redirect that selects a variant based on a cookie, a geolocation-based content rewrite — these benefit from running in a V8 isolate at a Point of Presence close to the user, with cold starts measured in milliseconds rather than hundreds of milliseconds.

**How it works.** The Edge runtime is a V8 isolate that runs at the host's edge network (Vercel, Cloudflare, Netlify) and exposes only Web Standard APIs (`fetch`, `Request`, `Response`, Web Crypto, `URL`, `URLSearchParams`). It cannot use Node-only APIs (`fs`, `child_process`, native modules) and cannot open long-lived TCP connections. Cold starts are minimal because V8 isolates do not need to boot a full Node process; the isolate is initialised once per host and can serve thousands of requests.

```ts
// app/api/geo/route.ts — Edge-suitable: lightweight, web standards only.
export const runtime = "edge";

export async function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country") ?? "US";
  return Response.json({ country });
}
```

**Trade-offs / when this fails.** The Edge runtime is the wrong choice for operations that need a database connection pool, native dependencies, or long-running compute. A typical traditional Postgres pool requires a long-lived TCP connection, which the Edge runtime cannot establish; the cure is to use a database with an HTTP-based serverless driver (PlanetScale, Neon over HTTP, Supabase Edge Functions). Native dependencies — image processing libraries, native cryptographic modules — are unavailable on Edge, so any route that needs them must run on Node.

### 3. What does `next/image` do that a hand-rolled `<img>` doesn't?

`next/image` performs five optimisations automatically: lazy loading for below-the-fold images, responsive `srcset` generation based on the `sizes` attribute, modern format negotiation (AV1 Image File Format, WebP) based on the browser's `Accept` header, Cumulative Layout Shift prevention by reserving space using the `width` and `height` attributes, and Content Delivery Network caching of every variant. A hand-rolled `<img>` requires the developer to do all five manually — implementing an `IntersectionObserver` for lazy loading, generating a `srcset` for every breakpoint, configuring an image-processing service for format negotiation, manually setting dimensions to prevent layout shift, and configuring caching headers separately.

**How it works.** When the component renders, the framework rewrites the `src` to point to its image optimiser endpoint (`/_next/image?url=...&w=...&q=...`). The optimiser fetches the source, transforms it to the requested width and format, caches the result, and serves it with appropriate caching headers. The `srcset` includes multiple widths so the browser can pick the best size for the current viewport.

```tsx
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Mountains at sunrise"
  width={1600}
  height={900}
  sizes="(min-width: 1024px) 1200px, 100vw"
  priority    // disables lazy loading and adds <link rel="preload">
/>
```

**Trade-offs / when this fails.** The optimiser is unavailable for purely static exports (`output: "export"`), in which case the application must ship pre-optimised assets or use a third-party loader. The optimiser also has its own cost — it's a function invocation per uncached variant, which can add up for high-traffic applications with many image variants. The cure for cost is aggressive caching at the optimiser level and at the CDN, plus deliberate choice of which images to optimise (a small icon does not need every variant).

### 4. Why is the `priority` prop on `next/image` not "always on"?

`priority` disables lazy loading and adds a `<link rel="preload">` to the document head, instructing the browser to fetch the image as early as possible. The browser has a finite connection budget — typically six concurrent connections per origin in HTTP/1.1, somewhat more under HTTP/2 — and preloading every image consumes that budget on assets that are not actually critical, delaying the resources that genuinely matter (the Largest Contentful Paint image, critical CSS, the document's JavaScript).

**How it works.** The browser's preloader scans the document head and dispatches preload requests immediately, before the layout engine has computed which images are actually visible. A page with twenty `priority` images dispatches twenty preload requests, all competing for the same connection budget; the LCP image is no longer prioritised because every image is "priority", and the LCP regresses. Reserving `priority` for the single LCP image — typically the hero, the article cover image, the featured product image — ensures the browser allocates its early connection budget to the asset that dictates the user's perception of load speed.

```tsx
// Correct: only the LCP image is priority.
<Image src="/hero.jpg" priority width={1600} height={900} alt="..." />

// Below the fold, the rest stay lazy:
<Image src="/photo-1.jpg" width={400} height={300} alt="..." />
<Image src="/photo-2.jpg" width={400} height={300} alt="..." />
```

**Trade-offs / when this fails.** Identifying the LCP image is non-trivial when the page layout depends on viewport size — the hero on mobile may be a different image than on desktop. The cure is to measure with the browser's developer tools or with the `web-vitals` library, identify the actual LCP element across viewports, and apply `priority` there. The pattern fails when the page genuinely has multiple critical above-the-fold images (a marquee gallery, a comparison view); for those, accept the regression or restructure the page to defer the secondary images.

### 5. Why is `next/font` better than a `<link rel="stylesheet">` to Google Fonts?

`next/font` downloads the font files at build time and serves them from the application's own origin, eliminating three problems with a `<link>` to `fonts.googleapis.com`: a network round-trip to a third-party origin on the critical path, a third-party dependency that can fail or slow the application, and a privacy and General Data Protection Regulation concern around shipping every visitor's IP address to Google. The build-time download also enables character subsetting (cutting the file size by an order of magnitude) and font-display configuration that eliminates the Flash of Invisible Text.

**How it works.** At build time, `next/font/google` downloads the requested font files for the configured subsets, places them in the application's static assets, and emits a CSS `@font-face` rule pointing to the local URL. The CSS is inlined in the document head, so there is no separate stylesheet round-trip. The font files are served with the application's caching headers, and the `font-display: swap` (or whichever value is configured) is included in the `@font-face` rule.

```tsx
// app/layout.tsx — fonts downloaded at build, served from own origin.
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],            // only Latin glyphs — order of magnitude smaller
  display: "swap",               // text visible in fallback font while web font loads
  variable: "--font-sans",       // exposes a CSS custom property
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body>{children}</body></html>;
}
```

**Trade-offs / when this fails.** The build-time download requires network access during build, which can fail in air-gapped CI environments. The cure is to mirror the font files to a private Content Delivery Network or commit them to the repository. The pattern is also overkill for a marketing site that already loads from a corporate font-hosting service; for those, a standard `<link>` with `crossorigin` and `preconnect` to the font origin is acceptable, though the privacy and dependency considerations remain.

## Further reading

- Next.js: [Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware), [Edge and Node Runtimes](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes).
- web.dev, [Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp).
