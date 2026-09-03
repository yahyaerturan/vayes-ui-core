# Vayes UI Core

A deliberately small frontend component layer for server-rendered CodeIgniter 4
applications.

Native Custom Elements, native DOM events, `AbortController`, `fetch`, ES
modules. **Zero runtime dependencies.** No virtual DOM, no reactivity, no hooks,
no compiler, no client router, no global store.

It is not a React/Vue/Svelte replacement and must never become one. The browser
is the platform; this library standardises only the few patterns the platform
exposes at a lower level than we want to repeat across an application.

## The design promise

Reading the DOM and the source should be enough to answer:

1. which component owns a behaviour;
2. which DOM event caused it;
3. which endpoint was called;
4. which event was emitted afterwards;
5. which subscriber reacted;
6. how the component cleans itself up.

## Install

```bash
npm install
npx playwright install chromium
```

## Quick start

```js
import { Component, define } from '@vayes/ui-core';

class Toggle extends Component {
  render() {
    if (this.querySelector('button')) {
      return;
    }

    this.innerHTML = '<button type="button" data-action="toggle">Off</button>';
  }

  bindEvents() {
    this.bindActions();
  }

  handleAction(action) {
    if (action === 'toggle') {
      const on = this.toggleAttribute('data-on');
      this.find('button').textContent = on ? 'On' : 'Off';
      this.emit('toggle:changed', { on });
    }
  }
}

define('vui-toggle', Toggle);
```

```html
<vui-toggle></vui-toggle>
```

That element works whether it was in the initial HTML, created in JavaScript, or
inserted by an AJAX fragment after the fact — and whether the module loaded
before or after the markup existed. No initialisation pass runs, ever.

## What is in the box

**Core** (~700 lines of code, reviewable in one sitting)

| Module           | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `Component`      | Lifecycle, scoped cancellation, events, delegated actions       |
| `EventBus`       | Application events with no DOM relationship                     |
| `HttpClient`     | Transport policy: headers, CSRF, timeout, abort, error taxonomy |
| `HttpError`      | `HttpError` / `NetworkError` / `TimeoutError` / `isAbortError`  |
| `fragments`      | Safe insertion of server HTML that upgrades custom elements     |
| `register`       | Idempotent `define()` with name and prefix policy               |
| `diagnostics`    | Optional, opt-in request and event logging with redaction       |
| `ActionRegistry` | Optional exact-key registry for server-declared handlers        |

**CodeIgniter adapter** — boot config reader, CSRF provider with token rotation,
`createCodeIgniterClient()`.

**Reference components**

| Element                   | Proves                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `<vui-counter>`           | Local state, incremental updates, delegated actions, reconnect safety           |
| `<vui-tabs>`              | Server-rendered enhancement, keyboard/ARIA, nested isolation                    |
| `<vui-modal>`             | Client-owned markup, cancelable pre-event, native `<dialog>` focus behaviour    |
| `<vui-customer-selector>` | Service injection, stale-request cancellation, async states, XSS-safe rendering |

## Commands

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `npm test`                 | Dependency gate + lint + all three test layers    |
| `npm run test:unit`        | Node test runner                                  |
| `npm run test:browser`     | Playwright, real Chromium                         |
| `npm run test:integration` | Playwright against a live CodeIgniter app         |
| `npm run lint`             | ESLint                                            |
| `npm run build`            | Optional Vite build to `public/build`             |
| `npm run size`             | Core size and line-count budget                   |
| `npm run deps:check`       | Fails if any runtime dependency appears           |
| `npm run ci4:install`      | Prepare the demo app and seed its SQLite database |
| `npm run ci4:serve`        | Serve the demo at <http://127.0.0.1:8081>         |

## Demo application

```bash
composer create-project codeigniter4/appstarter ci4   # first time only
npm run ci4:install
npm run ci4:serve
```

`ci4/` is a working CodeIgniter 4.7 application demonstrating server-rendered
enhancement, a JSON-driven component, an AJAX fragment containing custom
elements, a CSRF-protected write with token rotation, server-authoritative
validation, an authorisation check, correlation ids, and cross-component events.

It serves a strict Content-Security-Policy — `script-src 'self'`, no
`unsafe-inline`, no `unsafe-eval` — and the integration suite asserts the
components still work under it with zero policy violations.

## Documentation

Start at [docs/README.md](docs/README.md), or jump straight to what you need:

| Document                                                     | Read it when                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [docs/concepts.md](docs/concepts.md)                         | You want the mental model first — six ideas, and what each replaces         |
| [docs/getting-started.md](docs/getting-started.md)           | You want a working, tested component in about ten minutes                   |
| [docs/existing-project.md](docs/existing-project.md)         | **You already have a CodeIgniter app** and want to adopt this incrementally |
| [docs/authoring-components.md](docs/authoring-components.md) | You are writing your own component, start to finish                         |
| [docs/recipes.md](docs/recipes.md)                           | You have a specific task: a form, a filtered list, a confirm dialog         |
| [docs/troubleshooting.md](docs/troubleshooting.md)           | Something does not work                                                     |
| [docs/core-api.md](docs/core-api.md)                         | You need an exact signature, option or event contract                       |
| [docs/ci4-integration.md](docs/ci4-integration.md)           | You are wiring boot config, CSRF, fragments or validation                   |
| [docs/components/](docs/components/)                         | One full specification per reference component                              |
| [docs/testing.md](docs/testing.md)                           | Test layers, and why three browser engines                                  |
| [docs/acceptance-criteria.md](docs/acceptance-criteria.md)   | Every specification criterion mapped to its test                            |
| `vayes-ui-core-spec-pack/`                                   | The authoritative architecture specification and ADRs                       |

## Browser support

Chrome/Edge **116+**, Firefox **124+**, Safari **17.4+**.

That floor is set by exactly one API: the single `AbortSignal.any()` call in
`HttpClient`, used to compose a caller's cancellation with a configured timeout.
Everything else in the library is supported considerably further back —
`<dialog>`/`showModal()` since Firefox 98 and Safari 15.4, `replaceChildren()`
since Firefox 78 and Safari 14.

Nothing is transpiled to obsolete environments, and no polyfill is shipped
speculatively. If you need to support Safari 17.0–17.3, the deliberate change is
a fallback for that one call — not a build step.

The test suite runs against all three engines (`npm run test:browser`), most
recently Chromium 151, Firefox 153 and WebKit 26.5.

## Contributing rules that are not negotiable

Adding any of the following requires an accepted ADR first: a runtime
dependency, a virtual DOM or reactivity system, hooks, a client router, a global
state store, Shadow DOM by default, compiler-required syntax, or any change to
the server/client authority boundary.

`npm run deps:check` enforces the first of those mechanically, by failing on any
production dependency **or** any non-relative import in shipped source.

## Licence

MIT.
