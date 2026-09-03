# `<vui-counter>` — Component Specification

## Purpose

A numeric stepper. It exists to prove the smallest complete component contract
end to end, and is used as the lifecycle smoke test.

## Rendering mode

- [ ] Server-rendered enhancement
- [x] Client-owned
- [ ] Hybrid

DOM mode: **Light DOM**.

## Attributes

| Attribute  | Type    | Default | Observed? | Description                                                                             |
| ---------- | ------- | ------- | --------- | --------------------------------------------------------------------------------------- |
| `value`    | number  | `0`     | Yes       | Current value. Reflected from the property.                                             |
| `step`     | number  | `1`     | Yes       | Increment applied by the buttons. A non-finite or zero value falls back to the default. |
| `disabled` | boolean | absent  | Yes       | HTML boolean semantics: presence means true, so `disabled="false"` is still disabled.   |

## Properties

| Property   | Type                 | Default | Reflected?       | Description                                                  |
| ---------- | -------------------- | ------- | ---------------- | ------------------------------------------------------------ |
| `value`    | `number`             | `0`     | Yes → `value`    | Assigning emits `counter:changed` with `source: 'property'`. |
| `step`     | `number` (read-only) | `1`     | —                | Parsed from the attribute.                                   |
| `disabled` | `boolean`            | `false` | Yes → `disabled` |                                                              |

## Methods

### `setValue(value, options?)`

Parameters: `value: number`; `options.source` (`'user' | 'property' | 'attribute' | 'init'`, default `'property'`), `options.emit` (default `true`).
Returns: `void`.
Side effects: updates the `<output>` text, reflects the `value` attribute, emits `counter:changed`.
Errors: none. Non-finite input and no-op assignments are ignored.

### `increment()` / `decrement()`

Apply `+step` / `-step` with `source: 'property'`.

## Events

| Event             | Bubbles | Cancelable | Detail                                                | When emitted                                                                                           |
| ----------------- | ------- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `counter:changed` | Yes     | No         | `{ value: number, previous: number, source: string }` | After the value changed and the DOM was updated. Not emitted for initial hydration from the attribute. |

## Internal state

`#value` only. Everything else is derived or read from attributes.

## DOM contract

Server-owned markup: none.
Component-owned markup: two `<button data-action>` elements and one `<output data-value>`.
Stable selectors: `[data-value]`, `[data-action="increment"]`, `[data-action="decrement"]`.
Focus-sensitive elements: the buttons. `setValue()` updates only the `<output>` text, so focus is never disturbed.

Markup is created once. On reconnect the component detects its own existing
output and reuses it rather than rebuilding.

## Internal actions

| `data-action` | Handler        | Description                                                      |
| ------------- | -------------- | ---------------------------------------------------------------- |
| `increment`   | `handleAction` | `value + step`                                                   |
| `decrement`   | `handleAction` | `value - step`                                                   |
| `reset`       | `handleAction` | Back to `0`. Not rendered by default; available for host markup. |

Actions are ignored while `disabled`.

## Async/HTTP behavior

None.

## Accessibility

Semantics: native `<button>` and `<output>`; no ARIA roles are invented.
Keyboard: Enter and Space, provided by the native buttons.
Focus: never moved by the component.
ARIA: buttons carry `aria-label`; `disabled` maps to the native `disabled` property so assistive technology reports it.

## Security

Untrusted inputs: none. The value is coerced with `Number()` and written via
`textContent`, so a hostile attribute value cannot become markup.

## Lifecycle cleanup

- listeners: one delegated listener, bound with `this.signal`
- EventBus subscriptions: none
- observers: none
- timers: none
- requests: none

## Tests

`tests/browser/counter.spec.js`

- [x] pre/post definition upgrade
- [x] connect/disconnect/reconnect
- [x] no duplicate listeners
- [x] configuration (attribute defaults, invalid step, boolean semantics)
- [x] public events
- [x] keyboard
- [x] dynamic insertion via fragment
- [ ] error/abort behavior — not applicable
- [x] XSS-sensitive data (value is numeric and written as text)

## Non-goals

No min/max clamping, no formatting, no locale-aware digits, no form
association. A component needing those should wrap a native `<input
type="number">` instead.
