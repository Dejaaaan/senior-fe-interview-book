---
title: "TypeScript deep-dive"
sidebar_label: "2.1 TypeScript deep-dive"
description: "Generics, conditional/mapped types, narrowing, branded types, and the parts of the type system seniors are expected to use."
sidebar_position: 1
---

A senior interview will not stop at `string | number`. The expectation is that the candidate can articulate why TypeScript exists, can reach for the patterns that catch real bugs at compile time, and can make defensible choices about the strictness flags that govern an entire codebase. This chapter focuses on the parts of the type system that a senior is expected to use unprompted: generics with constraints, conditional and mapped types, exhaustive narrowing of discriminated unions, declaration files, branded types, and `tsconfig` strictness.

> **Acronyms used in this chapter.** API: Application Programming Interface. CI: Continuous Integration. ECMA: European Computer Manufacturers Association. ESM: ECMAScript Modules. JSX: JavaScript XML. TS: TypeScript. TDZ: Temporal Dead Zone.

## `tsconfig` strictness — the only flags that matter

`strict: true` enables the seven essential strict-mode checks (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`). It is the single highest-leverage knob in any TS codebase. Add the four extras that `strict` does not include:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

The two flags people most often miss:

- **`noUncheckedIndexedAccess`** — under this flag, `arr[0]` has type `T | undefined` rather than `T`. The change catches a substantial class of bugs (indexed access on a possibly empty array, dictionary lookup on a missing key) at the cost of a few defensive checks at boundaries.
- **`exactOptionalPropertyTypes`** — `{ name?: string }` no longer permits `{ name: undefined }`. The two are different in practice — the former is "the property is omitted", the latter is "the property exists and is `undefined`" — and serialisation behaviour, equality checks, and merge semantics treat them differently.

```ts
type Address = { street?: string };

const a: Address = { street: undefined };
// With exactOptionalPropertyTypes: error — the type forbids an explicit undefined.
// Use { } instead, or change the type to { street?: string | undefined }.
```

`verbatimModuleSyntax` removes the historical ambiguity around `import` elision: imports that are used only as types must be written `import type { … }`, and imports that are emitted into the JavaScript output are written without `type`. The flag eliminates a class of subtle bundling bugs where a type-only import was accidentally retained at runtime, pulling a heavy module into a hot path.

## Generics with constraints

Generics without constraints are equivalent to `unknown` with extra ceremony. The interesting patterns require a constraint that restricts the type parameter to a useful subset.

```ts
function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  return keys.reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Pick<T, K>);
}

const user = { id: 1, name: "Ada", email: "ada@example.com" };
const subset = pick(user, ["id", "name"]);
// subset: { id: number; name: string }
```

`K extends keyof T` is the constraint that makes the call safe and the return type precise. Without it, `keys` would be `string[]` and the return type would degrade to `Pick<T, string>`, which is uninhabited for any finite key set and therefore useless.

A second pattern that earns senior credit is the *higher-order generic* — a generic function that returns a generic function — used pervasively in form libraries and routers:

```ts
function field<T>() {
  return <K extends keyof T>(key: K, label: string): { key: K; label: string } => ({ key, label });
}

type LoginForm = { email: string; password: string };
const loginField = field<LoginForm>();

const emailField = loginField("email", "Email"); // { key: "email"; label: string }
// const wrong = loginField("token", "X"); // BAD: "token" is not assignable to keyof LoginForm.
```

The two-step API is the idiomatic way to fix one type parameter (the form shape) while leaving another (the field key) free.

## Conditional types and `infer`

Conditional types compute one type from another. The `infer` keyword extracts a piece of an inferred type within the conditional.

```ts
type AsyncReturn<F> = F extends (...args: infer _A) => Promise<infer R> ? R : never;

async function loadUser() {
  return { id: 1, name: "Ada" };
}

type User = AsyncReturn<typeof loadUser>; // { id: number; name: string }
```

This is the mechanism that libraries such as TanStack Query use to infer the data type of a hook from the fetcher passed in, with no explicit annotation by the caller.

A practical pattern that combines `infer` with template-literal types is route-parameter extraction:

```ts
type Params<S extends string> =
  S extends `${string}/:${infer P}/${infer Rest}`
    ? { [K in P | keyof Params<`/${Rest}`>]: string }
    : S extends `${string}/:${infer P}`
      ? { [K in P]: string }
      : {};

type Detail = Params<"/users/:userId/posts/:postId">;
// { userId: string; postId: string }
```

This is how typed routers (TanStack Router, type-route) generate per-route parameter shapes from a route literal at compile time, with no runtime cost.

## Mapped types

Mapped types build a new object type by iterating over the keys of another. They are the engine behind every utility type (`Partial`, `Required`, `Readonly`, `Pick`, and the rest of `lib.es5.d.ts`).

```ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type EventMap = { click: MouseEvent; keypress: KeyboardEvent };

type Handlers = {
  [K in keyof EventMap as `on${Capitalize<K>}`]: (event: EventMap[K]) => void;
};
// { onClick: (event: MouseEvent) => void; onKeypress: (event: KeyboardEvent) => void }
```

The `as` clause is the **key remapping** form — the mechanism that lets a mapped type rename keys while iterating, here prefixing each key with `on` and capitalising the first letter. The `Handlers` definition is two lines but it generates a precise event-handler type that scales with the event map, which is exactly how React's `DOMAttributes` is shaped under the hood.

## Discriminated unions and exhaustive narrowing

The single most useful pattern in any TypeScript codebase is to model state as a discriminated union, narrow with `switch`, and assert exhaustiveness in the `default` branch. The compiler then makes refactoring across a large frontend safe: adding a new variant fails the type check at every consumer until each is updated.

```ts
type Result<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function render<T>(r: Result<T>): string {
  switch (r.status) {
    case "idle":
      return "Click to load";
    case "loading":
      return "Loading...";
    case "success":
      return JSON.stringify(r.data);
    case "error":
      return r.error.message;
    default: {
      const _exhaustive: never = r;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

The `_exhaustive: never` assertion is the load-bearing line. Adding a new variant such as `{ status: "stale"; data: T }` to `Result` breaks the assignment to `never` and produces a compile error in every `switch` that has not been updated. This is the foundation of the safe-refactor experience that distinguishes a TypeScript codebase from a JavaScript one.

## Type predicates and assertion functions

When the compiler cannot follow the narrowing logic, the developer writes the predicate explicitly. The two forms differ in where the narrowing is applied:

```ts
function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

const ids = [1, undefined, 2, null, 3].filter(isNonNullable); // number[]

function assertDefined<T>(value: T, name: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`${name} is required`);
  }
}

declare const userId: string | undefined;
assertDefined(userId, "userId");
// From this point in the calling scope, userId is narrowed to string.
```

A type predicate (`x is T`) narrows inside a control-flow branch — the typical use is `if (predicate(x)) { /* x is T here */ }`. An assertion function (`asserts x is T`) narrows in the **rest of the calling scope** rather than only inside a branch, which is what makes `assertDefined` useful at the boundary of a function where the caller is supposed to have provided a value but the type system cannot prove it. A common pitfall is forgetting that an assertion function must throw on failure — a function that only sets a flag and returns will satisfy the signature but lie to the compiler in the success path.

## Branded types

Plain `string` and `number` mix freely. When the underlying primitives represent different concepts, the compiler should treat them as distinct types so that mistakes such as passing a `UserId` where an `OrderId` is required are caught at compile time.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };

type UserId = Brand<string, "UserId">;
type Email = Brand<string, "Email">;

function toUserId(s: string): UserId {
  if (!/^usr_/.test(s)) throw new Error("invalid user id");
  return s as UserId;
}

declare function sendEmail(to: Email, body: string): Promise<void>;

const userId = toUserId("usr_123");
// sendEmail(userId, "hi"); // BAD: Type 'UserId' is not assignable to type 'Email'.
```

The runtime cost is zero — the brand is a phantom field that exists only at compile time. The pattern prevents an entire class of bugs in domains where many concepts share the same primitive: monetary amounts (`USD` versus `EUR`), identifiers (`UserId` versus `OrderId`), or measurements (`Pixels` versus `Centimeters`). Senior interviewers ask about branded types because they are the cleanest way to demonstrate that a candidate has thought past "string is fine".

## Declaration files (`.d.ts`)

A senior frontend engineer typically writes a declaration file twice in a career: once when adding types to an untyped library, and once when extending a global scope (for example, attaching a property to `window` for analytics or feature flags).

```ts
// src/types/global.d.ts
export {};

declare global {
  interface Window {
    __APP_VERSION__: string;
  }
}
```

Notice the `export {};` on the first line. Without it, the file is treated as a global script rather than a module, and the `declare global` block has no effect at all. This is one of the most common reasons that `Window` augmentations are silently ignored — the file looks correct, the type-check passes, but the augmented property is unreachable from the rest of the codebase.

When typing an untyped library, the minimal declaration file is:

```ts
// src/types/some-lib.d.ts
declare module "some-lib" {
  export function doThing(input: string): Promise<number>;
  const _default: { doThing: typeof doThing };
  export default _default;
}
```

The `declare module "name"` form tells TypeScript "trust this signature when you see `import` from this module name". Use it sparingly — the better long-term answer is to contribute types upstream or migrate to a typed alternative — but it unblocks a project on day one.

## Variance: function parameters are bivariant by default

```ts
type Handler<T> = (value: T) => void;

const stringHandler: Handler<string> = (s) => console.log(s.toUpperCase());
const broader: Handler<unknown> = stringHandler; // OK: allowed (bivariance)
```

The assignment is unsound — `broader` could be called with a number and `stringHandler` would crash trying to read `.toUpperCase()` — but it is historically accepted for ergonomic reasons (it makes event-handler arrays much easier to type). To opt into strict (contravariant) checking, write parameters as method syntax under `strictFunctionTypes`:

```ts
type Strict<T> = { handle(value: T): void };
```

The distinction matters when designing library APIs that take callbacks. A library that exposes `onChange: (value: T) => void` will accept a wider handler than a library that exposes `{ onChange(value: T): void }`. The method-syntax form is the safer default for public APIs because it is contravariant; the function-syntax form is the more ergonomic default for internal types.

## Key takeaways

- Turn on `strict`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. They are the only flags whose presence or absence is visible from the outside in code review.
- Generics earn their keep when they are constrained (`<K extends keyof T>`). An unconstrained generic is `unknown` with extra ceremony.
- Discriminated unions plus a `switch` plus a `never`-assertion give compile-time exhaustiveness. This is the foundation of safe refactoring across a large frontend.
- Branded types make distinct concepts that share a primitive (identifiers, currencies, measurements) safe at zero runtime cost.
- Type predicates (`x is T`) narrow inside a branch; assertion functions (`asserts x is T`) narrow in the rest of the calling scope. Use the latter at boundaries where the type system cannot prove a value is defined.
- Function parameters are bivariant by default; method-syntax parameters are contravariant under `strictFunctionTypes`. The distinction matters for public library APIs.

## Common interview questions

1. What does `noUncheckedIndexedAccess` change, and why would you turn it on in a senior codebase?
2. Walk through writing a `DeepReadonly<T>` type from scratch.
3. How would you model a request lifecycle so the compiler forces every consumer to handle every state?
4. Explain branded types. What problem do they solve that nominal types in Java solve?
5. What is the difference between a type predicate and an assertion function?

## Answers

### 1. What does `noUncheckedIndexedAccess` change, and why would you turn it on in a senior codebase?

`noUncheckedIndexedAccess` changes the type of indexed access expressions on arrays and index signatures from `T` to `T | undefined`. After enabling the flag, `const first = items[0]` produces a `T | undefined` value, and the compiler refuses to dereference `first` until the `undefined` case has been handled. This catches the entire class of bugs where a developer assumed an array was non-empty or a record contained a key, and the assumption silently held in development but failed in production on an empty list or a missing entry.

**How it works.** TypeScript distinguishes between `T[]` access and the looser `Record<string, T>` access. Without the flag, both return `T`, which is convenient but unsound. The flag does not change the array's type — `items` is still `T[]` — only the type of the access expression. The runtime behaviour is unchanged; the JavaScript output is identical.

```ts
const codes: string[] = [];
const first = codes[0];
// Without the flag: first: string. The next line crashes at runtime.
// With the flag:    first: string | undefined. The next line is a compile error
// until you handle the undefined case.
console.log(first.toUpperCase());
```

**Trade-offs / when this fails.** The flag adds friction at boundaries. Tight loops over arrays read a few characters longer because each indexed access needs a guard or a definite-assignment annotation. The cleanest way to absorb the friction is to use iteration (`for (const code of codes)`) or destructuring (`const [first] = codes`) where possible, both of which preserve `T` rather than `T | undefined`. The flag is unambiguously the right choice for any codebase that cares about runtime safety, which in 2026 is every senior codebase.

### 2. Walk through writing a `DeepReadonly<T>` type from scratch.

The goal is a type that recursively marks every property and every nested property as `readonly`, transforming `{ user: { name: string } }` into `{ readonly user: { readonly name: string } }`. The implementation is a mapped type with a conditional inside it: for each key, if the value is an object, recurse; otherwise, mark the key as `readonly` and leave the value alone.

**How it works.** The mapped-type syntax `[K in keyof T]` iterates the keys of `T`. The `readonly` modifier in front of `[K in keyof T]` adds the modifier to each generated property. The conditional `T[K] extends object ? DeepReadonly<T[K]> : T[K]` is the recursive case: if the value is an object, replace it with its deep-readonly version; otherwise leave the primitive in place.

```ts
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type Config = {
  endpoint: string;
  retry: { attempts: number; delayMs: number };
};

type Frozen = DeepReadonly<Config>;
// {
//   readonly endpoint: string;
//   readonly retry: { readonly attempts: number; readonly delayMs: number };
// }
```

**Trade-offs / when this fails.** The `extends object` test is too broad in practice: it includes functions, arrays, and class instances, which usually you do want to recurse into but sometimes you do not. A production-grade implementation typically excludes specific built-ins:

```ts
type DeepReadonly<T> = T extends Function | Date | Error
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };
```

Also note that `readonly` is a compile-time guarantee only — `Object.freeze` is the runtime equivalent and the two are independent.

### 3. How would you model a request lifecycle so the compiler forces every consumer to handle every state?

Model the lifecycle as a discriminated union with a literal-string discriminant, narrow with `switch`, and assert exhaustiveness in the `default` branch. The exhaustiveness assertion is the load-bearing piece: adding a new variant later breaks every consumer that has not been updated, which turns a refactor into a guided edit rather than a hunt for missed call-sites.

**How it works.** The discriminant property (`status` in the example below) is a literal-string union, so the compiler can narrow the surrounding type whenever the code reads `r.status`. The `default` branch assigns the remaining value to a `never`-typed local; if the union is fully handled, the value is `never` and the assignment succeeds, otherwise the assignment fails with a type error that names the missed variant.

```ts
type Result<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function render<T>(r: Result<T>): string {
  switch (r.status) {
    case "idle":
      return "Click to load";
    case "loading":
      return "Loading...";
    case "success":
      return JSON.stringify(r.data);
    case "error":
      return r.error.message;
    default: {
      const _exhaustive: never = r;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

**Trade-offs / when this fails.** The pattern only works if the discriminant is a literal type, not an open `string`. If the union grows large (say, ten variants), the `switch` becomes long; the cure is to dispatch through a record (`const renderers: Record<Result<T>["status"], …>`) which gives the same exhaustiveness check via `Record`. The pattern fails when consumers receive the union as a JSON payload from the network without runtime validation, because the compiler trusts a value that the runtime cannot — pair with Zod or another runtime validator at the network boundary.

### 4. Explain branded types. What problem do they solve that nominal types in Java solve?

A branded type intersects a primitive with a phantom marker (`type UserId = string & { readonly __brand: "UserId" }`) so that the compiler treats it as a distinct type from a plain `string`. The runtime representation is unchanged — the brand is purely a compile-time construct — but assignments between values with different brands are rejected. The pattern brings nominal-typing semantics to TypeScript's structural type system for cases where structural compatibility is too permissive.

**How it works.** TypeScript's type system is structural: two types are compatible if they have the same shape. A `UserId` and an `OrderId` that are both aliases for `string` are interchangeable, which is unsafe in any code that operates on identifiers. Branding adds a property that exists only in the type domain, breaking structural equivalence: `UserId & { __brand: "UserId" }` and `OrderId & { __brand: "OrderId" }` no longer share a shape, so the compiler refuses cross-assignment.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type Cents = Brand<number, "Cents">;
type Euros = Brand<number, "Euros">;

declare function chargeCents(amount: Cents): void;
const total = 1999 as Cents;
chargeCents(total);                  // ok
chargeCents(1999 as Euros);          // type error
```

**Trade-offs / when this fails.** The constructor is the weakest link: somebody has to call `as UserId` or `toUserId(s)` to mint the branded value, and a careless `as` cast bypasses the protection. The standard countermeasure is a single constructor per branded type that performs runtime validation (regex, length check, schema parse) and is the only place the cast is allowed. The pattern is exactly what nominal types in Java provide for free; in TypeScript the same safety requires a small library of constructors and discipline at the network boundary.

### 5. What is the difference between a type predicate and an assertion function?

A type predicate is a function whose return type is `value is T` and whose effect is to narrow a value within a control-flow branch — the typical use is `if (isUser(x)) { /* x is User here */ }`. An assertion function is one whose return type is `asserts value is T` and whose effect is to narrow the value in the rest of the calling scope after the function returns; the assertion fails by throwing.

**How it works.** A type predicate is purely a return-type annotation — the function still has to return a `boolean` whose `true` branch implies `value is T`. The narrowing happens at the call site, inside the surrounding `if` or in the consequent of a ternary. An assertion function does not return a value (or returns `void`); after it returns normally, the compiler treats the value as narrowed for the rest of the function. The crucial constraint is that an assertion function *must throw* on the failure path — a function that returns silently in the failure case lies to the compiler.

```ts
function isUser(x: unknown): x is User {
  return typeof x === "object" && x !== null && "id" in x;
}

function assertUser(x: unknown): asserts x is User {
  if (!isUser(x)) throw new TypeError("not a user");
}

declare const value: unknown;
if (isUser(value)) { value.id; }      // narrowed inside the if
assertUser(value); value.id;           // narrowed afterwards in the rest of the scope
```

**Trade-offs / when this fails.** Predicates are the right tool when the narrowing is one of several branches at a call site (for example, distinguishing variants of a union); assertions are the right tool at boundaries where the value is supposed to be of the type and the compiler simply does not know it. The hidden hazard is that both rely on the developer to keep the runtime check in sync with the type signature — TypeScript trusts the annotation and does not verify the body. A predicate that says `value is User` but checks only the `id` field will lie if a future `User` field is required. The standard mitigation is to derive the predicate from a Zod (or similar) schema so that the compile-time and runtime views of the type are guaranteed to match.

## Further reading

- [TypeScript handbook: Everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).
- [Total TypeScript essentials](https://www.totaltypescript.com/books/total-typescript-essentials).
- [Effective TypeScript](https://effectivetypescript.com/) by Dan Vanderkam.
