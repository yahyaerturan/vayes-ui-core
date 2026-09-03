# Component template

A **working** component to copy and rename, not an abstract skeleton.

`<app-character-counter>` counts the characters in a form field and warns as the
limit approaches. Small, real, and chosen because it exercises every part of the
contract you will need.

```bash
cp examples/component-template/CharacterCounter.js  resources/js/components/YourThing.js
cp tests/browser/example-template.spec.js           tests/browser/your-thing.spec.js
```

---

## What to change

| In the component                                    | Change to                                                  |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `class CharacterCounter`                            | your class name                                            |
| `define('app-character-counter', …)`                | your tag — must contain a hyphen                           |
| The `'app-'` prefix block at the top                | move it to your boot file; keep one prefix per project     |
| `counter:limit-exceeded` / `counter:limit-restored` | your event names, as `entity:past-tense`                   |
| The import paths                                    | `'@vayes/ui-core'` if you installed with a package manager |
| The file header                                     | what your component does                                   |

Delete what you do not need. Everything left is a pattern you would otherwise
have to rediscover.

---

## What each part demonstrates

The numbered `STEP` comments in the file map to
[docs/authoring-components.md](../../docs/authoring-components.md).

| Step | Shows                                                                 |
| ---- | --------------------------------------------------------------------- |
| 1    | Registering a prefix before `define()`                                |
| 2    | `static properties` — surviving a property set before the class loads |
| 3    | `observedAttributes` — only what you react to _while mounted_         |
| 4    | Private fields for canonical state; no reactivity anywhere            |
| 5    | Parsing attributes explicitly, with a documented fallback             |
| 6    | Lifecycle: `mount`, idempotent `render`, `bindEvents`, `unmount`      |
| 7    | Public methods that update the smallest affected node                 |
| 8    | Emitting a fact on the _transition_, not on every change              |
| 9    | Idempotent registration                                               |

---

## Three details worth reading closely

**`render()` recovers its own output by querying the DOM.**

```js
this.#output ??= this.querySelector(':scope > [data-counter-output]');
```

`render()` runs again on every reconnect, and `unmount()` clears the cached
reference — so without this the component appends a second counter every time it
is removed and re-added. This exact bug shipped in this repository's own admin
kit, in a component whose other tests all passed.

**The debounce is on the repaint, not on the state.**

Typing should feel instant; the announcement should not fire on every keystroke.
The timer is cleared in `unmount()`, because the lifecycle signal covers
listeners but not timers.

**The count is associated with the field.**

`aria-describedby` links the live region to the input, so a screen-reader user
hears the limit on arrival rather than after exceeding it. `role="status"` with
`aria-live="polite"` announces changes without interrupting typing.

---

## The test file

`tests/browser/example-template.spec.js` is the worked example of the test
matrix. Each `describe` block is one section of it:

- **rendering and configuration** — defaults, unusable values, observed
  attributes, rich properties, property-before-upgrade
- **behaviour** — typing, state transitions, event timing, caret preservation
- **lifecycle** — reconnect without duplication, timer cleanup, loud failure on
  missing markup
- **accessibility** — association, live region, XSS-sensitive rendering

The reconnect test is the one to keep. It is four lines and it catches the bug
class that costs the most to find later.

---

## Then

- [docs/authoring-components.md](../../docs/authoring-components.md) — the full
  procedure, rules and checklist
- [docs/ai-prompts.md](../../docs/ai-prompts.md) — prompts for building
  components with a coding agent
- `vayes-ui-core-spec-pack/COMPONENT_SPEC_TEMPLATE.md` — the specification
  template to fill in
