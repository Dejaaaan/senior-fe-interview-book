// Branded types: zero runtime cost, compile-time safety.
// Run: pnpm --filter ts-demos demo:branded

type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type Email = Brand<string, "Email">;

export function toUserId(s: string): UserId {
  if (!/^usr_/.test(s)) throw new Error("invalid user id");
  return s as UserId;
}

export function toEmail(s: string): Email {
  if (!/.+@.+\..+/.test(s)) throw new Error("invalid email");
  return s as Email;
}

declare function sendEmail(to: Email, body: string): Promise<void>;

const userId = toUserId("usr_123");
const email = toEmail("ada@example.com");

console.log({ userId, email });

// Uncomment to see the type error:
// sendEmail(userId, "hi"); // Argument of type 'UserId' is not assignable to parameter of type 'Email'.
