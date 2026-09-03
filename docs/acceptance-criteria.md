# Acceptance criteria — status

Every criterion from `vayes-ui-core-spec-pack/docs/17-acceptance-criteria.md`,
with the code and the test that backs it.

Legend: **✔** met and covered by an automated test · **◑** met, verified by
review rather than a test.

## Architecture

| Criterion                                                 | Status | Evidence                                                                                          |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Zero runtime frontend framework dependencies              | ✔      | `scripts/check-runtime-deps.mjs` (empty `dependencies`, no non-relative import in `resources/js`) |
| Custom Elements are the reusable markup primitive         | ✔      | `resources/js/core/register.js`; every component in `resources/js/components`                     |
| No virtual DOM, reactive graph, hooks or compiler syntax  | ◑      | Core is 704 code lines across 9 files; `npm run size` reports it                                  |
| Light DOM is default                                      | ✔      | No `attachShadow` anywhere; `tests/browser/*.spec.js` query component descendants directly        |
| CI4 authoritative for rules, authorization and validation | ✔      | `tests/integration/ci4.spec.js` → “server-authoritative validation”, “authorisation”              |
| Core runtime is application-agnostic                      | ◑      | `resources/js/core` imports nothing from `components/`, `services/` or `ci4/`                     |

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

| Criterion                                                                   | Status | Evidence                                                                                                                      |
| --------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Public attributes/properties/defaults documented                            | ✔      | `docs/components/*.md`                                                                                                        |
| HTML boolean semantics respected                                            | ✔      | `counter.spec.js` → “`disabled="false"` is still disabled”                                                                    |
| Rich data uses properties, not serialized attributes                        | ✔      | `customer-selector.spec.js` → `selected`, `service`, `labels`                                                                 |
| Server enhancement, client-owned, JS-created and AJAX-inserted demonstrated | ✔      | `<vui-tabs>`, `<vui-modal>`, `core-runtime.spec.js`, `fragments.spec.js`, and all four modes on the demo page                 |
| Local updates are incremental by default                                    | ◑      | `Counter#setValue` touches one `<output>`; `Tabs` writes attributes only; no component rebuilds its subtree on a state change |
| AJAX fragment insertion does not execute scripts                            | ✔      | `fragments.spec.js` → “scripts in a fragment are removed and never execute”, “inline event handler attributes are stripped”   |

## Events

| Criterion                                                | Status | Evidence                                                                                                    |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Component changes use native CustomEvents                | ✔      | `core-runtime.spec.js` → “emit() bubbles, crosses shadow boundaries…”                                       |
| Public event names/detail shapes documented and tested   | ✔      | `docs/components/*.md`; per-component specs                                                                 |
| Bubbling behaviour tested                                | ✔      | `core-runtime.spec.js` → “an ancestor consumes a descendant event…”                                         |
| At least one cancelable pre-event demonstrated           | ✔      | `modal.spec.js` → “preventing modal:before-close keeps the dialog open”                                     |
| EventTarget bus demonstrated for a genuine non-DOM event | ✔      | `EventBus.test.js`; `core-runtime.spec.js` → “EventBus subscriptions honour the component lifecycle signal” |
| Reusable components do not depend on global callbacks    | ◑      | No component reads `window`; the demo subscribes with `addEventListener` in `resources/js/demo.js`          |

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
| Transport layer does not display UI                           | ◑      | `HttpClient.js` imports nothing but `HttpError.js`; the dependency gate would fail otherwise      |
| Live CI4 tests cover JSON, fragment and protected write flows | ✔      | `ci4.spec.js` (24 tests)                                                                          |

## Security

| Criterion                                   | Status | Evidence                                                                                                                                               |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| XSS-focused dynamic text tests pass         | ✔      | `customer-selector.spec.js` → hostile names; `ci4.spec.js` → hostile database row end to end                                                           |
| No `eval`/`new Function` path exists        | ✔      | ESLint `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`; `ActionRegistry.test.js` → “no string reaches a function that was not registered” |
| Client UI is never treated as authorization | ✔      | `ci4.spec.js` → “a forbidden action stays forbidden however the UI is manipulated”                                                                     |
| No secrets exposed in boot configuration    | ◑      | Boot config carries base URL, locale and the CSRF token only                                                                                           |
| Architecture compatible with strict CSP     | ◑      | External module scripts only; no inline executable script; boot data in a `application/json` block                                                     |

## Accessibility

| Criterion                                   | Status | Evidence                                                                                                             |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Tabs and modal keyboard tests pass          | ✔      | `tabs.spec.js` (arrow/Home/End, manual activation), `modal.spec.js` (Escape, focus trap)                             |
| Modal focus behaviour documented and tested | ✔      | `docs/components/vui-modal.md`; `modal.spec.js` → focus into dialog and back to invoker                              |
| Loading/disabled state accessible           | ✔      | `customer-selector.spec.js` → `aria-busy` and the `role="status"` live region; `counter.spec.js` → native `disabled` |
| Native semantics preferred                  | ◑      | `<button>`, `<output>`, `<dialog>`, `<input>` throughout; ARIA only where the pattern requires it                    |

## Quality

| Criterion                                   | Status | Evidence                                                                    |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Unit tests pass                             | ✔      | 75 tests                                                                    |
| Real-browser lifecycle/event tests pass     | ✔      | 96 tests                                                                    |
| CI4 integration tests pass                  | ✔      | 24 tests                                                                    |
| Lint/build pass                             | ✔      | `npm run lint`, `npm run build`                                             |
| Public APIs documented                      | ✔      | `docs/core-api.md`, `docs/components/*.md`, JSDoc on every public member    |
| Production runtime dependency list is empty | ✔      | `npm run deps:check`                                                        |
| Core reviewable end to end                  | ✔      | `npm run size`: 704 code lines, within the specification's 500–1,500 target |

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
