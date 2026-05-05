---
title: "Component patterns"
sidebar_label: "6.1 Component patterns"
description: "Compound components, headless UI, render props vs hooks-as-API, polymorphic components."
sidebar_position: 1
---

The shape of a component decides how easy it is to compose, override, and reuse. Senior interviews probe whether the candidate can name the established patterns, articulate which one fits a given problem, and explain the trade-offs each pattern carries. The patterns covered in this chapter — compound components, headless components, render props versus hooks-as-API, polymorphic components, and the slot pattern — are the vocabulary every senior frontend engineer is expected to share.

> **Acronyms used in this chapter.** ARIA: Accessible Rich Internet Applications. API: Application Programming Interface. CSS: Cascading Style Sheets. DOM: Document Object Model. JSX: JavaScript XML. UI: User Interface. WAI: Web Accessibility Initiative.

## Compound components

A compound component is a parent that exposes its children as related sub-components, sharing state via context.

```tsx
import { createContext, useContext, useId, useState, type ReactNode } from "react";

const TabsContext = createContext<{ active: string; setActive: (v: string) => void } | null>(null);

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue);
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}

function TabList({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
}

function Tab({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const id = useId();
  return (
    <button
      role="tab"
      id={`${id}-${value}`}
      aria-selected={ctx.active === value}
      onClick={() => ctx.setActive(value)}
    >
      {children}
    </button>
  );
}

function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  return ctx.active === value ? <div role="tabpanel">{children}</div> : null;
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

// Usage
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="settings">Settings</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="overview">Overview content</Tabs.Panel>
  <Tabs.Panel value="settings">Settings content</Tabs.Panel>
</Tabs>
```

Three properties make this shape preferable to a configuration-prop-driven alternative. The consumer arranges the layout themselves, which removes the configuration-prop explosion that grows linearly (and then super-linearly) with every new variation the component must support — the consumer can rearrange `<Tabs.List>` and `<Tabs.Panel>` freely without the parent component knowing or caring. The pattern scales gracefully — adding a `<Tabs.Trigger />` variant for a context-menu-style trigger does not bloat the parent's API, because the new sub-component is a sibling that opts in rather than a new prop on the parent. The accessibility wiring (`id` generation, `role` attributes, keyboard navigation, focus management) is centralised inside the sub-components, so the consumer cannot accidentally render an inaccessible variant.

This is the pattern Radix UI, React Aria, and shadcn/ui all adopted, and it is the senior-recommended shape for any composite primitive in a design system.

## Headless components

Headless components ship behaviour and accessibility wiring, not styles. The pattern lets the design-system author concentrate on the difficult and repetitive concerns — keyboard navigation, focus management, ARIA roles, screen-reader announcements, portalling, focus trapping in dialogs — while leaving every visual decision to the consumer. Two flavours of "headless" appear in the ecosystem: headless components and headless hooks.

The headless-component flavour (the model adopted by Radix UI, Headless UI, and React Aria Components) renders unstyled DOM with all the behaviour wired up; the consumer brings the Cascading Style Sheets. The headless-hook flavour (the model adopted by React Aria's hook layer) returns state and prop bags that the consumer spreads onto their own JSX. Headless components are slightly more opinionated about the DOM structure; headless hooks give the consumer total control of the JSX at the cost of more boilerplate per primitive.

```tsx
// Radix style
<Dialog.Root>
  <Dialog.Trigger asChild><button>Open</button></Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="overlay" />
    <Dialog.Content className="content">
      <Dialog.Title>Confirm</Dialog.Title>
      <Dialog.Description>Are you sure?</Dialog.Description>
      <Dialog.Close asChild><button>Cancel</button></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

```tsx
// React Aria style
const { buttonProps } = useButton({ onPress: open }, ref);
return <button {...buttonProps} ref={ref}>{children}</button>;
```

The trade-off is concrete: headless gives the consumer full design control (no fighting against framework-imposed styles, no overriding cascade rules), but there is more code to write because the consumer brings every visual decision themselves. For a design system at any meaningful scale — multiple product surfaces, multiple themes, custom branding — headless is the recommended default.

## Render props

A component takes a function as `children` and calls it with state.

```tsx
function MousePosition({ children }: { children: (pos: { x: number; y: number }) => ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return <>{children(pos)}</>;
}

<MousePosition>{({ x, y }) => <p>{x}, {y}</p>}</MousePosition>
```

Render props were dominant before hooks. In modern React, **prefer a custom hook** unless you need DOM coupling that hooks can't provide.

```tsx
function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return pos;
}

const { x, y } = useMousePosition();
```

## Polymorphic components (`as` prop)

A component that can render as different elements while keeping its props typed.

```tsx
type AsProp<E extends ElementType> = { as?: E };

type PolymorphicProps<E extends ElementType, P> = P &
  AsProp<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof P | "as">;

function Button<E extends ElementType = "button">({
  as,
  variant,
  ...rest
}: PolymorphicProps<E, { variant: "primary" | "secondary" }>) {
  const Component = as ?? "button";
  return <Component data-variant={variant} {...rest} />;
}

<Button variant="primary">Submit</Button>
<Button as="a" href="/dashboard" variant="secondary">Dashboard</Button>
```

Useful for design system primitives that can be a `<button>` or `<a>` depending on use. Type-error if you pass `href` without `as="a"`.

## Slot pattern (`asChild`)

A specialization of the polymorphic pattern. The component renders the *child* but with all its own behavior merged in.

```tsx
// Radix-style asChild
<Tooltip.Trigger asChild>
  <button>Hover me</button>
</Tooltip.Trigger>
```

The `<Tooltip.Trigger>` doesn't render a button itself — it clones the child and merges the tooltip's event handlers and ARIA props in. Lets you keep the consumer's element while still composing behavior.

## Controlled vs. uncontrolled (component-level)

The same controlled/uncontrolled distinction from forms applies to components like dropdowns, switches, tabs.

```tsx
// Uncontrolled — component owns the state
<Switch defaultChecked={false} onCheckedChange={track} />

// Controlled — consumer owns the state
<Switch checked={isOn} onCheckedChange={setIsOn} />
```

Senior pattern: **support both**. The default value should be uncontrolled (less boilerplate); the consumer can hoist state if they need to.

```tsx
function Switch({ checked, defaultChecked, onCheckedChange }: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  function setValue(next: boolean) {
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  }

  return <button role="switch" aria-checked={value} onClick={() => setValue(!value)}>...</button>;
}
```

This is the pattern every Radix and React Aria primitive uses.

## Avoiding "configuration soup"

When a component grows ten boolean props (`hideHeader`, `showFooter`, `withSearch`, `withFilter`, ...), it's time to refactor into a compound component. Boolean props don't compose.

```tsx
// BAD: explodes combinatorially
<DataTable hideHeader showFooter withSearch withFilter dense />

// OK: composes
<DataTable.Root>
  <DataTable.Toolbar>
    <DataTable.Search />
    <DataTable.Filter />
  </DataTable.Toolbar>
  <DataTable.Body dense />
  <DataTable.Footer />
</DataTable.Root>
```

## Key takeaways

- Compound components share state via React Context and let consumers control the layout themselves; this is the right shape for primitives like Tabs, Dialog, and Menu, where the consumer needs to arrange sub-pieces freely.
- Headless components or hooks are the recommended default for design systems because they ship behaviour and accessibility while leaving every visual decision to the consumer.
- Render props largely lost to hooks except for cases that genuinely require DOM coupling that hooks cannot provide; reach for a custom hook first.
- Polymorphic components (the `as` prop) and the Radix-style `asChild` slot let the consumer compose behaviour onto their own elements without the parent bloating its API.
- Support both controlled and uncontrolled modes for stateful primitives so the consumer can hoist state when they need to and stay terse when they do not.
- When boolean props on a component grow into the high single digits, refactor into a compound component; boolean props do not compose, and the combinations explode super-linearly.

## Common interview questions

1. What problem do compound components solve that prop-driven configuration doesn't?
2. Difference between Radix-style headless components and React Aria-style headless hooks?
3. When would you reach for a render prop in 2026?
4. How do polymorphic components stay type-safe? What is `as` doing under the hood?
5. Why is "support controlled and uncontrolled" the senior default for stateful primitives?

## Answers

### 1. What problem do compound components solve that prop-driven configuration doesn't?

Compound components solve the combinatorial explosion of configuration props. A Tabs component implemented as a single configurable component would need a prop for every variation in its layout, behaviour, and content — `tabs={[...]}`, `defaultActive={...}`, `onChange={...}`, `renderTab={...}`, `renderPanel={...}`, `align={...}`, `vertical={...}` — and every new variation a product team needs adds another prop. The compound-component shape inverts the responsibility: the parent (`<Tabs>`) shares state via React Context, and the sub-components (`<Tabs.List>`, `<Tabs.Tab>`, `<Tabs.Panel>`) are arranged by the consumer in any layout they need.

**How it works.** The parent owns the shared state (the active tab, in this case) and exposes it through a Context that the sub-components consume. Each sub-component is a thin wrapper that reads the Context, renders the appropriate ARIA attributes, and either dispatches state changes (the Tab) or conditionally renders content (the Panel). The consumer composes the sub-components freely, which is what gives the pattern its layout flexibility.

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="settings">Settings</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="overview">Overview content</Tabs.Panel>
  <Tabs.Panel value="settings">Settings content</Tabs.Panel>
</Tabs>
```

**Trade-offs / when this fails.** Compound components require more code than a single configurable component for the trivial case (a Tabs with no special needs). The pattern is the right shape when the team expects multiple variations or when the component is part of a design system used by multiple product teams. The pattern is wrong when the component will only ever be used in one place with one shape — for those, a configuration-prop component is appropriately concise.

### 2. Difference between Radix-style headless components and React Aria-style headless hooks?

Radix-style headless components ship as React components that render unstyled Document Object Model elements with all the behaviour wired up; the consumer adds CSS via `className` or `style`. React Aria-style headless hooks ship as functions that return state and prop bags; the consumer writes their own JSX and spreads the prop bags onto their own elements. The two styles cover the same conceptual space — accessibility plus behaviour, no styling — but differ in how much control they give the consumer over the rendered DOM.

**How it works.** Radix's `<Dialog.Trigger>` renders a `<button>` (or, with `asChild`, clones the consumer's child element) and attaches the trigger behaviour. React Aria's `useButton` returns a `buttonProps` object that the consumer spreads onto whatever element they wish to render. The Radix style is slightly more opinionated about the DOM shape; the React Aria style requires the consumer to write more boilerplate per primitive but yields total control of the JSX.

```tsx
// Radix style — component renders the DOM.
<Dialog.Root>
  <Dialog.Trigger asChild><button>Open</button></Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content>{/* ... */}</Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// React Aria style — hook returns prop bags.
const ref = useRef<HTMLButtonElement>(null);
const { buttonProps } = useButton({ onPress: open }, ref);
return <button {...buttonProps} ref={ref}>Open</button>;
```

**Trade-offs / when this fails.** Radix is the better default for most teams because the conventions are stronger and the integration is faster; React Aria is better when the team needs total control of the DOM (for performance reasons, for component testing strategies, for unusual layouts). The pattern fails when the team mixes both styles arbitrarily; the cure is to pick one and document the choice in the design system's contributor guide.

### 3. When would you reach for a render prop in 2026?

The honest answer is "rarely". Hooks subsumed nearly every render-prop use case after React 16.8, and the modern code style is to expose stateful logic as a custom hook (`useMousePosition()`) rather than a render-prop component (`<MousePosition>{render}</MousePosition>`). The remaining case for render props is when the consumer needs DOM coupling that hooks cannot provide — most commonly when a parent component needs to control the rendering of a child element it does not own (a virtualised list whose item-renderer must be a function so the parent can reuse the same component instance across positions).

**How it works.** A render-prop component takes a function as a child (or as a named prop) and calls the function during render with the state the consumer needs. The consumer writes the JSX they want, using the state the parent provides. The pattern was popular before hooks because it was the only way to share stateful logic across components that were not in a parent-child relationship.

```tsx
// Render prop — useful when the parent owns the render lifecycle.
<VirtualisedList items={tasks} itemHeight={40}>
  {({ item, style }) => <div style={style}>{item.title}</div>}
</VirtualisedList>

// Custom hook — preferred for stateful logic not coupled to the render lifecycle.
function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => { /* ... */ }, []);
  return pos;
}
```

**Trade-offs / when this fails.** Render props are the right shape when the parent must control when and how the child renders (virtualisation, recycling, lazy mounting); hooks are the right shape for everything else. The pattern fails when the team reaches for render props out of habit; the cure is to ask "could this be a hook?" first, and only fall back to render props when the answer is concretely "no".

### 4. How do polymorphic components stay type-safe? What is `as` doing under the hood?

A polymorphic component takes an `as` prop whose value is a React element type (a string like `"a"` or a component reference), uses that type to render, and forwards every prop appropriate for that type to the rendered element. Type safety is achieved through a generic parameter constrained to `ElementType`, combined with `ComponentPropsWithoutRef<E>` to derive the appropriate prop shape from the type. The result is that `<Button as="a" href="/">` correctly accepts `href`, while `<Button as="button" href="/">` is a type error.

**How it works.** The component is declared as a generic function over the element type `E`. The props type combines the consumer-defined props (`{ variant: ... }`) with `Omit<ComponentPropsWithoutRef<E>, ...>` to inherit the props of the rendered element. TypeScript narrows the props based on the actual `as` value, which gives the type checker enough information to validate every prop.

```tsx
import { ComponentPropsWithoutRef, ElementType } from "react";

type AsProp<E extends ElementType> = { as?: E };
type PolymorphicProps<E extends ElementType, P> =
  P & AsProp<E> & Omit<ComponentPropsWithoutRef<E>, keyof P | "as">;

function Button<E extends ElementType = "button">({
  as,
  variant,
  ...rest
}: PolymorphicProps<E, { variant: "primary" | "secondary" }>) {
  const Component = as ?? "button";
  return <Component data-variant={variant} {...rest} />;
}

<Button variant="primary">Submit</Button>
<Button as="a" href="/dashboard" variant="secondary">Dashboard</Button>
// Error: <Button href="/" /> — without as="a", href is not in props.
```

**Trade-offs / when this fails.** Polymorphic components are the right shape for design-system primitives that need to render as different semantic elements (a button that is sometimes an `<a>`, a heading that is sometimes a `<span>` for visual reuse). The pattern is overkill for components with a single semantic role. The pattern also fails for refs without `forwardRef` or React 19's `ref` as a prop; for those, use `PolymorphicProps & { ref?: ComponentPropsWithRef<E>["ref"] }` to keep the ref typed.

### 5. Why is "support controlled and uncontrolled" the senior default for stateful primitives?

Supporting both modes lets the consumer choose the right shape for their use case without forcing them into either one. The uncontrolled default (`defaultChecked`) gives consumers the terse API for the common case where they do not need to read or override the state from the parent. The controlled mode (`checked`, `onCheckedChange`) gives consumers full control when they need to derive state from external sources, persist it, animate it, or coordinate it with other components.

**How it works.** The component detects whether the controlled prop is provided (`value !== undefined`) and, if so, uses it as the source of truth; otherwise the component manages its own internal state. Both branches dispatch the change callback, so consumers in either mode can observe and respond to changes. The pattern is what every Radix and React Aria primitive implements internally.

```tsx
function Switch({ checked, defaultChecked, onCheckedChange }: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  function setValue(next: boolean) {
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  }

  return <button role="switch" aria-checked={value} onClick={() => setValue(!value)} />;
}
```

**Trade-offs / when this fails.** The pattern adds a small amount of code to every stateful primitive but pays back enormously in API ergonomics. The pattern fails when the consumer mixes the two modes accidentally — passing both `checked` and `defaultChecked`, or switching between modes during the component's lifetime; the cure is a development-mode warning when the controlled prop changes from `undefined` to a value or back. The senior framing is "the component is the consumer's tool, not the consumer's master".

## Further reading

- Sebastien Lorber, ["Compound Components"](https://www.smashingmagazine.com/2021/08/compound-components-react/).
- [Radix UI primitives](https://www.radix-ui.com/) — the canonical example of composable, accessible primitives.
- [React Aria](https://react-spectrum.adobe.com/react-aria/) docs.
