import { Component } from '../../resources/js/core/Component.js';
import { define } from '../../resources/js/core/register.js';

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
