# Troubleshooting

Symptom, cause, fix. Ordered roughly by how often each one happens.

---

## The element does nothing at all

Check first, in the console:

```js
customElements.get('vui-thing');
```

`undefined` means the module never ran, and nothing else matters yet.

| Cause                                | Fix                                                               |
| ------------------------------------ | ----------------------------------------------------------------- |
| The module was never imported        | Import it from your entry file. Importing is the registration.    |
| The script tag lacks `type="module"` | ES modules need it; without it the file fails to parse.           |
| The asset 404s                       | Check the network tab. Vendored copies get this wrong most often. |
| An earlier module threw              | Check the console. One exception stops the whole module graph.    |
| The name has no hyphen               | `define()` throws for invalid names — read the error.             |
| The name uses an unregistered prefix | Call `setAllowedPrefixes([...])` at boot, before importing.       |

If `customElements.get()` returns the class but the element is still inert, it
is not connected. `element.isConnected` and `element.mounted` will tell you.

---

## A handler fires twice, or three times

Listeners are being added on every mount without being removed. Almost always
one of these:

```js
// Wrong — never removed, accumulates on reconnect
bindEvents() {
    document.addEventListener('keydown', this.handleKey);
}

// Wrong — the constructor has no mount cycle to belong to
constructor() {
    super();
    this.addEventListener('click', this.handleClick);
}

// Right
bindEvents() {
    document.addEventListener('keydown', this.handleKey, { signal: this.signal });
}
```

Reproduce it in three lines — this is the test every component should have:

```js
element.remove();
container.append(element);
element.querySelector('button').click(); // should run the handler exactly once
```

---

## A property I set before the element upgraded is gone

```js
element.customer = { id: 1 }; // class not loaded yet
await import('./CustomerCard.js');
element.customer; // undefined
```

The assignment created an own data property that shadows the accessor installed
by the class definition. Declare the property:

```js
static properties = Object.freeze(['customer']);
```

The base class rescues declared properties on first mount. Do this for every
public property — the bug only appears under slow networks or lazy loading,
which is to say, in production and not on your machine.

---

## `Component is not currently mounted` when reading `this.signal`

You touched `this.signal` outside a mount cycle — usually in the constructor, or
in an async callback that resolved after the element was removed.

The throw is deliberate: a listener registered outside a mount cycle is one that
nothing will ever clean up.

```js
// Wrong
constructor() {
    super();
    window.addEventListener('resize', this.onResize, { signal: this.signal });
}

// Right
bindEvents() {
    window.addEventListener('resize', this.onResize, { signal: this.signal });
}
```

For async work that may outlive the element, capture the signal before awaiting,
or guard with `if (!this.mounted) return;` after the await.

---

## Every write request returns 403

The CSRF token is not reaching CodeIgniter, or it is stale.

Work through these in order:

1. **Is the token in the page?** `document.querySelector('meta[name="csrf-token"]')`.
   If it is missing, the layout is not rendering boot config.
2. **Is it on the request?** Check the network tab for the header named by
   `csrf_header()` — by default `X-CSRF-TOKEN`.
3. **Does only the _second_ request fail?** Then rotation is not reaching the
   browser. `Config\Security::$regenerate` is `true` by default, and the client
   can only learn the new hash if you publish it:

   ```php
   $response->setHeader(csrf_header(), csrf_hash());
   ```

   from an `after` filter, on **every** response including errors.

4. **Are you bypassing the client?** A raw `fetch()` gets no CSRF handling. Use
   the configured `HttpClient`.
5. **Is the request cross-origin?** CSRF is applied to same-origin unsafe
   requests only.

## Or: a write request returns 200 with a login page as the body

`Config\Security::$redirect` is `true`, so CodeIgniter answers a CSRF failure
with a 303. `fetch` follows redirects transparently, so the client sees a
successful response containing HTML.

Set `$redirect = false` for API routes.

---

## Components in an AJAX response are inert

| Cause                                                 | Fix                                                |
| ----------------------------------------------------- | -------------------------------------------------- |
| The module defining them was never imported           | Import it once at boot; order does not matter.     |
| The HTML was inserted into a detached node            | Elements mount on insertion **into the document**. |
| The response was inserted as text, not parsed as HTML | Use `replaceFragment()` or `insertAdjacentHTML`.   |

If the element is in the document and still inert, check `customElements.get()`
for its tag. Upgrade is retroactive — if the class is registered and the element
is connected, it has mounted.

---

## A `<script>` in my fragment does not run

Correct, and deliberate. `parseFragment` removes `<script>` elements and inline
handler attributes before the nodes enter the document.

This is not over-caution: a script parsed inside a `<template>` **does** execute
the moment it is moved into the live document. The architecture forbids
depending on scripts inside fragments (ADR-009).

Put the behaviour in a component instead. That is what they are for.

---

## Typing in a search box flashes an error on every keystroke

Cancellation is being treated as failure. Each keystroke aborts the previous
request, and an abort is not an error:

```js
catch (error) {
    if (isAbortError(error)) {
        return;
    }

    this.showError();
}
```

If a _stale_ result sometimes overwrites a newer one, add a request token — a
request can be aborted after the server has already replied.

---

## Focus jumps, or an input resets while typing

Something is rebuilding DOM that should have been updated in place. Replacing a
subtree destroys focus, text selection, scroll position, uncontrolled input
values and any native widget state inside it.

```js
// Wrong
update() {
    this.innerHTML = this.template();
}

// Right
update() {
    this.find('[data-value]').textContent = this.state.value;
}
```

---

## Two dialogs fight over which is on top

`<vui-modal>` uses the native `<dialog>` in modal mode, which renders in the
browser's **top layer** — above everything regardless of `z-index` — and makes
the rest of the page inert.

If your application has another modal implementation, expect exactly this.
Use one system per page.

---

## An automated accessibility audit passes but a screen reader announces nothing useful

A clean axe run is not evidence of an accessible component. In this project a
clean audit coexisted with two unnamed widgets:

- axe's `aria-dialog-name` rule matches `[role="dialog"]`, so a native
  `<dialog>` with an implicit role was never examined;
- axe accepts a `placeholder` as a last-resort accessible name, so a field named
  only by its placeholder passed.

Assert the computed name directly, by role and name:

```js
await expect(page.getByRole('combobox', { name: 'Find a customer', exact: true })).toHaveCount(1);
```

`exact: true` matters — Playwright matches accessible names by substring
otherwise, and `'Via aria-label'` will happily match `'Via aria-labelledby'`.

---

## `HttpClient received a plain object body without json: true`

Working as intended. The client will not silently serialise an object, because
that is how `[object Object]` reaches production.

```js
await http.post('/api/customers', customer, { json: true }); // JSON
await http.post('/api/customers', new FormData(form)); // multipart
await http.post('/api/customers', new URLSearchParams(data)); // form-encoded
```

---

## `Cannot resolve "…" against base "(none)"`

You are outside a browser — a Node unit test, most likely — where there is no
`document.baseURI` to resolve a relative URL against. Give the client a base:

```js
new HttpClient({ baseUrl: 'https://app.test', fetch: stub });
```

---

## `npm run arch:check` fails on code I think is fine

Each rule encodes an accepted ADR, so the fix is usually to change the code
rather than the rule.

| Message                                    | What it means                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `a core module may not import …`           | The layering is inverted. Core cannot depend on components or services.    |
| `the transport layer must not touch DOM`   | UI decisions belong above `HttpClient`, never inside it.                   |
| `dynamic global lookup is forbidden`       | `window[name]` is the pattern `ActionRegistry` exists to replace.          |
| `HTML sink without a safe-html annotation` | Add `// safe-html: <reason>` above it, stating why the content is trusted. |

The last one is not a rubber stamp. If you cannot write a convincing reason, the
code should be using `textContent`.

---

## Tests pass in Chromium and fail in WebKit

Usually the test, not the code. Engines legitimately differ in how they
_represent_ things while agreeing on behaviour.

The real example from this project: a modal focus test asserted that
`document.activeElement` stays inside the dialog while tabbing. WebKit reports
`document.body` at the wrap point and by default cycles only text inputs — while
focus never leaves the dialog in either engine. The assertion had encoded
Chromium's representation as if it were the contract.

Assert the contract, not the representation. Here, that no background control
can be reached.

---

## Still stuck

- `npm run test:browser:chromium` — fast feedback on one engine.
- `npx playwright test --debug` — step through in a real browser.
- `element.mounted`, `element.isConnected`, `customElements.get(tag)` — three
  properties that answer most lifecycle questions.
- The four reference components in `resources/js/components/` are working
  examples of every pattern described in these docs.
