# Admin kit

A curated set of admin-dashboard building blocks, styled with Tailwind CSS 4 and
built on Vayes UI Core.

```bash
node scripts/serve-static.mjs 5173 .
# open http://127.0.0.1:5173/examples/dashboard/index.html
```

`kit.css` is committed, so that works on a fresh clone with no build step.

---

## This is example code, not library API

Nothing here is exported from the package, versioned, or covered by any
compatibility promise. **Copy what you want into your application and own it
from there.** The `kit-` prefix exists so that is obvious in the DOM: a `vui-`
tag is the library, a `kit-` tag is something you copied.

That is deliberate. `docs/21-styling.md` is explicit that Vayes UI Core is not a
CSS framework and not a design system; shipping one inside the package would
make every visual decision a versioned API and every restyle a breaking change.

---

## Patterns and components are different things

**A card is not a component.** It is a `<div>` with classes. Wrapping it in a
custom element would add a lifecycle, an upgrade path and a registration for no
behaviour at all, and make it harder to style rather than easier.

So the kit splits in two:

| Patterns — markup only, in `index.html`                                       | Components — behaviour, in `js/`                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Page header, stat tiles, cards, badges, empty state, table shell, form fields | Dropdown, toast host, confirm dialog, async button, sortable table |
| Copy the markup and classes                                                   | Copy the file and the styles it relies on                          |

If you find yourself writing a component with an empty `bindEvents()`, it is a
pattern.

---

## Components

### `<kit-dropdown>` — menu button

```html
<kit-dropdown placement="bottom-end">
  <button type="button" data-trigger class="kit-button-secondary">Actions</button>
  <div data-menu hidden>
    <button type="button" role="menuitem" data-value="edit">Edit</button>
    <button type="button" role="menuitem" data-value="delete" data-variant="danger">Delete</button>
  </div>
</kit-dropdown>
```

Keyboard: ArrowDown from the trigger opens and focuses the first item; arrows
wrap; Home/End jump; Escape closes and returns focus; Tab dismisses without
trapping. ARIA (`aria-haspopup`, `aria-expanded`, `aria-controls`) and the
menu's accessible name are applied for you.

Emits `dropdown:opened`, `dropdown:closed`, and `dropdown:selected` with
`{ value, label }`.

### `<kit-toast-host>` — notifications

```html
<kit-toast-host></kit-toast-host>
```

```js
host.show({ variant: 'success', title: 'Saved', message: 'The customer was created.' });
```

One per page. `show()` returns an id for `dismiss(id)`. `timeout: 0` keeps a
toast until dismissed. Removing the host clears every pending timer and
discards the toasts — a notification is transient by definition.

### `<kit-confirm-dialog>` — confirm a destructive action

```js
const ok = await dialog.confirm({
  title: 'Delete customer?',
  message: `${name} will be removed. This cannot be undone.`,
  confirmLabel: 'Delete',
  variant: 'danger',
});
```

Returns a promise, because `if (await …)` reads exactly like the decision it
represents. Escape and the backdrop decline. Focus lands on **Cancel**, not on
the destructive button. Disconnecting resolves `false` rather than leaving the
caller awaiting forever.

### `<kit-async-button>` — in-flight state

```html
<kit-async-button id="save" busy-label="Saving…">
  <button type="button" class="kit-button-primary">Save changes</button>
</kit-async-button>
```

```js
await saveButton.run(() => http.post('/api/customers', data, { json: true }));
```

Wraps a real `<button>`, so form association and native keyboard behaviour keep
working. `run()` restores the button in a `finally`, including when the work
throws — which is the bug it exists to prevent. Clicks during flight are
swallowed at the capture phase, not merely blocked by `disabled`.

Put the `id` on the **component**, not on the inner button. Getting that wrong
is how `run()` becomes `undefined`.

### `<kit-sortable-table>` — column sorting

```html
<kit-sortable-table client-sort sort-column="name" sort-direction="ascending">
  <table class="kit-table">
    <thead>
      <tr>
        <th data-sort="name">Name</th>
        <th data-sort="spend" data-sort-type="number">Spend</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Ada Lovelace</td>
        <td data-sort-value="4820">£4,820</td>
      </tr>
    </tbody>
  </table>
</kit-sortable-table>
```

Enhancement mode: the server owns the table. `data-sort-value` sorts a formatted
cell by its underlying value. Header controls are wrapped in real `<button>`
elements, so keyboard support comes from the platform.

`client-sort` is **off by default**, because sorting only the visible page of a
paginated table is a lie. Without it the component manages `aria-sort` and emits
`table:sorted` so you can reload a server-sorted fragment.

It sorts by moving existing rows, never by rebuilding them — so components,
focus and open menus inside cells survive.

**It does one thing.** No pagination, filtering, selection, virtualisation or
fetching. `docs/15-reference-components.md` warns against starting with a
DataTable for good reason.

---

## Three rules that make the styling work

**1. No component contains a Tailwind class.** Components toggle semantic state
— `hidden`, `aria-expanded`, `data-state`, `aria-sort` — and all styling lives
in your markup and in `kit.css`. That keeps every component usable under
Bootstrap or plain CSS, and it means no class name is ever built in JavaScript,
which is where Tailwind's build-time scan would silently miss it.

**2. Shared primitives are `@utility`, not classes in a layer.** In Tailwind v4
`@apply` resolves utilities only, so `@apply kit-button-secondary` fails if
`kit-button-secondary` is an ordinary class. `@utility` makes them composable
and usable with variants.

**3. Every inline-axis utility is logical, never physical.** `end-0` not
`right-0`, `pe-10` not `pr-10`, `text-start` not `text-left`, `border-s-4` not
`border-l-4`. The kit is copied wholesale into real applications, and a physical
utility survives that copy as a bug in every RTL locale the application ever
reaches. The dropdown is the sharp case: `kit-dropdown[placement='bottom-end']`
is already named logically, so implementing it with `right-0` would open a
`bottom-end` menu on the wrong side under `dir="rtl"` — the attribute promising
one thing and the CSS doing another. Block-axis utilities have no direction and
stay physical: `top-2`, `mt-1`, `bottom-0`.

Layout is the only half of RTL that lives here. Direction-sensitive keyboard
behaviour belongs to the components and is already handled — see
[Bidirectional text](../../docs/authoring-components.md#bidirectional-text).

### Three collisions worth knowing about

All three will hit you the moment you put a native `<dialog>` into a Tailwind
application with a dark theme:

- **A native `<dialog>` loses its centring.** The browser centres a modal dialog
  with `margin: auto`, and Tailwind's preflight resets every margin to zero. The
  fix is `m-auto` on the dialog, which `kit.css` applies.

- **`dark:` follows the OS, not a class.** In v4 a `.dark` class on `<html>` does
  nothing until you declare
  `@custom-variant dark (&:where(.dark, .dark *));`.

- **A `<dialog>` does not inherit text colour.** The user-agent stylesheet sets
  `dialog { color: CanvasText }`. That is a real declaration, so it _breaks_
  inheritance from `<body>` — and `CanvasText` stays black while `color-scheme`
  is light. The result is black text on a dark panel, affecting every descendant
  that does not set its own colour, including content a consumer puts inside.

  Two things fix it, and `kit.css` does both:

  ```css
  /* 1. Tell the browser the scheme, not just Tailwind. This also fixes native
        form controls and scrollbars inside the dialog. */
  :root.dark {
    color-scheme: dark;
  }

  /* 2. State the colour explicitly, so it holds regardless. */
  vui-modal .vui-modal__dialog {
    @apply text-slate-900 dark:text-slate-100;
  }
  ```

  This one shipped in 1.2.0 and was reported by a user. The audit had opened the
  dropdown, the confirm dialog and a toast — but never this modal. The fix
  included replacing those hand-written cases with an enumerated table of every
  overlay in both themes, which is harder to leave a hole in.

---

## Rebuilding the CSS

```bash
npm run kit:css     # build once
npm run kit:watch   # rebuild on change
```

Source is `src/kit.css`. The output is committed so the showcase opens without a
build.

`@source` directives tell Tailwind where to scan. If you copy a component into a
new location, add that path or its classes will not be generated — a build-time
scan only sees what you point it at.

---

## Tested

`tests/browser/kit.spec.js` drives this page: keyboard behaviour, ARIA state,
promise resolution, timer cleanup, XSS-sensitive rendering, and an axe audit in
both light and dark themes.

The audit is an enumerated table: every overlay state — default, dropdown open,
confirm dialog open, invite modal open, toast showing — crossed with both
themes. It is written that way because the one bug that escaped 1.2.0 escaped
through a missing case, not a missing assertion.

Untested example code is how a "fast start" turns into someone else's debugging
session. Writing these tests found six real bugs: Escape not closing a dropdown
opened by mouse in Safari, toasts frozen after a reconnect, a dialog pinned to
the top-left under preflight, four colour-contrast failures in dark mode, `dark:`
doing nothing from a class, and black dialog text on a dark panel.
