/**
 * @file `<app-character-counter>` — a template for your own components.
 *
 * This is a **working component you are meant to copy and rename**, not an
 * abstract skeleton. It counts the characters in a form field and warns as the
 * limit approaches — a small, real job, chosen because it exercises every part
 * of the contract you will need:
 *
 * | Part                  | Where to look                                |
 * | --------------------- | -------------------------------------------- |
 * | Attribute config      | `max`, `warn-at` getters                     |
 * | Rich property         | `labels`, declared in `static properties`    |
 * | Observed attributes   | `attributeChangedCallback`                   |
 * | Enhancement rendering | `render()` adds to server markup             |
 * | Listener cleanup      | every listener takes `{ signal: this.signal }` |
 * | Timer cleanup         | `unmount()` clears the debounce              |
 * | Incremental updates   | `#update()` touches two nodes, never rebuilds |
 * | A public event        | `counter:limit-exceeded`                     |
 * | Accessibility         | `aria-describedby`, a polite live region     |
 *
 * See `docs/authoring-components.md` for the process, and `README.md` in this
 * directory for how to rename it into your own project.
 */

import { getAllowedPrefixes, setAllowedPrefixes } from '../../resources/js/core/register.js';
import { Component } from '../../resources/js/core/Component.js';
import { define } from '../../resources/js/core/register.js';

// STEP 1 — Register your prefix once, before any define() call.
// Do this in your application's boot file rather than per component; it lives
// here so this template works standalone.
if (!getAllowedPrefixes().includes('app-')) {
    setAllowedPrefixes([...getAllowedPrefixes(), 'app-']);
}

/**
 * Counts characters in the field it wraps.
 *
 * ```html
 * <app-character-counter max="140" warn-at="120">
 *     <label for="bio">Short bio</label>
 *     <textarea id="bio" name="bio"></textarea>
 * </app-character-counter>
 * ```
 *
 * @element app-character-counter
 * @fires app-character-counter#counter:limit-exceeded
 * @fires app-character-counter#counter:limit-restored
 */
export class CharacterCounter extends Component {
    // STEP 2 — Declare public properties so a value assigned before this class
    // loads is not silently lost. Omit this and the bug only shows up on slow
    // connections, which is to say in production and never on your machine.
    /** @type {readonly string[]} */
    static properties = Object.freeze(['labels']);

    // STEP 3 — Declare the attributes you react to *while mounted*. Attributes
    // read only at startup do not belong here.
    /** @returns {string[]} */
    static get observedAttributes() {
        return ['max', 'warn-at'];
    }

    /** Defaults live next to the component, not scattered through callers. */
    static defaults = Object.freeze({ max: 0, warnRatio: 0.85 });

    /** @type {Readonly<Record<string, string>>} */
    static labelDefaults = Object.freeze({
        remaining: 'characters remaining',
        exceeded: 'over the limit',
    });

    // STEP 4 — Canonical state. Plain fields; there is no reactivity, and
    // nothing here is public API.
    /** @type {HTMLInputElement|HTMLTextAreaElement|null} */
    #field = null;

    /** @type {HTMLElement|null} */
    #output = null;

    /** @type {ReturnType<typeof setTimeout>|null} */
    #timer = null;

    #exceeded = false;

    /** @type {Record<string, string>} */
    #labels = { ...CharacterCounter.labelDefaults };

    // STEP 5 — Public configuration. Attributes are parsed explicitly, with a
    // documented fallback for input you cannot use.

    /** @returns {number} Maximum characters; `0` disables the limit. */
    get max() {
        const raw = Number(this.getAttribute('max'));

        return Number.isFinite(raw) && raw > 0 ? raw : CharacterCounter.defaults.max;
    }

    /** @returns {number} Count at which the warning state begins. */
    get warnAt() {
        const raw = Number(this.getAttribute('warn-at'));

        if (Number.isFinite(raw) && raw > 0) {
            return raw;
        }

        return Math.floor(this.max * CharacterCounter.defaults.warnRatio);
    }

    /** @returns {number} Current character count. */
    get length() {
        return this.#field?.value.length ?? 0;
    }

    /**
     * Translated strings. Only the keys this component needs — never the whole
     * application catalogue.
     *
     * @returns {Record<string, string>}
     */
    get labels() {
        return { ...this.#labels };
    }

    /** @param {Record<string, string>} value */
    set labels(value) {
        this.#labels = { ...CharacterCounter.labelDefaults, ...(value ?? {}) };

        if (this.mounted) {
            this.#update();
        }
    }

    // STEP 6 — Lifecycle. `mount()` is overridden here because this is an
    // enhancement component: the server owns the field, so there is markup to
    // find before there is anything to render.

    mount() {
        this.#field = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (
            this.querySelector('input, textarea')
        );

        if (!this.#field) {
            // Fail loudly on a template mistake. A component that cannot do its
            // job should say so, not quietly do nothing.
            throw new Error(`<${this.localName}> requires an <input> or <textarea> child.`);
        }

        super.mount();
    }

    /**
     * Create component-owned markup.
     *
     * Must be idempotent: this runs again on every reconnect, so it detects its
     * own previous output rather than appending a second counter.
     *
     * @returns {void}
     */
    render() {
        // Recover our own previous output before deciding to build one. The
        // cached reference is cleared in unmount(), so on a reconnect this
        // check is the only thing standing between you and a second counter
        // appended below the first. Querying the DOM — not just testing the
        // field — is what makes render() genuinely idempotent.
        this.#output ??= /** @type {HTMLElement|null} */ (
            this.querySelector(':scope > [data-counter-output]')
        );

        if (this.#output && this.contains(this.#output)) {
            this.#update();

            return;
        }

        const field = /** @type {HTMLElement} */ (this.#field);
        const output = document.createElement('p');

        output.setAttribute('data-counter-output', '');
        // A polite live region announces the count without interrupting typing.
        output.setAttribute('role', 'status');
        output.setAttribute('aria-live', 'polite');
        output.id = `${field.id || this.localName}-counter`;

        this.append(output);
        this.#output = output;

        // Associate the message with the field, so a screen-reader user hears
        // the limit when they arrive rather than after they exceed it.
        const describedBy = field.getAttribute('aria-describedby');
        field.setAttribute(
            'aria-describedby',
            describedBy ? `${describedBy} ${output.id}` : output.id,
        );

        this.#update();
    }

    /**
     * Attach listeners. Always with `{ signal: this.signal }` — that is what
     * makes reconnecting safe.
     *
     * @returns {void}
     */
    bindEvents() {
        /** @type {HTMLElement} */ (this.#field).addEventListener('input', this.#handleInput, {
            signal: this.signal,
        });
    }

    /**
     * Release what the signal does not cover.
     *
     * The signal removes listeners; timers, observers, subscriptions and
     * in-flight requests are yours to dispose.
     *
     * @returns {void}
     */
    unmount() {
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }

        this.#field = null;
        this.#output = null;
    }

    /**
     * @param {string} name
     * @param {string|null} oldValue
     * @param {string|null} newValue
     * @returns {void}
     */
    attributeChangedCallback(name, oldValue, newValue) {
        void name;
        void newValue;

        if (oldValue === newValue || !this.mounted) {
            return;
        }

        this.#update();
    }

    // STEP 7 — Public methods. Explicit state changes that update the smallest
    // affected DOM and announce anything a consumer might act on.

    /**
     * Recalculate and repaint the counter.
     *
     * @returns {void}
     */
    refresh() {
        this.#update();
    }

    /** @type {(event: Event) => void} */
    #handleInput = () => {
        // Debounce the repaint, not the state. Typing should feel instant; the
        // announcement should not fire on every keystroke.
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
        }

        this.#timer = setTimeout(() => {
            this.#timer = null;
            this.#update();
        }, 120);
    };

    /**
     * Update only the nodes that changed.
     *
     * Never rebuild the subtree: replacing DOM would destroy focus, the text
     * selection and the caret position — in a component attached to a field the
     * user is actively typing in.
     *
     * @returns {void}
     */
    #update() {
        if (!this.#output || !this.#field) {
            return;
        }

        const { max } = this;
        const used = this.length;
        const remaining = max - used;
        const exceeded = max > 0 && used > max;

        // textContent, never innerHTML: the value is whatever the user typed.
        this.#output.textContent =
            max === 0
                ? String(used)
                : exceeded
                  ? `${Math.abs(remaining)} ${this.#labels.exceeded}`
                  : `${remaining} ${this.#labels.remaining}`;

        // State goes in a semantic attribute so CSS can hook it without the
        // component ever touching a class name.
        this.dataset.state = exceeded ? 'exceeded' : used >= this.warnAt ? 'warning' : 'ok';
        this.#field.setAttribute('aria-invalid', String(exceeded));

        // STEP 8 — Emit a fact when something meaningful changes, and only on
        // the transition. Firing on every keystroke would make the event
        // useless to a consumer.
        if (exceeded === this.#exceeded) {
            return;
        }

        this.#exceeded = exceeded;

        /**
         * @event app-character-counter#counter:limit-exceeded
         * @type {CustomEvent<{ length: number, max: number }>}
         */
        this.emit(exceeded ? 'counter:limit-exceeded' : 'counter:limit-restored', {
            length: used,
            max,
        });
    }
}

// STEP 9 — Register. `define()` is idempotent and validates both the name and
// your prefix policy, so importing this module twice is harmless.
define('app-character-counter', CharacterCounter);
