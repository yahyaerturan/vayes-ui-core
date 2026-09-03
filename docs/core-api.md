# Core API reference

Everything in this document is public API and covered by semantic versioning
(docs/18-maintenance-versioning.md in the specification). Anything not listed
here is internal and may change in a patch release.

The core has **zero runtime dependencies** and is plain ES modules. Importing
any core module has no side effects: nothing is registered, no listener is
installed and no DOM is touched.

```js
import { Component, EventBus, HttpClient, define } from '@vayes/ui-core';
```

---

## `Component extends HTMLElement`

Base class for every component. Provides lifecycle correctness, scoped
cancellation, event emission and small query helpers — and nothing else. There
is no reactivity, no virtual DOM and no automatic re-render (ADR-004).

### Static members

| Member       | Type                | Purpose                                                        |
| ------------ | ------------------- | -------------------------------------------------------------- |
| `properties` | `readonly string[]` | Public accessor names rescued by `upgradeProperty()` on mount. |

### Instance properties

| Property  | Type                      | Description                                                   |
| --------- | ------------------------- | ------------------------------------------------------------- |
| `mounted` | `boolean` (read-only)     | Whether the component is currently connected **and** mounted. |
| `signal`  | `AbortSignal` (read-only) | Scoped to the current mount cycle. Throws when unmounted.     |

### Lifecycle methods

| Method                   | When                                              | Override to                                        |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------- |
| `connectedCallback()`    | Platform                                          | — (final in practice; idempotent)                  |
| `disconnectedCallback()` | Platform                                          | — (final in practice; idempotent)                  |
| `mount()`                | Every connection                                  | Change the render/bind sequence                    |
| `unmount()`              | Every disconnection, **before** the signal aborts | Dispose observers, timers, requests                |
| `render()`               | From `mount()`                                    | Create component-owned markup (must be idempotent) |
| `bindEvents()`           | From `mount()`                                    | Attach listeners with `{ signal: this.signal }`    |

Guaranteed order, verified in `tests/browser/core-runtime.spec.js`:

```
connect    → mount() → render() → bindEvents()
disconnect → unmount() → signal.abort()
```

`unmount()` runs while the signal is still live, so cleanup code can read state
and interact with listeners that are about to be removed.

### `emit(name, detail?, options?) => boolean`

Dispatches a `CustomEvent`. Returns `false` when a cancelable event was
prevented.

| Option       | Default | Notes                                                               |
| ------------ | ------- | ------------------------------------------------------------------- |
| `bubbles`    | `true`  | Meaningful changes should reach ancestors.                          |
| `composed`   | `true`  | Crosses shadow boundaries, for components that opt into Shadow DOM. |
| `cancelable` | `false` | Reserve for genuine pre-events.                                     |

### `find(selector) => Element | null`

`this.querySelector(selector)`.

### `findAll(selector) => Element[]`

A real array, not a live `NodeList`.

### `upgradeProperty(name) => void`

Rescues a property assigned before the element was upgraded. Assigning
`el.customer = {...}` to a not-yet-defined element creates an own property that
would shadow the class accessor; this deletes it and re-assigns so the setter
runs. Declare such properties in `static properties` and the base class calls
this for you on first mount.

### `bindActions(options?) => void`

Installs delegated `data-action` handling. Call it from `bindEvents()`.

| Option      | Default    | Description                           |
| ----------- | ---------- | ------------------------------------- |
| `events`    | `'click'`  | Event type(s) to delegate.            |
| `attribute` | `'action'` | `dataset` key holding the identifier. |
| `root`      | `this`     | Delegation root.                      |

One listener serves every current and future descendant, so replacing inner
markup never requires rebinding.

**Ownership rule:** an action belongs to the _nearest_ custom element ancestor.
A trigger nested inside another custom element is ignored, so component
boundaries cannot steal each other's actions.

The attribute value is data, never code. It is passed to `handleAction()`, which
resolves it with explicit application code — there is no `eval`, no `new
Function` and no lookup into `window` (AGENTS.md §2).

### `handleAction(action, trigger, event) => void`

Override to map identifiers to methods with an inspectable `switch`.

---

## `EventBus extends EventTarget`

For application events whose publisher and subscriber intentionally have **no**
DOM relationship — session changed, locale changed, connectivity changed. If the
subscriber is an ancestor of the publisher, use a bubbling `CustomEvent`
instead (ADR-003).

| Method                                 | Returns      | Description                                                 |
| -------------------------------------- | ------------ | ----------------------------------------------------------- |
| `emit(name, detail?, { cancelable? })` | `boolean`    | `false` when prevented. Bus events do not bubble.           |
| `on(name, handler, options?)`          | `() => void` | Unsubscribe function. Pass `{ signal }` inside a component. |
| `once(name, handler, options?)`        | `() => void` | Unsubscribes after the first delivery.                      |

`events` is an exported shared instance.

---

## `HttpClient`

Owns transport policy and nothing else. It never renders a spinner, never picks
an error message and never knows a component exists.

```js
const http = new HttpClient({ baseUrl, csrf, timeout, headers, observer });
```

| Constructor option | Default            | Description                    |
| ------------------ | ------------------ | ------------------------------ |
| `baseUrl`          | document base      | Base for relative URLs.        |
| `headers`          | `{}`               | Extra default headers.         |
| `credentials`      | `'same-origin'`    | Passed to `fetch`.             |
| `timeout`          | `0` (off)          | Default timeout in ms.         |
| `csrf`             | `null`             | A `CsrfProvider`; see below.   |
| `fetch`            | `globalThis.fetch` | Injectable for tests.          |
| `requestIdHeader`  | `'X-Request-Id'`   | Correlation header to capture. |
| `observer`         | `null`             | Optional diagnostics hook.     |

### Methods

| Method                       | Returns                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `request(url, options?)`     | the raw successful `Response`                                  |
| `json(url, options?)`        | parsed JSON, or `null` for `204`/empty                         |
| `text(url, options?)`        | `string`                                                       |
| `html(url, options?)`        | `string` (sets an HTML `Accept`; does **not** insert anything) |
| `get(url, options?)`         | `Response`                                                     |
| `post(url, body?, options?)` | `Response`                                                     |
| `put` / `patch` / `delete`   | `Response`                                                     |

### Request options

| Option        | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `method`      | Defaults to `GET`.                                           |
| `headers`     | Merged over the defaults.                                    |
| `body`        | `FormData`, `URLSearchParams`, string, `Blob`, stream.       |
| `json`        | `true` serialises `body` to JSON and sets the content type.  |
| `query`       | Object or `URLSearchParams`, appended via `URLSearchParams`. |
| `signal`      | Caller cancellation.                                         |
| `timeout`     | Overrides the client default.                                |
| `credentials` | Overrides the client default.                                |
| `accept`      | Convenience for the `Accept` header.                         |

### Default headers

```http
X-Requested-With: XMLHttpRequest
Accept: application/json, text/html;q=0.9, */*;q=0.8
```

`X-Requested-With` lets CI4's `isAJAX()` negotiate content. It is a rendering
hint, never an authorization signal.

### Body policy

- `FormData`, `URLSearchParams`, strings and binary bodies pass through
  untouched, so the browser picks the correct content type and multipart
  boundary.
- A plain object is serialised **only** with an explicit `json: true`. Without
  it, the client throws — silent JSON encoding is how `[object Object]` reaches
  production.
- No `Content-Type` is invented for bodyless requests, which would turn
  same-origin requests into needless CORS preflights.

### Failure taxonomy

Four outcomes stay distinguishable, because each demands different UI:

| Failure                | Thrown value                             | Typical UI             |
| ---------------------- | ---------------------------------------- | ---------------------- |
| Caller cancelled       | native `DOMException` named `AbortError` | nothing at all         |
| Client timeout elapsed | `TimeoutError`                           | retry affordance       |
| No response produced   | `NetworkError` (native error as `cause`) | connectivity message   |
| Non-2xx response       | `HttpError`                              | server-authored detail |

Use `isAbortError(error)` rather than string-matching a name.

#### `HttpError`

| Field                                                   | Description                                     |
| ------------------------------------------------------- | ----------------------------------------------- |
| `status`, `statusText`                                  | HTTP status.                                    |
| `url`, `method`                                         | Effective request.                              |
| `response`                                              | The original `Response` (body may be consumed). |
| `body`                                                  | Parsed payload when safely readable.            |
| `requestId`                                             | Correlation id echoed by the server.            |
| `isClientError` / `isServerError` / `isValidationError` | Convenience predicates.                         |

### CSRF provider contract

Every method is optional; the client calls whichever exist. Applied only to
same-origin `POST`/`PUT`/`PATCH`/`DELETE`.

```js
const provider = {
  getRequestHeaders(context) {
    return { 'X-CSRF-TOKEN': token };
  },
  getRequestBodyFields(context) {
    return { csrf_test_name: token };
  },
  updateFromResponse(response) {
    /* adopt a rotated token */
  },
};
```

Body fields are added only to `FormData`/`URLSearchParams` bodies, which can be
extended without re-encoding the payload. JSON requests rely on the header.

`updateFromResponse()` receives **every** response, including error responses,
so a rotated token is not lost after a validation failure.

### Observer contract

```js
const observer = { onRequest(ctx), onResponse(ctx), onError(ctx) };
```

Purely informational; it cannot change the outcome.

---

## Fragments

```js
import { parseFragment, replaceFragment, appendFragment } from '@vayes/ui-core';
```

| Function                           | Description                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| `parseFragment(html)`              | Parses trusted server HTML into an inert `DocumentFragment`. |
| `replaceFragment(container, html)` | `container.replaceChildren(parsed)`.                         |
| `appendFragment(container, html)`  | Appends without disturbing existing children.                |

All three remove `<script>` elements and inline `on*` handler attributes before
the nodes are adopted. This is not belt-and-braces: a script parsed inside a
`<template>` **does** execute once moved into the live document.

Custom elements in the fragment upgrade automatically on insertion — and later,
if their module is imported afterwards. No initialisation scan runs (ADR-007).

Fragments are trusted server output. The server must escape dynamic values; this
layer is not a sanitiser and no home-grown sanitiser will be added
(docs/10-security.md).

---

## Registration

```js
import { define, setAllowedPrefixes } from '@vayes/ui-core';

define('vui-modal', Modal);
```

| Function                              | Description                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `define(name, constructor, options?)` | Idempotent registration; validates name and prefix. Returns the constructor. |
| `isValidCustomElementName(name)`      | Syntax check, including reserved names.                                      |
| `hasAllowedPrefix(name)`              | Prefix policy check.                                                         |
| `setAllowedPrefixes(prefixes)`        | Replace the allowlist (default `['vui-']`).                                  |
| `getAllowedPrefixes()`                | Current allowlist.                                                           |

Re-defining the same name with the same constructor is a no-op; a _different_
constructor logs a warning and keeps the existing definition.

---

## Diagnostics — optional

```js
import {
  createHttpObserver,
  observeComponentEvents,
  redactHeaders,
} from '@vayes/ui-core/core/diagnostics.js';
```

Opt-in and side-effect-free on import. Request bodies are never logged, and
credentials, cookies and CSRF tokens are redacted from headers.

The core never installs a global `window.onerror` or `unhandledrejection`
handler; an application may install its own observability adapter explicitly.

---

## ActionRegistry — optional

Deliberately **not** exported from the main entry point, and not used by the
reference components or the demo application. Import it only if the product
genuinely needs server markup to name an application handler:

```js
import { actions } from '@vayes/ui-core/actions';

actions.register('invoice.customerSelected', context => {
  /* ... */
});
```

| Method                    | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `register(name, handler)` | Returns an unregister function. Refuses to replace an existing key. |
| `unregister(name)`        | `boolean`.                                                          |
| `has(name)` / `get(name)` | Exact-key lookup; non-string keys never resolve.                    |
| `invoke(name, context?)`  | Throws a diagnosable error for an unknown key.                      |
| `names`                   | Registered identifiers.                                             |

Lookup is an exact match in a `Map`. Strings such as `__proto__`,
`constructor`, `window.alert` or `safe.handler; alert(1)` resolve to nothing.
Native `addEventListener` remains the preferred mechanism.
