---
title: "Server Actions"
sidebar_label: "4.4 Server Actions"
description: "Mutations without an API: useActionState, useFormStatus, optimistic updates, and the security pitfalls."
sidebar_position: 4
---

Server Actions let a client component call a function defined on the server directly, with the framework handling serialisation, the network round-trip, and the security boundary. Paired with React 19's `useActionState`, `useFormStatus`, and `useOptimistic`, the pattern lets a team build mutation flows without writing a hand-rolled Application Programming Interface (API) layer at all.

> **Acronyms used in this chapter.** API: Application Programming Interface. CSRF: Cross-Site Request Forgery. DB: Database. HTTP: HyperText Transfer Protocol. JS: JavaScript. UI: User Interface.

## The minimum

```tsx
// app/actions.ts
"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1).max(120) });

export async function createPost(formData: FormData) {
  const parsed = schema.parse({ title: formData.get("title") });
  await db.post.insert(parsed);
  revalidateTag("posts");
}
```

```tsx
// app/posts/new-post-form.tsx
import { createPost } from "../actions";

export function NewPostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button>Create</button>
    </form>
  );
}
```

When the form submits, the framework serialises the `FormData`, calls the action on the server, and then runs revalidation. The form continues to work even with JavaScript disabled in the browser, because the framework registers a server-side endpoint that the form can post to as a normal HTML form — this is the progressive-enhancement guarantee that distinguishes Server Actions from a hand-rolled `fetch` mutation.

## `useActionState` for results and pending state

For non-trivial actions you want the result back. `useActionState` is the React 19 hook for this:

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

type State = { errors?: { title?: string[] }; ok?: boolean };

export function NewPostForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      try {
        await createPost(formData);
        return { ok: true };
      } catch (err) {
        if (err instanceof z.ZodError) return { errors: err.flatten().fieldErrors };
        throw err;
      }
    },
    { errors: {} },
  );

  return (
    <form action={action}>
      <input name="title" aria-invalid={!!state.errors?.title} />
      {state.errors?.title?.[0] && <p role="alert">{state.errors.title[0]}</p>}
      <button disabled={pending}>{pending ? "Creating..." : "Create"}</button>
      {state.ok && <p role="status">Created!</p>}
    </form>
  );
}
```

`useActionState` returns a wrapped action you pass to `<form action>`, the latest state, and a pending flag. It handles concurrent submissions (only the latest result lands).

## `useFormStatus` for nested submit buttons

If your submit button is a separate component (for example, a design-system primitive), it can read pending state without prop drilling:

```tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Saving..." : children}</button>;
}
```

`useFormStatus` reads from the **closest parent `<form>`**.

## Calling Server Actions from `onClick` etc.

You don't need a form. Server Actions are just async functions on the client.

```tsx
"use client";
import { deletePost } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <button onClick={async () => {
      await deletePost(id);
    }}>
      Delete
    </button>
  );
}
```

For forms, prefer the `action={action}` prop — it gives you progressive enhancement for free.

## Optimistic updates with `useOptimistic`

```tsx
"use client";
import { useOptimistic, useState } from "react";
import { addCommentAction } from "./actions";

export function Comments({ postId, initial }: { postId: string; initial: Comment[] }) {
  const [comments, setComments] = useState(initial);
  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (state, draft: Comment) => [...state, draft],
  );

  return (
    <>
      <ul>{optimisticComments.map((c) => <li key={c.id}>{c.body}</li>)}</ul>
      <form action={async (formData) => {
        const draft = { id: crypto.randomUUID(), body: String(formData.get("body")) };
        addOptimistic(draft);
        const real = await addCommentAction(postId, draft);
        setComments((prev) => [...prev, real]);
      }}>
        <input name="body" required />
        <button>Post</button>
      </form>
    </>
  );
}
```

If the action throws, `optimisticComments` snaps back to `comments` automatically.

## Calling actions from anywhere

Actions can be called from server components too — they're just functions. You can also import them from a client file thanks to the `"use server"` directive's serialization layer.

A common organization:

```text
app/
├── lib/
│   └── posts/
│       ├── actions.ts        # "use server" + each mutation
│       ├── queries.ts        # data-fetching helpers (server only)
│       └── schema.ts         # Zod schemas shared by both
```

## Security: Server Actions are public endpoints

Every Server Action is **callable by anyone** with knowledge of the action's hashed identifier (which is publicly served in the JS bundle). Always validate inputs and authorize the caller:

```ts
"use server";

export async function deletePost(id: string) {
  const session = await auth();                      // your auth helper
  if (!session) throw new Error("Unauthorized");

  const post = await db.post.findUnique({ where: { id } });
  if (!post || post.authorId !== session.userId) {
    throw new Error("Forbidden");
  }

  await db.post.delete({ where: { id } });
  revalidateTag("posts");
}
```

Two more rules:

1. **Validate inputs** with Zod or similar — a Server Action is an HTTP endpoint in disguise.
2. **Don't leak secrets in the response.** Returning a server-side `Error.message` can disclose internals; return a sanitized error.

## When to use Server Actions vs. `route.ts` API endpoints

| Reach for | When |
| --- | --- |
| **Server Action** | Mutation triggered from the Next.js UI; progressive enhancement matters; the action should be colocated with the form |
| **`app/api/*/route.ts`** | The endpoint is consumed by a non-Next.js client (mobile application, third-party integration, webhook); the application needs a stable HTTP contract |

Both can coexist for the same underlying logic. The recommended pattern is to extract a shared service function (for example, `createPost(input: CreatePostInput)` in `lib/posts/service.ts`) and call it from both surfaces; the Server Action handles the form-driven path, the `route.ts` handler exposes the public contract, and the business logic lives in one place.

## Key takeaways

- Server Actions are server functions called from the client; the framework handles the round-trip, the serialisation, and the registration of the corresponding HTTP endpoint behind the scenes.
- `useActionState` returns the latest result and a pending flag; `useFormStatus` lets a nested submit button read the parent form's pending state without prop drilling; `useOptimistic` provides an optimistic snapshot that rolls back automatically if the action throws.
- Forms with `action={action}` get progressive enhancement for free because the framework registers a real endpoint behind the scenes; the same form works whether or not JavaScript has loaded in the browser.
- Server Actions are public endpoints, full stop. Validate every input with a schema (Zod or equivalent), authorise the caller on every invocation, and treat the action exactly like an HTTP endpoint that any client could discover and call.
- Use `route.ts` handlers when the endpoint must be consumed by external clients with a stable contract; use Server Actions for in-application mutations originating from the Next.js client.

## Common interview questions

1. What does the `"use server"` directive do, and where can it appear?
2. Walk me through `useActionState` vs. `useState` + `fetch`. What does it buy you?
3. How does `useOptimistic` know to roll back?
4. Why is "Server Actions are secure because the function is on the server" wrong?
5. When would you choose a `route.ts` handler over a Server Action?

## Answers

### 1. What does the `"use server"` directive do, and where can it appear?

`"use server"` marks a module (or a single function) as a Server Action — a function that runs on the server but can be called by reference from a client component. The framework automatically registers a corresponding HTTP endpoint at build time, replaces the function reference in the client bundle with a small stub that performs the round-trip, and handles the serialisation of arguments and the deserialisation of the return value.

**How it works.** The directive can appear at the top of a file, in which case every exported function in the file becomes a Server Action, or inside a function body, in which case only that function is a Server Action. The compiler walks the import graph and detects which references cross the server-client boundary; for every such reference it inserts the necessary stub. The action is given a hashed identifier that becomes part of the URL the framework registers, which is why the identifier is publicly served in the JS bundle.

```ts
// app/lib/posts/actions.ts — every export is a Server Action.
"use server";

export async function createPost(input: { title: string }) {
  await db.post.insert(input);
}

// Or inline in a server component:
async function inlineAction() {
  "use server";
  await doSomething();
}
```

**Trade-offs / when this fails.** The directive is fundamentally a security boundary, and conflating it with the React Server Components `"use client"` directive is a common confusion. `"use client"` says "this module runs in the browser"; `"use server"` says "this module's exports are public HTTP endpoints, even though they look like local function calls". The cure is to internalise that `"use server"` is closer to "export public API" than to "this is server-side code".

### 2. Walk me through `useActionState` vs. `useState` + `fetch`. What does it buy you?

`useActionState` is purpose-built for form mutations and gives the application three things that `useState` + `fetch` does not: a single source of truth for the latest action result, an automatic pending flag that the framework manages, and concurrency-safe handling of multiple submissions (only the latest result is applied, even if requests resolve out of order). The hook also integrates with the framework's progressive-enhancement story — the same `<form action={action}>` works without JavaScript.

**How it works.** `useActionState` takes an action function and an initial state, and returns a tuple of the current state, a wrapped action to pass to `<form action>`, and a boolean pending flag. When the form is submitted, the framework calls the wrapped action with the previous state and the form data; the return value becomes the new state, and the pending flag is true while the action is in flight.

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

const [state, action, pending] = useActionState(
  async (prev: State, formData: FormData) => {
    try {
      await createPost(formData);
      return { ok: true };
    } catch (err) {
      return { error: String(err) };
    }
  },
  { ok: false },
);

return (
  <form action={action}>
    <input name="title" required />
    <button disabled={pending}>{pending ? "Saving..." : "Save"}</button>
    {state.error && <p role="alert">{state.error}</p>}
  </form>
);
```

**Trade-offs / when this fails.** `useActionState` is opinionated about the action signature `(prevState, formData) => Promise<state>`; mutations that do not fit this shape (such as a multi-step wizard with branching state) are awkward to express. The hook also returns only the latest state, so applications that need a history of submissions must maintain that history separately. The cure for both is to fall back to a normal `fetch` plus `useState` when the shape genuinely does not fit.

### 3. How does `useOptimistic` know to roll back?

`useOptimistic` returns a derived state that overlays the canonical state with the optimistic update for as long as the surrounding action is pending. When the action completes — successfully or by throwing — React discards the optimistic overlay and the component re-renders with the canonical state. If the action threw, the canonical state has not changed, so the user sees the original data; if the action succeeded, the canonical state has typically been updated by the action's revalidation, and the optimistic update is replaced by the real value.

**How it works.** The hook tracks the pending action via React's transition machinery. When `addOptimistic(value)` is called inside the action, React records the optimistic value and renders the component as if the canonical state included it. When the action resolves or rejects, React clears the optimistic record and renders with the canonical state (which the action has presumably updated on success).

```tsx
const [optimistic, addOptimistic] = useOptimistic(
  comments,
  (state, draft: Comment) => [...state, draft],
);

async function postAction(formData: FormData) {
  const draft = { id: crypto.randomUUID(), body: String(formData.get("body")) };
  addOptimistic(draft);                      // shows the draft immediately
  await addCommentAction(draft);             // canonical update happens here
  // If addCommentAction throws, the draft disappears automatically.
}
```

**Trade-offs / when this fails.** The pattern works only when the canonical state is updated by the action's success path (typically via `revalidateTag` or `router.refresh()`); otherwise the optimistic update disappears on completion and the user sees a flicker. The pattern also fails when the optimistic value cannot be predicted client-side (for example, when the server assigns the canonical id and the UI must show the real id immediately); for those cases, a real-fetch-plus-loading-state is the correct shape.

### 4. Why is "Server Actions are secure because the function is on the server" wrong?

Every Server Action is, by construction, a public HTTP endpoint. The framework registers an endpoint for the action at build time, the endpoint's hashed identifier ships in the client bundle, and any attacker who reads the bundle (or any client at all) can invoke the action with arbitrary arguments. Saying "the function runs on the server" describes only where the code executes, not who can invoke it. The action's authorisation must be performed inside the action body, not assumed from the call site.

**How it works.** The framework's serialisation layer accepts any well-formed request to the registered endpoint and calls the action with the deserialised arguments. The framework does not verify that the request originated from a legitimate component on the application's own pages — it cannot, because the same component would be expected to call the action under normal use. The application is therefore responsible for verifying the session, validating the inputs, and checking the caller's authorisation against the resource being mutated.

```ts
"use server";
import { z } from "zod";

const schema = z.object({ id: z.string().uuid() });

export async function deletePost(input: unknown) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const { id } = schema.parse(input);

  const post = await db.post.findUnique({ where: { id } });
  if (!post || post.authorId !== session.userId) {
    throw new Error("Forbidden");
  }

  await db.post.delete({ where: { id } });
  revalidateTag("posts");
}
```

**Trade-offs / when this fails.** Treating the action as an internal function call leads to authorisation bypasses where the UI hides a button (because the user lacks permission) but the underlying action still allows the call. The cure is to perform every authorisation check inside the action body and to write tests that invoke the action directly without going through the UI. Cross-Site Request Forgery is also a consideration: the framework's defaults provide reasonable protection (same-site cookies, an `Origin` check), but applications with permissive CORS or alternative session models must verify the protections still apply.

### 5. When would you choose a `route.ts` handler over a Server Action?

Choose a `route.ts` handler when the endpoint must be consumed by clients other than the Next.js application itself — a mobile application, a third-party integration, a webhook receiver, a cron job, an iframe in another origin, or any client that needs a stable, framework-independent HTTP contract. Server Actions are tightly coupled to the framework's RPC layer and React form integration, so using them as a public API surface gives up the standard HTTP semantics, the documentation tooling (OpenAPI, Postman collections), and the contract stability that external consumers expect.

**How it works.** A `route.ts` handler is a plain Web Fetch handler — it receives a `Request`, returns a `Response`, and is fully under the developer's control. The handler defines the URL, the HTTP method, the headers, the body shape, and the status codes; nothing about it depends on the framework's RPC layer. A Server Action, by contrast, is opaque from the outside: the URL is hashed, the request shape is dictated by the framework, and the framework can change the wire format between releases.

```ts
// app/api/posts/route.ts — public, contract-driven endpoint.
import { z } from "zod";

const schema = z.object({ title: z.string().min(1).max(120) });

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!isValidApiKey(apiKey)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());
  const post = await db.post.insert(body);
  return Response.json({ post }, { status: 201 });
}
```

**Trade-offs / when this fails.** Choosing `route.ts` for in-application mutations gives up the framework's progressive-enhancement story, the integration with `useActionState` and `useFormStatus`, and the ergonomic optimistic-UI primitives. The senior framing is "Server Actions for internal mutations from a Next.js client; `route.ts` for any caller that needs a contract". When both are needed for the same logic, extract a shared service function and have both surfaces call it.

## Further reading

- React docs: [`useActionState`](https://react.dev/reference/react/useActionState), [`useOptimistic`](https://react.dev/reference/react/useOptimistic).
- Next.js: [Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations).
- [Security model of Server Actions](https://nextjs.org/blog/security-nextjs-server-components-actions).
