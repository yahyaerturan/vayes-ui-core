/**
 * @file Application event bus for genuinely non-DOM events.
 * @see docs/07-events-actions.md
 */

/**
 * A thin `EventTarget` wrapper for application events whose publisher and
 * subscriber intentionally have **no** DOM relationship — session changed,
 * locale changed, connectivity changed.
 *
 * It is not a general message broker and must not be used to avoid passing a
 * normal bubbling `CustomEvent` up the tree (ADR-003). If the subscriber is an
 * ancestor of the publisher, use `addEventListener` on the DOM instead.
 *
 * @example
 * const off = events.on('session:changed', handleSession);
 * off();
 *
 * @example <caption>Inside a component, prefer the lifecycle signal.</caption>
 * events.on('session:changed', this.handleSession, { signal: this.signal });
 */
export class EventBus extends EventTarget {
    /**
     * Publish an application event.
     *
     * Bus events do not bubble — there is no tree to bubble through — so only
     * `cancelable` is configurable.
     *
     * @param {string} name
     * @param {unknown} [detail]
     * @param {{ cancelable?: boolean }} [options]
     * @returns {boolean} `false` when a cancelable event was prevented.
     */
    emit(name, detail = undefined, options = {}) {
        return this.dispatchEvent(
            new CustomEvent(name, {
                detail,
                cancelable: options.cancelable ?? false,
            }),
        );
    }

    /**
     * Subscribe to an application event.
     *
     * @param {string} name
     * @param {EventListenerOrEventListenerObject} handler
     * @param {AddEventListenerOptions} [options] Pass `{ signal }` inside a
     *   component so the subscription dies with the mount cycle.
     * @returns {() => void} Unsubscribe function, for use outside components.
     */
    on(name, handler, options = {}) {
        this.addEventListener(name, handler, options);

        let unsubscribed = false;

        return () => {
            if (unsubscribed) {
                return;
            }

            unsubscribed = true;
            this.removeEventListener(name, handler, options);
        };
    }

    /**
     * Subscribe until the first delivery.
     *
     * @param {string} name
     * @param {EventListenerOrEventListenerObject} handler
     * @param {AddEventListenerOptions} [options]
     * @returns {() => void} Unsubscribe function.
     */
    once(name, handler, options = {}) {
        return this.on(name, handler, { ...options, once: true });
    }
}

/**
 * Default application bus. Applications may create additional buses, but a
 * single shared instance keeps event names globally meaningful.
 *
 * @type {EventBus}
 */
export const events = new EventBus();
