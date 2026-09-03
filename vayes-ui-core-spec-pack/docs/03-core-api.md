# 03 — Core API Specification

This document specifies the intended stable public surface. Names are normative for the first implementation unless an ADR changes them.

## `Component`

```js
export class Component extends HTMLElement
```

### Responsibilities

- standardize mount/unmount lifecycle;
- provide lifecycle-scoped cancellation;
- provide native event emission convenience;
- provide small query helpers;
- provide safe property-upgrade support;
- optionally provide declarative local action delegation.

### Required public/protected API

```js
class Component extends HTMLElement {
    get mounted();
    get signal();

    connectedCallback();
    disconnectedCallback();

    mount();
    unmount();

    render();
    bindEvents();

    emit(name, detail?, options?);
    find(selector);
    findAll(selector);
    upgradeProperty(name);
}
```

`mount`, `unmount`, `render`, and `bindEvents` are extension points. They may be no-ops in the base class.

### `mounted`

Read-only boolean indicating whether the component currently considers itself connected/mounted.

### `signal`

An `AbortSignal` tied to the current mount cycle. A fresh signal is created on each connection and aborted on disconnection.

Example:

```js
window.addEventListener('resize', this.handleResize, {
    signal: this.signal,
});
```

### `emit(name, detail = undefined, options = {})`

Creates and dispatches a `CustomEvent`.

Default behavior:

```js
{
    bubbles: true,
    composed: true,
    cancelable: false,
}
```

Callers may override the three event options explicitly.

Return the boolean result of `dispatchEvent`.

### `find(selector)`

Alias for `this.querySelector(selector)`.

### `findAll(selector)`

Returns a real array rather than a `NodeList`:

```js
return Array.from(this.querySelectorAll(selector));
```

### `upgradeProperty(name)`

Required to handle properties set on an un-upgraded custom element before its class is defined.

Canonical pattern:

```js
upgradeProperty(name) {
    if (!Object.prototype.hasOwnProperty.call(this, name)) {
        return;
    }

    const value = this[name];
    delete this[name];
    this[name] = value;
}
```

Components with public property accessors call this for those properties before consuming them.

## `EventBus`

```js
export class EventBus extends EventTarget
```

Required API:

```js
emit(name, detail?, options?);
on(name, handler, options?);
once(name, handler, options?);
```

`on()` should return an unsubscribe function for ergonomic use outside component lifecycles.

Example:

```js
const unsubscribe = events.on('session:changed', handleSession);
unsubscribe();
```

Inside a component, prefer passing the component lifecycle signal:

```js
events.on('session:changed', this.handleSession, {
    signal: this.signal,
});
```

The exported default application bus may be:

```js
export const events = new EventBus();
```

## `HttpClient`

```js
export class HttpClient
```

Required methods:

```js
request(url, options?);
json(url, options?);
text(url, options?);
html(url, options?);
get(url, options?);
post(url, body?, options?);
put(url, body?, options?);
patch(url, body?, options?);
delete(url, options?);
```

The exact convenience method set may be reduced if tests show unused duplication. `request`, `json`, `text`, `html`, `get`, and `post` are the minimum intended baseline.

### Required transport policy

- uses native `fetch`;
- sends `X-Requested-With: XMLHttpRequest` by default for CI4 AJAX detection;
- same-origin credentials by default unless explicitly overridden;
- supports external `AbortSignal`;
- supports configurable timeout by composing an abort signal;
- adds CSRF data/header through a pluggable strategy;
- throws `HttpError` for non-success HTTP status;
- does not display UI;
- does not retry unsafe requests automatically;
- never assumes every response is JSON.

## `HttpError`

Required fields:

```js
name = 'HttpError'
status
statusText
url
response
body // optional parsed body when safely available
requestId // optional
```

Network errors remain distinguishable from HTTP errors.

## `ActionRegistry` — optional core module

Purpose: allow declarative markup to reference **registered identifiers**, never executable strings.

Required API if implemented:

```js
register(name, handler);
unregister(name);
has(name);
get(name);
invoke(name, context);
```

Forbidden:

```js
new Function(attributeValue)
eval(attributeValue)
window[attributeValue](...)
```

Names should be application-scoped, for example:

```text
invoice.customerSelected
customer.openEditor
```

This registry is optional. Native DOM subscriptions remain the primary component communication mechanism.

## Registration helper

A small helper may standardize idempotent registration:

```js
export function define(name, constructor) {
    if (!customElements.get(name)) {
        customElements.define(name, constructor);
    }

    return constructor;
}
```

It must validate that the name follows Custom Element naming requirements and project prefix policy.

## Naming policy

Default project prefix:

```text
vui-
```

Examples:

```text
vui-modal
vui-tabs
vui-customer-selector
```

Application-specific components may use a product prefix if desired, but one repository should not mix prefixes without an ADR.
