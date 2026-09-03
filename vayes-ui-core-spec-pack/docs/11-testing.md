# 11 — Testing Strategy

## Testing philosophy

The runtime is small enough that tests should be exhaustive around lifecycle, event and transport semantics. Do not compensate for weak architecture with huge snapshot suites.

## Test layers

### 1. Pure unit tests

Suitable for:

- parsers;
- small helpers;
- EventBus semantics that do not require DOM;
- HttpError construction;
- URL/query building;
- ActionRegistry;
- CSRF provider policy.

A lightweight Node test environment is acceptable.

### 2. Real-browser component tests

Required for:

- Custom Element upgrade;
- `connectedCallback` / `disconnectedCallback`;
- reconnect;
- event bubbling/composed behavior;
- property upgrade before definition;
- focus/keyboard behavior;
- dynamic insertion;
- native form behavior;
- Shadow DOM components if any.

Use a real browser automation tool such as Playwright. Do not rely exclusively on jsdom-like environments for browser lifecycle correctness.

### 3. CI4 integration tests

Required for:

- HTML fragment endpoints;
- JSON endpoints;
- CSRF sequence;
- validation errors;
- authentication/session behavior;
- request IDs;
- localized responses;
- actual browser + CI4 interactions for reference flows.

Where database state is required, use a dedicated test database. For the sample/reference CI4 application, SQLite is preferred for deterministic isolation unless a DB-specific feature is under test.

### 4. Static quality checks

Recommended:

- ESLint;
- formatting check;
- JSDoc/type checking if configured;
- dependency/license audit for dev tools;
- PHP CodeSniffer/PHPStan/PHPUnit for CI4 adapter/demo as appropriate to the host project.

## Required Component test matrix

Every reusable component must consider this matrix:

| Scenario | Required? |
|---|---|
| Definition before element exists | Yes |
| Element exists before definition | Yes |
| Connect | Yes |
| Disconnect | Yes |
| Reconnect | Yes |
| No duplicate listener after reconnect | Yes |
| Attribute default | Yes |
| Attribute change while mounted | If observed |
| Rich property assignment | If exposed |
| Property set before upgrade | If exposed |
| User event produces expected DOM update | Yes |
| Public event name/detail | If emitted |
| Event bubbles | If contract says so |
| Keyboard support | Interactive components |
| Disabled state | If supported |
| Loading state | Async components |
| Request abort/stale response | Search/async components |
| Error state | Async components |
| Dynamic insertion via fragment | Yes for representative components |
| XSS-sensitive text | Components render dynamic text |

## Lifecycle leak test

A browser test should instrument a component or use counters:

1. append component;
2. trigger one event, observe one handler execution;
3. remove component;
4. reappend component;
5. trigger one event;
6. still observe exactly one handler execution.

For global listeners/observers, verify removal/abort after disconnect.

## Property upgrade test

1. create unknown element by tag;
2. assign public property;
3. append element;
4. define/import custom element;
5. assert accessor receives value and UI reflects it.

## AJAX insertion test

1. fetch or simulate server HTML fragment;
2. insert fragment into DOM;
3. assert contained Custom Elements become upgraded;
4. interact without any explicit `init()` scan.

## HTTP tests

Cover:

- success response;
- JSON parsing;
- HTML/text parsing;
- 400 validation body;
- 401/403/404/409/422/500 as project uses them;
- network failure;
- abort;
- timeout;
- `X-Requested-With` header;
- content type behavior;
- CSRF adapter;
- request ID capture.

## Accessibility tests

Automated accessibility tooling is useful but not sufficient. Add explicit keyboard/focus tests for interactive components.

## Snapshot policy

Avoid broad HTML snapshots that make harmless markup changes painful. Prefer behavioral assertions and focused DOM assertions.

## Coverage

Do not optimize for an arbitrary percentage. All public core branches and contracts should be covered. Untested public behavior is considered unfinished.
