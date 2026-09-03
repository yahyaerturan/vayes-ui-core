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
