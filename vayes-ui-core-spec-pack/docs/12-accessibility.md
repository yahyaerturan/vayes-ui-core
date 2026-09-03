# 12 — Accessibility

## Principle

A reusable component that cannot be operated with expected keyboard/assistive technology behavior is incomplete.

## Prefer native elements

Use native controls whenever possible:

```html
<button>
<input>
<select>
<dialog>
<details>
```

Do not replace native semantics with `<div>` plus ARIA unless the native control genuinely cannot satisfy the use case.

## Keyboard contracts

Each interactive component documents expected keys.

Examples:

### Modal/dialog

- moves focus appropriately on open;
- Escape closes unless prevented/disabled;
- focus remains within modal where modal semantics require it;
- focus returns to the invoker when closed where practical.

### Tabs

Follow accepted tab keyboard patterns for arrow navigation/activation model chosen by the component.

### Autocomplete/select

Document arrow, Enter, Escape, typing and focus semantics; implement associated ARIA state correctly.

## Focus updates

Incremental DOM updates must avoid unexpectedly replacing the currently focused element.

## ARIA state

State-changing methods update ARIA together with visual state:

```js
setLoading(loading) {
    this.toggleAttribute('aria-busy', loading);
    ...
}
```

## Disabled state

Use actual native `disabled` where the controlled native element supports it. If a custom element exposes `disabled`, ensure internal controls and accessibility state reflect it.

## Labels

Form-like components must preserve programmatic labels. If a component creates an internal control, document how consumers associate labels/help/errors.

## Error messages

Validation errors should be associated with the relevant field and announced appropriately when the application flow requires it.

## Reduced motion

Reusable components with animation should respect `prefers-reduced-motion` or leave motion to CSS/design-system layers.

## Shadow DOM

Any Shadow DOM component must receive additional testing for labels, focus and semantics across shadow boundaries.

## Acceptance rule

Do not mark a reference interactive component complete until keyboard interaction is covered by browser tests.
