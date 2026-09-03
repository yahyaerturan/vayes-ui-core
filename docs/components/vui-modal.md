# `<vui-modal>` — Component Specification

## Purpose

A modal dialog that wraps its own light-DOM children.

## Rendering mode

- [ ] Server-rendered enhancement
- [x] Client-owned (wrapper)
- [x] Hybrid (content may be server-rendered)

DOM mode: **Light DOM**.

## Implementation note: native `<dialog>`

The component wraps its children in a native `<dialog>` and calls
`showModal()`. The platform then supplies the focus trap, background inertness,
the top layer, `::backdrop` and Escape handling — behaviour that is laborious
and easy to get subtly wrong when a dialog is built from `<div>`s.
docs/12-accessibility.md requires evaluating the native element first; this is
the result of that evaluation.

## Attributes

| Attribute    | Type    | Default | Observed? | Description                                                                 |
| ------------ | ------- | ------- | --------- | --------------------------------------------------------------------------- |
| `open`       | boolean | absent  | Yes       | Reflects the open state and drives it declaratively. Style against this.    |
| `no-dismiss` | boolean | absent  | No        | Disables Escape and backdrop dismissal. Programmatic `close()` still works. |

## Properties

| Property      | Type                  | Default | Reflected? | Description                                         |
| ------------- | --------------------- | ------- | ---------- | --------------------------------------------------- |
| `isOpen`      | `boolean` (read-only) | `false` | —          | The boolean lives here so `open()` can stay a verb. |
| `dismissible` | `boolean` (read-only) | `true`  | —          | Inverse of `no-dismiss`.                            |

## Methods

### `open(options?)`

Parameters: `options.invoker` — element focus returns to on close; defaults to whatever had focus.
Returns: `boolean` — `false` when already open.
Side effects: `showModal()`, reflects `open`, emits `modal:opened`.
Errors: throws when the element is disconnected, because `showModal()` requires a connected element.

### `close(reason?)`

Parameters: `reason` — `'method' | 'escape' | 'backdrop' | 'action' | 'disconnect'`, default `'method'`.
Returns: `boolean` — `false` when already closed **or** when a listener prevented `modal:before-close`.
Side effects: emits the pre-event, closes the dialog, restores focus, emits `modal:closed`.

### `toggle(force?)`

Opens or closes; `force` overrides the direction.

## Events

| Event                | Bubbles | Cancelable | Detail       | When emitted                                      |
| -------------------- | ------- | ---------- | ------------ | ------------------------------------------------- |
| `modal:opened`       | Yes     | No         | —            | After the dialog became visible.                  |
| `modal:before-close` | Yes     | **Yes**    | `{ reason }` | Before closing. `preventDefault()` keeps it open. |
| `modal:closed`       | Yes     | No         | `{ reason }` | After the dialog closed and focus was restored.   |

Every dismissal route — Escape, backdrop, `data-action="close"`, `close()`,
removing the `open` attribute — passes through `modal:before-close`, so a single
listener can guard an unsaved form.

## Internal state

The dialog element reference and the stored invoker. Open state is read from the
native dialog rather than duplicated.

## DOM contract

Server-owned markup: the modal content, provided as children.
Component-owned markup: `<dialog class="vui-modal__dialog" data-vui-modal>` containing `<div class="vui-modal__content" data-content>`; children are moved into it on first render.
Stable selectors: `dialog[data-vui-modal]`, `[data-content]`.
Focus-sensitive elements: everything inside the dialog. Content is moved once and never recreated.

## Internal actions

| `data-action` | Handler        | Description                     |
| ------------- | -------------- | ------------------------------- |
| `close`       | `handleAction` | Closes with `reason: 'action'`. |

Place `data-action="close"` on any control inside the modal.

## Async/HTTP behavior

None. Submitting a form inside the modal is the application's concern; see
`resources/js/demo.js`.

## Accessibility

Semantics: native `<dialog>` in modal mode.
Keyboard: Escape closes unless `no-dismiss` or a prevented pre-event; Tab is trapped inside by the platform.
Focus: `showModal()` moves focus into the dialog; closing returns it to the invoker when that element is still connected.
ARIA: put `aria-label` or `aria-labelledby` on `<vui-modal>` itself; it is
forwarded to the `<dialog>`. Changing the attribute later updates the name.

## Security

Untrusted inputs: none. The component moves existing nodes and never
interpolates HTML.

## Lifecycle cleanup

- listeners: `cancel` and `click` on the dialog plus delegated actions, all bound with `this.signal`
- EventBus subscriptions: none
- observers: none
- timers: none
- requests: none

Disconnecting closes the dialog and restores focus **without** emitting events:
removal from the document is not a user's decision to close. The element can be
reconnected and reopened.

## Tests

`tests/browser/modal.spec.js`

- [x] pre/post definition upgrade
- [x] connect/disconnect/reconnect
- [x] no duplicate listeners
- [x] configuration (`open`, `no-dismiss`)
- [x] public events, including the cancelable pre-event
- [x] keyboard (Escape, focus trap) and focus restoration
- [x] background inertness
- [x] error path (opening while disconnected)
- [ ] XSS-sensitive data — not applicable

## Non-goals

No stacking manager, no scroll locking beyond what the platform does, no
transitions (leave those to CSS), no built-in confirm/alert presets.
