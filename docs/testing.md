# Testing guide

Three layers, each testing what only it can test.

| Layer       | Command                    | Runs                                      | Covers                                                                                               |
| ----------- | -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit        | `npm run test:unit`        | Node's built-in runner                    | Transport policy, error taxonomy, CSRF strategy, action registry, name validation, normalisation     |
| Browser     | `npm run test:browser`     | Playwright + Chromium, Firefox and WebKit | Lifecycle, upgrade, events, delegation, fragments, boot config, components, performance              |
| Integration | `npm run test:integration` | Playwright + live CodeIgniter             | CSRF rotation, validation, authorisation, fragments, correlation ids, end-to-end component behaviour |

`npm test` runs the dependency gate, the architecture gate, lint and all three
test layers. `npm run test:browser:chromium` runs one engine for fast iteration.

## Why three engines

The library's premise is that browser standards are the platform, so testing one
engine would leave that premise unverified in the other two. This is not
theoretical: the modal's focus test originally asserted that
`document.activeElement` stays inside the dialog while tabbing. That is true in
Chromium and false in WebKit — which reports `document.body` at the wrap point
and by default cycles only text inputs — even though focus never escapes the
dialog in either. A single-engine suite had quietly encoded one browser's
representation as the contract.

The suite now asserts the contract that matters: no background control can be
reached. Engine-specific representations are not assertions.

Integration tests run on one engine, because they test a server contract rather
than engine semantics.

## Performance benchmarks

`tests/browser/performance.spec.js` implements the reference benchmarks from
docs/13-performance.md: connecting 100 vs 1,000 components, 500 reconnect
cycles, a 1,000-row delegated list, 1,000 local state updates, and a fragment
carrying 200 components.

They are regression indicators, not guarantees, and they are built to avoid
being flaky:

- the load-bearing assertions are **structural** — handler counts, node
  identity, mount/unmount ledgers and scaling ratios are deterministic, while
  wall clock on a shared runner is not;
- time budgets are generous by roughly an order of magnitude, so a budget is
  tripped by an architectural mistake (a listener per row, a rerender per
  keystroke), not by a busy afternoon.

They run on Chromium only: they measure our own algorithmic behaviour, which
does not vary by engine.

## The accessibility audit

`tests/browser/accessibility.spec.js` runs axe over each component in isolation,
scoped to the component subtree so that page-level findings (no landmarks, no
`h1`) belong to the host application rather than the library.
`tests/integration/accessibility.spec.js` audits the live demo page in each of
its states: on load, with an AJAX fragment inserted, with the dialog open, with
search results open, and with server validation errors shown.

**The audit alone is not the test.** When axe was first introduced here it
reported zero violations across every component and every page state — while two
real naming defects were present:

- the modal's `<dialog>` had no accessible name. Authors put `aria-label` on
  `<vui-modal>`, but the dialog role lives on the internal `<dialog>`. axe's
  `aria-dialog-name` rule matches `[role="dialog"]`, and a native `<dialog>`
  carries only an implicit role, so the rule never examined it.
- the combobox was named by its `placeholder`, because `<label for>` pointing at
  a custom element is inert. axe accepts a placeholder as a last-resort
  accessible name, so the rule passed on a name that vanishes as the user types.

Both are fixed, and the suite now asserts computed accessible names directly by
querying for a role _and_ its expected name. That is what docs/12-accessibility.md
means by "automated accessibility tooling is useful but not sufficient",
demonstrated rather than quoted.

One trap worth knowing: Playwright matches accessible names by **substring**
unless you pass `exact: true`. A test asserting `name: 'Via aria-label'` will
happily match an element named `Via aria-labelledby`.

## The architecture gate

`npm run arch:check` enforces invariants that were previously true only because
the author wrote them that way:

- layer import direction — core cannot import a component, a service cannot
  import a component, transport cannot import UI;
- no DOM creation or mutation inside `core/Http*`;
- no dynamic global lookup (`window[name]`), which is the ActionRegistry
  prohibition restated as a build failure;
- no `attachShadow` in the core;
- every `innerHTML`/`outerHTML`/`insertAdjacentHTML` write carries a
  `// safe-html: <reason>` annotation.

The last rule deserves a note, because no static check can prove a string is
untrusted — so it does not try. It forces each HTML write to be an annotated
decision a reviewer must justify, which is the achievable guarantee and is worth
more than a rule people remember only sometimes.

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
