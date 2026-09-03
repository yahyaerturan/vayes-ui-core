# 22 — Component Authoring Standard

Every new reusable component must define the following contract before implementation.

## 1. Identity

- custom element tag;
- purpose;
- ownership mode: enhancement / client-owned / hybrid;
- Light DOM or justified Shadow DOM.

## 2. Public configuration

Document each attribute:

| Attribute | Type | Default | Observed? | Meaning |
|---|---|---|---|---|

Document each property:

| Property | Type | Default | Mutable? | Reflected? | Meaning |
|---|---|---|---|---|---|

## 3. Public methods

For every method specify parameters, return value, side effects and failure behavior.

## 4. Events

| Event | Timing | Bubbles | Cancelable | Detail shape |
|---|---|---:|---:|---|

For cancelable operations define pre/post event semantics explicitly.

## 5. Internal state

List canonical local state. Do not expose the internal state object as API.

## 6. DOM ownership

Document:

- server-provided nodes the component expects;
- nodes the component creates;
- stable `data-*` hooks;
- whether descendants may be replaced dynamically;
- focus-sensitive nodes that must not be unnecessarily recreated.

## 7. Actions

List supported internal `data-action` identifiers and owning handlers.

## 8. Async behavior

If applicable:

- service dependency;
- endpoint/config source;
- request cancellation policy;
- stale response policy;
- loading/empty/error states;
- retry behavior.

## 9. Accessibility

Define semantics, labels, keyboard interactions, focus management and ARIA state.

## 10. Security

Identify any untrusted data rendered by the component and the safe rendering method. If trusted HTML is accepted, define the trust boundary explicitly.

## 11. Lifecycle resources

List document/window listeners, EventBus subscriptions, timers, observers and requests that must be cleaned on disconnect.

## 12. Test checklist

A reusable component is done only after applicable tests cover:

- definition before/after element;
- connect/disconnect/reconnect;
- duplicate listener prevention;
- attributes/properties;
- property-before-upgrade;
- public events;
- keyboard/focus;
- dynamic AJAX insertion;
- async abort/errors;
- XSS-sensitive rendering;
- disabled/loading states.

## 13. Complexity check

Before adding a component-level abstraction ask:

1. Is this needed by this component now?
2. Is the native browser API sufficient?
3. Would a small private method be clearer?
4. Would moving it into core make unrelated components more complex?

Default to the smallest local solution.
