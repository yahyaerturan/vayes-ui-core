# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Component tag names, public methods, attributes, properties and emitted event
contracts are all versioned API (docs/18-maintenance-versioning.md).

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
