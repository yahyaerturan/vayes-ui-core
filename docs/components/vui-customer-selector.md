# `<vui-customer-selector>` — Component Specification

## Purpose

Search for a customer and announce the selection. It is the reference async
component: it proves service injection, stale-request cancellation, distinct
async states and safe rendering of untrusted server data.

## Rendering mode

- [ ] Server-rendered enhancement
- [x] Client-owned
- [ ] Hybrid

DOM mode: **Light DOM**.

## Attributes

| Attribute     | Type    | Default       | Observed? | Description                                                    |
| ------------- | ------- | ------------- | --------- | -------------------------------------------------------------- |
| `endpoint`    | string  | —             | No        | JSON search endpoint. Required unless a `service` is assigned. |
| `min-query`   | number  | `2`           | No        | Minimum trimmed length before a request is issued.             |
| `limit`       | number  | `20`          | No        | Maximum results requested.                                     |
| `debounce`    | number  | `250`         | No        | Milliseconds of typing quiet before searching.                 |
| `placeholder` | string  | label default | Yes       | Input placeholder.                                             |
| `disabled`    | boolean | absent        | Yes       | Disables the input and clear button, and closes the list.      |

Mounting without either `endpoint` or `service` throws: a selector with no way
to search is a template bug (docs/19-observability-errors.md).

## Properties

| Property                                    | Type                      | Default   | Reflected? | Description                                                             |
| ------------------------------------------- | ------------------------- | --------- | ---------- | ----------------------------------------------------------------------- |
| `selected`                                  | `Customer \| null`        | `null`    | No         | Assigning pre-fills the input **without** emitting `customer:selected`. |
| `service`                                   | `CustomerService \| null` | `null`    | No         | Injected search service. Anything with a compatible `search()` works.   |
| `labels`                                    | `Record<string, string>`  | see below | No         | Scoped translations: `loading`, `empty`, `error`, `clear`, `hint`.      |
| `disabled`                                  | `boolean`                 | `false`   | Yes        |                                                                         |
| `endpoint`, `minQuery`, `limit`, `debounce` | read-only                 | —         | —          | Parsed from attributes.                                                 |

`Customer` is `{ id: string, name: string, email?: string }`.

Only the keys this component needs are passed in `labels`; the whole
application catalogue is never shipped to the browser
(docs/09-ci4-integration.md).

## Methods

### `search(query)`

Runs a search immediately, bypassing the debounce. Aborts any request in flight.
Returns a promise that resolves when the state has settled. Never rejects: a
failure becomes the `error` state plus a `customer:search-failed` event.

### `selectCustomer(customer, options?)`

Selects programmatically and emits `customer:selected`. `options.source`
defaults to `'api'`.

### `clear()`

Cancels pending work, clears the selection, and emits `customer:cleared` only if
something was selected.

## Events

| Event                    | Bubbles | Cancelable | Detail                                          | When emitted                                                 |
| ------------------------ | ------- | ---------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `customer:selected`      | Yes     | No         | `{ id, customer, source: 'user' \| 'api' }`     | A customer was chosen by click, Enter or `selectCustomer()`. |
| `customer:cleared`       | Yes     | No         | `{ previous: Customer }`                        | A selection was removed.                                     |
| `customer:search-failed` | Yes     | No         | `{ query, error: { name, status, requestId } }` | A search failed for a reason other than cancellation.        |

`customer:search-failed` carries a small, log-safe descriptor — never the
server's message. The application decides what a user sees.

## Internal state

`selected`, `results`, `status`, `activeIndex`, `expanded`. Not exposed as API.

## DOM contract

Server-owned markup: none.
Component-owned markup: an `<input role="combobox">`, a clear `<button>`, a `<ul role="listbox">` and a `<p role="status">`.
Stable selectors: `[data-input]`, `[data-list]`, `[data-status]`, `[data-action="clear"]`, `[role="option"]`.
State hooks: `data-state` is one of `idle | loading | results | empty | error`; `aria-busy` is present while loading; `data-has-selection` marks a chosen customer.
Focus-sensitive elements: the input. Results are re-rendered on each search; the input is not.

## Internal actions

| `data-action` | Handler        | Description           |
| ------------- | -------------- | --------------------- |
| `clear`       | `handleAction` | Clears the selection. |

## Async/HTTP behavior

Service: `CustomerService` → `HttpClient` → CI4. The component issues no `fetch`
of its own. When no service is injected it creates a default one from the
`endpoint` attribute.

Cancellation: each search aborts the previous `AbortController`.
Stale responses: a monotonic request token is checked before any state is
written, so a response that wins a race after being aborted is still discarded.
Loading state: `data-state="loading"` plus `aria-busy` and a live-region message.
Error state: `data-state="error"` with a generic message.
Retry: none built in; the application may call `search()` again.

A cancelled request never renders the error state — that is the bug where every
keystroke flashes red.

## Accessibility

Semantics: the ARIA combobox/listbox pattern over a native `<input>`.
Keyboard: ArrowDown/ArrowUp move the active option (wrapping), Home/End jump, Enter selects the active option, Escape closes the list without clearing the query.
Focus: focus stays in the input; option activation is conveyed with `aria-activedescendant`. A `mousedown` on an option is prevented so the list cannot collapse before the click lands.
ARIA: `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `aria-selected` per option, and a `role="status"` live region for loading/empty/error messages.

Naming is described under **Naming the field** above. The internal input lives
in the Light DOM, so it participates in the document normally.

## Security

Untrusted inputs: customer `name` and `email` from the server.
Safe rendering method: option text is written with `textContent` and the input
with the `value` property. No customer data ever reaches `innerHTML`.
Trusted HTML boundary: none — this component accepts no HTML.

Verified with hostile fixtures in both the browser suite and end to end against
a seeded database row containing `<img src=x onerror=…>`.

## Lifecycle cleanup

- listeners: `input`, `keydown`, `focus` on the input; `mousedown`/`click` on the component; `click` on `document` — all bound with `this.signal`
- EventBus subscriptions: none
- observers: none
- timers: the debounce timer, cleared in `unmount()`
- requests: the in-flight search, aborted in `unmount()`

## Tests

`tests/browser/customer-selector.spec.js` and `tests/integration/ci4.spec.js`

- [x] pre/post definition upgrade (`selected` before definition)
- [x] connect/disconnect/reconnect
- [x] no duplicate listeners or duplicate requests
- [x] configuration (`min-query`, `limit`, `debounce`, `disabled`, `labels`)
- [x] public events and detail shapes
- [x] keyboard/focus (arrows, Home/End, Enter, Escape, outside click)
- [x] dynamic insertion
- [x] abort, stale response, network and server error paths
- [x] XSS-sensitive rendering, in isolation and end to end

## Non-goals

No multi-select, no tag input, no free-text entry, no creation of new customers,
no result caching, no infinite scrolling. Those belong to a purpose-built
component, not to this reference.
