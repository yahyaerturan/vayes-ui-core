# Recipes

Common tasks, in the shape this library expects. Each one is short on purpose —
if a recipe needs a page of setup, something is wrong with the design.

---

## Refresh a list region from the server

The classic case: filters change, the server re-renders a table, the table
contains components.

```php
// Controller
public function table(): string
{
    return view('fragments/customer_table', [
        'customers' => model('CustomerModel')->search($this->request->getGet('q'), 20),
    ]);
}
```

```js
import { replaceFragment } from '@vayes/ui-core';

async function refresh(query) {
  const html = await app.http.html('/customers/table', { query: { q: query } });
  replaceFragment(document.getElementById('results'), html);
}
```

Components inside the returned HTML start on insertion. There is no
re-initialisation step, and adding one would be a mistake.

`replaceFragment` removes `<script>` elements and inline handler attributes
before the nodes enter the document. The server is still the trust boundary:
escape with `esc()`.

---

## Submit a form as JSON and map server validation back to fields

```js
form.addEventListener('submit', async event => {
  event.preventDefault();

  clearErrors(form);
  submitButton.disabled = true;

  try {
    const response = await app.http.post('/api/customers', Object.fromEntries(new FormData(form)), {
      json: true,
    });

    const { data } = await response.json();
    status.textContent = `Created ${data.name}.`;
    form.reset();
  } catch (error) {
    if (error instanceof HttpError && error.isValidationError) {
      showErrors(form, error.body.errors);
    } else {
      status.textContent = describeFailure(error);
    }
  } finally {
    submitButton.disabled = false;
  }
});

function showErrors(form, errors) {
  for (const [field, message] of Object.entries(errors)) {
    // Server messages are data, not markup.
    form.querySelector(`[data-error-for="${CSS.escape(field)}"]`).textContent = Array.isArray(
      message,
    )
      ? message.join(' ')
      : String(message);
    form.querySelector(`[name="${CSS.escape(field)}"]`)?.setAttribute('aria-invalid', 'true');
  }

  form.querySelector('[aria-invalid="true"]')?.focus();
}
```

Notes that matter:

- `{ json: true }` is required. A plain object body without it throws rather
  than silently serialising to `[object Object]`.
- CSRF is applied automatically to unsafe same-origin requests.
- Move focus to the first invalid field. An error nobody can find is not
  feedback.

A working version is in `resources/js/demo.js`.

---

## Debounced search that cancels itself

```js
#handleInput = () => {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.search(this.#input.value), this.debounce);
};

async search(query) {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const token = ++this.#requestToken;

    try {
        const results = await this.service.search(query, { signal: this.#controller.signal });

        if (token !== this.#requestToken) {
            return;
        }

        this.#render(results);
    } catch (error) {
        if (isAbortError(error) || token !== this.#requestToken) {
            return;
        }

        this.#showError();
    }
}

unmount() {
    clearTimeout(this.#timer);
    this.#controller?.abort();
}
```

The token check is not redundant with the abort: a request can be aborted after
the server has already responded, and without the token a stale result can still
overwrite a newer one.

---

## Confirm before a destructive action

Use the modal's cancelable pre-event rather than inventing a confirmation
protocol:

```js
modal.addEventListener('modal:before-close', event => {
  if (form.hasUnsavedChanges && event.detail.reason !== 'action') {
    event.preventDefault();
    warning.hidden = false;
  }
});
```

Every dismissal route — Escape, backdrop, a `data-action="close"` control,
`close()`, removing the `open` attribute — passes through this event, so one
listener guards them all.

---

## Let two unrelated components talk

Through the DOM, if there is any ancestor in common:

```js
// Publisher: announces a fact, knows nothing about consumers.
this.emit('customer:selected', { id, customer });

// Consumer: anywhere up the tree.
document.addEventListener('customer:selected', event => {
  invoiceTotals.setCustomer(event.detail.customer);
});
```

Through the bus only when there is genuinely no DOM relationship — session
expiry, locale change, connectivity:

```js
import { events } from '@vayes/ui-core';

events.emit('session:expired', { at: Date.now() });

// Inside a component, tie the subscription to the mount cycle:
events.on('session:expired', this.handleExpiry, { signal: this.signal });
```

Do not reach for the bus to avoid passing an event up the tree. Bubbling is
what the DOM already does well.

---

## Give a wrapped input a real accessible name

```html
<label for="customer-search">Find a customer</label>
<vui-customer-selector
  id="customer-search"
  endpoint="/api/customers/search"
></vui-customer-selector>
```

That works, but only because the component resolves it. A custom element is not
labelable, so on its own the `<label for>` labels nothing.

If you are writing a component that wraps a control, forward the host's ARIA to
the internal element:

```js
#applyLabel() {
    const labelledBy = this.getAttribute('aria-labelledby');
    const label = this.getAttribute('aria-label');

    if (labelledBy) {
        this.#input.setAttribute('aria-labelledby', labelledBy);
    } else if (label) {
        this.#input.setAttribute('aria-label', label);
    }
}
```

Observe both attributes so a later change is picked up. Never let a
`placeholder` be the name.

---

## Show a loading state accessibly

```js
setLoading(loading) {
    this.state.loading = loading;
    this.toggleAttribute('aria-busy', loading);
    this.dataset.state = loading ? 'loading' : 'idle';
    this.find('[data-status]').textContent = loading ? this.labels.loading : '';
}
```

State lives in a semantic attribute, so CSS can hook it without JavaScript
duplicating class names:

```css
vui-thing[data-state='loading'] .spinner {
  display: block;
}
```

The message goes in a `role="status"` region so it is announced without stealing
focus.

---

## Create a component from JavaScript

```js
const card = document.createElement('vui-customer-card');
card.customer = customer; // property, before or after insertion
container.append(card); // mounts here
```

Property assignment before the class has loaded is safe, provided the component
declares `static properties`.

---

## Pass translated strings

Give the component only the keys it needs:

```js
selector.labels = {
  loading: 'Aranıyor…',
  empty: 'Müşteri bulunamadı.',
  error: 'Müşteriler yüklenemedi.',
};
```

Do not ship the application's entire language catalogue to every page. Render a
scoped subset from CodeIgniter into the boot config, or set it per component.

---

## Retry an idempotent GET

There is no retry in the core, deliberately — hidden retry loops turn one
outage into an amplification. When you need it, make it explicit and only for
safe methods:

```js
async function fetchWithRetry(url, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await app.http.json(url);
    } catch (error) {
      const retryable = error instanceof NetworkError || error.status >= 500;

      if (!retryable || attempt >= attempts) {
        throw error;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 2 ** attempt * 100);
      });
    }
  }
}
```

Never retry POST, PUT, PATCH or DELETE this way.

---

## Log requests during development

```js
import { createHttpObserver } from '@vayes/ui-core/core/diagnostics.js';

const { http } = createCodeIgniterClient({
  observer: import.meta.env?.DEV ? createHttpObserver() : null,
});
```

Bodies are never logged, and credentials, cookies and CSRF tokens are redacted
from headers. Importing the module installs nothing on its own.
