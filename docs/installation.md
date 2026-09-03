# Installation

Pick the route that matches your project, follow it end to end, then run the
verification at the bottom. It takes about ten minutes.

If you are adopting this into an application that already exists, read
[existing-project.md](existing-project.md) afterwards — it covers the parts that
are about _your_ codebase rather than about installing.

---

## What you need

| Requirement                                             | Why                                                       | Optional?                            |
| ------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| A browser: Chrome/Edge 116+, Firefox 124+, Safari 17.4+ | The floor is one `AbortSignal.any()` call in `HttpClient` | No                                   |
| A way to serve static files                             | The library is ES modules; `file://` will not work        | No                                   |
| CodeIgniter 4                                           | Only for the CSRF adapter and boot-config reader          | Yes — the core is framework-agnostic |
| Node.js 20+                                             | Only for the package manager route and for running tests  | Yes                                  |

There is **nothing else**. No runtime dependencies, no build step, no
transpiler, no polyfill.

---

## Route A — Copy the files (simplest)

Best when your project has no npm step, or commits its assets.

### 1. Copy

```bash
# from a clone or a downloaded release of vayes-ui-core
cp -R vayes-ui-core/resources/js  your-app/public/assets/vui/js
cp -R vayes-ui-core/resources/css your-app/public/assets/vui/css
```

You end up with:

```
public/assets/vui/
├── js/
│   ├── core/          ← the runtime
│   ├── ci4/           ← CodeIgniter adapter (delete if unused)
│   ├── components/    ← reference components (keep what you use)
│   └── services/
└── css/
    └── vayes-ui-core.css
```

This works because **every import in the shipped source is a relative path** —
there is not one bare specifier anywhere, so nothing needs resolving. That is
enforced: `npm run deps:check` fails the build if a non-relative import ever
appears.

### 2. Create an entry file

`public/assets/js/app.js`:

```js
// Importing a component module registers its element. That is the whole
// wiring step — there is no init() to call.
import '../vui/js/components/common/Modal.js';
import '../vui/js/components/common/Tabs.js';
```

### 3. Load it

```html
<link rel="stylesheet" href="/assets/vui/css/vayes-ui-core.css" />
<script type="module" src="/assets/js/app.js"></script>
```

`type="module"` is required. Without it the file fails to parse and nothing
runs.

### 4. Record the version

Copies drift. Note which release you took:

```bash
echo "vayes-ui-core v1.2.1" > public/assets/vui/VERSION
```

---

## Route B — Package manager (best for updates)

Best when your project already has a `package.json`.

### 1. Install

```bash
npm install github:yahyaerturan/vayes-ui-core#v1.2.1
```

Pin a tag. Tracking a branch means an unreviewed change can arrive with an
unrelated `npm install`.

### 2. Import

```js
import { Component, define, HttpClient } from '@vayes/ui-core';
import { createCodeIgniterClient } from '@vayes/ui-core/ci4';
import '@vayes/ui-core/components/common/Modal.js';
```

Available entry points:

| Specifier                     | Contents                           |
| ----------------------------- | ---------------------------------- |
| `@vayes/ui-core`              | Core runtime                       |
| `@vayes/ui-core/ci4`          | CodeIgniter adapter                |
| `@vayes/ui-core/actions`      | Optional `ActionRegistry`          |
| `@vayes/ui-core/components/*` | Reference components, individually |

### 3. Bundle

Add the entry file to whatever bundler you already run. The package is ESM-only
and depends on no bundler behaviour — no plugins, no loaders, no CSS-in-JS.

If you have no bundler, you can still serve `node_modules/@vayes/ui-core/` as
static files and use Route A's `<script type="module">` approach.

### 4. Updating

```bash
npm install github:yahyaerturan/vayes-ui-core#v1.3.0
```

Read the [CHANGELOG](../CHANGELOG.md) first. Component tags, methods,
attributes, properties and event contracts are all versioned API.

---

## Route C — Git submodule

Best when you expect to contribute changes back.

```bash
git submodule add https://github.com/yahyaerturan/vayes-ui-core vendor/vayes-ui-core
git submodule update --init
```

Then import from `vendor/vayes-ui-core/resources/js/...` as in Route A.

Submodules are a tax on everyone who clones the repository. Choose this only if
the two-way flow is real.

---

## CodeIgniter: two more steps

Skip these if you are not using CodeIgniter, or not making requests yet.

### 1. Render boot configuration

In your layout `<head>`:

```php
<meta name="app-base-url"    content="<?= esc(base_url(), 'attr') ?>">
<meta name="csrf-header"     content="<?= esc(csrf_header(), 'attr') ?>">
<meta name="csrf-token-name" content="<?= esc(csrf_token(), 'attr') ?>">
<meta name="csrf-token"      content="<?= esc(csrf_hash(), 'attr') ?>">
<meta name="locale"          content="<?= esc(service('request')->getLocale(), 'attr') ?>">
```

### 2. Publish the rotated CSRF token

CodeIgniter regenerates the token on every verified unsafe request. The browser
cannot learn the new value unless you send it. In an `after` filter:

```php
$response->setHeader(csrf_header(), csrf_hash());
```

Then build the client once:

```js
import { createCodeIgniterClient } from '@vayes/ui-core/ci4';

export const { http, csrf, config } = createCodeIgniterClient();
```

**This is the step that fails silently.** The first write request works and the
second returns 403. Verify it explicitly — the checklist below does.

Full detail in [ci4-integration.md](ci4-integration.md).

---

## Verify it works

Four checks, in order. Each one isolates a different failure, so stop at the
first that fails rather than guessing.

### 1. Did the module load?

Open the browser console:

```js
customElements.get('vui-modal');
```

Expect a class. `undefined` means the module never ran — check the network tab
for a 404 and confirm `type="module"` is on the script tag.

### 2. Does an element upgrade?

```js
const el = document.createElement('vui-counter');
document.body.append(el);
el.mounted; // true
el.querySelector('output'); // the rendered markup
el.remove();
```

If `mounted` is `false`, the element is not connected. If it throws, the
component module was not imported.

### 3. Do events reach you?

```js
document.addEventListener('counter:changed', e => console.log(e.detail));
```

Click the counter's `+`. You should see `{ value, previous, source }`. This
confirms the whole chain: registration, mount, delegated action, and emit.

### 4. Does a protected write survive token rotation?

The one that matters, and the one people skip:

```js
await VayesApp.http.post('/api/your-endpoint', { ping: 1 }, { json: true });
await VayesApp.http.post('/api/your-endpoint', { ping: 2 }, { json: true });
```

**Both** must succeed. If the second throws a 403, the rotated token is not
reaching the browser — go back to the `after` filter above.

---

## When something is wrong

| Symptom                                           | Most likely cause                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Nothing happens at all                            | The module was not imported, or `type="module"` is missing                                                     |
| `404` on a `.js` file                             | A wrong relative path after copying — check the browser's network tab                                          |
| `Failed to resolve module specifier`              | You used a bare import without a bundler; use Route A paths or add one                                         |
| `define() ... does not use an allowed prefix`     | Call `setAllowedPrefixes(['vui-', 'your-'])` at boot, before importing components                              |
| Every write returns 403                           | CSRF: see check 4 above                                                                                        |
| A write returns 200 with a login page in the body | `Config\Security::$redirect` is `true`; set it to `false` for API routes                                       |
| Styles look wrong                                 | The stylesheet is optional and minimal — see [../examples/dashboard/](../examples/dashboard/) for a styled kit |

[troubleshooting.md](troubleshooting.md) covers these and the rest in depth.

---

## Try it before you commit to it

To see everything working before installing anything:

```bash
git clone https://github.com/yahyaerturan/vayes-ui-core
cd vayes-ui-core
npm install

node scripts/serve-static.mjs 5173 .
```

- `/examples/standalone.html` — components with no server at all
- `/examples/dashboard/index.html` — the Tailwind admin kit

For the full CodeIgniter demo:

```bash
composer create-project codeigniter4/appstarter ci4
npm run ci4:install
npm run ci4:serve       # http://127.0.0.1:8081
```

---

## Next

| You want to                   | Read                                               |
| ----------------------------- | -------------------------------------------------- |
| Understand the model          | [concepts.md](concepts.md)                         |
| Build your first component    | [authoring-components.md](authoring-components.md) |
| Adopt this in an existing app | [existing-project.md](existing-project.md)         |
| Look up an API                | [core-api.md](core-api.md)                         |
