---
title: "Testing — first principles"
sidebar_label: "3.8 Testing — first principles"
description: "Vitest + React Testing Library: what to test, what not to, and the patterns that age well."
sidebar_position: 8
---

Senior interviewers care less about which tool the candidate uses and more about whether the candidate tests the right things. The full strategy (the test pyramid, Mock Service Worker, Playwright, visual regression) is in [Production Concerns: Testing strategy](../07-production-concerns/02-testing-strategy.md). This chapter is the React-specific introduction.

> **Acronyms used in this chapter.** API: Application Programming Interface. CI: Continuous Integration. DOM: Document Object Model. JSDOM: JavaScript Document Object Model (a Node.js implementation of the DOM). MSW: Mock Service Worker. RTL: React Testing Library. UI: User Interface.

## Test behaviour, not implementation

The single rule that ages well: **assert what the user sees and does, not how the component is built**.

```tsx
// BAD: implementation detail — breaks on refactor
expect(component.state.count).toBe(1);
expect(wrapper.find("Counter").prop("count")).toBe(1);

// OK: user-observable
expect(screen.getByRole("status")).toHaveTextContent("Count: 1");
```

This is the philosophy of **React Testing Library (RTL)** — it intentionally has no application programming interface to read state, no API to find children by class name, and no API to call methods. The tests query the rendered Document Object Model the way a user, or a screen reader, does.

## The test stack

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
```

```ts
// src/setupTests.ts
import "@testing-library/jest-dom/vitest";
```

The pieces, with a short justification for each:

- **Vitest** — a fast Vite-native test runner. Jest works equally well; choose Vitest if the project is already on Vite or on Next.js with Turbopack-based tests, otherwise Jest is a safe default.
- **React Testing Library** — the render and query application programming interface.
- **`@testing-library/user-event`** — simulates real interactions with a focus on accessibility. A click fires the focus events the browser would, typing fires composition events, and the cursor position is tracked across keystrokes, all of which are necessary to write tests that catch real interaction bugs.
- **Mock Service Worker (MSW)** — mock HyperText Transfer Protocol requests at the network layer instead of stubbing `fetch`. The component's network code runs unchanged; only the responses are controlled.

## The canonical query order

When finding elements, prefer queries in the following order. This is the order React Testing Library recommends and the order interviewers expect:

1. **`getByRole`** with optional `name` — the closest analogue to how a screen reader sees the page, so a passing assertion doubles as an accessibility check.
2. **`getByLabelText`** for form fields, because it asserts that the field has a programmatically associated label.
3. **`getByPlaceholderText`** when there is no label, although the absence of a label is usually itself a bug to fix.
4. **`getByText`** for non-interactive content such as headings and prose.
5. **`getByTestId`** as a last resort and explicit escape hatch.

```tsx
// good
const submit = screen.getByRole("button", { name: /sign in/i });

// last resort
const card = screen.getByTestId("featured-card");
```

If `getByTestId` shows up often in the test suite, the components probably are not accessible — that recurring need is the signal that the underlying components are missing roles, names, or both.

## A canonical component test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

it("calls onSubmit with the entered credentials", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/email/i), "ada@example.com");
  await user.type(screen.getByLabelText(/password/i), "secret123");
  await user.click(screen.getByRole("button", { name: /sign in/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: "ada@example.com",
    password: "secret123",
  });
});

it("shows a validation error when email is missing", async () => {
  const user = userEvent.setup();
  render(<LoginForm onSubmit={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: /sign in/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/email/i);
});
```

Two notes that come up in code review and that the test pattern depends on. **`findBy*` waits asynchronously; `getBy*` does not.** Use `findBy` for anything that appears after an asynchronous transition (post-submit error message, fetched data, post-effect content), and use `getBy` for synchronously rendered content. **`userEvent.setup()` returns a fresh `user` per test**, which carries the keyboard and pointer state across calls within the test. The older default-export style is deprecated.

## Mocking the network with MSW

Do not stub `fetch`. Stub HyperText Transfer Protocol at the network layer with **Mock Service Worker (MSW)** so the component runs the real `fetch` code path and the request shape becomes part of the test contract. A test that asserts the right body, headers, and method is testing the contract the server expects, not the call signature of `fetch`.

```ts
// src/test/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Ada" }),
  ),
];
```

```ts
// src/test/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
export const server = setupServer(...handlers);
```

```ts
// src/setupTests.ts
import { server } from "./test/server";
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Now any component that calls `/api/users/...` works in tests with no mocks scattered through component files.

## What not to test

Four categories of test add cost without value and should be deleted on sight. **Implementation details** — internal state, exact prop shapes, lifecycle order — couple the test to the implementation rather than the behaviour, so a refactor that preserves behaviour breaks the test. **Third-party libraries** — there is no value in testing that React Hook Form's `register` works; the library has its own tests, and the application's tests should assert the application's behaviour. **Trivial getters** — testing `function add(a, b) { return a + b }` adds no value because the function is its own specification. **Generated code** — type definitions, OpenAPI clients, snapshot files that no one reads — produces churn without catching real regressions.

If a test re-implements the component to assert the component, delete it.

## Snapshot tests

Use snapshot tests sparingly. Two uses are legitimate. **Locking down a JavaScript Object Notation contract** that the team has agreed not to break casually — for example, the schema of an event sent to an analytics pipeline. **Visual regression with screenshot snapshots** via Playwright or Storybook plus Chromatic, which is a fundamentally different mechanism from `toMatchSnapshot` on rendered React.

`toMatchSnapshot` on rendered React is almost always the wrong tool. The snapshot drifts as innocuous markup changes, developers regenerate it without reading the diff, and the test stops catching anything meaningful while still adding noise to every pull request.

## Async patterns

```tsx
// Wait for an element to appear
const el = await screen.findByRole("status");

// Wait for an element to disappear
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

// Custom wait
await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
```

`waitFor` retries the assertion until it passes or times out (the default is one second). Avoid putting multiple assertions inside one `waitFor` — the test runs slower because each retry re-runs every assertion, and the failure message is harder to read because it does not pinpoint which assertion failed.

## Coverage is not quality

Coverage tells the team which lines were executed during the test run, not whether the assertions on those lines are meaningful. A test that calls a function but asserts nothing improves coverage and reveals nothing. Aim for a coverage target as a smoke check (for example, seventy per cent) but do not pursue one hundred per cent — the last twenty per cent is usually error paths and dead branches that no one benefits from testing in unit tests anyway, and the pursuit produces tests that exist only to satisfy the coverage threshold.

## Key takeaways

- Test what the user observes; assertions on internal state are footguns.
- Prefer `getByRole` with `name` — it doubles as an a11y check.
- Use `userEvent` (not `fireEvent`) — it simulates real keystrokes and focus.
- Mock HTTP at the network layer with MSW; don't stub `fetch`.
- Snapshots: rare, intentional. Default to behavioural assertions.
- Coverage is a smoke check, not a goal.

## Common interview questions

1. Why does React Testing Library not let you read internal state?
2. What is the difference between `getByText` and `findByText`? When do you use each?
3. Why is Mock Service Worker preferable to stubbing `fetch`?
4. When is `toMatchSnapshot` the wrong tool?
5. How would you test a form's validation behaviour without testing React Hook Form's internals?

## Answers

### 1. Why does React Testing Library not let you read internal state?

Because tests that read internal state are coupled to the implementation rather than to the behaviour. A refactor that changes the internal data structure but preserves the user-observable behaviour breaks every such test, so the test becomes a tax on legitimate refactoring rather than a safety net for regressions. RTL deliberately omits state-reading APIs to push the developer toward assertions on what the user sees, which are stable across implementation changes and which double as accessibility checks because the queries operate on the accessibility tree.

**How it works.** RTL queries the rendered Document Object Model through the accessibility tree (`getByRole`), the labels (`getByLabelText`), and the visible text (`getByText`). The tests assert on the same surface a user or screen reader would observe — the role of an element, its accessible name, its visible content, its disabled or invalid state. The component's internal state is a private implementation detail that the test should not need to know about.

```tsx
// Bad: couples to the internal state shape.
expect(component.state.count).toBe(1);

// Good: asserts on what the user sees.
expect(screen.getByRole("status")).toHaveTextContent("Count: 1");
```

**Trade-offs / when this fails.** The pattern requires the application to expose the relevant state through the rendered output, which is usually the right design pressure. The pattern is uncomfortable for fully-async state machines whose intermediate states are not user-visible; for those, a separate test of the state machine itself (a pure function or hook) is appropriate, and the integration test asserts on the visible outcome.

### 2. What is the difference between `getByText` and `findByText`? When do you use each?

`getByText` is synchronous: it queries the rendered DOM immediately and throws if the element is not present. `findByText` is asynchronous: it polls for the element and resolves a `Promise` when the element appears, throwing only if the element does not appear within the timeout (the default is one second). Use `getByText` for content that is rendered synchronously by the component on its first render. Use `findByText` for content that appears after an asynchronous transition — a fetched value, a post-submit error message, an animation that mounts a new element.

**How it works.** Both queries share the same underlying matcher (`getByText`, `queryAllByText`, etc.). The difference is what happens when the element is not found: `getByText` throws synchronously; `queryByText` returns `null`; `findByText` polls via `waitFor` until the element exists or the timeout elapses. The asynchronous variant is necessary because React commits asynchronously after `setState` and the rendered output reflects the new state only after the commit.

```tsx
// Synchronous content.
expect(screen.getByText(/welcome/i)).toBeInTheDocument();

// Asynchronous content.
const error = await screen.findByText(/invalid email/i);
expect(error).toHaveAttribute("role", "alert");
```

**Trade-offs / when this fails.** A common bug is using `getByText` for asynchronous content; the test fails because the element is not yet rendered when the assertion runs. The fix is `findByText`. The opposite mistake — using `findByText` for synchronous content — works but is slower because the test waits for the polling interval. A `queryByText` returning `null` is the right tool to assert that something is *not* present, because `getByText` would throw and `findByText` would only fail after the timeout.

### 3. Why is Mock Service Worker preferable to stubbing `fetch`?

Stubbing `fetch` couples the test to the call signature of `fetch` and forgets the request shape. The component might call `fetch("/api/users", { method: "GET" })` correctly in the test and `fetch("/api/users", { method: "POST" })` incorrectly in production, and the stub would not catch the change. Mock Service Worker intercepts the request at the network layer using the same Service Worker mechanism the browser uses for offline support, so the component's full network code path runs and the test asserts on the actual outgoing HTTP request — method, headers, body, query string. The request shape becomes part of the test contract.

**How it works.** MSW registers a list of HTTP handlers (`http.get`, `http.post`, etc.) that match request URLs and methods. When the component calls `fetch`, MSW intercepts the request before it leaves the runtime and returns the configured response. The handlers can read the request body, return different responses for different inputs, and assert on call counts. The same handlers work in tests (Node), in development (browser via the Service Worker), and in Storybook, which makes the network layer consistent across environments.

```ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Ada" }),
  ),
  http.post("/api/users", async ({ request }) => {
    const body = (await request.json()) as { name: string };
    if (!body.name) return HttpResponse.json({ error: "name required" }, { status: 400 });
    return HttpResponse.json({ id: "new", name: body.name }, { status: 201 });
  }),
];
```

**Trade-offs / when this fails.** MSW adds a small amount of setup ceremony — register handlers, start the server in the test setup, reset between tests — and the handler list can grow large in big applications. The mitigation is to organise handlers by feature alongside the components that need them. The pattern is incomplete for non-`fetch` network APIs (WebSocket, EventSource, raw XMLHttpRequest) — MSW supports some of these in newer versions, but coverage is less complete than for `fetch`.

### 4. When is `toMatchSnapshot` the wrong tool?

Almost always when applied to rendered React markup. The snapshot is a serialised dump of the component tree, which changes whenever any markup changes, even if the behaviour is unchanged. Developers regenerate the snapshot reflexively when the test fails, the new snapshot becomes the new "correct" output, and the test stops catching anything beyond "did the markup change". The signal-to-noise ratio collapses to noise. The two legitimate uses of `toMatchSnapshot` are stable JavaScript Object Notation contracts (the schema of an analytics event, the body of a generated API response) and visual-regression screenshots via Playwright or Chromatic, which are not the same mechanism as RTL's snapshot serialiser.

**How it works.** `toMatchSnapshot` serialises a value and compares it to a stored file. On first run it writes the file; on subsequent runs it diffs the new value against the stored one. The diff is line-by-line, which works well for stable structured data and works poorly for rendered HTML where every layout change cascades into the snapshot.

```ts
// Wrong: brittle and uninformative.
expect(container).toMatchSnapshot();

// Right: a stable contract.
expect(serialiseAnalyticsEvent(event)).toMatchSnapshot();
```

**Trade-offs / when this fails.** The "always wrong" position is too strong; snapshots are appropriate when the developer would manually verify the diff carefully on each change. The pattern fails when the team treats snapshot regeneration as a pre-merge ritual, which is the failure mode that motivates the recommendation. Behavioural assertions (`expect(...).toHaveTextContent(...)`, `expect(...).toBeVisible(...)`) are more durable for component output.

### 5. How would you test a form's validation behaviour without testing React Hook Form's internals?

Render the form, simulate a user submission with invalid input, assert that the error message is displayed and that the submit handler was not called. Then simulate a user submission with valid input, assert that the submit handler was called with the expected values. The test makes no reference to React Hook Form's `register` function, its `formState` object, or its internal validation pipeline; it asserts only on the user-observable behaviour, which is what the user (and a screen reader) would care about.

**How it works.** RTL's `userEvent.type` and `userEvent.click` simulate the same events the browser would dispatch. React Hook Form receives those events through its own internal handlers, runs the resolver, and updates its internal state, which then renders the error UI. The test does not need to know any of that — it only needs to fill in the form and click submit, then assert on what appears.

```tsx
it("shows a validation error when email is missing", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/email/i);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("submits valid input", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  await user.type(screen.getByLabelText(/email/i), "ada@example.com");
  await user.type(screen.getByLabelText(/password/i), "secret123");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(onSubmit).toHaveBeenCalledWith({ email: "ada@example.com", password: "secret123" });
});
```

**Trade-offs / when this fails.** The pattern requires the form to expose its errors through the accessibility tree (`role="alert"`, `aria-describedby`), which is the right design pressure but is also a real refactor for a form that uses ad-hoc error rendering. The pattern is incomplete for asynchronous validation that requires a network round-trip; for those, combine the same RTL assertions with MSW handlers that return the right validation errors.

## Further reading

- Kent C. Dodds, ["Common mistakes with React Testing Library"](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library).
- Vitest [docs](https://vitest.dev/).
- MSW [docs](https://mswjs.io/).
