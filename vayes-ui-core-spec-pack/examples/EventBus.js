export class EventBus extends EventTarget {
    emit(name, detail = undefined, options = {}) {
        return this.dispatchEvent(new CustomEvent(name, {
            detail,
            cancelable: options.cancelable ?? false,
        }));
    }

    on(name, handler, options = {}) {
        this.addEventListener(name, handler, options);
        return () => this.removeEventListener(name, handler, options);
    }

    once(name, handler, options = {}) {
        return this.on(name, handler, { ...options, once: true });
    }
}

export const events = new EventBus();
