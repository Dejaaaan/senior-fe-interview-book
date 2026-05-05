---
title: "Accessibility (WCAG 2.2)"
sidebar_label: "2.4 Accessibility (WCAG 2.2)"
description: "Keyboard navigation, focus management, ARIA done right, and a11y in CI."
sidebar_position: 4
---

Accessibility (often abbreviated *a11y* — eleven letters between *a* and *y*) is no longer a discretionary topic at the senior level. Companies are increasingly accountable to Web Content Accessibility Guidelines (WCAG) 2.2 AA, legally in many regions and contractually in many business-to-business agreements. Senior frontend engineers are expected to bake accessibility into components from the first commit and to push back constructively when designs preclude it.

This chapter is the practical baseline that a senior should be able to apply without external reference.

> **Acronyms used in this chapter.** AA: WCAG conformance level (Single A is minimum, Triple A is highest). ARIA: Accessible Rich Internet Applications. CI: Continuous Integration. CSS: Cascading Style Sheets. DOM: Document Object Model. HTML: HyperText Markup Language. POUR: Perceivable, Operable, Understandable, Robust. RTL: Right-to-Left. SVG: Scalable Vector Graphics. UI: User Interface. WCAG: Web Content Accessibility Guidelines.

## The four POUR principles

WCAG organises every guideline under four principles. Memorising the four is enough to frame any accessibility conversation, and they are the lens through which a senior reviews designs and pull requests.

- **Perceivable.** Content can be seen or heard. Examples: text alternatives for images, captions for video, sufficient colour contrast, content that scales when the user zooms.
- **Operable.** The user interface can be used. Examples: every interactive element reachable by keyboard, no focus traps that the user cannot escape, no time limits that cannot be extended, no content that flashes in a way that triggers seizures.
- **Understandable.** Content and operation are clear. Examples: form fields have labels, error messages explain how to recover, navigation is consistent across pages, language attributes identify the document language so screen readers pronounce correctly.
- **Robust.** The content works with assistive technology now and in the future. Examples: valid HTML, semantic elements, ARIA used only when no native element fits.

## Keyboard navigation: the smoke test

Unplug the mouse. If every interactive element on the page cannot be reached and operated using only the keyboard, the page is shipping a bug. The minimum keyboard contract:

- `Tab` moves focus forward through the focus order; `Shift+Tab` moves focus back.
- `Enter` activates buttons and links.
- `Space` activates buttons and toggles checkboxes.
- Arrow keys move *within* a composite widget such as a radio group, tab list, or listbox — but not between them.
- `Esc` closes modals, popovers, and menus.

The **focus order** must follow the visual reading order. CSS `order`, `flex-direction: row-reverse`, and absolute positioning can all silently break this, because the visual order on screen no longer matches the source order in the Document Object Model. Always test by tabbing through the page.

```css
/* Easy to ship a bug: visually swapped, but tab order still says cancel-then-save. */
.actions { display: flex; flex-direction: row-reverse; }
```

The tab-key smoke test is the cheapest accessibility check available and it catches the largest class of regressions, which is why it is the single test most worth wiring into the developer's muscle memory.

## Focus management

Focus is the cursor for keyboard users. Two rules cover roughly ninety per cent of focus bugs:

1. **When something opens, move focus into it.** When a modal opens, focus the first focusable element inside, or the dialog itself if it is marked `tabindex="-1"`.
2. **When something closes, return focus to the trigger.** Whoever opened the modal should receive focus back when it closes; otherwise the keyboard user lands at the top of the document and has to tab back to where they were.

```tsx
function Modal({ open, onClose, children }: ModalProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      tabIndex={-1}
      ref={dialogRef}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <h2 id="dialog-title">Confirm</h2>
      {children}
    </div>
  );
}
```

For real production code, use a primitive library such as Radix UI, React Aria, or Headless UI. They handle focus traps, escape behaviour, inert backgrounds, and the dozens of edge cases (focus inside a Shadow DOM, focus when the trigger has been removed from the document, focus restoration after a navigation) that would consume weeks of engineering time to reproduce. Maintaining a custom modal accessibility implementation is rarely a defensible use of senior time.

## ARIA: the rule

The first rule of ARIA is: **do not use ARIA**. Use the right native element. ARIA is the escape hatch for genuinely novel widgets that have no native equivalent, and it requires the developer to implement keyboard, focus, and announcement semantics by hand. A `<button>` does all of that without a single ARIA attribute; a `<div role="button">` does none of it.

When ARIA is genuinely required, the patterns to know:

- `aria-label` and `aria-labelledby` give an element an accessible name when no visible text is available, such as an icon-only button.
- `aria-describedby` adds supplementary information, typically helper text or an error message linked to a form control.
- `aria-hidden="true"` removes an element from the accessibility tree. Use it for decorative icons that would otherwise be announced redundantly.
- `aria-live="polite"` (or `"assertive"`) announces dynamic content to screen readers. Use `polite` for status updates and `assertive` only for genuine errors that interrupt the user.
- `aria-current="page"` marks the active link in navigation.
- `aria-expanded` on triggers for collapsible sections, paired with `aria-controls` pointing at the controlled region.
- `aria-invalid="true"` plus `aria-describedby` on form controls with validation errors, so the screen reader announces both the invalid state and the message.

```tsx
<button aria-label="Close" onClick={onClose}>
  <svg aria-hidden="true" focusable="false">
    {/* X icon */}
  </svg>
</button>
```

Three common mistakes that a senior should be able to spot immediately:

- **`aria-hidden="true"` on a focusable element.** The screen reader ignores it but the keyboard still lands on it, leaving the user focused on something the assistive technology cannot describe. Always pair `aria-hidden="true"` with `tabindex="-1"` so keyboard focus skips the hidden element too.
- **Both a visible `<label>` and an `aria-label`.** The `aria-label` overrides the visible text when announced, which breaks voice-control software ("click submit" stops working because the announced name is now something else). Use one or the other.
- **`role="button"` on a `<div>` instead of using `<button>`.** Now the developer must implement keyboard handling, focus styles, the disabled state, the form-submit semantics, and the accessibility-tree role by hand. Almost always wrong.

## Forms: the highest-return-on-investment accessibility wins

Form accessibility is where the largest accessibility wins live, because forms are where users complete real tasks and where a small annotation has an outsized effect on screen-reader and password-manager behaviour.

```tsx
<form noValidate>
  <div>
    <label htmlFor="email">Email</label>
    <input
      id="email"
      type="email"
      autoComplete="email"
      aria-invalid={!!errors.email}
      aria-describedby={errors.email ? "email-error" : undefined}
      required
    />
    {errors.email && (
      <p id="email-error" role="alert">{errors.email}</p>
    )}
  </div>
</form>
```

Three rules cover the majority of form accessibility:

1. **Every input has a programmatically associated label** via `for` / `htmlFor` matching `id`, or by wrapping the input in `<label>`. The visible label is also the screen-reader name; this is the single most important rule and the one most often violated by ad-hoc form components.
2. **Errors are linked to the input** via `aria-describedby` and announced via `role="alert"` (or an `aria-live` region). The error message must be programmatically associated, not only visually adjacent.
3. **`autocomplete` is set for known fields.** This unlocks password managers, contact-information autofill, and one-time-code population from text-message readers — all of which are accessibility wins as well as usability wins.

## Colour and contrast

WCAG AA establishes minimum contrast ratios that the design must meet:

- **4.5:1** contrast for normal text.
- **3:1** for large text (18 point or 14 point bold and above).
- **3:1** for user interface components and graphical objects, including icons, focus rings, and form-control borders.

Do not trust visual judgement; use a tool. Browser developer tools display the contrast ratio in the inspector for any element. Figma plugins provide the same checks at design time, before the design is handed to engineering. The contrast requirement is binding rather than aspirational — it is the lowest-effort failure to fix in an audit and the most embarrassing to leave in production.

## Reduced motion

Honour `prefers-reduced-motion` for animations beyond minor state transitions. Animations that move objects across the viewport, parallax, and any non-essential transition should respect the user preference.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

For Framer Motion, set `<MotionConfig reducedMotion="user">` so every motion component honours the user's preference automatically. The pattern is to write the animations once, then opt every animation into the user-preference check rather than enumerating them by hand.

## Testing accessibility

Three layers of testing each catch different categories of issue, and the senior recommendation is to use all three because no single layer is sufficient on its own.

1. **Linting.** `eslint-plugin-jsx-a11y` catches static issues at write time — missing alt text, role applied to a non-interactive element, an `<img>` without an `alt` attribute. The lint runs on every commit and prevents regressions.

   ```ts
   // .eslintrc.json (excerpt)
   {
     "extends": ["plugin:jsx-a11y/recommended"]
   }
   ```

2. **Automated checks in tests.** `axe-core` (or `@axe-core/react`, `jest-axe`) scans the rendered output for a curated set of programmatically detectable violations.

   ```ts
   import { render } from "@testing-library/react";
   import { axe, toHaveNoViolations } from "jest-axe";

   expect.extend(toHaveNoViolations);

   it("has no accessibility violations", async () => {
     const { container } = render(<Form />);
     expect(await axe(container)).toHaveNoViolations();
   });
   ```

3. **Manual testing with assistive technology.** VoiceOver on macOS, NVDA on Windows, TalkBack on Android. Automated checks catch perhaps thirty per cent of real issues; the remaining seventy per cent — confusing announcements, illogical reading order, ambiguous labels — require a human listening to a screen reader. Manual testing is irreplaceable.

A Playwright + axe step in Continuous Integration catches regressions on every pull request:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page is accessible", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Key takeaways

- Use semantic HTML first; reach for ARIA only when no native element fits.
- Manage focus on open and close so the keyboard user is never lost.
- Every input needs a programmatically associated label, and errors are linked to the input via `aria-describedby` and announced via `role="alert"` or an `aria-live` region.
- Hit WCAG AA contrast (4.5:1 for normal text, 3:1 for large text and UI components). Contrast is a requirement, not a design preference.
- Honour `prefers-reduced-motion` for animations beyond minor state transitions.
- Catch regressions with `eslint-plugin-jsx-a11y`, `axe-core` in tests, and a screen-reader pass for new features. No single layer is sufficient.

## Common interview questions

1. What is the first rule of ARIA?
2. Walk me through making a custom modal accessible. What does focus do on open and on close?
3. What contrast ratio does WCAG AA require for normal text? For UI components?
4. How do you announce a successful form submission to a screen reader?
5. Why is "use a `<div>` with `role="button"`" almost never the right answer?
6. How would you wire automated accessibility checks into Continuous Integration?

## Answers

### 1. What is the first rule of ARIA?

The first rule of ARIA is: do not use ARIA. Use a native HTML element with the semantics you need, because the native element comes with keyboard handling, focus management, accessible name, and screen-reader announcement for free; ARIA is the explicit acknowledgement that the developer is now responsible for re-implementing all of those behaviours by hand. The rule exists because the most common accessibility regressions come from a `<div>` decorated with ARIA attributes that lacks the keyboard and focus behaviour the ARIA role implies.

**How it works.** ARIA attributes change how assistive technology *describes* an element; they do not change how the browser *handles* it. A `<div role="button">` is announced as a button, but the browser does not give it a focus ring, does not invoke its `onclick` handler on `Enter` or `Space`, does not gain `disabled` semantics from a `disabled` attribute, and does not participate in form submission. The native `<button>` does every one of those without ceremony.

```tsx
// Wrong: re-implementing button behaviour by hand.
<div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") onClick(e);
}}>
  Save
</div>

// Right: native <button>.
<button onClick={onClick}>Save</button>
```

**Trade-offs / when this fails.** The rule has a small set of legitimate exceptions: novel widgets with no native equivalent (a tree view, a colour picker, a complex date range with two coupled calendars). For these, ARIA is required and the developer takes on the implementation cost. The standard mitigation is to delegate to a primitive library (Radix, React Aria, Headless UI) that has already done the work and tested it against actual assistive technology. See [section 3](#aria-the-rule) for the common ARIA attributes and the patterns that misuse each.

### 2. Walk me through making a custom modal accessible. What does focus do on open and on close?

A custom modal must do four things to meet a senior accessibility bar: render with `role="dialog"` and `aria-modal="true"`, give itself an accessible name via `aria-labelledby` pointing at the heading, move focus into the dialog when it opens, and return focus to the trigger element when it closes. Production modals additionally trap focus inside the dialog while it is open and disable interaction with the rest of the page.

**How it works.** The dialog's role and `aria-modal` tell assistive technology that the rest of the page is currently inactive. The accessible name is announced when focus moves into the dialog. The focus-into-the-dialog rule means that on open the dialog itself, or its first focusable element, becomes the active element; otherwise the user's focus is left wherever it was, which may be invisible behind the modal backdrop. The focus-back-to-trigger rule on close means the user returns to the place they were before opening the modal, which is the keyboard equivalent of a memorised mouse position.

```tsx
useEffect(() => {
  if (open) {
    triggerRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
  } else {
    triggerRef.current?.focus();
  }
}, [open]);
```

**Trade-offs / when this fails.** Implementing the focus trap, scroll-lock, escape-to-close, and inert-background pieces correctly across browsers and edge cases (focus inside a Shadow DOM, focus on a removed element, focus when the trigger element is no longer in the document) is several weeks of work. The senior recommendation is to delegate to a primitive library such as Radix Dialog or React Aria. The hand-built version in this chapter is the *minimum* shape and is appropriate for a code-review whiteboard, not for production code.

### 3. What contrast ratio does WCAG AA require for normal text? For UI components?

WCAG 2.2 AA requires **4.5:1** contrast for normal text (less than 18 point or 14 point bold), **3:1** for large text (18 point and above, or 14 point bold and above), and **3:1** for non-text user-interface components and meaningful graphical objects, including icons, focus rings, and form-control borders. The ratios apply to the foreground colour against the background colour at the position where the text or component is rendered.

**How it works.** Contrast ratio is a perceptual measure between the relative luminance of two colours, computed by the formula in WCAG 2.x. A ratio of 1:1 is identical colours and 21:1 is black on white. The 4.5:1 threshold for normal text is empirically chosen to meet the needs of users with moderately reduced vision; 3:1 for large text reflects that larger glyphs are easier to read at lower contrast.

```ts
// Browser DevTools, Figma plugins, and CI tools (Pa11y, axe) all compute this.
// Example: #595959 on #ffffff gives 7:1 — passes AA and AAA for normal text.
```

**Trade-offs / when this fails.** AA is the typical compliance target; AAA is stricter (7:1 for normal text) and rarely required outside of accessibility-focused organisations. The 3:1 threshold for non-text components is the one most often missed because designers focus on text contrast and leave the focus ring at the same colour as the background border. The right mitigation is to bake contrast checks into the design-system tokens at definition time so any token combination that lands in production is guaranteed to pass.

### 4. How do you announce a successful form submission to a screen reader?

Render a status region with `role="status"` (or `role="alert"` for errors that interrupt the user) and update its text content when the submission succeeds. The screen reader announces the new content automatically because the region is a live region. The status element must already exist in the Document Object Model when the announcement should occur; adding the element only on success is unreliable across screen readers.

**How it works.** A live region is an element marked with `aria-live="polite"` (or `aria-live="assertive"`), or one of the implicit live-region roles (`status` is `aria-live="polite"`, `alert` is `aria-live="assertive"`). When the text content of the live region changes, assistive technology queues the new text for announcement. `polite` waits for the user to finish their current activity; `assertive` interrupts.

```tsx
function ContactForm() {
  const [status, setStatus] = useState("");
  return (
    <>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setStatus("Sending…");
        await sendMessage(new FormData(e.currentTarget));
        setStatus("Message sent successfully");
      }}>
        {/* fields */}
        <button type="submit">Send</button>
      </form>
      <div role="status" aria-live="polite">{status}</div>
    </>
  );
}
```

**Trade-offs / when this fails.** Toast components that mount on success and unmount after a few seconds are unreliable for screen-reader announcement because some assistive technologies require the live region to be present at parse time. The robust pattern is a long-lived hidden status region whose text content changes; toasts are a visual layer on top. The other failure mode is announcing too much: rapid status updates queue and can interrupt the user, so updates should be coalesced (debounce to the final state).

### 5. Why is "use a `<div>` with `role="button"`" almost never the right answer?

Because the native `<button>` element has six pieces of behaviour that ARIA does not give a `<div>`: it is focusable by default, it has a default focus ring, it is activated by `Enter` and `Space`, it participates in form submission, it has a `disabled` attribute that visually and behaviourally disables the control, and it is announced as "button" by screen readers. A `<div role="button">` provides only the last of those six behaviours; the developer has to re-implement the other five by hand and almost always misses at least one.

**How it works.** ARIA is the declaration to assistive technology that an element should be treated as a particular role. The browser still treats the element according to its tag, so `<div role="button">` is announced as a button but receives no keyboard handling, no focus, and no form-submit semantics. The full re-implementation requires `tabIndex`, an `onKeyDown` handler that activates on `Enter` and `Space`, custom focus styles, custom disabled styles, and additional code to integrate with form submission via a hidden submit button or programmatic submission.

```tsx
// What "use a div with role=button" actually requires in production.
<div
  role="button"
  tabIndex={isDisabled ? -1 : 0}
  aria-disabled={isDisabled}
  className={isDisabled ? "btn btn--disabled" : "btn"}
  onClick={isDisabled ? undefined : onClick}
  onKeyDown={(e) => {
    if (isDisabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e);
    }
  }}
>
  Save
</div>
```

**Trade-offs / when this fails.** The legitimate use case is when the developer needs button semantics on an element that absolutely cannot be a `<button>` — for example, the entire surface of a card that should be clickable but contains nested interactive elements (an HTML constraint forbids interactive elements inside a `<button>`). Even then, the right solution is usually to make the most prominent action a real `<button>` and the larger area click-through via JavaScript on the wrapper, rather than to fake button semantics on the wrapper.

### 6. How would you wire automated accessibility checks into Continuous Integration?

Three layers, each running at a different point. First, `eslint-plugin-jsx-a11y` runs on every pre-commit hook and pull request and catches static issues such as missing alt attributes and roles on non-interactive elements. Second, `jest-axe` (or `@axe-core/react` in development) scans the rendered output of unit and integration tests for programmatically detectable violations. Third, a Playwright end-to-end test runs `@axe-core/playwright` against key pages on the deployed preview environment and fails the pull request if violations exceed the agreed threshold.

**How it works.** The three layers run in increasing scope and decreasing speed. ESLint runs in milliseconds on every save and gives immediate feedback during development. Jest with axe runs in a few seconds and catches violations introduced by a test snapshot. Playwright with axe runs in tens of seconds against a real browser and catches violations that only appear after hydration or during interaction. Each layer catches a category of issue the others miss.

```ts
// .github/workflows/a11y.yml (excerpt)
- run: pnpm lint            # eslint-plugin-jsx-a11y
- run: pnpm test            # jest-axe assertions
- run: pnpm playwright test # @axe-core/playwright on preview URL
```

```ts
// playwright/accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home is accessible", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**Trade-offs / when this fails.** Automated checks catch perhaps thirty per cent of real accessibility issues; the remaining seventy per cent — confusing announcements, illogical reading order, ambiguous labels — require a human listening to a screen reader. The Continuous Integration suite is necessary but not sufficient. The complementary practice is a regular accessibility audit by a person who uses assistive technology daily, which catches the issues the rules cannot encode.

## Further reading

- [W3C WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) — the canonical patterns and the keyboard contracts for each.
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/).
- [Inclusive Components](https://inclusive-components.design/) by Heydon Pickering.
