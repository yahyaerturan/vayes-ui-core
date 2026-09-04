# `<vui-tabs>` — Component Specification

## Purpose

Adds keyboard navigation and ARIA state to server-rendered tab markup.

## Rendering mode

- [x] Server-rendered enhancement
- [ ] Client-owned
- [ ] Hybrid

DOM mode: **Light DOM**. `render()` is a no-op: the server's markup is never
rebuilt, so panel content, focus and any third-party widget inside a panel
survive untouched.

## Expected markup

```html
<vui-tabs>
  <div role="tablist" aria-label="Customer sections">
    <button id="tab-general" type="button" role="tab" aria-controls="panel-general">General</button>
    <button id="tab-billing" type="button" role="tab" aria-controls="panel-billing">Billing</button>
  </div>
  <section id="panel-general" role="tabpanel">…</section>
  <section id="panel-billing" role="tabpanel">…</section>
</vui-tabs>
```

Each `[role="tab"]` must reference an existing panel through `aria-controls`. A
dangling reference throws on mount — it is a template bug, not a runtime state.

## Attributes

| Attribute        | Type                    | Default     | Observed? | Description                                                                   |
| ---------------- | ----------------------- | ----------- | --------- | ----------------------------------------------------------------------------- |
| `selected-index` | number                  | `0`         | Yes       | Selected tab index. Reflected from the property and clamped to range.         |
| `activation`     | `automatic` \| `manual` | `automatic` | No        | `automatic` selects on focus; `manual` moves focus and waits for Enter/Space. |

## Properties

| Property        | Type                                  | Default       | Reflected?             | Description                                                      |
| --------------- | ------------------------------------- | ------------- | ---------------------- | ---------------------------------------------------------------- |
| `selectedIndex` | `number`                              | `0`           | Yes → `selected-index` | An assignment made before upgrade outranks the server attribute. |
| `activation`    | `'automatic' \| 'manual'` (read-only) | `'automatic'` | —                      |                                                                  |
| `selectedTab`   | `HTMLElement \| null` (read-only)     | —             | —                      |                                                                  |
| `selectedPanel` | `HTMLElement \| null` (read-only)     | —             | —                      |                                                                  |

## Methods

### `select(index, options?)`

Parameters: `index: number`; `options.source`, `options.focus` (default `false`).
Returns: `void`.
Side effects: updates `aria-selected`, roving `tabindex`, panel `hidden`, reflects the attribute, emits `tab:changed`.
Errors: none. Out-of-range indexes are clamped, because a template rendering one tab fewer should degrade, not break.

### `refresh(options?)`

Re-reads tabs and panels from the DOM. Call it after replacing the tablist with
an AJAX fragment. Cheap and idempotent; delegated listeners are unaffected.
`options.emit` (default `true`) controls whether a resulting selection change
announces itself.

## Events

| Event         | Bubbles | Cancelable | Detail                                             | When emitted                                                             |
| ------------- | ------- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| `tab:changed` | Yes     | No         | `{ index, previousIndex, tabId, panelId, source }` | After the selection changed. Re-selecting the current tab emits nothing. |

## Internal state

`#selectedIndex`, the collected `#tabs`/`#panels` arrays, and `#pendingIndex`
for a selection requested before the tabs were collected.

## DOM contract

Server-owned markup: the tablist, tabs and panels.
Component-owned markup: none.
Stable selectors: `[role="tablist"]`, `[role="tab"]`, `[role="tabpanel"]`.
Attributes the component writes: `aria-selected`, `tabindex`, `hidden`, `aria-labelledby`.
Focus-sensitive elements: the tabs. Panels are shown and hidden with the `hidden` property; their contents are never recreated.

Descendants may be replaced dynamically; call `refresh()` afterwards.

## Internal actions

None. Tabs are matched by `role`, not by `data-action`.

## Async/HTTP behavior

None.

## Accessibility

Semantics: the server provides the ARIA tabs pattern; the component maintains its state.
Keyboard: ArrowRight/ArrowDown next (wrapping), ArrowLeft/ArrowUp previous (wrapping), Home first, End last; in `manual` mode Enter and Space activate.
Direction: when the tablist resolves to `direction: rtl` the horizontal arrows mirror — ArrowLeft is next, ArrowRight is previous — because "next" follows reading order rather than screen geometry. ArrowUp/ArrowDown, Home and End are unaffected: only the inline axis has a direction. The direction is read from the tablist's computed style on each keypress, so a nested `dir` and a runtime language switch both resolve correctly; the document's `dir` does not decide it. See [Bidirectional text](../authoring-components.md#bidirectional-text).
Focus: a roving `tabindex` keeps exactly one tab in the tab order; selection moves focus to the selected tab.
ARIA: `aria-selected` on tabs, `hidden` on panels, `aria-labelledby` linking panel to tab when the tab has an id.

Nested `<vui-tabs>` are isolated: an inner component's tabs never respond to the
outer one's handlers.

## Security

Untrusted inputs: none. The component writes no text content.

## Lifecycle cleanup

- listeners: `click` and `keydown` on the component, bound with `this.signal`
- EventBus subscriptions: none
- observers: none
- timers: none
- requests: none

## Tests

`tests/browser/tabs.spec.js`

- [x] pre/post definition upgrade
- [x] connect/disconnect/reconnect
- [x] no duplicate listeners
- [x] configuration (attribute, property, precedence, clamping)
- [x] public events
- [x] keyboard/focus (both activation modes)
- [x] mirrored arrows in an RTL tablist, resolved from the tablist rather than the document
- [x] dynamic insertion / `refresh()` after a fragment replacement
- [x] nested component isolation
- [x] malformed markup fails loudly

## Non-goals

No lazy panel loading, no URL/hash synchronisation, no scrollable overflow
affordance, no animation. Those belong to the application or to CSS.
