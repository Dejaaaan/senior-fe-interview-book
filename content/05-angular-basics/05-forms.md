---
title: "Forms (template-driven vs reactive)"
sidebar_label: "5.5 Forms (template-driven vs reactive)"
description: "The two Angular forms APIs and which one a senior should reach for."
sidebar_position: 5
---

Angular ships two distinct forms approaches. Template-driven forms are declarative and concise — the form's structure and validation rules live in the template, with `[(ngModel)]` two-way bindings and validator attributes. Reactive forms are programmatic and typed — the form's structure lives in TypeScript as a `FormGroup` tree, validators are explicit, and the template is a thin binding layer. Senior projects almost always pick reactive forms because they are typed, testable, and scale to non-trivial forms without becoming unmaintainable. Reading skill in template-driven forms remains necessary because legacy code uses both, often in the same module.

> **Acronyms used in this chapter.** API: Application Programming Interface. CD: Change Detection. DI: Dependency Injection. DOM: Document Object Model. RFC: Request for Comments. TS: TypeScript.

## Template-driven (legacy / quick)

```ts
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-contact",
  standalone: true,
  imports: [FormsModule],
  template: `
    <form #f="ngForm" (ngSubmit)="submit(f.value)">
      <input name="email" [(ngModel)]="email" required email />
      <input name="message" [(ngModel)]="message" required minlength="10" />
      <button [disabled]="f.invalid">Send</button>
    </form>
  `,
})
export class ContactComponent {
  email = "";
  message = "";

  submit(value: any) {
    console.log(value);
  }
}
```

The strengths of template-driven forms are minimal TypeScript code and the directness of declaring everything in the template; this makes them a reasonable choice for a tiny form (a search box, a single-input subscription form) where the overhead of building a `FormGroup` is not justified.

The weaknesses are the price of those strengths. Validation logic lives in the template as attribute-based directives, which scales poorly past a handful of fields and is harder to test in isolation. The `value` is untyped (`any`), so the team gives up the TypeScript inference that makes the rest of the application safe. The form's state can only be manipulated through template references, which makes programmatic interactions awkward. For any non-trivial form, the senior recommendation is the reactive form.

## Reactive forms (recommended)

```ts
import { Component, inject } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";

@Component({
  selector: "app-contact",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Email
        <input type="email" formControlName="email" />
      </label>
      @if (form.controls.email.invalid && form.controls.email.touched) {
        <p class="error">Enter a valid email.</p>
      }

      <label>
        Message
        <textarea formControlName="message"></textarea>
      </label>
      @if (form.controls.message.errors?.['minlength']) {
        <p class="error">At least 10 characters.</p>
      }

      <button [disabled]="form.invalid || pending()">
        @if (pending()) { Sending... } @else { Send }
      </button>
    </form>
  `,
})
export class ContactComponent {
  private fb = inject(FormBuilder);

  pending = signal(false);

  form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    message: ["", [Validators.required, Validators.minLength(10)]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.pending.set(true);
    try {
      await this.contact.send(this.form.getRawValue());
      this.form.reset();
    } finally {
      this.pending.set(false);
    }
  }
}
```

The form is a **typed, observable model** in TypeScript. Validation rules are explicit. The template is just a binding layer.

## Typed forms

`FormBuilder.group()` infers the type:

```ts
const form = fb.group({
  email: ["", Validators.required],
  age: [0, [Validators.min(0)]],
});

form.controls.email.value;   // string | null
form.controls.age.value;     // number | null
form.value;                  // Partial<{ email: string; age: number }>
form.getRawValue();          // { email: string | null; age: number | null }
```

`getRawValue()` includes disabled controls; `.value` doesn't. The `null` shows up because controls can be nullable; use `nonNullable: true` to drop it:

```ts
const form = fb.nonNullable.group({
  email: ["", Validators.required],
});
form.controls.email.value;   // string
```

Always use `fb.nonNullable` unless you have a reason not to.

## Validators

Built-in: `required`, `requiredTrue`, `email`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `nullValidator`.

Custom synchronous:

```ts
function noProfanity(): ValidatorFn {
  const banned = /\b(spam|abuse)\b/i;
  return (control) => banned.test(control.value ?? "") ? { profanity: true } : null;
}
```

Custom async (return Observable / Promise):

```ts
function uniqueEmail(svc: UsersService): AsyncValidatorFn {
  return (control) =>
    svc.exists(control.value).pipe(
      map((exists) => (exists ? { taken: true } : null))
    );
}
```

Wire as: `[Validators.required, Validators.email]` (sync) and `[uniqueEmail(svc)]` (async).

## Cross-field validation

```ts
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const a = group.get("password")?.value;
  const b = group.get("confirm")?.value;
  return a === b ? null : { mismatch: true };
}

const form = fb.group(
  {
    password: ["", Validators.required],
    confirm: ["", Validators.required],
  },
  { validators: passwordsMatch }
);
```

## Dynamic forms (`FormArray`)

For repeating groups (multiple addresses, line items):

```ts
const form = fb.nonNullable.group({
  items: fb.array<FormGroup<{ name: FormControl<string>; qty: FormControl<number> }>>([]),
});

addItem() {
  this.form.controls.items.push(
    this.fb.nonNullable.group({
      name: ["", Validators.required],
      qty: [1, [Validators.min(1)]],
    })
  );
}

removeItem(i: number) {
  this.form.controls.items.removeAt(i);
}
```

```html
<div formArrayName="items">
  @for (group of form.controls.items.controls; track $index; let i = $index) {
    <div [formGroupName]="i">
      <input formControlName="name" />
      <input type="number" formControlName="qty" />
      <button type="button" (click)="removeItem(i)">Remove</button>
    </div>
  }
</div>
<button type="button" (click)="addItem()">Add</button>
```

## Reactive subscriptions

`form.valueChanges`, `form.statusChanges`, `control.valueChanges` are Observables. Use them for derived UI:

```ts
this.form.controls.country.valueChanges
  .pipe(takeUntilDestroyed())
  .subscribe((country) => {
    if (country === "US") this.form.controls.state.enable();
    else this.form.controls.state.disable();
  });
```

## Update strategies

Forms react to every keystroke by default (`updateOn: "change"`). For expensive validators, switch to `"blur"` or `"submit"`:

```ts
form: this.fb.nonNullable.group({
  email: this.fb.nonNullable.control("", {
    validators: [Validators.required, Validators.email],
    asyncValidators: [uniqueEmail(this.svc)],
    updateOn: "blur",
  }),
});
```

## Server-side validation

Match server errors back into form state:

```ts
this.api.submit(this.form.getRawValue()).subscribe({
  error: (err) => {
    if (err.status === 422) {
      for (const issue of err.issues) {
        this.form.get(issue.path)?.setErrors({ server: issue.message });
      }
    }
  },
});
```

Pair with RFC 7807 problem+json from the backend ([Part 9 chapter 4 — Errors](../09-rest-and-networking/04-errors.md)).

## Anti-patterns

Four anti-patterns appear often in Angular forms code. Mixing template-driven and reactive forms in the same form (or worse, in the same field) produces a confused state model where neither approach has full ownership; the cure is to pick one approach per form. Duplicating validation messages as inline template strings scatters the wording across the codebase and makes localisation painful; the cure is a small directive or pipe that maps the error key to a localised message. Calling `form.value` and being surprised by `null` for nullable controls; the cure is `form.getRawValue()` (which includes disabled controls) or, better, declaring the form with `fb.nonNullable` so the values are not nullable in the first place. Re-creating the form on every Change Detection cycle produces a fresh `FormGroup` on each render, which loses the user's input and triggers extra renders; the cure is to build the form once as a class field initialiser or in `ngOnInit`.

## Key takeaways

- Reactive forms with `FormBuilder.nonNullable` and typed groups are the right choice for any non-trivial form because they give the application typed access to the form's state.
- Custom validators are functions that take an `AbstractControl` and return either `null` (valid) or a `ValidationErrors` object describing what failed; async validators return an Observable or Promise of the same.
- `FormArray` is the right primitive for dynamic repeating sections (multiple addresses, line items, tags); push and remove controls programmatically as the user adds or removes rows.
- Server-side validation feeds back into the form by setting per-control errors via `setErrors({ server: message })`, ideally with the server returning RFC 7807 `problem+json` so the application can map field paths to controls deterministically.
- Use `updateOn: "blur"` (or `"submit"`) for expensive async validators to avoid running them on every keystroke.

## Common interview questions

1. Reactive vs template-driven — when each?
2. How do you write a custom validator?
3. Difference between `value` and `getRawValue()`?
4. How do you implement a "passwords must match" validation?
5. How do you wire server-side validation errors back into a form?

## Answers

### 1. Reactive vs template-driven — when each?

Reactive forms are the right choice for any non-trivial form: complex validation, conditional fields, dynamic field counts, server-side validation feedback, programmatic state manipulation, or anywhere the form state needs to be tested without rendering the template. Template-driven forms are the right choice for the simplest cases — a search input with no validation, a single-field subscription form, a quick prototype where the form is genuinely throwaway.

**How it works.** Reactive forms construct a typed `FormGroup` tree in TypeScript, with the template binding to it via `[formGroup]` and `formControlName`. The form is a first-class object that the application can read, write, validate, subscribe to, and test directly. Template-driven forms construct an implicit `FormGroup` from `[(ngModel)]` bindings in the template, with the form state living in the template's directive instances; the application interacts with the form through template references (`#f="ngForm"`).

```ts
// Reactive — typed model, validation in TS, easy to test.
form = inject(FormBuilder).nonNullable.group({
  email: ["", [Validators.required, Validators.email]],
  message: ["", [Validators.required, Validators.minLength(10)]],
});

// Template-driven — concise but untyped and validator attributes only.
@Component({ template: `
  <form #f="ngForm">
    <input name="email" [(ngModel)]="email" required email />
  </form>
` })
export class C { email = ""; }
```

**Trade-offs / when this fails.** Reactive forms have boilerplate that template-driven forms do not, which makes the latter genuinely faster for trivial cases. The pattern fails when a project standardises on one approach but a junior developer reaches for the other; the cure is a project convention documented in the team's style guide (typically: reactive forms for everything that ships to production).

### 2. How do you write a custom validator?

A synchronous validator is a function that takes an `AbstractControl` and returns either `null` (the value is valid) or a `ValidationErrors` object (a record describing what failed, where the keys are validator names and the values are arbitrary metadata). The function is registered on the control via the `validators` option, and the framework runs it on every value change (or on blur, depending on `updateOn`).

**How it works.** The framework collects the errors objects from every validator on every control and stores them in `control.errors`. The template can read the errors to display messages, the form's overall validity is the conjunction of every control's validity, and submitting can be guarded with `if (form.invalid) return`.

```ts
// Synchronous validator — return null when valid.
function noProfanity(): ValidatorFn {
  const banned = /\b(spam|abuse)\b/i;
  return (control) => banned.test(control.value ?? "") ? { profanity: true } : null;
}

// Async validator — returns an Observable or Promise of the same shape.
function uniqueEmail(svc: UsersService): AsyncValidatorFn {
  return (control) =>
    svc.exists(control.value).pipe(
      map((exists) => (exists ? { taken: true } : null)),
    );
}

// Wired on the control:
fb.nonNullable.control("", {
  validators: [Validators.required, noProfanity()],
  asyncValidators: [uniqueEmail(this.svc)],
  updateOn: "blur",
});
```

**Trade-offs / when this fails.** Async validators run on every triggering event by default; for expensive validators (network calls), set `updateOn: "blur"` or `"submit"` so the validator runs only when the user finishes the field. The pattern fails when the validator depends on multiple controls; for that case, write a group-level validator that reads the controls' values and returns errors on the group.

### 3. Difference between `value` and `getRawValue()`?

`form.value` is the value of the form excluding any disabled controls; `form.getRawValue()` is the value including disabled controls. The distinction matters because a form often disables fields conditionally — a "billing address same as shipping" checkbox might disable the billing address fields — and the application typically wants those values when submitting (the disabled fields are still semantically part of the form's data).

**How it works.** A control's `disabled` flag prevents the control from contributing to validation and excludes its value from `form.value`. The framework tracks disabled state separately from the value itself; `getRawValue()` walks the control tree and returns the value of every control regardless of disabled state.

```ts
const form = fb.nonNullable.group({
  email: ["a@b.com"],
  password: [{ value: "secret", disabled: true }],
});

form.value;          // { email: "a@b.com" } — password excluded
form.getRawValue();  // { email: "a@b.com", password: "secret" } — both
```

**Trade-offs / when this fails.** Use `getRawValue()` when submitting the form to the server, because the server typically needs the full data set. Use `value` when reading the form's "currently active" state for conditional UI. The pattern fails when the team uses `value` for submission and silently loses disabled fields; the cure is a project convention that submission always uses `getRawValue()`.

### 4. How do you implement a "passwords must match" validation?

Implement the validation as a group-level validator that reads both controls' values and returns an error on the group when they do not match. The validator is registered on the group via the `validators` option of `FormBuilder.group`. The template reads the group's errors to display the message — typically near the confirm-password field — and the form's overall validity reflects the mismatch.

**How it works.** A validator on a group receives the group as the `AbstractControl` argument, so it can read individual controls via `group.get("name")`. Returning `null` means valid; returning an errors object marks the group invalid. The framework re-runs the validator on every value change of any control in the group, which is what makes the validation reactive to either field changing.

```ts
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const a = group.get("password")?.value;
  const b = group.get("confirm")?.value;
  return a === b ? null : { mismatch: true };
}

const form = fb.nonNullable.group(
  {
    password: ["", Validators.required],
    confirm: ["", Validators.required],
  },
  { validators: passwordsMatch },
);

// Template renders the message based on the group-level error:
@if (form.errors?.['mismatch'] && form.controls.confirm.touched) {
  <p class="error">Passwords must match.</p>
}
```

**Trade-offs / when this fails.** Group-level errors live on the group, not on a specific control, which can be confusing for screen readers that announce errors per field. The cure is to copy the error onto the control via `confirm.setErrors({ mismatch: true })` so the field-level error machinery picks it up. The pattern fails when the validator runs before either field has been touched, producing an awkward "passwords must match" message on a freshly-mounted form; the cure is to gate the message on `confirm.touched` (as shown above) so it appears only after the user has interacted with the confirm field.

### 5. How do you wire server-side validation errors back into a form?

When the server rejects a submission with field-specific errors, map each error onto the corresponding control via `control.setErrors({ server: message })`. The error then appears alongside any client-side errors on the control, and the form's overall validity reflects the server's verdict. Pair the pattern with RFC 7807 `problem+json` from the backend so the response carries a structured list of `{ path, message }` pairs that the application can iterate over deterministically.

**How it works.** `setErrors` replaces the control's error map (or merges with existing errors, depending on how the team sets it up). The control's status flips to `INVALID`, the template re-renders, and any error-display directive bound to the control surfaces the server message. The user can then correct the field, which clears the local errors but leaves the server error in place — the control should clear the server error on the next change to avoid a stale "email already taken" message after the user has edited the email.

```ts
this.api.submit(this.form.getRawValue()).subscribe({
  error: (err) => {
    if (err.status === 422 && Array.isArray(err.issues)) {
      for (const issue of err.issues) {
        this.form.get(issue.path)?.setErrors({ server: issue.message });
      }
    }
  },
});

// Clear the server error when the user edits the field:
this.form.controls.email.valueChanges
  .pipe(takeUntilDestroyed())
  .subscribe(() => {
    const errors = this.form.controls.email.errors;
    if (errors?.["server"]) {
      const { server, ...rest } = errors;
      this.form.controls.email.setErrors(Object.keys(rest).length ? rest : null);
    }
  });
```

**Trade-offs / when this fails.** The pattern requires the server to return field-keyed errors in a structured format; a server that returns "Validation failed" as a single string forces the application to either show a generic error or do brittle text parsing. The cure is to standardise on `problem+json` (or a similar contract) at the API boundary. The pattern also requires the team to clear server errors on field edit; otherwise a stale error can confuse the user. The senior framing is "the form is the user's view of the server's verdict, including its rejection reasons".

## Further reading

- [Angular Reactive Forms](https://angular.dev/guide/forms/reactive-forms).
- [Typed Forms](https://angular.dev/guide/forms/typed-forms).
