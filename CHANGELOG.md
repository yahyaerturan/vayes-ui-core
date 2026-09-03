# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Component tag names, public methods, attributes, properties and emitted event
contracts are all versioned API (docs/18-maintenance-versioning.md).

## [0.1.0] — Unreleased

First implementation of the Vayes UI Core specification.

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

- 75 unit tests, 96 real-browser tests and 26 live CodeIgniter integration tests,
  the last of which run under a strict Content-Security-Policy.
- ESLint with rules banning `eval` and implied eval, Prettier, a Vite build, a
  bundle-size and line-count budget, and a dependency-policy gate that fails on
  any production dependency or non-relative import in shipped source.
- A CodeIgniter 4.7 demo application backed by SQLite.

### Notes

- Runtime dependencies: **none**.
