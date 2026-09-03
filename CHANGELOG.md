# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Component tag names, public methods, attributes, properties and emitted event
contracts are all versioned API (docs/18-maintenance-versioning.md).

## [1.3.0] — 2026-09-04

### Added

- `docs/installation.md` — three install routes (copy, package manager,
  submodule) with the CodeIgniter wiring, a four-step verification checklist and
  a symptom table. Copying works because every shipped import is relative, which
  `deps:check` enforces.
- `docs/authoring-components.md` rewritten as a numbered procedure: decide the
  ownership mode, write the contract, register the prefix, implement, test,
  document — followed by the six rules that catch people out and the test
  matrix.
- `examples/component-template/` — `<app-character-counter>`, a **working**
  component to copy and rename rather than an abstract skeleton, annotated step
  by step, with `tests/browser/example-template.spec.js` as the worked example of
  the test matrix.
- `docs/ai-prompts.md` — prompt templates for building components with a coding
  agent: a new component, a complex async component, converting existing code,
  reviewing, debugging, and adding a kit pattern. Includes a table of the
  mistakes agents specifically make in this architecture and how to pre-empt
  them.

### Fixed

- `<kit-confirm-dialog>` appended a second `<dialog>` on every reconnect.
  `render()` checked a cached reference that `unmount()` had cleared, so it no
  longer recognised the element it built last time. It now recovers the element
  by querying the DOM, and a test counts them after two reconnect cycles.

  The same bug appeared in the first draft of the component template and was
  caught by its own test, which is why "recover previous output by querying the
  DOM" is now stated as rule one for authors and for agents.

## [1.2.1] — 2026-09-03

### Fixed

- **Dialog text was unreadable in dark mode** (reported). The title and labels
  inside `<vui-modal>` rendered black on a dark panel. A `<dialog>` does not
  inherit text colour from the page: the user-agent stylesheet sets
  `dialog { color: CanvasText }`, which is a real declaration and breaks
  inheritance, and `CanvasText` stays black while `color-scheme` is light. Fixed
  by declaring `color-scheme` on the root — which also corrects native form
  controls and scrollbars — and by stating the colour explicitly on both
  dialogs.

### Changed

- The showcase accessibility audit is now an enumerated table of every overlay
  state crossed with both themes, replacing hand-written cases. The bug above
  escaped because the audit opened the dropdown, the confirm dialog and a toast,
  but never the invite modal — a missing case rather than a missing assertion. A
  test also asserts the mechanism directly, so a regression names its own cause.
  Both were verified by reintroducing the bug from source and confirming they
  fail.

## [1.2.0] — 2026-09-03

### Added

A curated Tailwind admin kit in `examples/dashboard/` — a runnable showcase,
copy-paste patterns, and five behaviour components. It is example code: nothing
is exported from the package or covered by semver, which keeps the library free
of design-system opinions as docs/21-styling.md requires.

- Patterns (markup and classes only): page header, stat tiles, cards, badges,
  empty state, table shell, form fields.
- Components: `kit-dropdown`, `kit-toast-host`, `kit-confirm-dialog`,
  `kit-async-button`, `kit-sortable-table`.
- Tailwind CSS 4 built with the CLI (`npm run kit:css`) into a committed
  stylesheet, so the showcase opens on a fresh clone with no build step.
- `tests/browser/kit.spec.js` — 26 tests covering keyboard behaviour, ARIA
  state, promise resolution, timer cleanup, XSS-sensitive rendering and an axe
  audit in both light and dark themes.

No component contains a Tailwind class. Components toggle semantic state and
styling lives in markup and `kit.css`, which keeps them usable under any CSS and
means no class name is ever constructed in JavaScript, where Tailwind's
build-time scan would miss it.

### Fixed

Writing the kit's tests found five bugs, all in the new example code:

- Escape did not close a dropdown opened by mouse, because Safari does not focus
  a button on click and the handler was scoped to the component. Escape is now
  handled at the document and always returns focus to the trigger, while an
  outside click or Tab away deliberately does not.
- A toast left frozen on screen after its host was removed and reconnected.
  Toasts are transient and are now discarded with their timers.
- A native `<dialog>` pinned itself to the top left under Tailwind, whose
  preflight resets the `margin: auto` that centres a modal dialog.
- Four colour-contrast failures, two in each theme.
- `dark:` had no effect from a class, because Tailwind v4 follows
  `prefers-color-scheme` until `@custom-variant dark` is declared.

## [1.1.1] — 2026-09-03

### Documentation

Full documentation set, covering adoption in an application that already exists:

- `docs/README.md` — index, organised by what you are trying to do.
- `docs/concepts.md` — the mental model in six ideas, each paired with the habit
  it replaces.
- `docs/getting-started.md` — a worked component with tests, in about ten
  minutes.
- `docs/existing-project.md` — adopting this incrementally in an existing
  CodeIgniter application: how to obtain the code, how to serve it with or
  without a bundler, boot configuration, making CSRF work, prefix policy,
  converting the first widget, coexisting with the JavaScript already there, and
  a migration order.
- `docs/authoring-components.md` — writing a component start to finish, with the
  full test matrix.
- `docs/recipes.md` — fragment refresh, JSON form submission with server
  validation, self-cancelling search, confirm-before-close, component
  communication, accessible naming, loading state, scoped translations.
- `docs/troubleshooting.md` — symptom, cause and fix for the failure modes that
  actually occur.

The tutorial's example is executable: it lives in `examples/toggle/Toggle.js`
and `tests/browser/example-toggle.spec.js` and runs as part of the suite, and a
unit test compares the guide's code against those files so the two cannot drift.

## [1.1.0] — 2026-09-03

### Added

- An accessibility audit layer: axe over every component in isolation, and over
  the live demo page in five states, backed by direct assertions on computed
  accessible names.
- `<vui-modal>` observes `aria-label` and `aria-labelledby` and forwards them to
  the internal `<dialog>`.
- `<vui-customer-selector>` observes `aria-label` and `aria-labelledby`, resolves
  a `<label for="{host id}">` written against the host, gives its internal input
  the stable id `{host id}-input`, and names the results listbox.

### Fixed

- **The modal's `<dialog>` had no accessible name.** `aria-label` written on
  `<vui-modal>` landed on a host with a generic role while the dialog role sat on
  the internal `<dialog>`, so assistive technology announced an unnamed dialog.
- **The combobox was named by its placeholder.** A `<label for>` pointing at a
  custom element is inert, leaving the placeholder as the only accessible name —
  a name that disappears as soon as the user types.

Neither defect was reported by axe: its `aria-dialog-name` rule matches
`[role="dialog"]` and does not examine a native `<dialog>`, and it accepts a
placeholder as a last-resort accessible name. Both are now covered by direct
role-and-name assertions.

## [1.0.0] — 2026-09-03

First stable release. Every criterion in
`vayes-ui-core-spec-pack/docs/17-acceptance-criteria.md` is met; the four that
remain verified by review rather than by an automated test are named, with the
reason, in `docs/acceptance-criteria.md`.

### Added

**Core runtime**

- `Component`: idempotent connect/disconnect, mount-scoped `AbortSignal`,
  `mount`/`unmount`/`render`/`bindEvents` extension points, `emit`, `find`,
  `findAll`, `upgradeProperty`, and delegated `data-action` handling through
  `bindActions`/`handleAction` with custom-element boundary ownership.
- `EventBus` with `emit`/`on`/`once`, an unsubscribe return value and
  `AbortSignal` support, plus a shared `events` instance.
- `HttpClient` over `fetch`: AJAX header, same-origin credentials, explicit body
  policy, `URLSearchParams` query building, composable abort and timeout,
  pluggable CSRF provider, correlation-id capture and an optional observer hook.
- Error taxonomy keeping cancellation, timeout, network failure and HTTP status
  errors distinguishable: `HttpError`, `NetworkError`, `TimeoutError`,
  `isAbortError`.
- `parseFragment`/`replaceFragment`/`appendFragment`, which strip `<script>`
  elements and inline handler attributes before adoption.
- `define()` with idempotent registration, custom-element name validation and a
  configurable project prefix policy.
- Optional, side-effect-free `diagnostics` module with header redaction.
- Optional `ActionRegistry` (exact-key only), excluded from the default entry
  point.

**CodeIgniter 4 adapter**

- `readBootConfig()` reading `<meta>` tags and a non-executable JSON block.
- `CodeIgniterCsrfProvider` with header and body-field strategies and token
  rotation from a response header or cookie.
- `createCodeIgniterClient()`.

**Reference components**

- `<vui-counter>`, `<vui-tabs>`, `<vui-modal>`, `<vui-customer-selector>`.

**Application layer**

- `CustomerService` demonstrating the component → service → transport direction.

**Tooling and tests**

- 75 unit tests, 293 real-browser tests across Chromium, Firefox and WebKit, and
  26 live CodeIgniter integration tests, the last of which run under a strict
  Content-Security-Policy.
- Reference performance benchmarks from the specification: connection scaling,
  reconnect cycles under stress, delegated large lists, repeated local updates
  and fragment insertion. They assert structural invariants — handler counts,
  node identity, scaling ratios — rather than wall-clock times.
- An architecture gate (`npm run arch:check`) enforcing layer import direction,
  the absence of DOM access in the transport layer, the ban on dynamic global
  lookup and on `attachShadow` in the core, and a `// safe-html: <reason>`
  annotation on every HTML sink.
- ESLint with rules banning `eval` and implied eval, Prettier, a Vite build, a
  bundle-size and line-count budget, and a dependency-policy gate that fails on
  any production dependency or non-relative import in shipped source.
- A CodeIgniter 4.7 demo application backed by SQLite.

### Notes

- Runtime dependencies: **none**.
- Browser support is Chrome/Edge 116+, Firefox 124+, Safari 17.4+. The floor is
  set by a single `AbortSignal.any()` call in `HttpClient`; an earlier draft
  claimed Firefox 121+ and Safari 17+, which was wrong.
- Adding Firefox and WebKit to the suite found one Chromium-shaped assertion:
  the modal focus test asserted that `document.activeElement` stays inside the
  dialog, which WebKit contradicts without focus ever escaping. It now asserts
  the real contract — that no background control can be reached.
