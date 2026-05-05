---
title: "State machines (XState)"
sidebar_label: "6.3 State machines (XState)"
description: "When to reach for a state machine and how to model multi-step flows, optimistic mutations, and async lifecycles."
sidebar_position: 3
---

Most React state can stay in `useState` and the application is the better for it — adding a state-machine library to model a single boolean is over-engineering. Some flows, however, are state machines disguised as `useState`, and those flows develop bugs at a rate proportional to the implicit state's complexity. Senior interviews probe whether the candidate can recognise when a state machine is the right shape and articulate the cost of the alternative.

> **Acronyms used in this chapter.** API: Application Programming Interface. JS: JavaScript. QA: Quality Assurance. UI: User Interface.

## When `useState` stops being enough

Three signals indicate that the flow being modelled is implicitly a state machine and would benefit from being modelled explicitly. The first is the boolean explosion — fields like `isLoading`, `isError`, `isSuccess`, `isOptimistic`, `isRetrying` accumulate, and the combinatorial space includes impossible combinations (`isLoading && isError`, `isSuccess && isOptimistic`) that the type system cannot rule out. The second is order — the flow has steps with prerequisites, and the user can only reach step 3 after completing step 2; encoding this with booleans requires guards everywhere and the guards drift out of sync. The third is event polymorphism — the same event (a click on "Submit") has different effects depending on the current state (in `idle`, it submits; in `submitting`, it should be ignored or queued; in `error`, it might retry).

Any of those three signals is a sign that an implicit state machine is being assembled out of `useState` calls. Making the machine explicit — with a discriminated union for the state and a reducer for the transitions — makes the impossible states unrepresentable, the transitions auditable, and the bugs much harder to introduce.

## A state machine in 30 lines

A simple file-upload state machine using a discriminated union and a reducer:

```ts
type State =
  | { status: "idle" }
  | { status: "selecting" }
  | { status: "uploading"; progress: number }
  | { status: "success"; url: string }
  | { status: "error"; error: Error };

type Event =
  | { type: "PICK"; file: File }
  | { type: "PROGRESS"; progress: number }
  | { type: "DONE"; url: string }
  | { type: "FAIL"; error: Error }
  | { type: "RESET" };

function reducer(state: State, event: Event): State {
  switch (state.status) {
    case "idle":
    case "selecting":
      if (event.type === "PICK") return { status: "uploading", progress: 0 };
      if (event.type === "RESET") return { status: "idle" };
      return state;
    case "uploading":
      if (event.type === "PROGRESS") return { ...state, progress: event.progress };
      if (event.type === "DONE") return { status: "success", url: event.url };
      if (event.type === "FAIL") return { status: "error", error: event.error };
      return state;
    case "success":
    case "error":
      if (event.type === "RESET") return { status: "idle" };
      return state;
  }
}
```

This already gets you exhaustiveness, no impossible states, and a clean event log. For many flows, this is enough.

## When to reach for XState

XState is worth its dependency cost when the application needs one or more capabilities a hand-rolled reducer cannot provide cleanly. Hierarchical states let an outer state (such as "uploading") have inner sub-states (such as "transferring", "retrying", "paused") that share the outer state's behaviour but specialise the inner transitions; modelling this with a flat enum becomes unwieldy fast. Parallel states let a single machine track multiple independent state dimensions simultaneously — a multi-region form where each region (personal details, billing, preferences) has its own state and transitions, and the machine's overall state is the cross product. Guards (predicates that gate a transition) are first-class; the machine reasons about whether a transition is currently legal, and the consumer can ask `machine.can(event)` to drive UI affordances. Entry and exit actions on each state let the application register side effects with proper cleanup — the entry action starts a timer, the exit action stops it — without scattering the lifecycle code across the consumer. The visualiser in XState Studio renders the machine as a state diagram that designers and Quality Assurance reviewers can inspect, which substantially improves cross-team alignment on what the machine actually does.

```ts
import { setup, assign } from "xstate";

const uploadMachine = setup({
  types: {} as {
    context: { progress: number; url: string | null; error: string | null; retries: number };
    events:
      | { type: "PICK"; file: File }
      | { type: "PROGRESS"; progress: number }
      | { type: "DONE"; url: string }
      | { type: "FAIL"; error: string }
      | { type: "RETRY" }
      | { type: "RESET" };
  },
  guards: {
    canRetry: ({ context }) => context.retries < 3,
  },
  actions: {
    setProgress: assign({ progress: ({ event }) => (event as any).progress }),
    setError: assign({ error: ({ event }) => (event as any).error }),
    incRetries: assign({ retries: ({ context }) => context.retries + 1 }),
    reset: assign({ progress: 0, url: null, error: null, retries: 0 }),
  },
}).createMachine({
  id: "upload",
  initial: "idle",
  context: { progress: 0, url: null, error: null, retries: 0 },
  states: {
    idle: { on: { PICK: "uploading" } },
    uploading: {
      on: {
        PROGRESS: { actions: "setProgress" },
        DONE: { target: "success", actions: assign({ url: ({ event }) => event.url }) },
        FAIL: { target: "error", actions: ["setError", "incRetries"] },
      },
    },
    error: {
      on: {
        RETRY: { target: "uploading", guard: "canRetry" },
        RESET: { target: "idle", actions: "reset" },
      },
    },
    success: { on: { RESET: { target: "idle", actions: "reset" } } },
  },
});
```

In React:

```tsx
import { useMachine } from "@xstate/react";

const [snapshot, send] = useMachine(uploadMachine);

return (
  <>
    {snapshot.matches("idle") && <input type="file" onChange={(e) => send({ type: "PICK", file: e.target.files![0] })} />}
    {snapshot.matches("uploading") && <progress value={snapshot.context.progress} max={100} />}
    {snapshot.matches("error") && (
      <>
        <p>{snapshot.context.error}</p>
        {snapshot.can({ type: "RETRY" }) && <button onClick={() => send({ type: "RETRY" })}>Retry</button>}
      </>
    )}
    {snapshot.matches("success") && <a href={snapshot.context.url ?? "#"}>Download</a>}
  </>
);
```

Three concrete wins are visible in this example. Impossible states are unrepresentable — the machine's state cannot be both "uploading" and "error" at the same time, because the type system rules it out. `snapshot.can(event)` asks the machine whether a transition is currently legal, which lets the user interface enable or disable controls based on the actual state machine rather than on duplicated boolean logic. The XState Studio visualiser renders the machine as a state diagram that designers can inspect and Quality Assurance can use as the source of truth for test scenarios.

## Mental model: state, event, transition, action, guard

| Term | What it is |
| --- | --- |
| **State** | A named situation the system is in (`idle`, `uploading`, `error`). |
| **Event** | A signal that something happened (`PICK`, `PROGRESS`, `RETRY`). |
| **Transition** | Moving from one state to another in response to an event. |
| **Action** | A side effect or context update during a transition. |
| **Guard** | A predicate that gates a transition. |
| **Context** | Mutable data attached to the machine (`progress`, `retries`). |

If you can name these in an interview, you've got the model.

## Where state machines shine

State machines pay back most clearly in five categories of flow. Multi-step forms and wizards always have hidden state that breaks when implemented as nested booleans — "step 3 is enabled if step 2 is complete and step 1's selection allows step 2 to even appear" is a sentence whose boolean encoding is harder to maintain than its state-machine encoding. Asynchronous flows with retries — uploads, payment flows, Open Authorization callbacks — have natural state machines (idle, in flight, succeeded, failed, retrying) that the reducer pattern surfaces clearly. Drag-and-drop and drawing-canvas interactions have explicit phases (idle, dragging, dropping, snapping back) that benefit from being named rather than implied. Onboarding checklists are state machines whose states encode what is complete, what is pending, and what the next allowed action is. WebSocket and connection lifecycles (connecting, open, closing, closed, reconnecting with backoff) have well-defined transitions that the state-machine model expresses precisely.

## Where they do not

State machines are the wrong shape for three categories of state. A modal that is simply "open or closed" needs only `useState<boolean>`; a state machine adds ceremony with no benefit. A form with three optional fields needs React Hook Form plus Zod; the form library already encodes the validation state machine internally. A list of items being filtered needs only a derived value (`useMemo` or a `computed` signal); the filter result is a function of the input, not a state.

State machines are a precision tool, not a substitute for everything. The senior framing is "use a state machine when the flow is genuinely a state machine, not when modelling everything as a state machine feels architecturally satisfying".

## Key takeaways

- Recognise implicit state machines by their three signals: boolean explosion that produces impossible combinations, ordered steps with prerequisites, and events whose meaning depends on the current state.
- For simple cases, `useReducer` with a discriminated-union state and a typed event union captures most of the benefit without an external library.
- Reach for XState when the application needs hierarchical states, parallel state regions, guards, entry-and-exit actions with cleanup, or the visualiser for cross-team review.
- Name the parts of the model — state, event, transition, action, guard, context — so the team has a shared vocabulary when discussing the machine.
- Use state machines for multi-step flows, asynchronous lifecycles with retries, complex interactions; do not use them for every modal or every two-state toggle.

## Common interview questions

1. What's a sign that `useState` is the wrong abstraction for a flow?
2. Walk me through modeling a file-upload flow as a state machine.
3. What's a guard in XState and why does it matter?
4. When would you reach for XState over a `useReducer`?
5. How do you keep designers and engineers aligned on a complex interaction?

## Answers

### 1. What's a sign that `useState` is the wrong abstraction for a flow?

The clearest sign is the boolean explosion — when the component grows fields like `isLoading`, `isError`, `isSuccess`, `isOptimistic`, `isRetrying`, and the combinatorial space includes impossible combinations the type system cannot rule out. A second sign is order-dependence — the flow has steps with prerequisites, and the component needs scattered guards to enforce that the user cannot reach step 3 without completing step 2. A third sign is event polymorphism — the same user action means different things in different states, and the handler grows a long if-else cascade to handle each case.

**How it works.** Each of these signs indicates that the flow is implicitly a state machine. Making it explicit collapses the boolean space into a single discriminated union, replaces the scattered guards with a reducer that handles one state at a time, and turns the if-else cascade into a per-state switch that the type checker can verify is exhaustive.

```ts
// Implicit machine — boolean explosion, impossible states.
const [isLoading, setLoading] = useState(false);
const [isError, setError] = useState(false);
const [isSuccess, setSuccess] = useState(false);
// Nothing prevents (isLoading && isError && isSuccess).

// Explicit machine — discriminated union, impossible states unrepresentable.
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Data }
  | { status: "error"; error: Error };
const [state, dispatch] = useReducer(reducer, { status: "idle" });
```

**Trade-offs / when this fails.** The explicit machine adds code for simple cases. The pattern is the right shape only when the flow's complexity justifies it; the cure for ambiguity is to count the boolean fields — three or more is usually a strong signal that the explicit machine will pay off.

### 2. Walk me through modeling a file-upload flow as a state machine.

The states of a file upload are idle (no file selected), uploading (file selected, transfer in progress), success (transfer complete, URL received), and error (transfer failed). The events are PICK (a file was selected), PROGRESS (a progress chunk arrived), DONE (the transfer completed with a URL), FAIL (the transfer failed with an error), and RESET (the user wants to start over). The transitions are: idle on PICK → uploading; uploading on PROGRESS → uploading (with updated context); uploading on DONE → success; uploading on FAIL → error; success on RESET → idle; error on RESET → idle.

**How it works.** The state is a discriminated union with a `status` discriminator. The reducer dispatches on the status and the event together. Invalid combinations (FAIL while in idle, PROGRESS while in success) return the existing state unchanged, which prevents the machine from getting into impossible states. The component renders different UI based on `state.status`, with the type checker confirming that every status is handled.

```ts
type State =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success"; url: string }
  | { status: "error"; error: Error };

type Event =
  | { type: "PICK"; file: File }
  | { type: "PROGRESS"; progress: number }
  | { type: "DONE"; url: string }
  | { type: "FAIL"; error: Error }
  | { type: "RESET" };

function reducer(state: State, event: Event): State {
  switch (state.status) {
    case "idle":
      return event.type === "PICK" ? { status: "uploading", progress: 0 } : state;
    case "uploading":
      if (event.type === "PROGRESS") return { ...state, progress: event.progress };
      if (event.type === "DONE") return { status: "success", url: event.url };
      if (event.type === "FAIL") return { status: "error", error: event.error };
      return state;
    case "success":
    case "error":
      return event.type === "RESET" ? { status: "idle" } : state;
  }
}
```

**Trade-offs / when this fails.** The pattern is the senior-recommended shape for any non-trivial async flow with multiple terminal states. The pattern fails when the team adds a "retrying" state without thinking about its transitions; the cure is to draw the machine on a whiteboard before writing the reducer, ensuring every transition is intentional.

### 3. What's a guard in XState and why does it matter?

A guard in XState is a predicate function that gates a transition — the transition fires only if the guard returns true. Guards are evaluated against the machine's context and the incoming event, so the guard can express conditions like "retry only if `context.retries < 3`" or "submit only if `context.formIsValid`". Guards matter because they let the machine encode business rules at the transition level rather than scattering the rules across the application's event handlers.

**How it works.** When an event arrives, the machine looks up the matching transition for the current state, evaluates the transition's guard (if any) against the current context and the event, and applies the transition only if the guard returns true. If the guard returns false, the transition does not fire and the machine stays in the current state. The consumer can ask `snapshot.can(event)` to check whether the event would be accepted; the machine evaluates the guard internally and returns the answer.

```ts
const machine = setup({
  types: {} as { context: { retries: number }, events: { type: "RETRY" } | { type: "FAIL" } },
  guards: {
    canRetry: ({ context }) => context.retries < 3,
  },
}).createMachine({
  initial: "idle",
  context: { retries: 0 },
  states: {
    error: {
      on: {
        RETRY: { target: "uploading", guard: "canRetry" },   // gated by guard
      },
    },
    uploading: { /* ... */ },
  },
});

// Component asks the machine if the action is currently legal:
{snapshot.can({ type: "RETRY" }) && <button onClick={() => send({ type: "RETRY" })}>Retry</button>}
```

**Trade-offs / when this fails.** Guards are the right place for transition-level business rules. They are the wrong place for cross-cutting concerns (authentication, authorisation, network connectivity); those belong in middleware or in the surrounding application layer. The pattern fails when the team puts heavy logic in guards that should live elsewhere; the cure is to keep guards pure and quick to evaluate.

### 4. When would you reach for XState over a `useReducer`?

Reach for XState when the machine has hierarchical states (a state with sub-states that share the outer state's transitions but specialise the inner ones), parallel state regions (multiple independent state dimensions tracked simultaneously), entry-and-exit actions with cleanup, or when the visualiser would meaningfully improve cross-team alignment. Stick with `useReducer` for flat state machines without these complications — the discriminated-union plus reducer pattern captures the substantial majority of state-machine use cases without an external dependency.

**How it works.** XState provides primitives that `useReducer` does not have: nested states with the parent's `on` handlers as defaults, parallel regions whose state is the cross-product, services that run while a state is active and stop when it exits, and a runtime that emits events the visualiser can render. The cost is the dependency, the learning curve for the API, and the ceremony of declaring the machine in XState's specific shape.

```ts
// useReducer is enough for a flat state machine.
const [state, dispatch] = useReducer(reducer, { status: "idle" });

// XState earns its keep when hierarchy or parallelism is involved.
const machine = setup({ /* ... */ }).createMachine({
  type: "parallel",                        // parallel regions
  states: {
    auth: { initial: "loggedOut", states: { loggedOut: { /* ... */ }, loggedIn: { /* ... */ } } },
    network: { initial: "online", states: { online: { /* ... */ }, offline: { /* ... */ } } },
  },
});
```

**Trade-offs / when this fails.** The pattern is "useReducer for simple, XState for complex". The pattern fails when the team adopts XState for everything (over-engineering simple flows) or refuses to adopt it for genuinely complex flows (under-engineering and accumulating bugs). The senior framing is to choose by the actual complexity of the machine, not by what feels architecturally interesting.

### 5. How do you keep designers and engineers aligned on a complex interaction?

The recommended pattern is to model the interaction as an explicit state machine, render the machine in the visualiser (XState Studio), and use the diagram as the source of truth that designers and engineers both review. The diagram makes the states, transitions, and guards visible to every stakeholder, so the design review becomes "is this transition correct?" and "should this state have a sub-state?" rather than "I think the spec means..." and "what does the code actually do?".

**How it works.** XState Studio reads the machine definition (or the running machine via the developer tools) and produces an interactive state diagram. The designer can click through the states, trigger events, see the resulting transitions, and identify cases the engineer missed. The Quality Assurance team can use the diagram to derive test scenarios — every state and every transition becomes a test case. The diagram lives in the design system's documentation site, so anyone joining the team can see the actual behaviour, not the team's recollection of it.

```ts
// The machine is the spec. The diagram is the rendering.
const checkoutMachine = setup({ /* ... */ }).createMachine({
  initial: "cart",
  states: {
    cart: { on: { CHECKOUT: "shipping" } },
    shipping: { on: { CONTINUE: "payment", BACK: "cart" } },
    payment: { on: { SUBMIT: "processing", BACK: "shipping" } },
    processing: { on: { SUCCESS: "confirmed", FAIL: "payment" } },
    confirmed: { /* terminal */ },
  },
});
// View at https://stately.ai/registry — designers and QA both look here.
```

**Trade-offs / when this fails.** The pattern requires investment in maintaining the machine definitions and the diagram-rendering pipeline. The pattern fails when the team treats the machine as a mere implementation detail rather than as the shared spec; the cure is to make "review the state diagram" a step in the design review process so the diagram remains the canonical artefact. The pattern also fails when the team uses informal `useState` for the actual implementation while maintaining a separate state-machine diagram; the cure is to actually run the machine in production, so the diagram and the behaviour are guaranteed to match.

## Further reading

- David Khourshid, ["No, Disabling a Button Is Not App Logic"](https://dev.to/davidkpiano/no-disabling-a-button-is-not-app-logic-598i).
- [Statecharts: A Visual Formalism for Complex Systems](https://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf), the Harel paper that started it all.
- [XState docs](https://stately.ai/docs).
