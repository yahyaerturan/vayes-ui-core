# 21 — Styling and Design-System Integration

## Principle

Vayes UI Core is not a CSS framework. Components must integrate predictably with Bootstrap, Tailwind, a custom design system, or application CSS.

## Light DOM implications

Because Light DOM is default, application CSS can style component descendants normally. This is intentional.

Component markup should still avoid generic class names that create collisions.

Recommended reusable-component class naming:

```text
vui-modal
vui-modal__panel
vui-modal__header
vui-modal--open
```

A strict BEM implementation is not required, but names should be clearly component-scoped.

## State hooks

Prefer semantic attributes for states that affect both behavior and styling:

```html
<vui-customer-selector loading disabled aria-busy="true">
```

or internal state markers such as:

```html
<div data-state="error">
```

Do not duplicate the same state across many unrelated CSS classes and JS booleans without reason.

## CSS custom properties

Reusable components may expose CSS custom properties as a stable styling API when useful:

```css
vui-modal {
    --vui-modal-max-width: 48rem;
}
```

Do not expose dozens of variables preemptively. Add them when consumers need stable customization.

## Tailwind

Tailwind may style server/component markup, but the core must not depend on Tailwind runtime behavior. If build-time class detection is used, dynamically generated class names must follow the host application's safelist/build conventions.

## Bootstrap

Bootstrap classes may be used by an application-specific component implementation, but generic core behavior should not assume Bootstrap JavaScript plugins exist.

## Shadow DOM styling

If a component opts into Shadow DOM, define an explicit external styling surface using CSS custom properties, slots and/or `::part`. Document that surface as public API.

## Visibility

Prefer semantic/native mechanisms (`hidden`, `open`, `disabled`) when appropriate instead of arbitrary style mutations.

## Motion

Keep transitions primarily in CSS. Component code should toggle state; CSS should own animation details. Respect reduced-motion preferences.

## Theme support

The core does not own light/dark theme state. Theme selection belongs to the application/design system. Components should inherit normal CSS where possible.

## Tests

Visual regression testing is optional for core, but reference components should at least test that behavior does not depend on a specific framework stylesheet and that hidden/disabled/open states are represented semantically.
