---
title: "Forms"
sidebar_label: "3.6 Forms"
description: "React Hook Form + Zod, controlled vs uncontrolled, server actions, accessibility, and the patterns that scale."
sidebar_position: 6
---

Forms are where React applications spend most of their bug budget. The senior position is: **uncontrolled by default, validate with a schema, integrate with the same application programming interface (API) surface the server expects, and make accessibility non-optional**.

> **Acronyms used in this chapter.** API: Application Programming Interface. ARIA: Accessible Rich Internet Applications. CSS: Cascading Style Sheets. DB: Database. DOM: Document Object Model. JSX: JavaScript XML. RHF: React Hook Form. UI: User Interface.

## Controlled vs. uncontrolled

A **controlled** input keeps its value in React state; the input is told what to display on every render. The component owns the value and has full visibility into every keystroke, at the cost of one re-render per keystroke per field.

```tsx
const [name, setName] = useState("");
<input value={name} onChange={(e) => setName(e.target.value)} />
```

An **uncontrolled** input keeps its value in the Document Object Model; the component reads the value only when needed, typically on submit. The component renders less often (the input does not re-render on each keystroke) at the cost of giving up moment-to-moment visibility.

```tsx
<input ref={inputRef} defaultValue="Ada" />
inputRef.current?.value;
```

Controlled is easier to reason about for small forms but causes a re-render per keystroke per field, which scales poorly for forms with many fields and pushes the form into noticeable input lag on slower devices. Uncontrolled scales better because no React work happens during typing; **React Hook Form** uses uncontrolled inputs by default for exactly this reason.

## React Hook Form + Zod: the senior default

```tsx
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ onSubmit }: { onSubmit: (v: FormValues) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch (err) {
          if (err instanceof InvalidCredentials) {
            setError("password", { message: "Wrong email or password" });
          } else {
            setError("root", { message: "Something went wrong" });
          }
        }
      })}
      noValidate
    >
      <Field label="Email" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      {errors.root && <p role="alert">{errors.root.message}</p>}

      <button disabled={isSubmitting}>Sign in</button>
    </form>
  );
}
```

The shape captures five decisions that scale across the codebase. **Schema-first validation** with Zod means the same schema validates the request body on the server (Express plus Zod, NestJS plus Zod, Fastify with `zod-to-json-schema`) — one source of truth for both shape and validation rules. **Uncontrolled inputs** keep the form's render budget low because typing does not re-render the form on every keystroke. **`setError` for server errors** routes failed-submission errors into the same UI as client-side validation errors, so the user does not see two different error styles depending on where the validation ran. **`autocomplete`** unlocks password managers, contact-information autofill, and accessibility. **`aria-invalid` plus a linked error message via `aria-describedby`** ensures screen readers announce both the invalid state and the message.

## The `Field` primitive

Every form has the same wrapper: label, control, error. Build one component:

```tsx
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  const id = useId();
  const errorId = `${id}-error`;
  const child = cloneElement(children, {
    id,
    "aria-describedby": error ? errorId : undefined,
  });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {child}
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}
```

This is one reason headless component libraries (Radix, React Aria) exist — they ship the wiring but not the styles.

## Async validation

Use `mode: "onBlur"` to avoid running the async validator on every keystroke; debounce as needed.

```tsx
const schema = z.object({
  username: z
    .string()
    .min(3)
    .refine(async (v) => !(await api.usernameTaken(v)), "Already taken"),
});
```

For richer cases (need to throttle, cache, or share state with another field), drop down to a custom validator that wraps a server check.

## Server Actions (Next.js / React 19)

Forms can submit directly to a Server Action without a hand-rolled API or fetch. The form's `action` prop accepts an async function that runs on the server.

```tsx
"use server";
export async function createPost(prev: State, formData: FormData) {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  await db.post.insert(parsed.data);
  redirect("/posts");
}
```

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

export function NewPost() {
  const [state, action, pending] = useActionState(createPost, { errors: {} });
  return (
    <form action={action}>
      <input name="title" aria-invalid={!!state.errors?.title} />
      {state.errors?.title?.[0] && <p role="alert">{state.errors.title[0]}</p>}
      <textarea name="body" />
      <button disabled={pending}>Create</button>
    </form>
  );
}
```

Pair with `useFormStatus()` inside a button to show pending state without prop drilling.

## File uploads

Use a Server Action or a presigned URL flow (covered in [AWS S3](../12-aws/02-s3.md) and [interview prompt: file uploader](../13-interview-prep/05-worked-uploader.md)).

For multi-file or large uploads, use chunked uploads with resumability — never POST a 2 GB blob in one request.

## Accessibility checklist for forms

A senior-quality form satisfies six accessibility commitments. Every input has a `<label htmlFor>` matching the input's `id`, or wraps the input directly so the screen-reader name comes from the visible label. The `autocomplete` attribute is set on every known field so password managers and assistive technology can populate the field correctly. Errors are linked to the input via `aria-describedby` and announced via `role="alert"` or an `aria-live` region. The submit control is a real `<button>`, never a `<div onClick>`, so keyboard, focus, and `Enter`-to-submit all work without custom code. The submit button shows pending state during submission and is disabled while the request is in flight, so the user does not double-submit. Keyboard users can submit with `Enter` from any input — which is free if the markup uses `<form>` rather than a bare `<div>`.

## Key takeaways

- Use uncontrolled inputs (React Hook Form) for performance; reach for controlled only when you need to react to every keystroke.
- One Zod schema, validated on both client and server.
- Build a `Field` primitive once; never write `<label>` + `<input>` + `<error>` by hand again.
- For Next.js: prefer Server Actions + `useActionState` over hand-rolled fetch + state.
- Treat accessibility as part of "is the form done", not a polish step.

## Common interview questions

1. Controlled versus uncontrolled — when each, and why does it matter for performance?
2. Walk me through validating the same form on both client and server with one schema.
3. How does `useActionState` differ from `useState` plus `fetch`?
4. How do you surface a server error (for example, "username taken") on the right field?
5. What is the smallest set of accessibility wiring to make a form usable with a screen reader?

## Answers

### 1. Controlled versus uncontrolled — when each, and why does it matter for performance?

A controlled input keeps its value in React state and re-renders the component on every keystroke. An uncontrolled input keeps its value in the Document Object Model and the component reads the value only when it needs to (typically on submit). Use controlled when the component must react to every keystroke — for example, an autocomplete that filters as the user types, a credit-card field that masks during entry, or a character-count display below the input. Use uncontrolled (typically via React Hook Form) for everything else, because the cumulative cost of one render per keystroke per field becomes noticeable in larger forms on slower devices.

**How it works.** A controlled input passes both `value` and `onChange` props. The state setter inside `onChange` triggers a re-render, the new `value` flows back into the input on the next render, and the cycle repeats per keystroke. An uncontrolled input passes only `defaultValue` and a `ref`; the browser tracks the value internally and the React tree does not re-render on input. React Hook Form layers a `register` API over the uncontrolled pattern to subscribe to values without owning them.

```tsx
// Controlled: re-renders per keystroke.
const [name, setName] = useState("");
<input value={name} onChange={(e) => setName(e.target.value)} />

// Uncontrolled: zero re-renders per keystroke.
const ref = useRef<HTMLInputElement>(null);
<input defaultValue="Ada" ref={ref} />
const submit = () => api.update(ref.current!.value);
```

**Trade-offs / when this fails.** The controlled-vs-uncontrolled distinction does not matter for forms with three fields and no per-keystroke logic. It matters substantially for forms with twenty fields and a few thousand renders per minute (signup flows, configuration screens, tabular data editors). The other failure mode is mixing the two: declaring `value={state}` without `onChange` produces a "controlled component without `onChange`" warning and a read-only input. The senior choice is to commit to one model per form.

### 2. Walk me through validating the same form on both client and server with one schema.

Define the schema once (in Zod, Valibot, or the team's chosen schema library), export it from a shared module, and use it on both sides: the client uses `zodResolver(schema)` with React Hook Form for instant feedback on the user's input, and the server validates the request body with `schema.safeParse(body)` before processing. Validation errors from the server use the same field names, so the client can route them back to the right field via `setError(fieldName, { message })` on submission failure.

**How it works.** The schema is a value, not a generated type, so it can be imported by both the React frontend and the Node backend without code generation. The TypeScript type is inferred from the schema via `z.infer<typeof schema>`, which gives both sides the same compile-time type. The `safeParse` result is a discriminated union of `{ success: true; data }` and `{ success: false; error }`, so the server can branch on the result and return a structured error response to the client.

```ts
// shared/schemas.ts
import { z } from "zod";
export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

// client
const form = useForm<CreatePostInput>({ resolver: zodResolver(createPostSchema) });

// server (Express)
app.post("/posts", (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  // ...
});
```

**Trade-offs / when this fails.** The pattern requires a shared package or workspace where both client and server can import the schema; in a monorepo this is straightforward, in a split repo it is more work. The pattern also fails for validation that is fundamentally server-only (uniqueness checks, authorisation checks) — those errors come back on submission and must be routed to the right field via `setError`, which is the topic of the next answer.

### 3. How does `useActionState` differ from `useState` plus `fetch`?

`useActionState` is purpose-built for the form-action lifecycle in React 19: it returns the current state, a wrapped action that updates it on submit, and a pending flag, with the action running on the server when the underlying function is a Server Action. The hand-rolled `useState` plus `fetch` requires the developer to manage the pending flag, the error handling, the optimistic state, and the integration with the form's `action` prop manually, and it does not integrate with React 19's progressive-enhancement story for forms that submit before JavaScript hydrates.

**How it works.** `useActionState(action, initial)` accepts a function whose first argument is the previous state and whose remaining arguments are the form data, and returns `[state, wrappedAction, pending]`. Passing `wrappedAction` to a `<form action={...}>` makes the form submission run the action; the action's return value becomes the next state. The wrapped action also works server-side: the form is functional even before client-side React hydrates, because the action is dispatched as a normal HTTP POST.

```tsx
"use client";
import { useActionState } from "react";
import { createPost } from "./actions";

const initial = { errors: {} as Record<string, string[]> };

export function NewPost() {
  const [state, action, pending] = useActionState(createPost, initial);
  return (
    <form action={action}>
      <input name="title" aria-invalid={!!state.errors.title} />
      <button disabled={pending}>Create</button>
    </form>
  );
}
```

**Trade-offs / when this fails.** The hook is tied to React 19's action model and to a framework that supports Server Actions (Next.js, the experimental React server runtimes). For a Single-Page Application with no Server Action support, the hand-rolled `useState` plus `fetch` (or TanStack Query's `useMutation`) is still the right shape. The hook also cannot return a non-serialisable value because the action may run on the server; the state must be a plain object.

### 4. How do you surface a server error on the right field?

The server returns a structured error response — typically an object keyed by field name with an array of messages per field, the shape that `safeParse(...).error.flatten()` produces. The client unwraps the error in the submit handler and calls `form.setError(fieldName, { message })` for each field error. The error then renders in the same `aria-invalid` plus `aria-describedby` slot as the client-side validation errors, so the user sees a unified error UI regardless of where the validation ran.

**How it works.** React Hook Form's `setError` writes into the `formState.errors` object, which is the same object that the client-side validator writes into. The component reads `errors.email?.message` and renders it the same way for client and server errors. For errors that do not belong to a specific field (network failure, unexpected server crash), use the `root` key (`form.setError("root", { message: "Something went wrong" })`).

```tsx
const onSubmit = handleSubmit(async (values) => {
  try {
    await api.createUser(values);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      form.setError("email", { message: "Email already taken" });
    } else {
      form.setError("root", { message: "Something went wrong" });
    }
  }
});
```

**Trade-offs / when this fails.** The pattern requires the server to return errors in a shape the client can map back to fields. The standard contract is the RFC 7807 `application/problem+json` envelope (covered in [Part 9 chapter 4](../09-rest-and-networking/04-errors.md)) extended with a `fields` member, or the flatter `{ fieldErrors: { email: ["…"] } }` shape that Zod's `flatten()` produces. The pattern fails for errors that genuinely cannot be tied to a field — for example, a network outage — which is why the `root` error key exists.

### 5. What is the smallest set of accessibility wiring to make a form usable with a screen reader?

Five attributes per input, plus one wrapper. Each input has an `id` matched by a `<label htmlFor={id}>`. Each input has an `autoComplete` value chosen from the standard list (for example, `email`, `current-password`, `name`). Errors render in an element whose `id` is referenced by the input's `aria-describedby`. The input has `aria-invalid={true}` when an error is present. The error element has `role="alert"` (or lives inside a static `aria-live="polite"` region) so the screen reader announces it. The wrapping element is a real `<form>` so `Enter` submits and the browser's native form behaviour is preserved.

**How it works.** Screen readers consume the accessibility tree, which is computed from the Document Object Model plus ARIA attributes. The label text becomes the input's accessible name, the `aria-describedby` text is read after the name, the `aria-invalid` flag is announced as "invalid", and the live region triggers an announcement when its text changes. Together they give the user a coherent narrative: name, value, validation status, error explanation.

```tsx
<form>
  <label htmlFor="email">Email</label>
  <input id="email" type="email" autoComplete="email" aria-invalid={!!err}
         aria-describedby={err ? "email-error" : undefined} required />
  {err && <p id="email-error" role="alert">{err}</p>}
  <button>Sign in</button>
</form>
```

**Trade-offs / when this fails.** The minimum wiring assumes the visible label, the input, and the error message are all in the standard order in the DOM. Custom layouts that move the label below the input or render the error far from the input still work because the `aria-describedby` is the contract, but visual designers sometimes need a reminder that the visual order should follow the source order for the screen reader to make sense. The pattern is also incomplete for compound widgets (date pickers, combo boxes) which require a richer ARIA pattern; for those, delegate to a primitive library such as Radix or React Aria.

## Further reading

- React Hook Form [docs](https://react-hook-form.com/).
- Zod [docs](https://zod.dev/).
- Adam Wathan, ["Renderless Components"](https://adamwathan.me/renderless-components-in-vuejs/) — concept that became headless components.
