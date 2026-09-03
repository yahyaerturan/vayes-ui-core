# AI Agent Implementation Rules

This file is authoritative for AI coding agents implementing Vayes UI Core.

## 1. Mission

Implement the specification in this repository **without inventing a frontend framework**. Prefer browser standards over library abstractions. If the browser already exposes a clear primitive, wrap it only when the wrapper creates a repeatable policy or removes meaningful boilerplate.

## 2. Hard constraints

The following are forbidden unless a future ADR explicitly reverses the decision:

- React, Vue, Angular, Svelte, Solid, Alpine, HTMX, Stimulus or comparable runtime frameworks.
- Virtual DOM or DOM diff/reconciliation engines.
- JSX or a custom compiler-required template syntax.
- Reactive proxies, signal graphs, implicit observers, automatic dependency tracking.
- Hooks or hook-like lifecycle composition APIs.
- A global mutable application state store in the core.
- Two-way data binding.
- `eval`, `new Function`, string-to-code execution, or inline executable handler strings.
- DOM mutation scanners used to initialize Custom Elements.
- Requiring Shadow DOM for ordinary components.
- A custom client router in the core.
- A dependency injection container in the frontend core.
- Runtime npm dependencies without a new ADR and explicit approval.
- Silently swallowing errors.
- `innerHTML`/`insertAdjacentHTML` with untrusted or unsanitized data.

## 3. Preferred implementation primitives

Use, in order of preference:

1. Custom Elements.
2. Native DOM events.
3. Event delegation.
4. `AbortController` for lifecycle-scoped listener cleanup.
5. Explicit methods for state mutation and DOM updates.
6. Properties for rich values; attributes for HTML-friendly scalar configuration.
7. `fetch` through the project HTTP abstraction.
8. ES modules.
9. JSDoc for public API types and contracts.

## 4. Phase discipline

Implement `docs/16-implementation-plan.md` one phase at a time.

For every phase:

1. read all referenced specs and ADRs;
2. write or update tests for the public behavior;
3. implement only the smallest API required by the phase;
4. run unit, browser, lint and integration checks applicable to the phase;
5. update documentation/examples where public behavior changed;
6. verify phase exit criteria;
7. do **not** start the next phase while required tests fail.

## 5. Public API discipline

Every public class, public method, supported attribute, property, emitted event, event detail shape and HTTP behavior must be documented.

Public APIs must not be added merely because they may be useful later. YAGNI applies. Prefer a private helper until at least two concrete call sites require a stable abstraction.

## 6. Lifecycle discipline

Custom Elements can be connected, disconnected and reconnected more than once. Implementations must be safe under all three operations.

- Never assume `connectedCallback()` runs exactly once.
- Never create duplicate event listeners on reconnect.
- Use a new lifecycle `AbortController` for each mount cycle.
- Abort it in `disconnectedCallback()`.
- Timers, observers and subscriptions created by a component must be disposed during disconnect.
- Avoid network calls in constructors.
- Avoid accessing child DOM in constructors.

## 7. Rendering discipline

Initial rendering and incremental updates are separate concerns.

- `render()` may create initial component markup when the component owns that markup.
- State changes should update the smallest relevant DOM region by explicit methods.
- Do not implement global `setState() -> render everything` behavior in the core.
- Server-rendered light DOM must be preservable and progressively enhanced where specified.
- Do not destroy user focus, text selection, scroll position or uncontrolled form state through gratuitous rerenders.

## 8. Event discipline

- Use DOM `CustomEvent` for component-to-parent/ancestor communication.
- Events that represent meaningful changes should bubble by default.
- Use the application `EventBus` only when the publisher/subscriber relationship is intentionally independent of DOM hierarchy.
- Event names and `detail` payloads are API contracts and must be tested.
- Do not call application-specific global functions from reusable components.

## 9. Security discipline

- Treat all server and user data as untrusted by default.
- Prefer `textContent`, properties and DOM creation methods over HTML interpolation.
- If HTML fragments are intentionally accepted, the trust boundary must be explicit and documented.
- No script execution from AJAX HTML fragments.
- CSRF handling must follow the CodeIgniter adapter contract.
- No secrets in frontend source.

## 10. Testing discipline

A component is not complete unless tests cover, where applicable:

- initial connection;
- disconnection cleanup;
- reconnect without duplicate behavior;
- configuration from attributes;
- configuration from properties;
- property assignment before custom-element definition (upgrade case);
- emitted events and detail payloads;
- event bubbling;
- dynamic insertion after an AJAX-like DOM update;
- keyboard behavior and accessibility expectations;
- server error and network error paths;
- XSS-sensitive rendering paths.

Browser-native behavior must be verified in a real browser test suite, not only a simulated DOM.

## 11. Change control

When the implementation appears to require violating a hard constraint:

1. stop that design path;
2. document why the current specification appears insufficient;
3. propose an ADR describing alternatives, trade-offs and compatibility impact;
4. do not implement the architectural change until accepted.
