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
