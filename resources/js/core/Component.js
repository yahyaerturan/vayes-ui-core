/**
 * @file Base class for Vayes UI Core custom elements.
 * @see docs/03-core-api.md
 * @see docs/04-component-lifecycle.md
 * @see docs/07-events-actions.md
 */

/**
 * Options accepted by {@link Component#emit}.
 *
 * @typedef {Object} EmitOptions
 * @property {boolean} [bubbles=true]
 * @property {boolean} [composed=true]
 * @property {boolean} [cancelable=false]
 */

/**
 * Options accepted by {@link Component#bindActions}.
 *
 * @typedef {Object} BindActionsOptions
 * @property {string|string[]} [events='click'] DOM event type(s) to delegate.
 * @property {string} [attribute='action'] `dataset` key holding the action id.
 * @property {EventTarget} [root=this] Delegation root. Defaults to the component.
 */

/**
 * `Component` standardises the parts of the Custom Elements lifecycle that are
 * easy to get wrong: duplicate `connectedCallback` invocations, listener leaks
 * across reconnects, and rich properties assigned before the element class was
 * defined.
 *
 * It deliberately provides **no** reactivity, no virtual DOM and no automatic
 * re-render. State changes update the DOM through explicit methods
 * (ADR-004).
 *
 * Extension points, all no-ops in the base class:
 *
 * - {@link Component#mount} — runs on every connection.
 * - {@link Component#unmount} — runs on every disconnection, before abort.
 * - {@link Component#render} — create component-owned markup (idempotent).
 * - {@link Component#bindEvents} — attach listeners, always with `this.signal`.
 *
 * @example
 * class Toggle extends Component {
 *     static properties = ['config'];
 *
 *     bindEvents() {
 *         this.addEventListener('click', () => this.toggle(), { signal: this.signal });
 *     }
 * }
 * define('vui-toggle', Toggle);
 */
export class Component extends HTMLElement {
    /**
     * Names of public accessor properties that must survive assignment before
     * the element was upgraded. Subclasses override this list.
     *
     * @type {readonly string[]}
     */
    static properties = Object.freeze([]);

    /** @type {boolean} */
    #mounted = false;

    /** @type {AbortController|null} */
    #lifecycle = null;

    /**
     * Whether the component currently considers itself connected and mounted.
     *
     * @returns {boolean}
     */
    get mounted() {
        return this.#mounted;
    }

    /**
     * `AbortSignal` scoped to the current mount cycle. A fresh signal is
     * created on every connection and aborted on disconnection, so every
     * listener registered with it is removed automatically.
     *
     * Accessing it while unmounted is a programmer error: it would produce a
     * listener nothing will ever clean up.
     *
     * @returns {AbortSignal}
     * @throws {Error} When the component is not mounted.
     */
    get signal() {
        if (!this.#lifecycle) {
            throw new Error(
                `<${this.localName}>: "signal" is only available while the component is mounted. ` +
                    'Register listeners from mount()/bindEvents(), not from the constructor.',
            );
        }

        return this.#lifecycle.signal;
    }

    /**
     * Native lifecycle callback. Idempotent: a second call without an
     * intervening disconnection is ignored, because the DOM may invoke it more
     * than once for a single logical mount (for example when an ancestor is
     * moved).
     *
     * @returns {void}
     */
    connectedCallback() {
        if (this.#mounted) {
            return;
        }

        this.#lifecycle = new AbortController();
        this.#mounted = true;

        for (const property of this.constructor.properties ?? []) {
            this.upgradeProperty(property);
        }

        this.mount();
    }

    /**
     * Native lifecycle callback.
     *
     * Order is normative and tested: `unmount()` runs **before** the lifecycle
     * signal aborts, so cleanup code can still read live state and, if needed,
     * touch listeners that are about to be removed.
     *
     * @returns {void}
     */
    disconnectedCallback() {
        if (!this.#mounted) {
            return;
        }

        try {
            this.unmount();
        } finally {
            this.#lifecycle?.abort();
            this.#lifecycle = null;
            this.#mounted = false;
        }
    }

    /**
     * Called on every connection. The default implementation performs the
     * canonical two-step: create owned markup, then bind listeners.
     *
     * @returns {void}
     */
    mount() {
        this.render();
        this.bindEvents();
    }

    /**
     * Called on every disconnection, before the lifecycle signal aborts.
     * Dispose observers, timers and subscriptions that are not signal-bound.
     *
     * @returns {void}
     */
    unmount() {}

    /**
     * Create component-owned markup. Must be idempotent: it runs again on every
     * reconnect. Enhancement components leave it as a no-op.
     *
     * @returns {void}
     */
    render() {}

    /**
     * Attach event listeners. Always pass `{ signal: this.signal }` so that
     * reconnecting cannot duplicate a listener.
     *
     * @returns {void}
     */
    bindEvents() {}

    /**
     * Dispatch a `CustomEvent` from this element.
     *
     * Defaults to `bubbles: true, composed: true, cancelable: false`, because a
     * component event reports a fact an ancestor may care about.
     *
     * @param {string} name Event name, conventionally `entity:past-tense`.
     * @param {unknown} [detail] Public payload. Treated as an API contract.
     * @param {EmitOptions} [options]
     * @returns {boolean} `false` when a cancelable event was prevented.
     */
    emit(name, detail = undefined, options = {}) {
        return this.dispatchEvent(
            new CustomEvent(name, {
                detail,
                bubbles: options.bubbles ?? true,
                composed: options.composed ?? true,
                cancelable: options.cancelable ?? false,
            }),
        );
    }

    /**
     * @param {string} selector
     * @returns {Element|null}
     */
    find(selector) {
        return this.querySelector(selector);
    }

    /**
     * Like {@link Component#find} but returns a real array, not a live
     * `NodeList`, so array methods are available without ceremony.
     *
     * @param {string} selector
     * @returns {Element[]}
     */
    findAll(selector) {
        return Array.from(this.querySelectorAll(selector));
    }

    /**
     * Rescue a property that was assigned before the element was upgraded.
     *
     * Assigning `el.customer = {...}` to a not-yet-defined element creates an
     * *own* data property that shadows the class accessor installed later. This
     * deletes the own property and re-assigns the value so the setter runs.
     *
     * @param {string} name
     * @returns {void}
     */
    upgradeProperty(name) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
            return;
        }

        const value = this[name];
        delete this[name];
        this[name] = value;
    }

    /**
     * Install delegated `data-action` handling for this component.
     *
     * One listener on the component root serves every current and future
     * descendant, so replacing inner markup never requires rebinding
     * (docs/06-rendering-dom.md, Phase 3).
     *
     * Ownership rule: an action belongs to the *nearest* custom element
     * ancestor. Triggers nested inside another custom element are ignored, so
     * component boundaries do not steal each other's actions.
     *
     * The attribute value is data, never code: it is passed to
     * {@link Component#handleAction}, which resolves it with explicit
     * application code (AGENTS.md §2).
     *
     * @param {BindActionsOptions} [options]
     * @returns {void}
     */
    bindActions(options = {}) {
        const attribute = options.attribute ?? 'action';
        const selector = `[data-${attribute}]`;
        const root = options.root ?? this;
        const events = Array.isArray(options.events) ? options.events : [options.events ?? 'click'];

        for (const type of events) {
            root.addEventListener(
                type,
                event => {
                    const target = /** @type {Element|null} */ (event.target);
                    const trigger = target?.closest?.(selector);

                    if (!trigger || !this.ownsActionTrigger(trigger)) {
                        return;
                    }

                    const action = /** @type {HTMLElement} */ (trigger).dataset[attribute];

                    if (action === undefined || action === '') {
                        return;
                    }

                    this.handleAction(action, /** @type {HTMLElement} */ (trigger), event);
                },
                { signal: this.signal },
            );
        }
    }

    /**
     * Whether a delegated action trigger belongs to this component rather than
     * to a nested custom element.
     *
     * @param {Element} trigger
     * @returns {boolean}
     */
    ownsActionTrigger(trigger) {
        if (!this.contains(trigger)) {
            return false;
        }

        for (let node = trigger.parentElement; node && node !== this; node = node.parentElement) {
            if (node.localName.includes('-')) {
                return false;
            }
        }

        return true;
    }

    /**
     * Handle a delegated action. Subclasses map identifiers to their own
     * methods with an explicit, inspectable switch or frozen map.
     *
     * @param {string} action Value of the `data-action` attribute.
     * @param {HTMLElement} trigger Element carrying the attribute.
     * @param {Event} event Originating DOM event.
     * @returns {void}
     */
    handleAction(action, trigger, event) {
        void action;
        void trigger;
        void event;
    }
}
