/** Simplified reference only; tests/spec are authoritative. */
export class Component extends HTMLElement {
    #mounted = false;
    #lifecycleController = null;

    get mounted() {
        return this.#mounted;
    }

    get signal() {
        if (!this.#lifecycleController) {
            throw new Error('Component is not currently mounted.');
        }
        return this.#lifecycleController.signal;
    }

    connectedCallback() {
        if (this.#mounted) return;

        this.#lifecycleController = new AbortController();
        this.#mounted = true;

        for (const property of this.constructor.properties ?? []) {
            this.upgradeProperty(property);
        }

        this.mount();
    }

    disconnectedCallback() {
        if (!this.#mounted) return;

        try {
            this.unmount();
        } finally {
            this.#lifecycleController?.abort();
            this.#lifecycleController = null;
            this.#mounted = false;
        }
    }

    mount() {
        this.render();
        this.bindEvents();
    }

    unmount() {}
    render() {}
    bindEvents() {}

    emit(name, detail = undefined, options = {}) {
        return this.dispatchEvent(new CustomEvent(name, {
            detail,
            bubbles: options.bubbles ?? true,
            composed: options.composed ?? true,
            cancelable: options.cancelable ?? false,
        }));
    }

    find(selector) {
        return this.querySelector(selector);
    }

    findAll(selector) {
        return Array.from(this.querySelectorAll(selector));
    }

    upgradeProperty(name) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) return;
        const value = this[name];
        delete this[name];
        this[name] = value;
    }
}
