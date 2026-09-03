# Getting started

Ten minutes, from nothing to a working component with a test.

If you already have a CodeIgniter application, read
[existing-project.md](existing-project.md) instead — it covers the same ground
with the constraints of a codebase that already exists.

---

## 1. Run the demo first

Seeing it work removes a lot of guesswork.

```bash
npm install
npx playwright install chromium

composer create-project codeigniter4/appstarter ci4   # first time only
npm run ci4:install
npm run ci4:serve
```

Open <http://127.0.0.1:8081>. The page demonstrates all four rendering modes:
server-rendered enhancement, client-owned markup, a JSON-driven component, and
an AJAX fragment containing further components.

Try this in the console:

```js
document.addEventListener('counter:changed', e => console.log(e.detail));
```

Then click the counter. That is the whole communication model.

For a version with no server at all, serve the repository and open
`/examples/standalone.html`:

```bash
node scripts/serve-static.mjs 5173 .
```

---

## 2. Write a component

Create `resources/js/components/common/Toggle.js`:

```js
import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

/**
 * A two-state switch.
 *
 * @element vui-toggle
 * @fires vui-toggle#toggle:changed
 */
export class Toggle extends Component {
  static properties = Object.freeze(['on']);

  static get observedAttributes() {
    return ['on', 'disabled'];
  }

  #on = false;
  #button = null;

  get on() {
    return this.#on;
  }

  set on(value) {
    this.setOn(value);
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  render() {
    // Idempotent: this runs again on every reconnect, so detect prior output.
    if (this.#button && this.contains(this.#button)) {
      return;
    }

    this.#button = document.createElement('button');
    this.#button.type = 'button';
    this.#button.dataset.action = 'toggle';
    this.append(this.#button);

    this.#on = this.hasAttribute('on');
    this.#update();
  }

  bindEvents() {
    this.bindActions();
  }

  unmount() {
    this.#button = null;
  }

  handleAction(action) {
    if (action === 'toggle' && !this.disabled) {
      this.setOn(!this.#on, { source: 'user' });
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    if (name === 'on') {
      this.setOn(newValue !== null, { emit: false });
    }

    this.#update();
  }

  setOn(value, options = {}) {
    const next = Boolean(value);

    if (next === this.#on) {
      return;
    }

    this.#on = next;
    this.toggleAttribute('on', next);
    this.#update();

    if (options.emit !== false) {
      this.emit('toggle:changed', { on: next, source: options.source ?? 'property' });
    }
  }

  #update() {
    if (!this.#button) {
      return;
    }

    // textContent, not innerHTML: this is where untrusted data would land.
    this.#button.textContent = this.#on ? 'On' : 'Off';
    this.#button.setAttribute('aria-pressed', String(this.#on));
    this.#button.disabled = this.disabled;
  }
}

define('vui-toggle', Toggle);
```

Five details worth noticing, because they are the ones people miss:

| Detail                             | Why it is there                                                           |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `static properties = ['on']`       | Rescues a property assigned before the class loaded.                      |
| `render()` checks for prior output | It runs again on every reconnect.                                         |
| `bindActions()` in `bindEvents()`  | One delegated listener, bound to the mount signal, removed automatically. |
| `setOn(..., { emit: false })`      | Hydrating from an attribute is not a user change.                         |
| `aria-pressed`                     | State that is visible must also be announced.                             |

## 3. Use it

```html
<vui-toggle on></vui-toggle>
```

```js
import './components/common/Toggle.js';

document.addEventListener('toggle:changed', event => {
  console.log('now', event.detail.on);
});
```

No initialisation call. The element works whether it was in the initial HTML,
created in JavaScript, or inserted by an AJAX response — and whether the module
loaded before or after the markup existed.

## 4. Test it

`tests/browser/toggle.spec.js`:

```js
import { test, expect } from './support/fixtures.js';

const load = page => page.evaluate(() => import('/resources/js/components/common/Toggle.js'));

test('toggles and announces the change', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = '<vui-toggle></vui-toggle>';
  });

  const heard = await page.evaluate(() => {
    const seen = [];
    document.addEventListener('toggle:changed', e => seen.push(e.detail));
    document.querySelector('button').click();

    return seen;
  });

  expect(heard).toEqual([{ on: true, source: 'user' }]);
  await expect(page.locator('button')).toHaveAttribute('aria-pressed', 'true');
});

test('reconnecting does not duplicate the handler', async ({ page }) => {
  await load(page);

  const count = await page.evaluate(() => {
    const root = document.getElementById('root');
    root.innerHTML = '<vui-toggle></vui-toggle>';

    const toggle = root.querySelector('vui-toggle');
    let events = 0;
    document.addEventListener('toggle:changed', () => (events += 1));

    toggle.remove();
    root.append(toggle);
    toggle.querySelector('button').click();

    return events;
  });

  expect(count).toBe(1);
});
```

```bash
npm run test:browser:chromium
```

The second test is the important one. Remove it and a listener leak can live in
your codebase indefinitely without anyone noticing.

> **This example is executable.** The component above and both tests live in
> `examples/toggle/Toggle.js` and `tests/browser/example-toggle.spec.js`, and
> run as part of the suite — so an API change that breaks this guide breaks the
> build. The only difference is the import paths, which point at this
> repository's source rather than at a published package.

---

## Where to go next

| You want to                                     | Read                                               |
| ----------------------------------------------- | -------------------------------------------------- |
| Understand the model properly                   | [concepts.md](concepts.md)                         |
| Write a real component, with the full checklist | [authoring-components.md](authoring-components.md) |
| Do a specific task                              | [recipes.md](recipes.md)                           |
| Wire the server side                            | [ci4-integration.md](ci4-integration.md)           |
| Look up an exact signature                      | [core-api.md](core-api.md)                         |
