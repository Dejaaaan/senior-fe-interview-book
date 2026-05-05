"use server";

import { z } from "zod";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
});

export type ActionState = {
  errors?: { title?: string[] };
  ok?: boolean;
};

export async function createPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Pretend persistence
  await new Promise((r) => setTimeout(r, 300));

  return { ok: true };
}
