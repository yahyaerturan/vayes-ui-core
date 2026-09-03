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
