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
