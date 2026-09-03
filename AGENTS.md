# Working in this repository

The authoritative specification lives in `vayes-ui-core-spec-pack/`. Read
`vayes-ui-core-spec-pack/AGENTS.md` before changing anything in
`resources/js/`. This file only summarises what is enforced mechanically and
where things live.

## Layout

| Path                       | Contents                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `resources/js/core/`       | The runtime. Application-agnostic; imports nothing outside itself. |
| `resources/js/ci4/`        | CodeIgniter adapter: boot config, CSRF provider.                   |
| `resources/js/components/` | Reference components.                                              |
| `resources/js/services/`   | Application services between components and transport.             |
| `ci4/`                     | Demo CodeIgniter 4 application and integration-test host.          |
| `tests/unit/`              | Node test runner: pure logic only.                                 |
| `tests/browser/`           | Playwright + Chromium: everything DOM-shaped.                      |
| `tests/integration/`       | Playwright + live CodeIgniter.                                     |
| `docs/`                    | Public API reference and per-component specifications.             |

Dependency direction is one-way and must stay that way:

```
component → service → HttpClient → CI4 endpoint
component → core
```

Never `core → component`, and never `HttpClient → any UI`.

## Enforced automatically

| Gate              | Command              | Fails on                                                                                      |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Dependency policy | `npm run deps:check` | Any production dependency, or any non-relative import in `resources/js`                       |
| Lint              | `npm run lint`       | `eval`, implied eval, `new Function`, `javascript:` URLs, undeclared globals, unused bindings |
| Size budget       | `npm run size`       | Core over 60 KB; reports code-line count against the 500–1,500 target                         |
| Tests             | `npm test`           | All three layers                                                                              |

## Forbidden without an accepted ADR

React/Vue/Svelte/Alpine/HTMX/Stimulus, virtual DOM, JSX, reactive proxies or
signals, hooks, a global state store in core, two-way binding, `eval` or any
string-to-code path, DOM initialisation scanners, Shadow DOM by default, a
client router, a frontend DI container, runtime npm dependencies, and silently
swallowed errors.

If an implementation seems to require one of these: stop, and propose an ADR
describing alternatives, trade-offs and compatibility impact. Do not implement
first.

## Rules that catch people out

1. **`connectedCallback` can run many times.** Never assume once. Bind listeners
   with `{ signal: this.signal }`; a fresh signal exists per mount cycle.
2. **`render()` runs again on reconnect.** It must detect its own previous
   output rather than rebuilding.
3. **Properties may be assigned before the class is defined.** Declare public
   accessors in `static properties`.
4. **Untrusted data never touches `innerHTML`.** Use `textContent` and
   properties. Static component templates may use template literals only when
   nothing is interpolated.
5. **A cancelled request is not an error.** Check `isAbortError()` before
   rendering a failure state.
6. **Adding a public API needs two call sites.** Prefer a private helper until
   then.

## Definition of done for a component

`docs/components/` contains one specification per component; follow
`vayes-ui-core-spec-pack/COMPONENT_SPEC_TEMPLATE.md` for a new one. A component
is finished when its documented attributes, properties, methods and events all
have tests, including the reconnect, property-before-upgrade, keyboard and
XSS-sensitive cases.
