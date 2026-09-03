/**
 * @file `<vui-counter>` — reference component R1.
 * @see docs/15-reference-components.md
 * @see docs/components/vui-counter.md
 *
 * Proves the smallest complete component contract: client-owned markup, local
 * state, incremental DOM updates, delegated `data-action` handling, a public
 * `CustomEvent`, attribute/property configuration and reconnect safety.
 */

import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

/**
 * A numeric stepper.
 *
 * @element vui-counter
 * @fires vui-counter#counter:changed
 *
 * @example
 * <vui-counter value="3" step="5"></vui-counter>
 */
export class Counter extends Component {
    /** @type {readonly string[]} */
    static properties = Object.freeze(['value']);

    /** @returns {string[]} */
    static get observedAttributes() {
        return ['value', 'step', 'disabled'];
    }

    /** @type {Readonly<{ value: number, step: number }>} */
    static defaults = Object.freeze({ value: 0, step: 1 });

    /** Canonical local state. */
    #value = Counter.defaults.value;

    /** @type {HTMLOutputElement|null} */
    #output = null;

    /** @type {HTMLButtonElement[]} */
    #buttons = [];

    /** Guards attribute↔property reflection from looping. */
    #reflecting = false;

    /**
     * Current value.
     *
     * @returns {number}
     */
    get value() {
        return this.#value;
    }

    /**
     * Assigning the property is a programmatic change: it updates the DOM and
     * emits `counter:changed` with `source: 'property'`.
     *
     * @param {number} next
     */
    set value(next) {
        this.setValue(next, { source: 'property' });
    }

    /**
     * Increment applied by the buttons. Invalid or non-finite values fall back
     * to the documented default rather than poisoning state with `NaN`.
     *
     * @returns {number}
     */
    get step() {
        const raw = this.getAttribute('step');

        if (raw === null) {
            return Counter.defaults.step;
        }

        const parsed = Number(raw);

        return Number.isFinite(parsed) && parsed !== 0 ? parsed : Counter.defaults.step;
    }

    /**
     * HTML boolean semantics: presence means true, so `disabled="false"` is
     * still disabled.
     *
     * @returns {boolean}
     */
    get disabled() {
        return this.hasAttribute('disabled');
    }

    /** @param {boolean} value */
    set disabled(value) {
        this.toggleAttribute('disabled', Boolean(value));
    }

    /**
     * Creates component-owned markup exactly once per set of children. Runs
     * again on reconnect and must therefore detect its own previous output.
     *
     * @returns {void}
     */
    render() {
        if (this.#output && this.contains(this.#output)) {
            this.#cacheElements();
            this.#updateValue();
            this.#updateDisabled();

            return;
        }

        // safe-html: a static, developer-authored literal with no interpolation
        // at all. The value is written separately through textContent.
        this.innerHTML = `
            <button class="vui-counter__button" type="button" data-action="decrement" aria-label="Decrease">−</button>
            <output class="vui-counter__value" data-value>0</output>
            <button class="vui-counter__button" type="button" data-action="increment" aria-label="Increase">+</button>
        `;

        this.#cacheElements();
        this.#applyValueAttribute();
        this.#updateValue();
        this.#updateDisabled();
    }

    /** @returns {void} */
    bindEvents() {
        this.bindActions();
    }

    /** @returns {void} */
    unmount() {
        this.#output = null;
        this.#buttons = [];
    }

    /**
     * @param {string} action
     * @returns {void}
     */
    handleAction(action) {
        if (this.disabled) {
            return;
        }

        switch (action) {
            case 'increment':
                this.setValue(this.#value + this.step, { source: 'user' });
                break;
            case 'decrement':
                this.setValue(this.#value - this.step, { source: 'user' });
                break;
            case 'reset':
                this.setValue(Counter.defaults.value, { source: 'user' });
                break;
            default:
                break;
        }
    }

    /**
     * @param {string} name
     * @param {string|null} oldValue
     * @param {string|null} newValue
     * @returns {void}
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue || this.#reflecting) {
            return;
        }

        if (name === 'value') {
            this.#applyValueAttribute();
            this.#updateValue();

            return;
        }

        if (name === 'disabled') {
            this.#updateDisabled();
        }
    }

    /**
     * Set the value, update the smallest affected DOM region and announce the
     * change.
     *
     * @param {number} next
     * @param {Object} [options]
     * @param {'user'|'property'|'attribute'|'init'} [options.source='property']
     * @param {boolean} [options.emit=true] Suppressed for initial hydration.
     * @returns {void}
     */
    setValue(next, options = {}) {
        const normalized = Number(next);

        if (!Number.isFinite(normalized) || normalized === this.#value) {
            return;
        }

        const previous = this.#value;
        this.#value = normalized;

        this.#reflect();
        this.#updateValue();

        if (options.emit === false) {
            return;
        }

        /**
         * The value changed.
         *
         * @event vui-counter#counter:changed
         * @type {CustomEvent<{ value: number, previous: number, source: string }>}
         */
        this.emit('counter:changed', {
            value: this.#value,
            previous,
            source: options.source ?? 'property',
        });
    }

    /** @returns {void} */
    increment() {
        this.setValue(this.#value + this.step, { source: 'property' });
    }

    /** @returns {void} */
    decrement() {
        this.setValue(this.#value - this.step, { source: 'property' });
    }

    /** @returns {void} */
    #cacheElements() {
        this.#output = /** @type {HTMLOutputElement|null} */ (this.find('[data-value]'));
        this.#buttons = /** @type {HTMLButtonElement[]} */ (this.findAll('button[data-action]'));
    }

    /** @returns {void} */
    #applyValueAttribute() {
        const raw = this.getAttribute('value');

        if (raw === null) {
            return;
        }

        const parsed = Number(raw);

        if (Number.isFinite(parsed)) {
            this.#value = parsed;
        }
    }

    /** @returns {void} */
    #reflect() {
        this.#reflecting = true;
        this.setAttribute('value', String(this.#value));
        this.#reflecting = false;
    }

    /** @returns {void} */
    #updateValue() {
        if (!this.#output) {
            return;
        }

        const text = String(this.#value);
        this.#output.value = text;
        this.#output.textContent = text;
    }

    /** @returns {void} */
    #updateDisabled() {
        const disabled = this.disabled;

        for (const button of this.#buttons) {
            button.disabled = disabled;
        }
    }
}

define('vui-counter', Counter);
