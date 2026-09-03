# Authoring a component

The process, the decisions, and the checklist. If you want a quick worked
example first, read [getting-started.md](getting-started.md).

---

## Before writing code: answer five questions

Written down, in the component's own specification file. The template is
`vayes-ui-core-spec-pack/COMPONENT_SPEC_TEMPLATE.md`, and the four reference
components in [components/](components/) are worked examples.

### 1. Who owns the markup?

| Mode             | The server renders               | `render()` does      | Example         |
| ---------------- | -------------------------------- | -------------------- | --------------- |
| **Enhancement**  | all of it                        | nothing              | `<vui-tabs>`    |
| **Client-owned** | an empty element                 | builds the structure | `<vui-counter>` |
| **Hybrid**       | the content; the component wraps | adds a wrapper once  | `<vui-modal>`   |

Prefer enhancement. Markup the server already renders is markup that works
before JavaScript arrives, survives a failed asset load, and cannot be
destroyed by a rerender.

### 2. What is configuration and what is data?

Attributes for anything an author writes in a view — strings, numbers, booleans,
enums, URLs. Properties for anything JavaScript hands over — objects, arrays,
services.

Do not serialise an object into an attribute. If you find yourself writing
`JSON.parse(this.getAttribute('config'))`, it is a property.

### 3. What does it announce?

Name the events before writing them. `entity:past-tense`. Decide the `detail`
shape and treat it as an API contract, because it is one — changing it is a
breaking change.

Keep payloads small and explicit. Do not pass your internal state object out;
you will not be able to change it afterwards.

### 4. What does it own, and what must it release?

List every listener, timer, observer, subscription and in-flight request. Each
one needs a disposal story: bound to `this.signal`, or explicitly disposed in
`unmount()`.

### 5. How is it operated without a mouse?

Which keys, what receives focus, what ARIA state changes. A component that
cannot be driven from the keyboard is unfinished — that is the rule in
`docs/12-accessibility.md`, not a preference.

---

## Writing it

### Skeleton

```js
import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

export class Thing extends Component {
  static properties = Object.freeze(['data']);

  static get observedAttributes() {
    return ['disabled'];
  }

  static defaults = Object.freeze({ limit: 20 });

  #data = null;
  #elements = null;

  get data() {
    return this.#data;
  }

  set data(value) {
    this.#data = value;

    if (this.mounted) {
      this.#renderData();
    }
  }

  render() {} // create owned markup, idempotently
  bindEvents() {} // listeners, always with { signal: this.signal }
  unmount() {} // dispose what the signal does not cover
}

define('vui-thing', Thing);
```

### The five rules that matter

**1. `render()` runs again on every reconnect.** Detect your own prior output:

```js
render() {
    if (this.#elements && this.contains(this.#elements.list)) {
        return;
    }
    // …build
}
```

**2. Bind every listener with the signal.** Any target — the element,
`document`, `window`, a bus:

```js
document.addEventListener('keydown', this.handleKey, { signal: this.signal });
```

`this.signal` throws if you touch it while unmounted, which is the intended
correction: a listener registered outside a mount cycle is one nothing will
clean up. Never bind in the constructor.

**3. Declare public properties.** `static properties = ['data']` rescues values
assigned before the class loaded. Without it, the assignment is silently lost.

**4. Update the smallest node.** Never rebuild a subtree to reflect one change —
it destroys focus, selection, scroll position and uncontrolled input values.

**5. Do not emit on hydration.** Reading an initial value from an attribute is
not a user action:

```js
this.setValue(parsed, { emit: false });
```

### Delegated actions

For anything with more than one control, or with controls that come and go:

```js
bindEvents() {
    this.bindActions();
}

handleAction(action, trigger, event) {
    switch (action) {
        case 'save':   this.save(); break;
        case 'cancel': this.cancel(); break;
    }
}
```

```html
<button type="button" data-action="save">Save</button>
```

One listener covers every current and future descendant, so replacing inner
markup never requires rebinding. Actions inside a nested custom element belong
to that element, not to you — the boundary is enforced.

The attribute value is data. It reaches an explicit `switch` in your code, never
a lookup into `window` and never anything evaluated.

### Async work

```js
async search(query) {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const token = ++this.#requestToken;

    this.#setStatus('loading');

    try {
        const results = await this.service.search(query, { signal: this.#controller.signal });

        if (token !== this.#requestToken) {
            return; // a newer request has already answered
        }

        this.#render(results);
    } catch (error) {
        if (isAbortError(error) || token !== this.#requestToken) {
            return; // cancelled, not failed
        }

        this.#setStatus('error');
    }
}
```

Three things are load-bearing here:

- **abort the previous request** — otherwise responses race and the slower,
  older one can win;
- **check the token as well** — a request can be aborted after the server has
  already replied, so the abort alone is not sufficient;
- **stay silent on cancellation** — every superseded keystroke would otherwise
  flash an error.

Dispose the controller in `unmount()`.

### Untrusted data

Text goes through `textContent` or a property assignment. Never through HTML.

```js
const name = document.createElement('span');
name.textContent = customer.name; // safe even if the name contains markup
```

A static template literal is fine when nothing is interpolated into it. If you
must write HTML, `npm run arch:check` requires an annotation stating why it is
safe:

```js
// safe-html: static literal, no interpolation; values are set via textContent below.
this.innerHTML = `<div data-content></div>`;
```

### Accessibility

Use the native element. `<button>`, `<input>`, `<dialog>`, `<details>` bring
keyboard behaviour, focus handling and platform semantics that are tedious and
error-prone to reconstruct.

If your component wraps an internal control, it needs an accessible name —
and this is easy to get wrong, because **a custom element is not a labelable
element**. `<label for="my-thing">` beside `<my-thing id="my-thing">` labels
nothing at all.

`<vui-customer-selector>` shows the pattern: forward the host's `aria-label` and
`aria-labelledby` to the internal control, and resolve a `<label for>` written
against the host. Do not let a `placeholder` be the accessible name — it
disappears the moment the user types, and an automated audit will still pass.

State changes update ARIA alongside the visual change:

```js
setLoading(loading) {
    this.toggleAttribute('aria-busy', loading);
    this.find('[data-loader]').hidden = !loading;
}
```

---

## Testing it

Every applicable row, in a real browser:

| Scenario                                    | Required                      |
| ------------------------------------------- | ----------------------------- |
| Definition before the element exists        | Yes                           |
| Element exists before definition            | Yes                           |
| Connect                                     | Yes                           |
| Disconnect                                  | Yes                           |
| Reconnect                                   | Yes                           |
| No duplicate listener after reconnect       | Yes                           |
| Attribute defaults, and invalid values      | Yes                           |
| Attribute change while mounted              | If observed                   |
| Rich property assignment                    | If exposed                    |
| Property set before upgrade                 | If exposed                    |
| User event produces the expected DOM change | Yes                           |
| Public event name and detail                | If emitted                    |
| Bubbling                                    | If the contract says so       |
| Keyboard operation                          | If interactive                |
| Disabled state                              | If supported                  |
| Loading state                               | If async                      |
| Request abort and stale response            | If async                      |
| Error state                                 | If async                      |
| Insertion via an AJAX fragment              | For representative components |
| XSS-sensitive text                          | If it renders dynamic text    |
| Accessible name                             | If it wraps a control         |

The reconnect test is the one people skip and the one that catches real leaks:

```js
element.remove();
root.append(element);
element.querySelector('button').click();
expect(handlerCalls).toBe(1); // not 2
```

And assert accessible names by querying for a role **and** its name, with
`exact: true`. An axe run alone is not enough — in this project a clean audit
coexisted with two unnamed widgets:

```js
await expect(page.getByRole('combobox', { name: 'Find a customer', exact: true })).toHaveCount(1);
```

---

## Before you call it done

- [ ] A specification file in `docs/components/`, following the template.
- [ ] Every attribute, property, method and event documented, with defaults.
- [ ] The test matrix above, for every applicable row.
- [ ] `npm test` passes — including `arch:check` and the three browser engines.
- [ ] Non-goals written down. What this component will never do is as useful to
      a future reader as what it does.

## When you want to add something to the core

Do not, until two components need it. Prefer a private method, then a shared
helper in the component directory, and only then the core.

The core is 707 lines. It is reviewable in one sitting, and that is a feature
worth more than any individual convenience.
