# Vayes UI Core — Master Specification


---

<!-- SOURCE: README.md -->

# Vayes UI Core — Native Component Architecture Specification

**Status:** Implementation specification  
**Audience:** AI coding agents, lead developers, reviewers, maintainers  
**Primary backend:** CodeIgniter 4  
**Frontend runtime:** Browser-native JavaScript only  
**Runtime framework dependencies:** **None**

Vayes UI Core is a deliberately small frontend component layer for server-oriented web applications. It provides reusable/configurable UI components, explicit lifecycle management, native component events, an optional application event bus, controlled HTTP/AJAX integration, and support for both server-rendered and client-rendered components.

It is **not** a React/Vue/Svelte replacement and must never evolve into one. The browser is the platform. The library exists only to standardize the few patterns that browsers expose at a lower level than we want to repeat throughout application code.

## Required browser primitives

The implementation is built on:

- `HTMLElement` and Custom Elements (`customElements.define`)
- `EventTarget`, `Event`, and `CustomEvent`
- `AbortController` / `AbortSignal`
- `fetch`
- ES modules
- standard DOM APIs (`querySelector`, `closest`, `dataset`, `classList`, etc.)
- optional `<template>` elements
- optional `ElementInternals` for advanced form-associated components
- optional Shadow DOM only when isolation is a genuine requirement

## Core design promise

A developer inspecting the DOM and JavaScript should be able to determine:

1. which component owns a behavior;
2. which DOM event caused the behavior;
3. which server endpoint was called;
4. which event was emitted after the change;
5. which subscriber reacted to that event;
6. how the component cleans itself up.

No invisible dependency graph, reactive proxy, hook scheduler, virtual DOM, compiler, decorator system, or proprietary template language is permitted.

## Read order for implementation agents

1. `AGENTS.md`
2. `docs/01-vision-principles.md`
3. `docs/02-architecture.md`
4. `docs/03-core-api.md`
5. `docs/04-component-lifecycle.md`
6. `docs/05-configuration-state.md`
7. `docs/06-rendering-dom.md`
8. `docs/07-events-actions.md`
9. `docs/08-http-ajax.md`
10. `docs/09-ci4-integration.md`
11. `docs/10-security.md`
12. `docs/11-testing.md`
13. `docs/12-accessibility.md`
14. `docs/13-performance.md`
15. `docs/14-build-packaging.md`
16. `docs/15-reference-components.md`
17. `docs/16-implementation-plan.md`
18. `docs/17-acceptance-criteria.md`
19. `docs/18-maintenance-versioning.md`
20. ADRs in `adrs/`

## Deliverable target

The first stable release should contain only a compact core plus a small reference component set. A target of roughly **500–1,500 lines for the core runtime** is healthy. Component implementations, tests, examples, and documentation are not counted in that number.

The core should remain small enough that a competent developer can understand the full runtime in one focused review.


---

<!-- SOURCE: AGENTS.md -->

# AI Agent Implementation Rules

This file is authoritative for AI coding agents implementing Vayes UI Core.

## 1. Mission

Implement the specification in this repository **without inventing a frontend framework**. Prefer browser standards over library abstractions. If the browser already exposes a clear primitive, wrap it only when the wrapper creates a repeatable policy or removes meaningful boilerplate.

## 2. Hard constraints

The following are forbidden unless a future ADR explicitly reverses the decision:

- React, Vue, Angular, Svelte, Solid, Alpine, HTMX, Stimulus or comparable runtime frameworks.
- Virtual DOM or DOM diff/reconciliation engines.
- JSX or a custom compiler-required template syntax.
- Reactive proxies, signal graphs, implicit observers, automatic dependency tracking.
- Hooks or hook-like lifecycle composition APIs.
- A global mutable application state store in the core.
- Two-way data binding.
- `eval`, `new Function`, string-to-code execution, or inline executable handler strings.
- DOM mutation scanners used to initialize Custom Elements.
- Requiring Shadow DOM for ordinary components.
- A custom client router in the core.
- A dependency injection container in the frontend core.
- Runtime npm dependencies without a new ADR and explicit approval.
- Silently swallowing errors.
- `innerHTML`/`insertAdjacentHTML` with untrusted or unsanitized data.

## 3. Preferred implementation primitives

Use, in order of preference:

1. Custom Elements.
2. Native DOM events.
3. Event delegation.
4. `AbortController` for lifecycle-scoped listener cleanup.
5. Explicit methods for state mutation and DOM updates.
6. Properties for rich values; attributes for HTML-friendly scalar configuration.
7. `fetch` through the project HTTP abstraction.
8. ES modules.
9. JSDoc for public API types and contracts.

## 4. Phase discipline

Implement `docs/16-implementation-plan.md` one phase at a time.

For every phase:

1. read all referenced specs and ADRs;
2. write or update tests for the public behavior;
3. implement only the smallest API required by the phase;
4. run unit, browser, lint and integration checks applicable to the phase;
5. update documentation/examples where public behavior changed;
6. verify phase exit criteria;
7. do **not** start the next phase while required tests fail.

## 5. Public API discipline

Every public class, public method, supported attribute, property, emitted event, event detail shape and HTTP behavior must be documented.

Public APIs must not be added merely because they may be useful later. YAGNI applies. Prefer a private helper until at least two concrete call sites require a stable abstraction.

## 6. Lifecycle discipline

Custom Elements can be connected, disconnected and reconnected more than once. Implementations must be safe under all three operations.

- Never assume `connectedCallback()` runs exactly once.
- Never create duplicate event listeners on reconnect.
- Use a new lifecycle `AbortController` for each mount cycle.
- Abort it in `disconnectedCallback()`.
- Timers, observers and subscriptions created by a component must be disposed during disconnect.
- Avoid network calls in constructors.
- Avoid accessing child DOM in constructors.

## 7. Rendering discipline

Initial rendering and incremental updates are separate concerns.

- `render()` may create initial component markup when the component owns that markup.
- State changes should update the smallest relevant DOM region by explicit methods.
- Do not implement global `setState() -> render everything` behavior in the core.
- Server-rendered light DOM must be preservable and progressively enhanced where specified.
- Do not destroy user focus, text selection, scroll position or uncontrolled form state through gratuitous rerenders.

## 8. Event discipline

- Use DOM `CustomEvent` for component-to-parent/ancestor communication.
- Events that represent meaningful changes should bubble by default.
- Use the application `EventBus` only when the publisher/subscriber relationship is intentionally independent of DOM hierarchy.
- Event names and `detail` payloads are API contracts and must be tested.
- Do not call application-specific global functions from reusable components.

## 9. Security discipline

- Treat all server and user data as untrusted by default.
- Prefer `textContent`, properties and DOM creation methods over HTML interpolation.
- If HTML fragments are intentionally accepted, the trust boundary must be explicit and documented.
- No script execution from AJAX HTML fragments.
- CSRF handling must follow the CodeIgniter adapter contract.
- No secrets in frontend source.

## 10. Testing discipline

A component is not complete unless tests cover, where applicable:

- initial connection;
- disconnection cleanup;
- reconnect without duplicate behavior;
- configuration from attributes;
- configuration from properties;
- property assignment before custom-element definition (upgrade case);
- emitted events and detail payloads;
- event bubbling;
- dynamic insertion after an AJAX-like DOM update;
- keyboard behavior and accessibility expectations;
- server error and network error paths;
- XSS-sensitive rendering paths.

Browser-native behavior must be verified in a real browser test suite, not only a simulated DOM.

## 11. Change control

When the implementation appears to require violating a hard constraint:

1. stop that design path;
2. document why the current specification appears insufficient;
3. propose an ADR describing alternatives, trade-offs and compatibility impact;
4. do not implement the architectural change until accepted.


---

<!-- SOURCE: docs/01-vision-principles.md -->

# 01 — Vision and Principles

## Problem statement

Traditional CodeIgniter applications often begin with server-rendered PHP views plus small JavaScript files. As interactivity grows, the JavaScript can degrade into scattered selectors, duplicate AJAX helpers, manually initialized widgets, undocumented global events, and components that fail when injected after an AJAX response.

The alternative is often to introduce a full SPA framework. That solves componentization, but also transfers large responsibilities to the frontend: routing, application state, API contracts, duplicate validation, client data synchronization, build conventions, framework lifecycle and framework-specific testing.

Vayes UI Core occupies the narrow space between those extremes.

## Goals

### G1. Reusable components

A reusable UI capability is represented by a native Custom Element or, only where a custom element is inappropriate, a small explicit module.

Example:

```html
<vui-customer-selector
    endpoint="/customers/search"
    min-query="2"
></vui-customer-selector>
```

### G2. Explicit configuration

Simple configuration is visible in HTML attributes. Rich JavaScript data is passed through properties. Defaults are documented and deterministic.

### G3. Explicit events

Components publish meaningful changes through `CustomEvent`. Consumers subscribe with `addEventListener()` or, for intentionally global application events, through a tiny `EventBus` based on `EventTarget`.

### G4. Dynamic DOM support

Components inserted by server-rendered AJAX fragments or created in JavaScript must initialize automatically through the Custom Elements lifecycle. No global `initWidgets()` pass is required.

### G5. Server/client coexistence

A component may be:

- entirely server rendered and behavior-enhanced;
- server rendered with client-managed local state;
- client-created from JSON/properties;
- inserted as server-generated HTML after an AJAX call.

These modes must not require different component classes.

### G6. Zero runtime framework dependencies

The stable runtime should depend on browser standards only. Tooling dependencies for linting, testing, documentation and bundling are allowed, but production component behavior must not depend on a third-party frontend framework.

### G7. Traceability

Behavior should remain obvious from source and DevTools. A request should be traceable from user event → component method → HTTP call → DOM update → emitted event → subscriber.

### G8. Long-term stability

The architecture should resist ecosystem churn. Browser standards evolve more slowly than frontend frameworks and maintain backward compatibility more strongly.

## Non-goals

Vayes UI Core is not intended to provide:

- client-side application routing;
- server-side rendering of a JavaScript application;
- hydration/reconciliation;
- reactive state graphs;
- global state management;
- a templating language;
- a CSS framework;
- a data ORM;
- business/domain logic;
- a replacement for CodeIgniter views;
- a universal design system in the first release.

## Design principles

### P1. Browser first

If the native API is already clean, use it directly.

### P2. Explicit over implicit

An explicit `setLoading(true)` method is preferable to a proxy that observes `state.loading` and invisibly modifies the DOM.

### P3. Light DOM by default

Components used inside first-party CodeIgniter applications should participate normally in application CSS, forms, accessibility trees and DevTools. Shadow DOM is an explicit opt-in for isolation use cases.

### P4. Server authoritative

Business rules, permissions and data validation remain authoritative on the server. Client-side validation exists for UX, not security.

### P5. Events decouple components

Reusable components emit facts such as `customer:selected`; they do not directly call invoice, CRM or analytics modules.

### P6. Separate transport from UI

Components should consume an HTTP service/client rather than each inventing fetch/CSRF/error conventions.

### P7. Small core, richer components

Complexity belongs in the components that need it, not in the universal runtime.

### P8. Progressive enhancement where practical

When useful, initial server HTML should remain meaningful before JavaScript upgrades the element.

### P9. Accessibility is behavior

Keyboard and semantic behavior are part of component correctness, not a final styling pass.

### P10. Test native behavior in native browsers

Simulated DOM tests may accelerate utilities, but browser lifecycle/event behavior requires real-browser integration tests.


---

<!-- SOURCE: docs/02-architecture.md -->

# 02 — Architecture

## High-level architecture

```text
CodeIgniter 4
│
├── Routes / Filters
├── Controllers
├── Services / Domain
├── Validation / Authorization
├── Models / Repositories
└── Views / HTML fragments
        │
        ▼
Browser DOM
│
├── Custom Elements
│   ├── Component lifecycle
│   ├── local state
│   ├── explicit DOM updates
│   └── component CustomEvents
│
├── EventBus (only for non-DOM application events)
│
├── HttpClient
│   ├── fetch
│   ├── CSRF policy
│   ├── JSON / text / HTML handling
│   ├── timeout / abort
│   └── normalized transport errors
│
└── Application subscribers/services
```

## Layer responsibilities

### Core runtime

The core runtime may contain:

- `Component`
- `EventBus`
- `HttpClient`
- `HttpError`
- `ActionRegistry` (optional, narrowly scoped)
- small DOM/type helpers only when repeated use justifies them
- component registration helpers

It must not contain application-specific components or endpoints.

### Reusable UI components

Examples:

- modal
- tabs
- dropdown/menu
- toast/notification host
- confirm dialog
- async button
- optional autocomplete/select

Components have their own styles/markup behavior but consume only core contracts.

### Application components

Examples:

- customer selector
- invoice totals
- media picker
- user permissions editor

Application components can depend on application services and data contracts. They should still follow the same lifecycle/event conventions.

### Application services

Services coordinate HTTP/domain-facing calls:

```text
CustomerSelector -> CustomerService -> HttpClient -> CI4 endpoint
```

The component should not have to know CSRF, response headers, error normalization or request instrumentation.

## Folder structure

Recommended source structure:

```text
resources/
└── js/
    ├── core/
    │   ├── Component.js
    │   ├── EventBus.js
    │   ├── HttpClient.js
    │   ├── HttpError.js
    │   ├── ActionRegistry.js
    │   ├── register.js
    │   └── index.js
    │
    ├── components/
    │   ├── common/
    │   │   ├── Modal.js
    │   │   ├── Tabs.js
    │   │   └── AsyncButton.js
    │   └── customer/
    │       └── CustomerSelector.js
    │
    ├── services/
    │   ├── CustomerService.js
    │   └── InvoiceService.js
    │
    ├── actions/
    │   └── invoiceActions.js
    │
    └── app.js
```

Recommended tests:

```text
tests/
├── unit/
├── browser/
├── integration/
└── fixtures/
```

## Dependency direction

Allowed:

```text
Application Component
    ↓
Application Service
    ↓
Core HttpClient
```

Allowed:

```text
Reusable Component
    ↓
Core Component
```

Not allowed:

```text
Core Component
    ↓
Application Component
```

Not allowed:

```text
HttpClient
    ↓
Modal / Toast / UI component
```

Transport errors may emit an application-neutral event or throw an error. Presentation decisions belong above the transport layer.

## Runtime initialization

The application entry module imports definitions:

```js
import './components/common/Modal.js';
import './components/common/Tabs.js';
import './components/customer/CustomerSelector.js';
```

When the module defining a custom element is evaluated:

```js
if (!customElements.get('vui-customer-selector')) {
    customElements.define('vui-customer-selector', CustomerSelector);
}
```

No DOM-ready initialization loop is required for Custom Elements. Existing matching elements upgrade when registered; subsequently inserted elements initialize automatically when connected.

## Multiple rendering modes

### Server-first enhancement

```html
<vui-customer-card customer-id="...">
    <h3>Server rendered name</h3>
    <button data-action="edit">Edit</button>
</vui-customer-card>
```

JS attaches behavior while preserving meaningful server markup.

### Client-owned markup

```html
<vui-modal></vui-modal>
```

The component creates its internal light DOM on first connection.

### JavaScript-created component

```js
const el = document.createElement('vui-customer-card');
el.customer = customer;
container.append(el);
```

### AJAX fragment

CI4 returns:

```html
<vui-customer-card customer-id="..."></vui-customer-card>
```

The client inserts it. The native custom-element lifecycle performs initialization.

## Architectural boundary test

Before adding a core abstraction, ask:

1. Is this behavior available directly through a stable browser primitive?
2. Does wrapping it create a consistent policy used in multiple places?
3. Can the wrapper remain understandable in one file?
4. Does the abstraction hide important control flow?
5. Does it move business logic into the frontend?

If answers 2–3 are weak or 4–5 are true, do not add the abstraction.


---

<!-- SOURCE: docs/03-core-api.md -->

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


---

<!-- SOURCE: docs/04-component-lifecycle.md -->

# 04 — Component Lifecycle

## Lifecycle model

A native Custom Element can be constructed before it is connected, connected multiple times, moved between parents, disconnected temporarily, and upgraded after it already exists in the document.

The library must treat lifecycle correctness as a first-class concern.

## Constructor rules

The constructor may:

- initialize plain fields;
- bind stable method references if needed;
- create internal state objects;
- optionally call `attachShadow()` for explicitly isolated components.

The constructor should not:

- fetch remote data;
- query child elements that may not exist yet;
- depend on layout measurements;
- register global listeners that cannot yet be lifecycle-scoped;
- mutate unrelated DOM.

## Connection flow

Normative base behavior:

```text
connectedCallback()
  ├─ ignore duplicate callback if already mounted
  ├─ create new AbortController
  ├─ mark mounted
  ├─ upgrade declared public properties
  └─ mount()
       ├─ render() when required
       └─ bindEvents()
```

The implementation can vary internally, but behavior must match.

## Disconnection flow

```text
disconnectedCallback()
  ├─ if not mounted, return
  ├─ unmount()
  ├─ abort lifecycle AbortController
  ├─ disconnect observers/timers not tied to signal
  └─ mark unmounted=false
```

`unmount()` executes before or after signal abort only if the order is documented and consistently tested. Prefer giving `unmount()` access to live state, then aborting remaining listeners.

## Reconnection

The same element instance may be reconnected:

```js
const el = document.querySelector('vui-tabs');
el.remove();
container.append(el);
```

Expected:

- component works after reconnect;
- listeners are not duplicated;
- state intentionally stored on the instance remains unless the component documents a reset;
- resources from previous mount are not leaked.

## Property upgrade problem

This case must be tested:

```html
<vui-customer-card id="card"></vui-customer-card>
```

```js
const card = document.querySelector('#card');
card.customer = customer;

// custom element module loads later
await import('./CustomerCard.js');
```

A pre-definition assignment can create an own property that shadows a class accessor. Components with public properties must use the base `upgradeProperty()` pattern before reading those properties.

Recommended convention:

```js
static properties = ['customer', 'options'];
```

The base class may iterate this static declaration during initial mount. If implemented, the mechanism must remain simple and documented.

## Attribute lifecycle

Components reacting to attributes declare:

```js
static get observedAttributes() {
    return ['disabled', 'value', 'page-size'];
}
```

`attributeChangedCallback(name, oldValue, newValue)` must:

- return when values are equal;
- avoid expensive full rerenders by default;
- update only affected UI/state;
- work before/after connection as appropriate.

Do not mirror every property to an attribute automatically. Reflection is a per-property decision.

## Event binding

Prefer lifecycle signal binding:

```js
this.addEventListener('click', this.handleClick, {
    signal: this.signal,
});

document.addEventListener('keydown', this.handleKeyDown, {
    signal: this.signal,
});
```

This drastically reduces manual `removeEventListener` bookkeeping.

## Observers

For `ResizeObserver`, `IntersectionObserver`, or `MutationObserver`, explicit disconnect is required unless a wrapper ties it to the lifecycle signal.

Example:

```js
this.resizeObserver = new ResizeObserver(entries => {
    this.onResize(entries);
});
this.resizeObserver.observe(this);
```

Then:

```js
unmount() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
}
```

## Timers

Store timer IDs and clear them during unmount. Do not leave recurring background behavior after an element is removed.

## Lifecycle invariant

After disconnection, the component must have no active listeners, observers, subscriptions, timers or in-flight requests that are owned solely by that mount cycle.


---

<!-- SOURCE: docs/05-configuration-state.md -->

# 05 — Configuration, Properties and State

## Configuration policy

Use attributes for values that make sense in declarative HTML. Use properties for rich objects/functions/collections.

### Attributes

Suitable:

- strings;
- booleans;
- numbers;
- enums;
- IDs/URLs;
- simple behavior flags.

Example:

```html
<vui-customer-selector
    endpoint="/customers/search"
    min-query="2"
    limit="20"
    disabled
></vui-customer-selector>
```

### Properties

Suitable:

- objects;
- arrays;
- functions/callback adapters;
- service instances;
- structured configuration.

Example:

```js
selector.columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
];
```

## Attribute parsing

Each component owns explicit parsers/getters:

```js
get limit() {
    const raw = this.getAttribute('limit');
    return raw === null ? 20 : Number(raw);
}

get disabled() {
    return this.hasAttribute('disabled');
}
```

Invalid input must follow documented behavior:

- use a default when safe;
- throw during development for programmer mistakes when appropriate;
- never silently coerce dangerous/ambiguous values.

## Boolean attributes

Follow HTML semantics:

```html
<vui-widget disabled></vui-widget>
```

Presence means true. Values such as `disabled="false"` still mean true and should be documented to avoid confusion.

## Property setters

Public property setters should:

1. normalize/validate input;
2. store it;
3. update relevant DOM if mounted;
4. emit an event only if the property change represents a public user/application change and the contract says so.

Do not emit user-change events merely because initial data was assigned unless explicitly documented.

## Local component state

State is ordinary JavaScript data:

```js
this.state = {
    open: false,
    loading: false,
    selectedId: null,
};
```

There is no reactive proxy.

Mutation occurs through explicit methods:

```js
setLoading(value) {
    this.state.loading = Boolean(value);
    this.updateLoading();
}
```

## No universal `setState`

The core must not implement React-style automatic `setState()` followed by full rerender. A tiny component may choose to rerender itself after a change, but this is a local implementation decision, not the architecture.

## Derived state

Prefer derived getters over duplicated state:

```js
get hasSelection() {
    return this.state.selectedId !== null;
}
```

Avoid storing values that can always be computed from canonical state.

## Controlled vs uncontrolled input

Components wrapping form controls must document whether they are:

- controlled by a public `value` property;
- internally controlled and report changes;
- form-associated custom elements.

Do not create ambiguous two-way synchronization.

## Defaults

Defaults should be defined near the component, not scattered through callers.

Example:

```js
static defaults = Object.freeze({
    minQuery: 2,
    limit: 20,
});
```

A generic deep-merge configuration engine is not required. Prefer explicit configuration fields.

## Immutability

The core does not enforce immutability. Components receiving rich objects should document whether they retain the reference or clone. Default recommendation: treat externally supplied objects as read-only input and do not mutate them unexpectedly.


---

<!-- SOURCE: docs/06-rendering-dom.md -->

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


---

<!-- SOURCE: docs/07-events-actions.md -->

# 07 — Events, Subscribers and Declarative Actions

## Two event scopes

Vayes UI Core distinguishes:

1. **DOM component events** — the default.
2. **Application/global events** — only when DOM hierarchy is irrelevant.

## Component events

A component emits a fact:

```js
this.emit('customer:selected', {
    id: customer.id,
    customer,
});
```

A parent or document-level subscriber listens:

```js
container.addEventListener('customer:selected', event => {
    invoice.setCustomer(event.detail.customer);
});
```

### Event naming

Recommended grammar:

```text
entity-or-component:past-tense-change
```

Examples:

```text
customer:selected
customer:cleared
quantity:changed
modal:opened
modal:closed
form:submitted
upload:completed
```

Avoid vague names such as `change`, `update`, or `done` for public custom events unless the component follows a native control convention where `change` is intentionally appropriate.

### Detail payloads

Payloads are stable contracts. Prefer small, explicit structures:

```js
{
    id,
    value,
    source,
}
```

Do not expose large internal state objects by default.

### Cancellation

For actions consumers may prevent, emit a cancelable pre-event:

```text
modal:before-close (cancelable)
modal:closed
```

If `dispatchEvent()` returns false, cancel the action.

Do not make every notification cancelable.

## Application EventBus

Use when publisher and subscriber intentionally have no DOM relationship, for example:

- session changed;
- global locale changed;
- application-wide notification received;
- connectivity state changed.

Do **not** use it merely to avoid passing through DOM events.

## Subscription cleanup

Prefer signals:

```js
events.on('session:changed', this.handleSession, {
    signal: this.signal,
});
```

Outside components, `on()` returns unsubscribe:

```js
const off = events.on('session:changed', fn);
off();
```

## Internal `data-action` delegation

Components may declare internal action targets:

```html
<button type="button" data-action="save">Save</button>
<button type="button" data-action="cancel">Cancel</button>
```

The component maps action identifiers to its own methods through explicit code. The attribute is data, not executable code.

Recommended implementation style:

```js
handleAction(action, element, event) {
    switch (action) {
        case 'save':
            this.save();
            break;
        case 'cancel':
            this.cancel();
            break;
    }
}
```

A static action map is acceptable if it remains inspectable:

```js
static actions = Object.freeze({
    save: 'save',
    cancel: 'cancel',
});
```

Do not implement arbitrary method invocation from HTML without an allowlist.

## Optional declarative external action registry

If the product genuinely needs subscribers configurable from server markup, an optional `ActionRegistry` can support identifiers such as:

```html
<vui-customer-selector
    data-on-selected="invoice.customerSelected"
></vui-customer-selector>
```

The value resolves only against a pre-registered map:

```js
actions.register('invoice.customerSelected', context => {
    // explicit application handler
});
```

Required security rules:

- never resolve arbitrary dotted names from `window`;
- never evaluate source text;
- missing handlers must produce a diagnosable development warning/error;
- registered handlers receive a documented context object, not hidden globals;
- the feature remains optional and can be excluded from builds.

Native `addEventListener()` remains the preferred default because it is standard, debuggable and naturally supports bubbling.

## Event instrumentation

Development builds may provide opt-in diagnostics that log emitted custom events. This must not alter semantics or become a required runtime dependency.


---

<!-- SOURCE: docs/08-http-ajax.md -->

# 08 — HTTP and AJAX

## Goals

Centralize transport behavior without turning the HTTP client into a data framework.

## HttpClient responsibilities

- create `fetch` requests;
- add standard headers;
- handle CSRF adapter integration;
- support request cancellation/timeouts;
- normalize non-2xx responses as `HttpError`;
- expose response parsing helpers;
- optionally surface request IDs for logging;
- remain independent from UI components.

## Default request behavior

Recommended defaults:

```js
{
    method: 'GET',
    credentials: 'same-origin',
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
    },
}
```

Do not add `Content-Type: application/json` to requests without a JSON body; this can change CORS behavior and is semantically wrong.

## Body handling

### JSON

```js
await http.post('/customers', customer, {
    json: true,
});
```

The client may serialize JSON only when explicitly requested or when a dedicated JSON method is used.

### FormData

Pass `FormData` directly and allow the browser to create the multipart boundary. Never manually set `multipart/form-data` content type.

### URLSearchParams

Supported as a native body type.

## Response helpers

### JSON

```js
const data = await http.json('/api/customers');
```

### HTML

```js
const html = await http.html('/customers/fragment');
```

`html()` returns text. DOM insertion remains an explicit caller decision unless a separate helper is created.

### Raw response

`request()` returns the raw successful `Response` for cases needing headers/streams/status details.

## HTTP error semantics

- 4xx/5xx should throw `HttpError`.
- Validation errors remain normal HTTP errors with machine-readable server content.
- Network failures remain native/normalized network errors distinguishable from `HttpError`.
- Abort should remain distinguishable from failure so canceled searches do not show false errors.

## Request cancellation

Search/autocomplete components should abort stale requests:

```js
this.searchController?.abort();
this.searchController = new AbortController();

const results = await http.json(url, {
    signal: this.searchController.signal,
});
```

On component disconnect, the lifecycle signal should also cancel owned requests where practical.

## Timeout

If the core provides timeouts, implement via `AbortController`/`AbortSignal.timeout()` where supported by the chosen browser baseline, with a simple fallback only if necessary.

The client must distinguish a configured timeout from a user/component cancellation when that distinction matters to presentation.

## CSRF adapter contract

Do not hard-code one CodeIgniter CSRF configuration. The application supplies a strategy.

Possible interface:

```js
class CsrfProvider {
    getRequestHeaders(request) { return {}; }
    getRequestBodyFields(request) { return {}; }
    updateFromResponse(response) {}
}
```

A simpler function-based contract is preferred if sufficient.

Recommended first-party CI4 strategy:

- server renders current token metadata in `<meta>` tags or another explicit boot configuration;
- HttpClient adds the configured token/header for unsafe same-origin requests;
- if token regeneration is enabled, update token from an agreed response header or returned boot metadata;
- integration tests verify consecutive unsafe requests.

Exact CI4 names/behavior should be implemented against the project's configured CSRF mode rather than guessed by the generic core.

## Request IDs

If the backend provides a request/correlation ID header, `HttpError` and optional diagnostics should retain it. This creates a trace from browser failure to server logs.

## Retries

Core policy:

- no automatic retry for POST/PUT/PATCH/DELETE;
- optional explicit retry helper for idempotent GET only if a real use case emerges;
- respect abort signals;
- never create hidden exponential retry loops.

## HTML fragment insertion

Use a separate explicit utility, for example:

```js
const html = await http.html('/customers/table');
replaceFragment(container, html);
```

This preserves separation between transport and DOM mutation.

## Loading state

Components own loading presentation:

```js
this.setLoading(true);
try {
    ...
} finally {
    this.setLoading(false);
}
```

The HttpClient must not toggle spinners or global overlays by itself.


---

<!-- SOURCE: docs/09-ci4-integration.md -->

# 09 — CodeIgniter 4 Integration

## Principle

CodeIgniter remains the application host and authority. The frontend core is an interaction layer, not a second application server.

## Recommended server responsibilities

CI4 owns:

- routing;
- authentication/session;
- authorization;
- business/domain rules;
- validation;
- persistence;
- localization source data;
- server-rendered pages/fragments;
- canonical error semantics;
- CSRF configuration;
- audit/activity logs.

## Request detection

HttpClient sends:

```http
X-Requested-With: XMLHttpRequest
```

This allows CI4 AJAX-aware request handling where desired.

Do not make endpoint correctness depend solely on this header. It is a rendering/content-negotiation hint, not authorization.

## Endpoint patterns

### Page route

```text
GET /customers
```

Returns full layout + server content.

### Fragment route

```text
GET /customers/table?...filters
```

Returns a trusted HTML fragment intended for insertion into a known application region.

### JSON route

```text
GET /api/customers/search?q=...
```

Returns structured JSON for a client-rendered component.

A project may combine page and fragment behavior behind one route using explicit negotiation, but avoid opaque controller branches that become hard to test.

## Controller discipline

Controllers should remain thin:

```text
request -> validate -> authorize -> service -> response/view
```

Frontend components must not cause business logic to migrate into controllers or JavaScript.

## Server-rendered component markup

Plain view usage is preferred:

```php
<vui-customer-card
    customer-id="<?= esc($customer->uuid, 'attr') ?>"
>
    <h3><?= esc($customer->name) ?></h3>
</vui-customer-card>
```

An optional helper for attribute serialization may be introduced only if it demonstrably prevents repetitive escaping/boolean handling. It must remain transparent and testable.

## Boot configuration

Application-level configuration needed by JavaScript should be rendered once, explicitly.

Recommended pattern:

```html
<meta name="app-base-url" content="...">
<meta name="csrf-header" content="...">
<meta name="csrf-token" content="...">
<meta name="locale" content="en">
```

or a non-executable JSON block:

```html
<script type="application/json" id="app-config">{...}</script>
```

If JSON is used, it must be encoded safely for HTML context.

Do not create dozens of implicit global JS variables.

## Localization

Server-rendered text uses CI4 localization normally.

Client-owned components requiring translated strings should receive a small explicit dictionary or translation service containing only necessary keys.

Avoid shipping the entire application language catalogue to every page.

Example property:

```js
modal.labels = {
    close: 'Close',
    cancel: 'Cancel',
};
```

or boot-time scoped catalog.

## Validation

Client validation is UX assistance. Server validation is authoritative.

Server validation response should identify fields predictably, for example:

```json
{
    "message": "Validation failed",
    "errors": {
        "email": ["The email field is required."]
    }
}
```

The exact JSON schema should be standardized per application/API layer and tested end-to-end.

For server-rendered fragments, server may return the form with errors instead.

## Authentication

For same-origin CI4 applications, prefer normal secure session cookies rather than adding token authentication just because JavaScript uses `fetch`.

Do not expose session secrets to JavaScript.

## CSRF

The integration adapter must match the actual CI4 security configuration. Test:

- initial unsafe request;
- second unsafe request after token regeneration if enabled;
- expired/invalid token path;
- form and JSON request variants if both are supported.

## Activity logging

Meaningful domain actions should be logged server-side with authenticated actor, target entity, result and request/correlation ID where available. Frontend event logs are diagnostics, not authoritative audit logs.

## Error rendering

Map HTTP errors at the application/component layer:

- validation → field errors;
- unauthorized → login/session handling;
- forbidden → permission message;
- not found → contextual empty/error state;
- conflict → explicit stale/conflict UI;
- server error → generic UI + request ID for support.

The HTTP client itself must not decide the message language or UI component.

## Test application

The spec implementation should include a minimal CI4 integration/demo application or test routes demonstrating:

1. server-rendered enhancement component;
2. JSON-driven component;
3. AJAX HTML fragment containing Custom Elements;
4. CSRF-protected POST;
5. validation error display;
6. component event observed by another component;
7. disconnect/reconnect behavior.


---

<!-- SOURCE: docs/10-security.md -->

# 10 — Security Specification

## Threat model

Primary frontend risks include:

- XSS from interpolated server/user data;
- unsafe dynamic handler execution;
- CSRF failures;
- accidental credential/token exposure;
- HTML fragment trust confusion;
- URL injection;
- unsafe file handling;
- authorization assumptions in JavaScript.

## XSS rules

### Untrusted text

Use:

```js
node.textContent = value;
input.value = value;
node.setAttribute('title', value);
```

Do not use:

```js
node.innerHTML = `<span>${untrusted}</span>`;
```

### Trusted static component templates

Static template strings are allowed when values are not interpolated from untrusted sources.

### Trusted server fragments

HTML fragments returned from first-party CI4 endpoints may be treated as server-rendered application HTML only when the endpoint applies normal output escaping and the caller expects HTML.

The fragment insertion layer must not execute embedded scripts.

### Sanitization

Do not create a home-grown HTML sanitizer. If rich untrusted HTML becomes a requirement, introduce a dedicated, audited sanitizer through an ADR.

## No executable strings

Forbidden:

- `eval`;
- `new Function`;
- `setTimeout(string)`;
- `setInterval(string)`;
- resolving arbitrary handler paths from `window`;
- injecting event handler attributes from data.

Optional declarative actions resolve only pre-registered identifiers.

## CSP compatibility

The architecture should be compatible with a strict Content Security Policy:

- external/module scripts;
- no required inline executable scripts;
- no eval;
- no required inline `onclick` handlers.

Boot data may use non-executable JSON script blocks or meta tags.

## CSRF

Unsafe same-origin requests must apply the configured CI4 CSRF contract. Frontend disabling or bypassing CSRF for convenience is forbidden.

## Authorization

A hidden/disabled frontend control is not authorization. Every protected operation is re-authorized server-side.

## URLs

Dynamic URLs must be created with `URL`/`URLSearchParams` where appropriate rather than manual string concatenation.

Do not allow untrusted values to select arbitrary schemes for navigation/resource loading without validation.

## File uploads

Client checks for extension/size/type are UX only. Server performs authoritative validation, storage policy and malware/security controls.

Use `FormData`; do not base64-encode ordinary uploads without a concrete protocol requirement.

## Secrets

Never place in frontend configuration:

- database credentials;
- private API keys;
- signing secrets;
- privileged service tokens.

Any credential available to browser JavaScript must be assumed visible to the user.

## Error exposure

Production UI must not dump stack traces, SQL, internal filesystem paths or sensitive exception messages.

Where available, expose a correlation/request ID that support can use to find server-side details.

## Dependency security

The production runtime targets zero third-party JS dependencies. Development tooling should be pinned with lockfiles and updated deliberately.

## Security acceptance tests

At minimum:

- dynamic user text renders as text, not HTML;
- malicious strings cannot invoke ActionRegistry functions unless exact registered key matches;
- AJAX fragments do not execute returned `<script>` content;
- CSRF-protected calls fail without valid token and succeed with adapter;
- forbidden server action remains forbidden even if UI is manipulated;
- URLs reject/normalize invalid schemes where relevant.


---

<!-- SOURCE: docs/11-testing.md -->

# 11 — Testing Strategy

## Testing philosophy

The runtime is small enough that tests should be exhaustive around lifecycle, event and transport semantics. Do not compensate for weak architecture with huge snapshot suites.

## Test layers

### 1. Pure unit tests

Suitable for:

- parsers;
- small helpers;
- EventBus semantics that do not require DOM;
- HttpError construction;
- URL/query building;
- ActionRegistry;
- CSRF provider policy.

A lightweight Node test environment is acceptable.

### 2. Real-browser component tests

Required for:

- Custom Element upgrade;
- `connectedCallback` / `disconnectedCallback`;
- reconnect;
- event bubbling/composed behavior;
- property upgrade before definition;
- focus/keyboard behavior;
- dynamic insertion;
- native form behavior;
- Shadow DOM components if any.

Use a real browser automation tool such as Playwright. Do not rely exclusively on jsdom-like environments for browser lifecycle correctness.

### 3. CI4 integration tests

Required for:

- HTML fragment endpoints;
- JSON endpoints;
- CSRF sequence;
- validation errors;
- authentication/session behavior;
- request IDs;
- localized responses;
- actual browser + CI4 interactions for reference flows.

Where database state is required, use a dedicated test database. For the sample/reference CI4 application, SQLite is preferred for deterministic isolation unless a DB-specific feature is under test.

### 4. Static quality checks

Recommended:

- ESLint;
- formatting check;
- JSDoc/type checking if configured;
- dependency/license audit for dev tools;
- PHP CodeSniffer/PHPStan/PHPUnit for CI4 adapter/demo as appropriate to the host project.

## Required Component test matrix

Every reusable component must consider this matrix:

| Scenario | Required? |
|---|---|
| Definition before element exists | Yes |
| Element exists before definition | Yes |
| Connect | Yes |
| Disconnect | Yes |
| Reconnect | Yes |
| No duplicate listener after reconnect | Yes |
| Attribute default | Yes |
| Attribute change while mounted | If observed |
| Rich property assignment | If exposed |
| Property set before upgrade | If exposed |
| User event produces expected DOM update | Yes |
| Public event name/detail | If emitted |
| Event bubbles | If contract says so |
| Keyboard support | Interactive components |
| Disabled state | If supported |
| Loading state | Async components |
| Request abort/stale response | Search/async components |
| Error state | Async components |
| Dynamic insertion via fragment | Yes for representative components |
| XSS-sensitive text | Components render dynamic text |

## Lifecycle leak test

A browser test should instrument a component or use counters:

1. append component;
2. trigger one event, observe one handler execution;
3. remove component;
4. reappend component;
5. trigger one event;
6. still observe exactly one handler execution.

For global listeners/observers, verify removal/abort after disconnect.

## Property upgrade test

1. create unknown element by tag;
2. assign public property;
3. append element;
4. define/import custom element;
5. assert accessor receives value and UI reflects it.

## AJAX insertion test

1. fetch or simulate server HTML fragment;
2. insert fragment into DOM;
3. assert contained Custom Elements become upgraded;
4. interact without any explicit `init()` scan.

## HTTP tests

Cover:

- success response;
- JSON parsing;
- HTML/text parsing;
- 400 validation body;
- 401/403/404/409/422/500 as project uses them;
- network failure;
- abort;
- timeout;
- `X-Requested-With` header;
- content type behavior;
- CSRF adapter;
- request ID capture.

## Accessibility tests

Automated accessibility tooling is useful but not sufficient. Add explicit keyboard/focus tests for interactive components.

## Snapshot policy

Avoid broad HTML snapshots that make harmless markup changes painful. Prefer behavioral assertions and focused DOM assertions.

## Coverage

Do not optimize for an arbitrary percentage. All public core branches and contracts should be covered. Untested public behavior is considered unfinished.


---

<!-- SOURCE: docs/12-accessibility.md -->

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


---

<!-- SOURCE: docs/13-performance.md -->

# 13 — Performance

## Performance model

The architecture avoids a framework runtime and virtual DOM, but poor component code can still be slow. Performance comes from explicit DOM ownership and restrained work.

## Rules

### Avoid full rerenders for local changes

Update the smallest necessary node/state.

### Cache stable element references when useful

After initial rendering:

```js
this.elements = {
    loader: this.find('[data-loader]'),
    value: this.find('[data-value]'),
};
```

Do not cache nodes across markup replacement unless caches are rebuilt.

### Use event delegation

For repeated/dynamic child actions, one root listener is often cheaper and safer than rebinding many children.

### Abort stale requests

Autocomplete/filter components must cancel superseded requests where possible and ignore stale responses otherwise.

### Debounce only where justified

Typing search may use a simple explicit debounce. Do not create a generic scheduler/reactivity system.

### Avoid layout thrashing

Batch reads/writes where a component performs measurements. Do not repeatedly interleave layout reads and style writes in loops.

### Lazy loading

Large/rare component modules may be dynamically imported by application code. The core does not require a MutationObserver-based lazy loader.

A declarative lazy registry can be considered later only after measurements justify it.

### Bundle size

The core runtime target is intentionally small. CI should track production bundle size and flag material unexplained growth.

Suggested target for the first stable core: remain comfortably within tens of kilobytes uncompressed; smaller is preferred. Do not distort code solely to chase a vanity number.

## Performance tests

Reference benchmarks may include:

- creation/connection of 100/1,000 simple components;
- reconnect without listener growth;
- large list event delegation;
- repeated local state updates;
- AJAX fragment insertion with multiple components.

Benchmarks are regression indicators, not universal browser guarantees.


---

<!-- SOURCE: docs/14-build-packaging.md -->

# 14 — Build, Packaging and Code Quality

## Source language

Use modern standards-based **JavaScript ES modules**. TypeScript is not required. Use JSDoc for public contracts where it improves tooling.

The shipped source should remain understandable as JavaScript without a compiler transformation.

## Runtime dependencies

Target: **zero**.

Development dependencies are allowed for tests, browser automation, linting, formatting, bundling/minification and documentation.

## Build tool

Vite or an equivalent simple bundler may be used for development and production asset generation, but components must not depend on bundler-specific runtime behavior. Direct ESM development should remain possible where practical.

Recommended output:

```text
public/build/
├── app-[hash].js
├── app-[hash].css
└── manifest.json
```

For a reusable internal package, optional `dist/` ESM exports may be produced.

## Code quality

Adopt one consistent JS style. Prefer descriptive names and obvious control flow over clever compact code.

Architecturally important lint rules should prohibit:

- `eval` and implied eval;
- undeclared globals;
- unused variables/imports;
- unreachable code;
- accidental assignment in conditions;
- unsafe promise handling where tooling can detect it.

## Package policy

If published internally through npm:

- use semantic versioning;
- use ES module package mode;
- expose only intentional public entry points;
- keep development lockfiles;
- document the supported browser policy.

## Browser policy

Target evergreen browsers supported by the consuming product. Do not transpile to obsolete environments by default. Add a narrowly scoped polyfill only when a supported browser demonstrably requires it.

## Source maps

Generate production source maps according to deployment/privacy policy. If maps are not public, preserve private maps where operationally useful.


---

<!-- SOURCE: docs/15-reference-components.md -->

# 15 — Reference Components

The first implementation should include a small set of reference components chosen to prove the architecture, not to create a full design system.

## R1. `<vui-counter>` — lifecycle/event smoke test

Proves local state, incremental DOM updates, `data-action` delegation, emitted events and reconnect safety.

## R2. `<vui-tabs>` — server-rendered enhancement

Requirements:

- consumes server-provided tab/panel markup;
- does not rebuild the initial DOM unnecessarily;
- keyboard support;
- selected tab through documented attribute/property;
- emits `tab:changed`;
- works when inserted dynamically.

## R3. `<vui-modal>` — client-owned UI and global interactions

Requirements:

- explicit `open()`/`close()`;
- cancelable `modal:before-close`;
- `modal:opened` / `modal:closed`;
- Escape and focus behavior;
- focus returns to invoker when appropriate;
- lifecycle-clean document listeners;
- evaluate native `<dialog>` before recreating dialog semantics.

## R4. `<vui-customer-selector>` — async component

Requirements:

- query input;
- configurable endpoint and minimum query length;
- aborts stale requests;
- loading/empty/error states;
- uses `CustomerService` → `HttpClient` rather than ad-hoc fetch;
- renders untrusted names with safe DOM APIs;
- emits `customer:selected` with documented detail;
- accepts initial selected customer through property;
- property-before-upgrade test.

## R5. AJAX fragment example

A CI4 route returns a fragment containing multiple registered custom elements. The client inserts it without any manual initialization scan. This proves the central dynamic-DOM requirement.

## Do not start with a DataTable

A feature-rich table can hide core flaws behind sorting, filtering, virtualization, selection and accessibility complexity. Build it only after lifecycle/event/http patterns are stable.


---

<!-- SOURCE: docs/16-implementation-plan.md -->

# 16 — Implementation Plan

Implement one phase at a time. Do not proceed while a phase exit gate fails.

## Phase 0 — Repository and quality gates

**Goal:** deterministic implementation environment before runtime features.

Tasks:

- establish `resources/js`, tests, examples and docs;
- configure ES modules;
- add formatter/linter;
- add unit runner and real-browser runner;
- add optional Vite build;
- add CI commands;
- add dependency-policy check asserting no production runtime dependencies;
- define browser support policy;
- expose scripts such as `lint`, `test:unit`, `test:browser`, `test`, `build`.

Exit gate: smoke tests/lint/build pass and runtime dependency list is empty.

## Phase 1 — Component lifecycle core

Implement:

- `Component extends HTMLElement`;
- mount state;
- lifecycle `AbortController`;
- connect/disconnect callbacks;
- `mount`, `unmount`, `render`, `bindEvents` extension points;
- `find`, `findAll`, `upgradeProperty`;
- idempotent `define()` helper.

Required tests:

- connect/disconnect/reconnect;
- lifecycle signal abort;
- no duplicate listeners;
- element exists before definition;
- property set before definition;
- idempotent registration.

Exit gate: all lifecycle invariants pass in a real browser.

## Phase 2 — Component events and EventBus

Implement `Component.emit()`, `EventBus`, unsubscribe-returning `on()`, signal-aware subscriptions and optional `once()`.

Test detail payloads, bubbling, cancellation, unsubscribe and reconnect behavior.

Exit gate: a child can publish a change consumed by an ancestor without knowing the consumer; a genuine non-DOM global event works through EventBus.

## Phase 3 — Explicit action delegation

Standardize internal `data-action` delegation. Add a helper only if repetition justifies it. Handle nested custom-element boundaries explicitly.

Do **not** implement a DSL, arbitrary server callbacks or global automatic wiring.

Exit gate: dynamic descendant replacement works without rebinding and nested component actions do not leak to parents.

## Phase 4 — HTTP transport core

Implement:

- `HttpError`;
- `HttpClient.request()`;
- JSON/text/HTML helpers;
- minimal GET/POST convenience;
- AJAX header and same-origin credentials;
- JSON/FormData/URLSearchParams body policy;
- external abort signal and timeout;
- request-ID capture;
- pluggable CSRF provider.

Test success, HTTP errors, network/abort, body modes, headers, CSRF injection and parsing.

Exit gate: normal reference components do not use ad-hoc raw `fetch`.

## Phase 5 — CI4 integration foundation

Implement/demo:

- boot config reader;
- CI4 CSRF provider;
- page route;
- fragment route;
- JSON route;
- protected POST;
- validation response;
- request/correlation ID propagation where available;
- SQLite-backed test/demo persistence where required.

Browser + CI4 tests must verify initial and consecutive unsafe requests, validation and authorization behavior.

Exit gate: transport contract is proven against a real CI4 host.

## Phase 6 — Rendering/fragment utilities

Add only the smallest justified fragment helpers. Returned scripts must not execute. Test automatic upgrade of inserted Custom Elements and compatibility with delegated listeners.

Exit gate: server HTML fragment containing components works with **zero** `initAll()`/DOM scanning.

## Phase 7 — Reference components

Implement in order:

1. `vui-counter`;
2. `vui-tabs`;
3. `vui-modal`;
4. `vui-customer-selector`.

The set must collectively prove server enhancement, client-owned rendering, local state, incremental updates, public events, cancelable events, global lifecycle listeners, async JSON, stale request cancellation, attributes, properties, pre-upgrade properties and dynamic insertion.

## Phase 8 — Optional ActionRegistry

Implement **only if a concrete application requirement exists** for server-declared action identifiers.

If implemented: exact-key registry only; no `window` lookup; no code execution; explicit context; feature must remain removable without affecting native event consumers.

## Phase 9 — Hardening

Perform security, CSP, XSS, CSRF, accessibility, focus, lifecycle leak, performance and bundle-size review/tests.

Exit gate: no high-severity security/a11y defect, no reconnect/resource leak under stress, core remains deliberately small.

## Phase 10 — Stable packaging

Stabilize exports, API docs, examples, SemVer policy and release packaging. Tag stable only after `docs/17-acceptance-criteria.md` passes completely.


---

<!-- SOURCE: docs/17-acceptance-criteria.md -->

# 17 — Stable Release Acceptance Criteria

## Architecture

- [ ] Zero runtime frontend framework dependencies.
- [ ] Custom Elements are the reusable markup component primitive.
- [ ] No virtual DOM, reactive graph, hooks or compiler syntax.
- [ ] Light DOM is default.
- [ ] CI4 remains authoritative for business rules, authorization and canonical validation.
- [ ] Core runtime is application-agnostic.

## Lifecycle

- [ ] Element present before class definition upgrades correctly.
- [ ] Element inserted after definition works.
- [ ] Disconnect/reconnect works.
- [ ] Reconnect does not duplicate listeners/subscriptions.
- [ ] Lifecycle-owned resources are cleaned.
- [ ] Public rich properties work when assigned before custom-element definition.

## Configuration/rendering

- [ ] Public attributes/properties/defaults are documented.
- [ ] HTML boolean semantics are respected.
- [ ] Rich data uses properties instead of giant serialized attributes.
- [ ] Server enhancement, client-owned, JS-created and AJAX-inserted components are demonstrated.
- [ ] Local updates are incremental by default.
- [ ] AJAX fragment insertion does not execute scripts.

## Events

- [ ] Component changes use native CustomEvents.
- [ ] Public event names/detail shapes are documented/tested.
- [ ] Bubbling behavior is tested.
- [ ] At least one cancelable pre-event is demonstrated.
- [ ] EventTarget-based global bus is demonstrated for a genuine non-DOM event.
- [ ] Reusable components do not depend on global callback functions.

## HTTP/CI4

- [ ] Shared HttpClient policy exists.
- [ ] AJAX header reaches CI4.
- [ ] JSON and HTML/text are explicit response modes.
- [ ] HTTP errors, network failures and aborts are distinguishable.
- [ ] Request cancellation works.
- [ ] CI4 CSRF contract works, including token rotation policy if configured.
- [ ] Request ID is retained when supplied.
- [ ] Transport layer does not display UI.
- [ ] Live CI4 tests cover JSON, HTML fragment and protected write flows.

## Security

- [ ] XSS-focused dynamic text tests pass.
- [ ] No `eval`/`new Function` path exists.
- [ ] Client UI is never treated as authorization.
- [ ] No secrets are exposed in boot configuration.
- [ ] Architecture is compatible with strict CSP.

## Accessibility

- [ ] Tabs and modal keyboard tests pass.
- [ ] Modal focus behavior is documented/tested.
- [ ] Loading/disabled state is accessible.
- [ ] Native semantics are preferred.

## Quality

- [ ] Unit tests pass.
- [ ] Real-browser lifecycle/event tests pass.
- [ ] CI4 integration tests pass.
- [ ] Lint/build pass.
- [ ] Public APIs are documented.
- [ ] Production runtime dependency list is empty.
- [ ] Core can be reviewed end-to-end without navigating a meta-framework.


---

<!-- SOURCE: docs/18-maintenance-versioning.md -->

# 18 — Maintenance, Versioning and Evolution

## Semantic versioning

Treat component tags, public methods, attributes/properties and emitted event contracts as versioned API.

Breaking changes include renaming a component/event, incompatible event-detail changes, removing an attribute, changing event bubbling semantics, changing HttpClient error semantics, or converting an existing light-DOM component to Shadow DOM.

## ADR-required changes

Create a new ADR before:

- adding a runtime dependency;
- introducing compiler-required source semantics;
- adding reactivity/virtual DOM/hooks;
- making Shadow DOM default;
- adding a client router or global state system;
- changing event architecture;
- changing server/client authority boundaries.

## Dependency maintenance

Tooling dependencies may evolve independently of runtime architecture. Pin them with a lockfile and upgrade with tests.

## Core growth review

At each minor release review:

- core line count;
- public exports;
- runtime dependencies;
- abstractions with one consumer;
- deprecated APIs;
- performance/bundle regressions.

If the core grows rapidly, move capabilities to optional modules or components rather than expanding the universal runtime.

The success metric is not feature count. It is maintainable application UI with a small, unsurprising core.


---

<!-- SOURCE: docs/19-observability-errors.md -->

# 19 — Error Handling and Observability

## Principle

Failures must remain traceable from the browser to CodeIgniter logs without turning the frontend core into a logging framework.

## Error ownership

### Transport layer

`HttpClient` detects transport/HTTP failures and exposes structured error information. It does not choose UI copy or display notifications.

### Component/application layer

The caller decides whether an error becomes:

- inline field feedback;
- component error state;
- retry affordance;
- application notification;
- authentication/session redirect/flow;
- silent cancellation for superseded requests.

### Server layer

CI4 retains authoritative diagnostics, stack traces in appropriate non-production environments, audit records and request correlation.

## Error taxonomy

Keep these cases distinguishable:

- request intentionally aborted;
- request timeout;
- network failure;
- 4xx HTTP error;
- 5xx HTTP error;
- validation error;
- authorization error;
- conflict/stale-write error;
- component programmer error.

Do not collapse all failures into `Something went wrong` internally, even if the user-facing message is generic.

## Correlation IDs

Where the host application supports a request ID/correlation ID:

1. CI4 generates or accepts it at the request boundary;
2. response includes it in an agreed header;
3. `HttpClient` retains it in `HttpError`;
4. application error UI may show a support/reference ID;
5. server logs include the same ID.

This is the preferred bridge between client symptoms and server diagnostics.

## Frontend diagnostics

Development builds may expose an opt-in diagnostics module that can log:

- component connected/disconnected;
- component public events;
- HTTP request start/end/failure metadata;
- unknown declarative action IDs;
- invalid component configuration.

Diagnostics must:

- be disabled or low-noise in production by default;
- never log secrets/CSRF tokens/passwords;
- never alter control flow;
- remain optional and removable.

## Programmer errors

Invalid required configuration should fail clearly during development rather than silently producing undefined behavior.

Example:

```js
if (!this.endpoint) {
    throw new Error('<vui-customer-selector> requires an endpoint attribute.');
}
```

For recoverable user/data conditions, render an explicit state instead of throwing.

## Global error handling

The core must not install invasive global `window.onerror`/`unhandledrejection` handlers automatically. The host application may install an observability adapter explicitly.

## Audit/activity distinction

Frontend diagnostic events are **not audit logs**. Meaningful business actions must be recorded server-side after authorization and successful/failed domain execution according to the application's audit policy.

## Tests

- request ID survives into `HttpError`;
- abort does not trigger generic failure UI in reference async component;
- server 500 can render generic component error while retaining correlation ID;
- development diagnostics redact configured sensitive fields;
- no global handler is installed merely by importing core modules.


---

<!-- SOURCE: docs/20-forms-validation.md -->

# 20 — Forms and Validation

## Default strategy

Prefer ordinary HTML forms and native controls. Custom Elements should enhance form UX, not replace the browser form model without a concrete requirement.

## Server authority

CodeIgniter validation remains canonical. Client rules improve feedback latency only.

The same operation must remain safe/correct if client-side validation is bypassed.

## Native form integration

A component that wraps ordinary form controls should, where practical, keep real `<input>`, `<select>`, `<textarea>` elements in Light DOM so normal form submission, labels, autofill and browser behavior continue to work.

Example:

```html
<vui-money-input>
    <input type="text" name="amount" inputmode="decimal">
</vui-money-input>
```

The custom element enhances formatting/behavior while the native field remains the submitted control.

## Form-associated Custom Elements

`ElementInternals` / `formAssociated` may be used for components that truly need to behave as standalone form controls.

This is **advanced/opt-in**, because it introduces more browser, validation and accessibility obligations.

Before using it, document and test:

- submitted form value;
- reset behavior;
- disabled state;
- constraint validation;
- label association;
- autofill expectations;
- browser support baseline.

## Validation response contract

For JSON-based forms, standardize one application schema, for example:

```json
{
    "message": "Validation failed",
    "errors": {
        "email": ["The email field is required."],
        "name": ["The name must be at least 2 characters."]
    }
}
```

Do not bake one universal schema into the generic component core; adapt it in the host application/form service.

## Field error rendering

A form component should expose explicit methods such as:

```js
setErrors(errors)
clearErrors()
```

The implementation must associate messages with fields accessibly and must not interpolate untrusted messages through unsafe HTML.

## Submission state

Explicit state methods:

```js
setSubmitting(true)
setSubmitting(false)
```

Expected behavior may include:

- prevent accidental duplicate submission;
- set `aria-busy` where meaningful;
- disable only controls that should be disabled;
- restore state in `finally`.

Do not globally block the page for every request.

## Dirty state

Do not implement a universal reactive dirty-tracking system in core. A form that needs dirty detection should compare explicit initial/current values or use native events in an application-level helper.

## File inputs

Do not clone/recreate file inputs gratuitously. Use `FormData` and server-side validation.

## Tests

For form-related components, test as applicable:

- normal native submission semantics;
- JSON submission flow;
- duplicate-submit prevention;
- server validation mapping;
- focus/announcement of errors;
- reset;
- disabled state;
- disconnect during in-flight submit;
- CSRF-protected submit;
- malicious error/value strings render safely.


---

<!-- SOURCE: docs/21-styling.md -->

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


---

<!-- SOURCE: docs/22-component-authoring-standard.md -->

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


---

<!-- SOURCE: adrs/ADR-001-custom-elements.md -->

# ADR-001 — Custom Elements as the Component Primitive

**Status:** Accepted

## Decision

Reusable markup-level components use native Custom Elements (`HTMLElement` + `customElements`).

## Why

- native lifecycle;
- automatic upgrade for elements already in or later inserted into the DOM;
- declarative HTML configuration;
- framework independence;
- browser interoperability.

## Consequences

- names require a hyphen;
- reconnect lifecycle semantics must be handled correctly;
- public rich properties require the pre-definition upgrade pattern;
- real-browser tests are required.

## Rejected

- manual `data-component` initialization scanners;
- frontend framework runtimes;
- a home-grown component registry recreating native lifecycle.


---

<!-- SOURCE: adrs/ADR-002-light-dom-default.md -->

# ADR-002 — Light DOM by Default

**Status:** Accepted

## Decision

First-party application components use Light DOM by default. Shadow DOM is opt-in per component.

## Rationale

Light DOM integrates naturally with application CSS, CodeIgniter server rendering, forms, accessibility and DevTools. Shadow DOM is justified for strong isolation/third-party embedding, not as a universal default.


---

<!-- SOURCE: adrs/ADR-003-native-events.md -->

# ADR-003 — Native Events as the Communication Protocol

**Status:** Accepted

## Decision

Components communicate outward using native `CustomEvent`. Non-DOM global application communication uses an `EventTarget`-based EventBus.

## Rejected

- mandatory centralized event brokers for all changes;
- direct reusable-component calls to application globals;
- framework-specific emitter systems.


---

<!-- SOURCE: adrs/ADR-004-no-reactive-runtime.md -->

# ADR-004 — No Reactive Runtime or Virtual DOM

**Status:** Accepted

## Decision

State is plain JavaScript. Components update the DOM through explicit methods. The core provides no signals, proxies, dependency tracking, hooks, virtual DOM or reconciliation.

## Consequence

Component authors may write several more explicit lines, but state → DOM control flow stays local, predictable and debuggable.


---

<!-- SOURCE: adrs/ADR-005-zero-runtime-dependencies.md -->

# ADR-005 — Zero Runtime Dependencies

**Status:** Accepted

## Decision

The stable core has no production/runtime third-party JavaScript dependencies. Testing/lint/build dependencies are allowed.

Any future runtime dependency requires a new ADR explaining necessity, browser-native alternatives, security/maintenance cost, size and exit strategy.


---

<!-- SOURCE: adrs/ADR-006-server-authoritative.md -->

# ADR-006 — CodeIgniter Remains Authoritative

**Status:** Accepted

## Decision

Business rules, authorization, canonical validation and persistence authority remain on the CodeIgniter server.

Client validation is UX only. Hidden/disabled controls are never authorization. Same-origin session cookies remain appropriate for normal CI4 applications.


---

<!-- SOURCE: adrs/ADR-007-no-init-scanner.md -->

# ADR-007 — No Global DOM Initialization Scanner

**Status:** Accepted

## Decision

Do not scan the DOM after page load or AJAX insertion to initialize components. Native Custom Elements lifecycle provides initialization/upgrades.

A non-Custom-Element behavior may use explicit initialization only when truly necessary; it must not become the main architecture.


---

<!-- SOURCE: adrs/ADR-008-jsdoc-esm.md -->

# ADR-008 — JavaScript ES Modules + JSDoc

**Status:** Accepted

## Decision

Core source is modern JavaScript ES modules. JSDoc documents public types/contracts. TypeScript is not required for source semantics.

This preserves browser-language transparency while retaining editor/type assistance where useful.


---

<!-- SOURCE: adrs/ADR-009-html-fragments.md -->

# ADR-009 — Trusted Server HTML Fragments Are First-Class

**Status:** Accepted

## Decision

CI4 may intentionally return escaped server-rendered HTML fragments for insertion into application regions, alongside JSON-driven component flows.

Rules:

- endpoint intentionally returns HTML;
- normal server output escaping applies;
- insertion helper does not execute scripts;
- contained custom elements initialize natively;
- no manual component scan;
- transport and DOM insertion remain separate responsibilities.


---

<!-- SOURCE: adrs/ADR-010-real-browser-tests.md -->

# ADR-010 — Real Browser Tests for Native Semantics

**Status:** Accepted

## Decision

Custom Element lifecycle, upgrade, bubbling, focus and dynamic insertion contracts must be tested in real browsers. Simulated DOM unit tests are supplementary only.


---

<!-- SOURCE: COMPONENT_SPEC_TEMPLATE.md -->

# `<vui-component-name>` — Component Specification

## Purpose

Describe one clear responsibility.

## Rendering mode

- [ ] Server-rendered enhancement
- [ ] Client-owned
- [ ] Hybrid

DOM mode: **Light DOM** unless an ADR/justification below says otherwise.

## Attributes

| Attribute | Type | Default | Observed? | Description |
|---|---|---|---:|---|

## Properties

| Property | Type | Default | Reflected? | Description |
|---|---|---|---:|---|

## Methods

### `methodName(...)`

Parameters:  
Returns:  
Side effects:  
Errors:

## Events

| Event | Bubbles | Cancelable | Detail | When emitted |
|---|---:|---:|---|---|

## Internal state

List canonical state only.

## DOM contract

Server-owned markup:  
Component-owned markup:  
Stable selectors/data hooks:  
Focus-sensitive elements:

## Internal actions

| `data-action` | Handler | Description |
|---|---|---|

## Async/HTTP behavior

Service:  
Cancellation:  
Loading state:  
Error state:  
Stale response policy:

## Accessibility

Semantics:  
Keyboard:  
Focus:  
ARIA:

## Security

Untrusted inputs:  
Safe rendering method:  
Trusted HTML boundary (if any):

## Lifecycle cleanup

- listeners:
- EventBus subscriptions:
- observers:
- timers:
- requests:

## Tests

- [ ] pre/post definition upgrade
- [ ] connect/disconnect/reconnect
- [ ] no duplicate listeners
- [ ] configuration
- [ ] public events
- [ ] keyboard/focus
- [ ] dynamic insertion
- [ ] error/abort behavior
- [ ] XSS-sensitive data

## Non-goals

Explicitly list behavior this component will not own.


---

<!-- SOURCE: IMPLEMENTATION_PROMPT.md -->

# Prompt for an AI Coding Agent

Implement **Vayes UI Core** using the complete specification in this repository.

## Mandatory preparation

Before writing code, read fully:

1. `AGENTS.md`;
2. all `docs/*.md`;
3. all accepted `adrs/*.md`;
4. `examples/` only as non-authoritative illustrations.

The specification/ADRs override examples.

## Execution model

Implement **one phase at a time** from `docs/16-implementation-plan.md`.

For each phase:

1. summarize requirements;
2. list expected file changes;
3. write/update tests for public behavior;
4. implement the smallest compliant solution;
5. run relevant tests, lint and build;
6. fix implementation failures rather than weakening valid tests;
7. compare against the phase exit gate and `docs/17-acceptance-criteria.md`;
8. update public docs;
9. stop after the phase unless explicitly told to continue.

## Critical prohibitions

Do not introduce React/Vue/Svelte/Alpine/HTMX/Stimulus, virtual DOM, JSX, reactive proxies/signals, hooks, frontend DI, global state stores, client routers, two-way binding, proprietary templates, `eval`, `new Function`, arbitrary `window` handler resolution, global DOM init scans, or runtime npm dependencies without an accepted ADR.

If you believe an architectural prohibition must be broken, **do not implement it**. Produce a proposed ADR with alternatives, trade-offs and compatibility impact.

## Quality bar

- correct connect/disconnect/reconnect lifecycle;
- property-before-definition upgrade support;
- AJAX fragment Custom Elements initialize natively;
- DOM CustomEvents are default communication;
- Light DOM by default;
- explicit incremental local updates;
- HttpClient has no UI responsibility;
- CodeIgniter remains authoritative;
- real-browser tests verify browser semantics;
- security-sensitive data uses safe DOM rendering;
- public APIs/events are documented and tested.

Start with **Phase 0 only** unless instructed otherwise.
