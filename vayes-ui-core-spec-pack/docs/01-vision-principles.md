# 01 — Vision and Principles

## Problem statement

Traditional CodeIgniter applications often begin with server-rendered PHP views plus small JavaScript files. As interactivity grows, the JavaScript can degrade into scattered selectors, duplicate AJAX helpers, manually initialized widgets, undocumented global events, and components that fail when injected after an AJAX response.

The alternative is often to introduce a full SPA framework. That solves componentization, but also transfers large responsibilities to the frontend: routing, application state, API contracts, duplicate validation, client data synchronization, build conventions, framework lifecycle and framework-specific testing.

Vayes UI Core occupies the narrow space between those extremes.

## Goals

### G1. Reusable components

A reusable UI capability is represented by a native Custom Element or, only where a custom element is inappropriate, a small explicit module.

Example:

```html
<vui-customer-selector
    endpoint="/customers/search"
    min-query="2"
></vui-customer-selector>
```

### G2. Explicit configuration

Simple configuration is visible in HTML attributes. Rich JavaScript data is passed through properties. Defaults are documented and deterministic.

### G3. Explicit events

Components publish meaningful changes through `CustomEvent`. Consumers subscribe with `addEventListener()` or, for intentionally global application events, through a tiny `EventBus` based on `EventTarget`.

### G4. Dynamic DOM support

Components inserted by server-rendered AJAX fragments or created in JavaScript must initialize automatically through the Custom Elements lifecycle. No global `initWidgets()` pass is required.

### G5. Server/client coexistence

A component may be:

- entirely server rendered and behavior-enhanced;
- server rendered with client-managed local state;
- client-created from JSON/properties;
- inserted as server-generated HTML after an AJAX call.

These modes must not require different component classes.

### G6. Zero runtime framework dependencies

The stable runtime should depend on browser standards only. Tooling dependencies for linting, testing, documentation and bundling are allowed, but production component behavior must not depend on a third-party frontend framework.

### G7. Traceability

Behavior should remain obvious from source and DevTools. A request should be traceable from user event → component method → HTTP call → DOM update → emitted event → subscriber.

### G8. Long-term stability

The architecture should resist ecosystem churn. Browser standards evolve more slowly than frontend frameworks and maintain backward compatibility more strongly.

## Non-goals

Vayes UI Core is not intended to provide:

- client-side application routing;
- server-side rendering of a JavaScript application;
- hydration/reconciliation;
- reactive state graphs;
- global state management;
- a templating language;
- a CSS framework;
- a data ORM;
- business/domain logic;
- a replacement for CodeIgniter views;
- a universal design system in the first release.

## Design principles

### P1. Browser first

If the native API is already clean, use it directly.

### P2. Explicit over implicit

An explicit `setLoading(true)` method is preferable to a proxy that observes `state.loading` and invisibly modifies the DOM.

### P3. Light DOM by default

Components used inside first-party CodeIgniter applications should participate normally in application CSS, forms, accessibility trees and DevTools. Shadow DOM is an explicit opt-in for isolation use cases.

### P4. Server authoritative

Business rules, permissions and data validation remain authoritative on the server. Client-side validation exists for UX, not security.

### P5. Events decouple components

Reusable components emit facts such as `customer:selected`; they do not directly call invoice, CRM or analytics modules.

### P6. Separate transport from UI

Components should consume an HTTP service/client rather than each inventing fetch/CSRF/error conventions.

### P7. Small core, richer components

Complexity belongs in the components that need it, not in the universal runtime.

### P8. Progressive enhancement where practical

When useful, initial server HTML should remain meaningful before JavaScript upgrades the element.

### P9. Accessibility is behavior

Keyboard and semantic behavior are part of component correctness, not a final styling pass.

### P10. Test native behavior in native browsers

Simulated DOM tests may accelerate utilities, but browser lifecycle/event behavior requires real-browser integration tests.
