# 06 — Rendering and DOM Ownership

## Principle

Use the real DOM directly. Do not introduce a virtual representation of the DOM.

## Ownership modes

Every component should document one of these primary modes.

### A. Enhancement component

The server owns initial markup. The component adds behavior.

```html
<vui-tabs>
    <button role="tab" ...>General</button>
    <button role="tab" ...>Billing</button>
    ...
</vui-tabs>
```

`render()` is normally a no-op. The component queries existing children and attaches behavior.

### B. Client-owned component

The element starts empty or has a loading fallback. The component creates its internal markup once.

```html
<vui-modal></vui-modal>
```

The component can render on first mount if no owned markup exists.

### C. Hybrid component

The server provides initial meaningful content, but the component may add controlled wrappers/status regions.

## Initial render vs update

Initial render:

```js
render() {
    if (this.dataset.rendered === '1') {
        return;
    }

    // create initial structure
    this.dataset.rendered = '1';
}
```

This is only an example; a private boolean is often better than a public data attribute.

Incremental update:

```js
setLoading(loading) {
    this.state.loading = loading;
    this.find('[data-loader]').hidden = !loading;
    this.toggleAttribute('aria-busy', loading);
}
```

## Event delegation

Prefer one stable listener on the component root when multiple dynamic descendants perform actions.

```js
this.addEventListener('click', event => {
    const trigger = event.target.closest('[data-action]');

    if (!trigger || !this.contains(trigger)) {
        return;
    }

    this.handleAction(trigger.dataset.action, trigger, event);
}, { signal: this.signal });
```

A nested custom element can contain its own action markup. Parent components must avoid stealing actions from nested component boundaries. Recommended guard:

```js
const owner = trigger.closest('vui-parent-component');
if (owner !== this) return;
```

or component-specific selectors that make ownership unambiguous.

## DOM creation

Preferred for untrusted dynamic text:

```js
const label = document.createElement('span');
label.textContent = customer.name;
```

Template literals are acceptable for static/trusted component structure:

```js
this.innerHTML = `
    <div class="vui-modal__panel" role="dialog">
        <button data-action="close" type="button">Close</button>
        <div data-content></div>
    </div>
`;
```

Then insert untrusted values via `textContent`/properties.

## AJAX HTML fragments

Server-rendered HTML fragments may be inserted with:

```js
container.replaceChildren(fragment);
```

or parsed through a helper using `<template>`/`DOMParser`.

The fragment insertion utility must not execute embedded scripts. Application code must not depend on `<script>` tags inside returned fragments.

Custom Elements inside inserted HTML automatically upgrade if defined. If definition occurs later, they upgrade when registered.

## Focus preservation

Avoid full subtree replacement when a state update can modify one node. Replacing DOM can destroy:

- focus;
- text selection;
- browser-managed input state;
- open popovers/details state;
- scroll anchors;
- third-party/native widget state.

Incremental DOM updates are therefore the default.

## Shadow DOM policy

Light DOM is default.

Shadow DOM may be used when at least one is true:

- component must be embedded in unknown third-party CSS;
- style isolation is a product requirement;
- slot-based encapsulation materially improves a standalone widget;
- the component is distributed outside the primary application.

A component using Shadow DOM must document:

- styling API (`::part`, CSS custom properties, slots);
- event composed behavior;
- accessibility implications;
- form behavior;
- testing differences.

## No proprietary template engine

Do not add syntax such as:

```text
{{ value }}
@if(...)
v-for
x-bind
```

CodeIgniter views and native JavaScript remain the template mechanisms.
