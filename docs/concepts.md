# Concepts

Six ideas. Each one replaces a habit that server-rendered applications tend to
accumulate. Once these are clear the rest of the library is small.

---

## 1. A component is a Custom Element

A reusable behaviour is a tag.

```html
<vui-customer-selector endpoint="/api/customers/search"></vui-customer-selector>
```

The browser owns the lifecycle. When the element enters the document it starts;
when it leaves, it stops. You never call an initialiser.

**What this replaces:** `$('.customer-selector').each(init)` and every variation
of it.

### Upgrade is retroactive, and that is the whole trick

Registration and markup can happen in either order:

- markup first, module later — every matching element already in the document is
  upgraded the moment `customElements.define()` runs;
- module first, markup later — an element inserted at any point afterwards, by
  any means, starts on insertion.

This is why AJAX-inserted HTML needs no initialisation pass. The server returns
a fragment containing `<vui-counter>`; you insert it; it works. There is no
"re-init after AJAX" step because there was never an init step.

That guarantee is load-bearing enough that the architecture forbids DOM
initialisation scanners outright (ADR-007).

---

## 2. One `AbortSignal` per mount cycle

Every component gets a fresh `AbortSignal` when it connects. Pass it to
everything:

```js
bindEvents() {
    this.addEventListener('click', this.handleClick, { signal: this.signal });
    document.addEventListener('keydown', this.handleKey, { signal: this.signal });
    window.addEventListener('resize', this.handleResize, { signal: this.signal });
}
```

On disconnect the signal aborts and **every** listener registered with it is
removed — on any target, in one operation. Nothing to track, nothing to forget.

**What this replaces:** paired `removeEventListener` calls, and the leaks that
happen when someone adds a listener and forgets the pairing.

This matters more than it first appears, because an element can be connected,
disconnected and reconnected any number of times. A component that binds
listeners without a signal accumulates a duplicate set on every reconnect: one
click, three handlers. The base class makes that failure mode structurally
impossible rather than a thing you remember.

---

## 3. State is plain JavaScript, and DOM updates are explicit

There is no reactivity. You change a value and you say what that means:

```js
setLoading(loading) {
    this.state.loading = loading;
    this.find('[data-loader]').hidden = !loading;
    this.toggleAttribute('aria-busy', loading);
}
```

Three lines instead of one, and in exchange the path from state to pixel is
visible in the source and steppable in a debugger.

The rule is to update the smallest affected node. Never rebuild a subtree to
reflect one change: replacing DOM destroys focus, text selection, scroll
position, uncontrolled input values and any state a native widget was holding.

**What this replaces:** `setState()` and a re-render, and the class of bugs where
typing in a field resets it.

---

## 4. Components announce facts; they do not call out

A component emits what happened. It does not know who cares.

```js
this.emit('customer:selected', { id: customer.id, customer });
```

Anything up the tree can listen, because component events bubble by default:

```js
document.addEventListener('customer:selected', event => {
  invoiceTotals.setCustomer(event.detail.customer);
});
```

These are native `CustomEvent`s dispatched on real elements. Any code listening
through the standard DOM API receives them — the component makes no assumption
about what the listener is written with.

Event names read as `entity:past-tense`: `customer:selected`, `modal:closed`,
`tab:changed`. Avoid `change` or `update` for public events; they say nothing.

For an action a listener may veto, emit a cancelable pre-event and check the
return value:

```js
if (!this.emit('modal:before-close', { reason }, { cancelable: true })) {
  return; // a listener called preventDefault()
}
```

The `EventBus` exists for the narrow case where publisher and subscriber have no
DOM relationship at all — session changed, locale changed, connection lost. If
the subscriber is an ancestor, use a DOM event; that is what bubbling is for.

**What this replaces:** components calling application globals, and the coupling
that follows.

---

## 5. Attributes configure, properties carry data

| Use an attribute for                    | Use a property for                            |
| --------------------------------------- | --------------------------------------------- |
| strings, numbers, booleans, enums, URLs | objects, arrays, functions, service instances |
| anything an author writes in a view     | anything JavaScript hands over                |

```html
<vui-customer-selector
  endpoint="/api/customers/search"
  min-query="2"
  disabled
></vui-customer-selector>
```

```js
selector.selected = { id: '7', name: 'Ada Lovelace' };
selector.service = customerService;
```

Booleans follow HTML: presence means true, so `disabled="false"` is still
disabled.

### The upgrade trap

Assigning a property to an element whose class has not loaded yet creates an own
property that shadows the accessor installed later — the value is silently lost.
Declare public properties and the base class rescues them:

```js
static properties = ['selected', 'service'];
```

Do this for every public property. It costs one line and prevents a bug that
only appears under slow networks or lazy loading.

---

## 6. Transport is separate from UI

`HttpClient` sends requests and reports what happened. It never shows a spinner,
never picks an error message, never touches the DOM. That boundary is enforced
by a build gate, not by convention.

The part that matters day to day is that four failure modes stay distinct:

| What happened               | You get                             | What the UI should do     |
| --------------------------- | ----------------------------------- | ------------------------- |
| You cancelled the request   | `AbortError` (use `isAbortError()`) | nothing at all            |
| Your timeout elapsed        | `TimeoutError`                      | offer a retry             |
| No response arrived         | `NetworkError`                      | "check your connection"   |
| The server answered 4xx/5xx | `HttpError` with status and body    | show what the server said |

Collapsing these is how a search box ends up flashing an error on every
keystroke: each new keystroke cancels the previous request, and a cancellation
is not a failure.

```js
try {
  const results = await service.search(query, { signal: controller.signal });
  this.render(results);
} catch (error) {
  if (isAbortError(error)) {
    return; // superseded — say nothing
  }
  this.showError();
}
```

---

## How the pieces sit together

```
CodeIgniter  ─ routes, auth, validation, persistence, views, fragments
     │
     ▼
Custom Element  ─ lifecycle, local state, explicit DOM updates, CustomEvents
     │
     ├── Service      ─ endpoints and payload shapes for one domain area
     │      │
     │      ▼
     │   HttpClient   ─ headers, CSRF, timeout, abort, error taxonomy
     │
     └── EventBus     ─ only for events with no DOM relationship
```

Dependencies point one way: components use services, services use the client,
and nothing in the core knows a component exists.

---

## What is deliberately absent

No virtual DOM. No reactivity or signals. No hooks. No JSX or template language.
No client router. No global state store. No dependency injection. No runtime npm
dependency. No `eval` in any form.

Each of these is refused by an accepted ADR, and several are enforced by
`npm run arch:check`. If you find yourself needing one, that is a design
conversation and an ADR — not a pull request.

**Next:** [getting-started.md](getting-started.md) for a new project, or
[existing-project.md](existing-project.md) to adopt this in an application you
already have.
