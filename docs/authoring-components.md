# Creating a component

A numbered procedure, a runnable template to copy, and the rules that catch
people out.

If you have never written one, do [getting-started.md](getting-started.md)
first — it builds a small component end to end in about ten minutes.

---

## Start from the template

Do not start from an empty file. `examples/component-template/` contains a
**working** component — `<app-character-counter>` — annotated step by step, plus
its test file and its specification.

```bash
cp examples/component-template/CharacterCounter.js  resources/js/components/YourThing.js
cp tests/browser/example-template.spec.js           tests/browser/your-thing.spec.js
```

Then rename: the class, the tag in `define()`, the event names, the file header.
Delete what you do not need. Everything left is a pattern you would otherwise
have to rediscover.

It counts characters in a form field — a small, real job chosen because it
exercises the whole contract: attribute config, a rich property, observed
attributes, idempotent rendering, listener and timer cleanup, incremental
updates, a public event, and accessible announcements.

---

## The procedure

### Step 1 — Decide the ownership mode

This is the first question because everything else follows from it.

| Mode             | The server renders | `render()`           | Example         |
| ---------------- | ------------------ | -------------------- | --------------- |
| **Enhancement**  | all the markup     | nothing              | `<vui-tabs>`    |
| **Client-owned** | an empty element   | builds the structure | `<vui-counter>` |
| **Hybrid**       | the content        | adds a wrapper once  | `<vui-modal>`   |

**Prefer enhancement.** Markup the server already renders works before
JavaScript arrives, survives a failed asset load, and cannot be destroyed by a
rerender.

### Step 2 — Write the contract down first

Before implementing. Copy `vayes-ui-core-spec-pack/COMPONENT_SPEC_TEMPLATE.md`
into `docs/components/your-thing.md` and fill in:

- **Attributes** — name, type, default, observed?
- **Properties** — name, type, default, reflected?
- **Methods** — parameters, return, side effects, failure behaviour
- **Events** — name, bubbles, cancelable, `detail` shape, when
- **DOM contract** — what the server owns, what you create, stable hooks
- **Accessibility** — semantics, keys, focus, ARIA
- **Non-goals** — what this will never do

Ten minutes here saves an afternoon. The `detail` shape in particular is a
contract you cannot change later without a major version.

### Step 3 — Register your prefix

Once, at boot, before importing any component:

```js
import { setAllowedPrefixes } from '@vayes/ui-core';

setAllowedPrefixes(['vui-', 'app-']);
```

`define()` rejects anything outside the allowlist. That is deliberate: three
naming conventions in one codebase happens by accident, never on purpose.

### Step 4 — Implement

```js
import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

export class YourThing extends Component {
  static properties = Object.freeze(['data']); // ← survives pre-upgrade assignment

  static get observedAttributes() {
    return ['disabled']; // ← only what you react to while mounted
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

  render() {} // create owned markup — must be idempotent
  bindEvents() {} // listeners, always with { signal: this.signal }
  unmount() {} // dispose what the signal does not cover
}

define('app-your-thing', YourThing);
```

### Step 5 — Test it

Every applicable row of the matrix below, in a real browser. Start with the
reconnect test; it catches the most bugs per line.

### Step 6 — Document it

Fill in the spec from step 2 with what you actually built, and link it from
`docs/components/`.

---

## The six rules that matter

### 1. `render()` runs again on every reconnect

It must recognise its own previous output. **Recover the reference from the DOM**
— do not rely on a cached field, because `unmount()` clears it:

```js
render() {
    this.#output ??= this.querySelector(':scope > [data-output]');

    if (this.#output && this.contains(this.#output)) {
        return;
    }

    // …build it
}
```

Get this wrong and every reconnect appends a second copy. This exact bug shipped
in this repository's own kit, in a component whose tests otherwise passed —
because nothing counted the elements after a reconnect.

Alternatively, replace rather than append (`this.innerHTML = …`), which is
idempotent by construction but throws away any state inside.

### 2. Bind every listener with the signal

Any target — the element, `document`, `window`, a bus:

```js
document.addEventListener('keydown', this.handleKey, { signal: this.signal });
```

Never in the constructor. `this.signal` throws while unmounted, and that throw is
the correction: a listener registered outside a mount cycle is one nothing will
clean up.

### 3. Declare public properties

```js
static properties = Object.freeze(['data']);
```

Without it, `el.data = {...}` before the class loads creates an own property that
shadows your accessor, and the value is silently lost. The bug appears only on
slow connections — which is to say in production and never on your machine.

### 4. Update the smallest node

Never rebuild a subtree to reflect one change. Replacing DOM destroys focus, the
text selection, the caret, scroll position, uncontrolled input values and any
native widget state inside it.

### 5. Do not emit on hydration

Reading an initial value from an attribute is not a user action:

```js
this.setValue(parsed, { emit: false });
```

Emit on the _transition_, not on every update — an event that fires on each
keystroke is useless to a consumer.

### 6. Untrusted data never touches HTML

```js
node.textContent = customer.name; // safe even if the name contains markup
```

A static template literal is fine when nothing is interpolated. Any HTML write
needs a `// safe-html: <reason>` annotation or `npm run arch:check` fails. If you
cannot write a convincing reason, use `textContent`.

---

## Delegated actions

For anything with more than one control, or controls that come and go:

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
markup never requires rebinding. Actions inside a nested custom element belong to
that element — the boundary is enforced.

The attribute value is data. It reaches an explicit `switch`, never a lookup into
`window` and never anything evaluated.

---

## Async components

```js
async search(query) {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const token = ++this.#requestToken;

    this.#setStatus('loading');

    try {
        const results = await this.service.search(query, { signal: this.#controller.signal });

        if (token !== this.#requestToken) {
            return;                       // a newer request already answered
        }

        this.#render(results);
    } catch (error) {
        if (isAbortError(error) || token !== this.#requestToken) {
            return;                       // cancelled, not failed
        }

        this.#setStatus('error');
    }
}
```

Three things are load-bearing:

- **abort the previous request**, or responses race and the older one can win;
- **check the token too** — a request can be aborted _after_ the server replied,
  so the abort alone is not enough;
- **stay silent on cancellation**, or every superseded keystroke flashes an error.

Dispose the controller in `unmount()`.

---

## Accessibility

Use the native element. `<button>`, `<input>`, `<dialog>`, `<details>` bring
keyboard behaviour, focus handling and platform semantics that are tedious and
error-prone to rebuild.

If your component wraps a control, it needs an accessible name — and this is easy
to get wrong, because **a custom element is not a labelable element**.
`<label for="my-thing">` beside `<my-thing id="my-thing">` labels nothing.
Forward the host's `aria-label` and `aria-labelledby` to the internal control;
`<vui-customer-selector>` shows the full pattern.

Never let a `placeholder` be the accessible name. It disappears as the user
types, and an automated audit will still pass.

**Do not swallow a key you do not navigate with.** `preventDefault()` on an
arrow key takes page scrolling away from a keyboard user, so a component should
consume only the axis it actually moves on. The APG says this for tabs — "if the
tab list is horizontal, it does not listen for Down Arrow or Up Arrow so those
keys can provide their normal browser scrolling functions" — and the same holds
for any roving-focus collection. Read `aria-orientation` and act on one axis;
leave the other to the browser.

Update ARIA alongside the visual change:

```js
setLoading(loading) {
    this.toggleAttribute('aria-busy', loading);
    this.find('[data-loader]').hidden = !loading;
}
```

---

## Bidirectional text

The line falls where the authority boundary already falls.

**Layout is yours, not the library's.** Components carry no styling, so nothing
in `resources/js/` knows or cares which way a page reads. Mirroring a layout
under `dir="rtl"` is your CSS, and the way to write it is logical properties —
`margin-inline-start`, `padding-inline-end`, `inset-inline-end`,
`border-inline-start`, `text-align: start` — rather than the physical pairs.
Tailwind spells the same set `ms-`, `pe-`, `end-`, `border-s-`, `text-start`.
Get that right once and the page mirrors itself; get it wrong and no component
can rescue you, because none of them ship a stylesheet to override.

**Keyboard direction is the library's, not yours.** Arrow keys that move along
the inline axis are behaviour, and behaviour is what a component owns. A
horizontal collection laid out under `dir="rtl"` renders right-to-left, so
there <kbd>→</kbd> moves to the _previous_ item: "next" follows reading order,
not screen geometry. `<vui-tabs>` mirrors its horizontal arrows for exactly
this reason.

Three rules for implementing it:

1. **Read the direction from the element that lays the collection out** — the
   tablist, the menu, the toolbar. Not `document.documentElement.dir`: a
   subtree carries its own direction, and an English report inside an Arabic
   page (or the reverse) is the ordinary case, not the exotic one.
   `getComputedStyle(element).direction` resolves inheritance for you; a `dir`
   attribute check does not.
2. **Read it per keypress, not once at mount.** A language switcher can flip
   `dir` on a connected component, and one style read per arrow press is
   cheaper than a wrong answer.
3. **Mirror the inline axis only.** <kbd>↑</kbd> and <kbd>↓</kbd> never flip —
   direction is a property of the inline axis. Neither do <kbd>Home</kbd> and
   <kbd>End</kbd>, which already mean first and last rather than leftmost and
   rightmost, nor <kbd>Enter</kbd>, <kbd>Space</kbd>, <kbd>Escape</kbd> or
   <kbd>Tab</kbd>.

The WAI-ARIA APG does not spell this out in its individual patterns. What it
states is the principle the flip follows from: move focus in a pattern that
matches the reading order of the page's language.

Test it in a browser, with a real `dir="rtl"`. An automated audit will not find
this class of defect — the DOM and the ARIA are both correct while the arrows
walk backwards, so axe has nothing to report. Assert the focus moves, and
assert it twice: once for an RTL collection, and once for a collection whose
direction disagrees with the document's, which is the case a naive
implementation gets wrong.

---

## The test matrix

| Scenario                                    | Required                      |
| ------------------------------------------- | ----------------------------- |
| Definition before the element exists        | Yes                           |
| Element exists before definition            | Yes                           |
| Connect                                     | Yes                           |
| Disconnect                                  | Yes                           |
| **Reconnect — no duplicated markup**        | Yes                           |
| **Reconnect — no duplicated listener**      | Yes                           |
| Attribute defaults, and unusable values     | Yes                           |
| Attribute change while mounted              | If observed                   |
| Rich property assignment                    | If exposed                    |
| Property set before upgrade                 | If exposed                    |
| User event produces the expected DOM change | Yes                           |
| Public event name and `detail`              | If emitted                    |
| Bubbling                                    | If the contract says so       |
| Keyboard operation                          | If interactive                |
| Disabled state                              | If supported                  |
| Loading state                               | If async                      |
| Request abort and stale response            | If async                      |
| Error state                                 | If async                      |
| Insertion via an AJAX fragment              | For representative components |
| XSS-sensitive text                          | If it renders dynamic text    |
| Accessible name                             | If it wraps a control         |

The two reconnect rows are the ones people skip, and between them they have
caught more real bugs in this repository than every other row combined:

```js
element.remove();
root.append(element);

expect(element.querySelectorAll('[data-output]').length).toBe(1); // not 2
element.querySelector('button').click();
expect(handlerCalls).toBe(1); // not 2
```

Assert accessible names by role **and** name, with `exact: true`:

```js
await expect(page.getByRole('combobox', { name: 'Find a customer', exact: true })).toHaveCount(1);
```

An axe run alone is not enough — in this project a clean audit coexisted with two
unnamed widgets.

---

## Before you call it done

- [ ] A specification in `docs/components/`.
- [ ] Every attribute, property, method and event documented with its default.
- [ ] Every applicable row of the matrix tested.
- [ ] `npm test` passes — including `arch:check` and all three browser engines.
- [ ] Non-goals written down. What it will never do is as useful to the next
      reader as what it does.

---

## Adding to the core

Don't, until two components need it. Prefer a private method, then a shared
helper beside the components, and only then the core.

The core is 707 lines. Being reviewable in one sitting is worth more than any
individual convenience.

---

## Working with an AI agent

This repository is written to be worked on by coding agents — see
[ai-prompts.md](ai-prompts.md) for prompts that produce components which pass
these gates instead of ones you have to rewrite.
