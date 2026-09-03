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
