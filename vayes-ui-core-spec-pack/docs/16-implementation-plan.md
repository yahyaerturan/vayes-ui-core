# 16 — Implementation Plan

Implement one phase at a time. Do not proceed while a phase exit gate fails.

## Phase 0 — Repository and quality gates

**Goal:** deterministic implementation environment before runtime features.

Tasks:

- establish `resources/js`, tests, examples and docs;
- configure ES modules;
- add formatter/linter;
- add unit runner and real-browser runner;
- add optional Vite build;
- add CI commands;
- add dependency-policy check asserting no production runtime dependencies;
- define browser support policy;
- expose scripts such as `lint`, `test:unit`, `test:browser`, `test`, `build`.

Exit gate: smoke tests/lint/build pass and runtime dependency list is empty.

## Phase 1 — Component lifecycle core

Implement:

- `Component extends HTMLElement`;
- mount state;
- lifecycle `AbortController`;
- connect/disconnect callbacks;
- `mount`, `unmount`, `render`, `bindEvents` extension points;
- `find`, `findAll`, `upgradeProperty`;
- idempotent `define()` helper.

Required tests:

- connect/disconnect/reconnect;
- lifecycle signal abort;
- no duplicate listeners;
- element exists before definition;
- property set before definition;
- idempotent registration.

Exit gate: all lifecycle invariants pass in a real browser.

## Phase 2 — Component events and EventBus

Implement `Component.emit()`, `EventBus`, unsubscribe-returning `on()`, signal-aware subscriptions and optional `once()`.

Test detail payloads, bubbling, cancellation, unsubscribe and reconnect behavior.

Exit gate: a child can publish a change consumed by an ancestor without knowing the consumer; a genuine non-DOM global event works through EventBus.

## Phase 3 — Explicit action delegation

Standardize internal `data-action` delegation. Add a helper only if repetition justifies it. Handle nested custom-element boundaries explicitly.

Do **not** implement a DSL, arbitrary server callbacks or global automatic wiring.

Exit gate: dynamic descendant replacement works without rebinding and nested component actions do not leak to parents.

## Phase 4 — HTTP transport core

Implement:

- `HttpError`;
- `HttpClient.request()`;
- JSON/text/HTML helpers;
- minimal GET/POST convenience;
- AJAX header and same-origin credentials;
- JSON/FormData/URLSearchParams body policy;
- external abort signal and timeout;
- request-ID capture;
- pluggable CSRF provider.

Test success, HTTP errors, network/abort, body modes, headers, CSRF injection and parsing.

Exit gate: normal reference components do not use ad-hoc raw `fetch`.

## Phase 5 — CI4 integration foundation

Implement/demo:

- boot config reader;
- CI4 CSRF provider;
- page route;
- fragment route;
- JSON route;
- protected POST;
- validation response;
- request/correlation ID propagation where available;
- SQLite-backed test/demo persistence where required.

Browser + CI4 tests must verify initial and consecutive unsafe requests, validation and authorization behavior.

Exit gate: transport contract is proven against a real CI4 host.

## Phase 6 — Rendering/fragment utilities

Add only the smallest justified fragment helpers. Returned scripts must not execute. Test automatic upgrade of inserted Custom Elements and compatibility with delegated listeners.

Exit gate: server HTML fragment containing components works with **zero** `initAll()`/DOM scanning.

## Phase 7 — Reference components

Implement in order:

1. `vui-counter`;
2. `vui-tabs`;
3. `vui-modal`;
4. `vui-customer-selector`.

The set must collectively prove server enhancement, client-owned rendering, local state, incremental updates, public events, cancelable events, global lifecycle listeners, async JSON, stale request cancellation, attributes, properties, pre-upgrade properties and dynamic insertion.

## Phase 8 — Optional ActionRegistry

Implement **only if a concrete application requirement exists** for server-declared action identifiers.

If implemented: exact-key registry only; no `window` lookup; no code execution; explicit context; feature must remain removable without affecting native event consumers.

## Phase 9 — Hardening

Perform security, CSP, XSS, CSRF, accessibility, focus, lifecycle leak, performance and bundle-size review/tests.

Exit gate: no high-severity security/a11y defect, no reconnect/resource leak under stress, core remains deliberately small.

## Phase 10 — Stable packaging

Stabilize exports, API docs, examples, SemVer policy and release packaging. Tag stable only after `docs/17-acceptance-criteria.md` passes completely.
