# Testing guide

Three layers, each testing what only it can test.

| Layer       | Command                    | Runs                          | Covers                                                                                               |
| ----------- | -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit        | `npm run test:unit`        | Node's built-in runner        | Transport policy, error taxonomy, CSRF strategy, action registry, name validation, normalisation     |
| Browser     | `npm run test:browser`     | Playwright + Chromium         | Lifecycle, upgrade, events, delegation, fragments, boot config, components                           |
| Integration | `npm run test:integration` | Playwright + live CodeIgniter | CSRF rotation, validation, authorisation, fragments, correlation ids, end-to-end component behaviour |

`npm test` runs the dependency gate, lint and all three.

## Why the split is not negotiable

`Component.js` cannot even be imported in Node: `HTMLElement` does not exist
there. That is not an inconvenience to work around with a DOM shim — it is
ADR-010 showing up in practice. Upgrade order, reconnect semantics, event
propagation, focus and the top layer are browser behaviours; a simulated DOM
would only test our assumptions back at us.

So the unit layer covers pure logic, and everything DOM-shaped runs in real
Chromium against source loaded as native ES modules — no bundler in between,
so the tested code is the shipped code.

## Browser test conventions

`tests/browser/support/fixtures.js` provides a `page` that:

- starts on a blank fixture and imports modules on demand;
- fails the test on any uncaught page error or console error.

A test that deliberately provokes a programmer error opts in:

```js
test('fails loudly', async ({ page, allowErrors }) => {
  allowErrors(/must reference an existing panel/);
  // …
});
```

Each test gets a fresh page, so custom element registrations never leak between
tests and probe components can use unique tag names.

## Required matrix per component

From docs/22-component-authoring-standard.md. A component is not done until the
applicable rows pass:

definition before/after the element exists · connect · disconnect · reconnect ·
no duplicate listeners · attribute defaults and changes · rich properties ·
property assigned before upgrade · user event → DOM update · public event names
and detail shapes · bubbling · keyboard · disabled · loading · request
abort/stale response · error state · dynamic insertion via a fragment ·
XSS-sensitive text.

## The lifecycle leak test

Every component suite includes the same shape:

1. append the component;
2. trigger one event, observe exactly one handler run;
3. remove it;
4. re-append it;
5. trigger once more;
6. still exactly one handler run.

`tests/browser/core-runtime.spec.js` runs it against the element, `document` and
`window` at once, which is where leaks actually hide.

## Integration state

`scripts/global-setup.mjs` rebuilds the SQLite database before the servers
start, so the suite is independent of whatever a previous run inserted or
archived.

## Snapshots

There are none, deliberately. Broad HTML snapshots make harmless markup changes
painful and prove very little; the suites assert behaviour and focused DOM
state instead.

## Coverage

No percentage target. The rule is that every public contract has a test, and
untested public behaviour is treated as unfinished.
