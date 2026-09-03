# 17 — Stable Release Acceptance Criteria

## Architecture

- [ ] Zero runtime frontend framework dependencies.
- [ ] Custom Elements are the reusable markup component primitive.
- [ ] No virtual DOM, reactive graph, hooks or compiler syntax.
- [ ] Light DOM is default.
- [ ] CI4 remains authoritative for business rules, authorization and canonical validation.
- [ ] Core runtime is application-agnostic.

## Lifecycle

- [ ] Element present before class definition upgrades correctly.
- [ ] Element inserted after definition works.
- [ ] Disconnect/reconnect works.
- [ ] Reconnect does not duplicate listeners/subscriptions.
- [ ] Lifecycle-owned resources are cleaned.
- [ ] Public rich properties work when assigned before custom-element definition.

## Configuration/rendering

- [ ] Public attributes/properties/defaults are documented.
- [ ] HTML boolean semantics are respected.
- [ ] Rich data uses properties instead of giant serialized attributes.
- [ ] Server enhancement, client-owned, JS-created and AJAX-inserted components are demonstrated.
- [ ] Local updates are incremental by default.
- [ ] AJAX fragment insertion does not execute scripts.

## Events

- [ ] Component changes use native CustomEvents.
- [ ] Public event names/detail shapes are documented/tested.
- [ ] Bubbling behavior is tested.
- [ ] At least one cancelable pre-event is demonstrated.
- [ ] EventTarget-based global bus is demonstrated for a genuine non-DOM event.
- [ ] Reusable components do not depend on global callback functions.

## HTTP/CI4

- [ ] Shared HttpClient policy exists.
- [ ] AJAX header reaches CI4.
- [ ] JSON and HTML/text are explicit response modes.
- [ ] HTTP errors, network failures and aborts are distinguishable.
- [ ] Request cancellation works.
- [ ] CI4 CSRF contract works, including token rotation policy if configured.
- [ ] Request ID is retained when supplied.
- [ ] Transport layer does not display UI.
- [ ] Live CI4 tests cover JSON, HTML fragment and protected write flows.

## Security

- [ ] XSS-focused dynamic text tests pass.
- [ ] No `eval`/`new Function` path exists.
- [ ] Client UI is never treated as authorization.
- [ ] No secrets are exposed in boot configuration.
- [ ] Architecture is compatible with strict CSP.

## Accessibility

- [ ] Tabs and modal keyboard tests pass.
- [ ] Modal focus behavior is documented/tested.
- [ ] Loading/disabled state is accessible.
- [ ] Native semantics are preferred.

## Quality

- [ ] Unit tests pass.
- [ ] Real-browser lifecycle/event tests pass.
- [ ] CI4 integration tests pass.
- [ ] Lint/build pass.
- [ ] Public APIs are documented.
- [ ] Production runtime dependency list is empty.
- [ ] Core can be reviewed end-to-end without navigating a meta-framework.
