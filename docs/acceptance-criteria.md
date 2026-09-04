# Acceptance criteria — status

Every criterion from `vayes-ui-core-spec-pack/docs/17-acceptance-criteria.md`,
with the code and the test that backs it.

Legend: **✔** met and covered by an automated test · **◑** met, verified by
review rather than a test.

## Architecture

| Criterion                                                 | Status | Evidence                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero runtime frontend framework dependencies              | ✔      | `scripts/check-runtime-deps.mjs` (empty `dependencies`, no non-relative import in `resources/js`)                                                                                                                            |
| Custom Elements are the reusable markup primitive         | ✔      | `resources/js/core/register.js`; every component in `resources/js/components`                                                                                                                                                |
| No virtual DOM, reactive graph, hooks or compiler syntax  | ◑      | Core is 707 code lines across 9 files; `npm run size` reports it. Partly mechanised: `npm run deps:check` and `npm run arch:check` block the usual routes in, but a hand-written reconciler would still need review to catch |
| Light DOM is default                                      | ✔      | No `attachShadow` anywhere; `tests/browser/*.spec.js` query component descendants directly                                                                                                                                   |
| CI4 authoritative for rules, authorization and validation | ✔      | `tests/integration/ci4.spec.js` → “server-authoritative validation”, “authorisation”                                                                                                                                         |
| Core runtime is application-agnostic                      | ✔      | `npm run arch:check` enforces the layer import rules; a core module importing a component fails the build                                                                                                                    |

## Lifecycle

| Criterion                                        | Status | Evidence                                                                                                     |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| Element present before class definition upgrades | ✔      | `core-runtime.spec.js` → “an element already in the document upgrades…”                                      |
| Element inserted after definition works          | ✔      | `fragments.spec.js` → “custom elements inside an inserted fragment initialise…”                              |
| Disconnect/reconnect works                       | ✔      | `core-runtime.spec.js` → “connect, disconnect and reconnect run in the documented order”                     |
| Reconnect does not duplicate listeners           | ✔      | `core-runtime.spec.js` → “reconnecting does not duplicate listeners on the element, document or window”      |
| Lifecycle-owned resources are cleaned            | ✔      | `core-runtime.spec.js` → signal abort; `customer-selector.spec.js` → “disconnecting cancels in-flight work…” |
| Rich properties assigned before definition work  | ✔      | `core-runtime.spec.js`, `counter.spec.js`, `tabs.spec.js`, `customer-selector.spec.js`                       |

## Configuration and rendering

| Criterion                                                                   | Status | Evidence                                                                                                                                              |
| --------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public attributes/properties/defaults documented                            | ✔      | `docs/components/*.md`                                                                                                                                |
| HTML boolean semantics respected                                            | ✔      | `counter.spec.js` → “`disabled="false"` is still disabled”                                                                                            |
| Rich data uses properties, not serialized attributes                        | ✔      | `customer-selector.spec.js` → `selected`, `service`, `labels`                                                                                         |
| Server enhancement, client-owned, JS-created and AJAX-inserted demonstrated | ✔      | `<vui-tabs>`, `<vui-modal>`, `core-runtime.spec.js`, `fragments.spec.js`, and all four modes on the demo page                                         |
| Local updates are incremental by default                                    | ✔      | `performance.spec.js` → “repeated local state updates touch one node”: after 1,000 updates the output node is the same object, so nothing was rebuilt |
| AJAX fragment insertion does not execute scripts                            | ✔      | `fragments.spec.js` → “scripts in a fragment are removed and never execute”, “inline event handler attributes are stripped”                           |

## Events

| Criterion                                                | Status | Evidence                                                                                                    |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Component changes use native CustomEvents                | ✔      | `core-runtime.spec.js` → “emit() bubbles, crosses shadow boundaries…”                                       |
| Public event names/detail shapes documented and tested   | ✔      | `docs/components/*.md`; per-component specs                                                                 |
| Bubbling behaviour tested                                | ✔      | `core-runtime.spec.js` → “an ancestor consumes a descendant event…”                                         |
| At least one cancelable pre-event demonstrated           | ✔      | `modal.spec.js` → “preventing modal:before-close keeps the dialog open”                                     |
| EventTarget bus demonstrated for a genuine non-DOM event | ✔      | `EventBus.test.js`; `core-runtime.spec.js` → “EventBus subscriptions honour the component lifecycle signal” |
| Reusable components do not depend on global callbacks    | ✔      | `npm run arch:check` forbids dynamic global lookup (`window[…]`) anywhere in `resources/js`                 |

## HTTP and CI4

| Criterion                                                     | Status | Evidence                                                                                          |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Shared HttpClient policy exists                               | ✔      | `HttpClient.test.js` (28 tests)                                                                   |
| AJAX header reaches CI4                                       | ✔      | `ci4.spec.js` → “X-Requested-With is sent on every request”                                       |
| JSON and HTML/text are explicit response modes                | ✔      | `HttpClient.test.js`; `ci4.spec.js` → “HTML fragments”                                            |
| HTTP errors, network failures and aborts distinguishable      | ✔      | `HttpClient.test.js` → “HttpClient failure taxonomy” (7 tests)                                    |
| Request cancellation works                                    | ✔      | `customer-selector.spec.js` → “aborts superseded requests and never renders a stale result”       |
| CI4 CSRF contract works, including rotation                   | ✔      | `ci4.spec.js` → “consecutive unsafe requests survive token rotation”, “a stale token is rejected” |
| Request ID retained when supplied                             | ✔      | `ci4.spec.js` → “the response request id is retained on HttpError”                                |
| Transport layer does not display UI                           | ✔      | `npm run arch:check` forbids DOM creation and mutation APIs in `core/Http*`                       |
| Live CI4 tests cover JSON, fragment and protected write flows | ✔      | `ci4.spec.js` (26 tests) plus `accessibility.spec.js` (7 tests)                                   |

## Security

| Criterion                                   | Status | Evidence                                                                                                                                                                                                  |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS-focused dynamic text tests pass         | ✔      | `customer-selector.spec.js` → hostile names; `ci4.spec.js` → hostile database row end to end                                                                                                              |
| No `eval`/`new Function` path exists        | ✔      | ESLint `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`; `npm run arch:check` re-checks the shipped source; `ActionRegistry.test.js` → “no string reaches a function that was not registered” |
| Client UI is never treated as authorization | ✔      | `ci4.spec.js` → “a forbidden action stays forbidden however the UI is manipulated”                                                                                                                        |
| No secrets exposed in boot configuration    | ◑      | Boot config carries base URL, locale and the CSRF token only                                                                                                                                              |
| Architecture compatible with strict CSP     | ✔      | The demo serves `script-src 'self'` with no `unsafe-inline`/`unsafe-eval`; `ci4.spec.js` → “content security policy” drives components under it and asserts zero `securitypolicyviolation` events         |

## Accessibility

| Criterion                                   | Status | Evidence                                                                                                                                                                      |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabs and modal keyboard tests pass          | ✔      | `tabs.spec.js` (arrow/Home/End, manual activation, mirrored arrows under `dir="rtl"`), `modal.spec.js` (Escape, focus trap)                                                   |
| Modal focus behaviour documented and tested | ✔      | `docs/components/vui-modal.md`; `modal.spec.js` → focus into dialog and back to invoker                                                                                       |
| Loading/disabled state accessible           | ✔      | `customer-selector.spec.js` → `aria-busy` and the `role="status"` live region; `counter.spec.js` → native `disabled`                                                          |
| Native semantics preferred                  | ◑      | `<button>`, `<output>`, `<dialog>`, `<input>` throughout; ARIA only where the pattern requires it. Partly mechanised: `accessibility.spec.js` audits every component with axe |

## Quality

| Criterion                                   | Status | Evidence                                                                    |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Unit tests pass                             | ✔      | 77 tests                                                                    |
| Real-browser lifecycle/event tests pass     | ✔      | 507 tests across Chromium, Firefox and WebKit                               |
| CI4 integration tests pass                  | ✔      | 33 tests                                                                    |
| Lint/build pass                             | ✔      | `npm run lint`, `npm run build`                                             |
| Public APIs documented                      | ✔      | `docs/core-api.md`, `docs/components/*.md`, JSDoc on every public member    |
| Production runtime dependency list is empty | ✔      | `npm run deps:check`                                                        |
| Core reviewable end to end                  | ✔      | `npm run size`: 707 code lines, within the specification's 500–1,500 target |

## Phase 9 — hardening

`docs/16-implementation-plan.md` sets a separate exit gate for hardening: no
high-severity security or accessibility defect, no reconnect or resource leak
under stress, and a core that stays deliberately small.

| Check                                       | Status | Evidence                                                                                                                                                              |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-engine behaviour                      | ✔      | The browser suite runs on Chromium, Firefox and WebKit. One assertion was found to be Chromium-shaped and was corrected — see the note below.                         |
| No listener growth under stress             | ✔      | `performance.spec.js` → 500 connect/disconnect cycles, after which one click still runs exactly one handler                                                           |
| Connection cost scales linearly             | ✔      | `performance.spec.js` → 100 vs 1,000 components, asserting the scaling factor rather than an absolute time                                                            |
| Delegation cost is independent of list size | ✔      | `performance.spec.js` → a 1,000-row list served by one listener; the last row costs the same as the first                                                             |
| Incremental updates preserve nodes          | ✔      | `performance.spec.js` → 1,000 updates leave the output node object identical                                                                                          |
| Fragment insertion cost                     | ✔      | `performance.spec.js` → 200 components upgraded in one synchronous insertion                                                                                          |
| Core size budget                            | ✔      | `npm run size`                                                                                                                                                        |
| Strict CSP                                  | ✔      | `ci4.spec.js` → “content security policy”                                                                                                                             |
| Keyboard and focus                          | ✔      | `tabs.spec.js`, `modal.spec.js`, `customer-selector.spec.js`                                                                                                          |
| Automated a11y audit (axe)                  | —      | Not run. `docs/12-accessibility.md` requires explicit keyboard and focus tests, which exist; an axe pass would additionally cover contrast and labelling in the demo. |

Benchmarks are regression indicators, not browser guarantees. They lean on
structural assertions — handler counts, node identity, scaling ratios — because
wall-clock timing on a shared CI runner is not a stable signal. Time budgets are
generous by roughly an order of magnitude, so a budget is tripped by an
architectural mistake, not a busy afternoon.

### Two defects a clean audit missed

Introducing axe produced zero violations across every component and every page
state. Two real defects were present at that moment:

1. **The modal's `<dialog>` was anonymous.** `aria-label` on `<vui-modal>` names
   a host with a generic role, while the dialog role sits on the internal
   `<dialog>`. axe's `aria-dialog-name` rule matches `[role="dialog"]`; a native
   `<dialog>` has only an implicit role, so the rule never looked at it. The
   component now forwards the host's ARIA to the dialog.

2. **The combobox was named by its placeholder.** `<label for="customer-search">`
   pointing at a custom element is inert — `label.control` is `null` — so the
   only name the input had was its placeholder, which axe accepts as a
   last-resort name. The component now resolves a name through four documented
   routes and leaves the field unnamed rather than falling back to the
   placeholder.

The suite now asserts computed accessible names directly, by role _and_ name.
This is the concrete case for docs/12-accessibility.md's rule that automated
tooling is useful but not sufficient: a green audit was not evidence of an
accessible component.

### A Chromium-shaped assertion, corrected

The modal's focus test originally asserted that `document.activeElement` is
always inside the dialog while tabbing. That passes in Chromium and fails in
WebKit — not because focus escapes, but because WebKit reports `document.body`
at the wrap point and, by default, cycles only text inputs rather than buttons.

The contract that actually matters is that **no background control can be
reached**, so the test now asserts that instead. This is the concrete argument
for ADR-010: a single-engine suite had encoded one browser's representation as
if it were the specification.

## Deviations and judgement calls

1. **`ActionRegistry` was implemented although Phase 8 says “only if a concrete
   application requirement exists.”** No such requirement exists in this
   codebase. It is implemented because `docs/03-core-api.md` specifies its API
   and `docs/10-security.md` requires a security test for it — but it is
   excluded from the main entry point, unused by every reference component and
   by the demo, and removable without affecting anything else. Delete
   `resources/js/core/ActionRegistry.js` and its test and nothing breaks.

2. **`NetworkError` and `TimeoutError` extend the specified error surface.**
   `docs/03-core-api.md` requires only `HttpError`, but docs 08 and 19 require
   abort, timeout, network failure and HTTP errors to stay distinguishable, and
   that is not expressible with one error type plus native `TypeError`.

3. **`Component#bindActions` is a core helper.** Phase 3 permits one “only if
   repetition justifies it”. Three of the four reference components delegate
   `data-action`, and each needs the same nested-custom-element ownership guard,
   which is the part that is easy to get wrong.

4. **`<vui-modal>` exposes `isOpen` rather than `open` for state.** The
   specification asks for explicit `open()`/`close()` methods, and a class
   cannot have both a method and a getter named `open`. The `open` _attribute_
   still reflects state and is the documented styling hook.
