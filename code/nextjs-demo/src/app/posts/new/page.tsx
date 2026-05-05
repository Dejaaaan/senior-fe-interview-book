"use client";

import { useActionState } from "react";
import { createPost, type ActionState } from "./actions";

const initial: ActionState = { errors: {} };

export default function NewPostPage() {
  const [state, action, pending] = useActionState(createPost, initial);

  return (
    <main>
      <h1>New post</h1>
      <form action={action} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
        <label>
          Title
          <input
            name="title"
            required
            aria-invalid={!!state.errors?.title}
            aria-describedby={state.errors?.title ? "title-error" : undefined}
          />
        </label>
        {state.errors?.title?.[0] && (
          <p id="title-error" role="alert">{state.errors.title[0]}</p>
        )}

        <button disabled={pending}>{pending ? "Creating..." : "Create"}</button>

        {state.ok && <p role="status">Created!</p>}
      </form>
    </main>
  );
}
