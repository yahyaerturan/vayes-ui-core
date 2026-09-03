/**
 * @file Optional registry mapping declarative markup identifiers to handlers.
 * @see docs/07-events-actions.md
 * @see docs/16-implementation-plan.md (Phase 8)
 *
 * This module is **optional** and intentionally not re-exported from
 * `core/index.js`. Native `addEventListener` remains the default component
 * communication mechanism; removing this file must not affect it.
 *
 * It exists for one case: server-rendered markup that names an application
 * handler, e.g.
 *
 * ```html
 * <vui-customer-selector data-on-selected="invoice.customerSelected">
 * ```
 *
 * The attribute value is an opaque **key**, never code and never a path into
 * `window`. Lookup is an exact match in a `Map`, so no string can reach a
 * function that was not deliberately registered.
 */

/**
 * Context handed to a declarative handler. Handlers receive this explicitly
 * instead of reading hidden globals.
 *
 * @typedef {Object} ActionContext
 * @property {string} action Registered identifier that was invoked.
 * @property {Event} [event] Originating DOM event, when there is one.
 * @property {Element} [element] Element that declared the action.
 * @property {unknown} [detail] Event detail or caller-supplied payload.
 */

/**
 * An exact-key registry of application action handlers.
 */
export class ActionRegistry {
    /** @type {Map<string, (context: ActionContext) => unknown>} */
    #handlers = new Map();

    /**
     * @param {string} name Application-scoped identifier, e.g. `invoice.saved`.
     * @param {(context: ActionContext) => unknown} handler
     * @returns {() => void} Unregister function.
     * @throws {TypeError} On an invalid name or handler.
     * @throws {Error} When the name is already registered.
     */
    register(name, handler) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new TypeError('ActionRegistry.register() requires a non-empty string name.');
        }

        if (typeof handler !== 'function') {
            throw new TypeError(`Handler for action "${name}" must be a function.`);
        }

        if (this.#handlers.has(name)) {
            throw new Error(`Action "${name}" is already registered.`);
        }

        this.#handlers.set(name, handler);

        return () => this.unregister(name);
    }

    /**
     * @param {string} name
     * @returns {boolean} Whether a handler was removed.
     */
    unregister(name) {
        return this.#handlers.delete(name);
    }

    /**
     * @param {unknown} name
     * @returns {boolean}
     */
    has(name) {
        return typeof name === 'string' && this.#handlers.has(name);
    }

    /**
     * @param {unknown} name
     * @returns {((context: ActionContext) => unknown)|undefined}
     */
    get(name) {
        return typeof name === 'string' ? this.#handlers.get(name) : undefined;
    }

    /**
     * Invoke a registered handler.
     *
     * An unknown identifier is a programmer error — a typo in a view template
     * or a missing registration — so it throws instead of failing silently
     * (docs/19-observability-errors.md).
     *
     * @param {string} name
     * @param {ActionContext} [context]
     * @returns {unknown} The handler's return value.
     * @throws {Error} When no handler is registered under that exact key.
     */
    invoke(name, context = /** @type {ActionContext} */ ({})) {
        const handler = this.get(name);

        if (!handler) {
            throw new Error(
                `No handler is registered for action "${String(name)}". ` +
                    'Register it with actions.register() before referencing it from markup.',
            );
        }

        return handler({ ...context, action: name });
    }

    /**
     * Registered identifiers, for diagnostics and tests.
     *
     * @returns {string[]}
     */
    get names() {
        return [...this.#handlers.keys()];
    }
}

/**
 * Default registry instance for applications that opt into declarative actions.
 *
 * @type {ActionRegistry}
 */
export const actions = new ActionRegistry();
