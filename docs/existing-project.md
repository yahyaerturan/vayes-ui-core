# Adopting this in an existing application

This guide assumes you already have a working CodeIgniter 4 application with its
own JavaScript, its own asset pipeline and its own habits. Nothing here asks you
to stop using any of that.

The library is additive by design. A custom element is a tag the browser did not
previously know; adding one changes nothing about the code around it. That is
what makes incremental adoption realistic rather than aspirational.

> **Do not adopt this everywhere at once.** The end state is a codebase where
> _some_ interactive regions are components. Converting working code that has no
> problem is cost without benefit.

---

## Three decisions, in order

1. **How the code gets into your project** — vendored, npm dependency, or submodule.
2. **How the browser loads it** — directly as ES modules, or through your bundler.
3. **How far you adopt** — which region goes first, and what stays as it is.

Take them one at a time. Decisions 1 and 2 are reversible in an afternoon.

---

## Step 1 — Get the code

### Option A: vendor it (simplest, no tooling)

Copy `resources/js/` into your application's asset directory.

```bash
cp -R vayes-ui-core/resources/js  app-root/assets/js/vui
cp -R vayes-ui-core/resources/css app-root/assets/css/vui
```

This works because **every import in the shipped source is a relative path** —
there is not one bare specifier anywhere, so nothing needs resolution. That is
not an accident of the current code; `npm run deps:check` fails the build if a
non-relative import ever appears.

- **Good for:** applications with no npm step, or where assets are committed.
- **Costs:** updating means copying again. Track the version you took.

### Option B: npm or Yarn dependency (best for updates)

If your project already has a `package.json`:

```bash
npm install github:your-org/vayes-ui-core#v1.1.0
```

Pin a tag. The package is ESM-only, has zero runtime dependencies, and exposes
these entry points:

| Specifier                     | Contents                                    |
| ----------------------------- | ------------------------------------------- |
| `@vayes/ui-core`              | the core runtime                            |
| `@vayes/ui-core/ci4`          | the CodeIgniter adapter                     |
| `@vayes/ui-core/actions`      | the optional `ActionRegistry`               |
| `@vayes/ui-core/components/*` | reference components, imported individually |

- **Good for:** projects that already run a package manager.
- **Costs:** your build must handle ESM. Most modern bundlers do by default.

### Option C: git submodule

```bash
git submodule add https://your-host/vayes-ui-core vendor-js/vayes-ui-core
```

- **Good for:** you expect to contribute changes back.
- **Costs:** submodules are their own kind of tax on everyone who clones.

**Recommendation:** Option B if you have a package manager, Option A if you do
not. Do not add a package manager solely to install this.

---

## Step 2 — Get it into the browser

### Without a build step

The source is ES modules with relative imports and no dependencies. Serve the
directory and load one entry point:

```html
<script type="module" src="/assets/js/vui/app.js"></script>
```

This genuinely works — the demo application and the entire browser test suite
load the source exactly this way, with no bundler between the file and the
browser. Because the imports are relative, the server does not need to resolve
anything.

Trade-off: one HTTP request per module. Over HTTP/2 with normal caching that is
usually fine for an internal application; measure before assuming otherwise.

### With your existing bundler

Import the modules from your existing entry file and let the bundler do what it
already does:

```js
import '@vayes/ui-core/components/common/Modal.js';
import './components/InvoiceRow.js';
```

Nothing in the library depends on bundler-specific behaviour — no `import.meta`
tricks, no plugin requirements, no CSS-in-JS. A `vite.config.js` is included if
you want a reference, but the library does not care which bundler you use.

### Your own entry file

Create one file that imports the components a page needs. Importing a component
module registers its element; that is the entire wiring step.

```js
// assets/js/components.js
import '@vayes/ui-core/components/common/Modal.js';
import '@vayes/ui-core/components/common/Tabs.js';
import './components/InvoiceRow.js';
```

There is no `init()` to call, on page load or after AJAX.

---

## Step 3 — Boot configuration

Your JavaScript needs a few values from the server. Render them once, into
markup, in your existing layout's `<head>`:

```php
<meta name="app-base-url"    content="<?= esc(base_url(), 'attr') ?>">
<meta name="csrf-header"     content="<?= esc(csrf_header(), 'attr') ?>">
<meta name="csrf-token-name" content="<?= esc(csrf_token(), 'attr') ?>">
<meta name="csrf-token"      content="<?= esc(csrf_hash(), 'attr') ?>">
<meta name="locale"          content="<?= esc(service('request')->getLocale(), 'attr') ?>">
```

Anything richer goes in a JSON block, which the browser never executes and a
strict CSP therefore permits:

```php
<script type="application/json" id="app-config"><?= json_encode([
    'endpoints' => ['customerSearch' => '/api/customers/search'],
], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
```

Then build the client once:

```js
import { createCodeIgniterClient } from '@vayes/ui-core/ci4';

export const { http, csrf, config } = createCodeIgniterClient();
```

If your application already has a global namespace object, hang it there. One
namespace is fine; dozens of loose globals are what this replaces.

---

## Step 4 — Make CSRF actually work

This is the step that most often fails silently, so verify it early.

CodeIgniter regenerates the CSRF hash on every verified unsafe request when
`Config\Security::$regenerate` is `true` (the default). The browser cannot know
the new value unless you send it. Publish it from an `after` filter:

```php
public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
{
    $response->setHeader(csrf_header(), csrf_hash());
}
```

The provider reads that header from **every** response, including error
responses, so a rotated token survives a validation failure.

Two settings worth checking against your own `Config\Security`:

- **`$redirect`** — set it to `false` for API routes. A 303 to a login page is
  unreadable to `fetch`, which follows the redirect and reports a confusing
  `200`.
- **`$tokenName` and `$headerName`** — if you have customised them, the adapter
  reads both from the meta tags above, so nothing is hard-coded.

**Verify it before building anything on top:** issue two consecutive POSTs from
the browser console and confirm both return success rather than 403. If the
second fails, rotation is not reaching the client.

Full detail in [ci4-integration.md](ci4-integration.md).

---

## Step 5 — Choose your prefix

The default policy accepts `vui-` only. Register your product's prefix once, at
boot, before any component module is imported:

```js
import { setAllowedPrefixes } from '@vayes/ui-core';

setAllowedPrefixes(['vui-', 'acme-']);
```

Your own components then use your prefix:

```js
define('acme-invoice-row', InvoiceRow);
```

Custom element names are global to the document, so check for collisions with
anything else on the page. The policy exists to make that a deliberate decision
rather than a discovery.

---

## Step 6 — Convert one thing

Pick a **leaf**: a widget that other code does not reach into. Good first
candidates are a formatted input, a toggle, a stepper, a small self-contained
panel. Bad first candidates are anything other scripts query by class name, and
anything central enough that reverting is awkward.

### The shape of a conversion

Typical existing code:

```js
function initQuantityStepper(root) {
  root.querySelectorAll('.stepper').forEach(el => {
    el.querySelector('.plus').addEventListener('click', () => {
      /* … */
    });
    el.querySelector('.minus').addEventListener('click', () => {
      /* … */
    });
  });
}

initQuantityStepper(document);
// …and again after every AJAX response that might contain one
```

As a component:

```js
import { Component, define } from '@vayes/ui-core';

class QuantityStepper extends Component {
  #value = 0;

  bindEvents() {
    this.bindActions();
  }

  handleAction(action) {
    if (action === 'increment') this.setValue(this.#value + 1);
    if (action === 'decrement') this.setValue(this.#value - 1);
  }

  setValue(value) {
    this.#value = value;
    this.find('[data-value]').textContent = String(value);
    this.emit('quantity:changed', { value });
  }
}

define('acme-quantity-stepper', QuantityStepper);
```

What changed that matters:

- the re-initialisation call after AJAX is **deleted**, not moved;
- listeners are bound once per mount and removed automatically;
- one delegated listener survives the inner markup being replaced;
- other code learns about changes by listening for `quantity:changed` instead of
  being called directly.

Keep the server markup you already have. `render()` is a no-op for an
enhancement component — the server owns the HTML, the component owns behaviour.

---

## Coexisting with your existing JavaScript

### Component events are ordinary DOM events

`emit()` dispatches a native `CustomEvent` on a real element, and it bubbles.
Any code that listens with `addEventListener` receives it — the component makes
no assumption about what that code is written with:

```js
document.addEventListener('quantity:changed', event => {
  recalculateTotals(event.detail.value);
});
```

If your existing code uses a library that wraps the event object, check how that
wrapper exposes a `CustomEvent`'s `detail` before relying on it; wrappers vary.
Using `addEventListener` directly for component events avoids the question
entirely, and is what the rest of these docs assume.

### Existing initialisation keeps working

Nothing about adopting components disables `querySelectorAll(...).forEach(init)`
elsewhere on the page. Both patterns coexist indefinitely. What you should not
do is call an initialiser _on_ a component's internals — the component owns that
subtree.

### If you already have a modal system

`<vui-modal>` uses the native `<dialog>` element in modal mode, which renders in
the browser's **top layer** — above every other element regardless of
`z-index` — and makes the rest of the page inert. If you already have a modal
implementation, expect two systems that each believe they are on top.

Pick one per page, and convert modals late rather than early.

### Region replacement

When existing code replaces a region's HTML, any components inside it disconnect
cleanly and any components in the new HTML start on insertion. That works
regardless of how the replacement happens.

For server-rendered fragments, prefer the provided helper:

```js
import { replaceFragment } from '@vayes/ui-core';

const html = await http.html('/customers/table');
replaceFragment(container, html);
```

It removes `<script>` elements and inline handler attributes before the nodes
enter the document. This is not belt-and-braces: a `<script>` parsed inside a
`<template>` **does** execute the moment it is moved into the live document.

---

## A migration order that works

1. **A leaf widget.** Prove the pipeline: assets load, an element upgrades, an
   event fires. Ship it. Do not proceed until this is boring.
2. **A self-contained async widget** — a search field, a filter. This exercises
   the client, CSRF and error handling in one place.
3. **AJAX list regions.** This is where the payoff is: delete the
   re-initialisation calls after each response.
4. **Forms**, once you trust the validation-error path.
5. **Dialogs**, last, and only if you want them — see the note above.

Things worth not doing: converting a whole page in one change; introducing this
and a bundler migration in the same pull request; converting code that works and
is not being touched.

---

## Testing in your project

You do not need to replicate this repository's test setup. The minimum that pays
for itself:

- **One real-browser test per component you write**, covering connect,
  disconnect, reconnect, and the public event. Reconnect is the one that catches
  duplicate-listener bugs, and it is three lines.
- **One integration test for the CSRF path**, asserting two consecutive unsafe
  requests both succeed. This breaks quietly and is miserable to debug in
  production.

If you have no browser test runner, that is a separate decision — do not let it
block adoption. [testing.md](testing.md) describes the layering used here and
what belongs in each.

---

## When something does not work

[troubleshooting.md](troubleshooting.md) covers the failure modes people
actually hit: elements that never upgrade, handlers that fire twice, properties
that vanish, 403s on every write, fragments that arrive inert.

The first question is almost always: **did the module that defines this element
actually load?** Check `customElements.get('acme-quantity-stepper')` in the
console. If it returns `undefined`, nothing else matters yet.
