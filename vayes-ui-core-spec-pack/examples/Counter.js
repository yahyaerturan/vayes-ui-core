import { Component } from './Component.js';

export class Counter extends Component {
    #value = 0;
    #valueElement = null;

    render() {
        if (this.#valueElement) return;

        this.innerHTML = `
            <button type="button" data-action="decrement">-</button>
            <output data-value></output>
            <button type="button" data-action="increment">+</button>
        `;

        this.#valueElement = this.find('[data-value]');
        this.#updateValue();
    }

    bindEvents() {
        this.addEventListener('click', event => {
            const trigger = event.target.closest('[data-action]');
            if (!trigger || !this.contains(trigger)) return;

            if (trigger.dataset.action === 'increment') this.setValue(this.#value + 1);
            if (trigger.dataset.action === 'decrement') this.setValue(this.#value - 1);
        }, { signal: this.signal });
    }

    setValue(value) {
        const normalized = Number(value);
        if (!Number.isFinite(normalized) || normalized === this.#value) return;
        this.#value = normalized;
        this.#updateValue();
        this.emit('counter:changed', { value: this.#value });
    }

    #updateValue() {
        if (!this.#valueElement) return;
        this.#valueElement.value = String(this.#value);
        this.#valueElement.textContent = String(this.#value);
    }
}

if (!customElements.get('vui-counter')) {
    customElements.define('vui-counter', Counter);
}
