/**
 * @file `<vui-tabs>` — reference component R2.
 * @see docs/15-reference-components.md
 * @see docs/components/vui-tabs.md
 *
 * Proves the server-rendered *enhancement* mode: CodeIgniter owns the markup,
 * the component owns behaviour and ARIA state. `render()` is a no-op — the
 * initial DOM is never rebuilt, so server-rendered content, focus and any
 * third-party widget inside a panel survive untouched.
 */

import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

/** Keys that move selection or focus within a tablist. */
const NAVIGATION_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * How the horizontal arrows read when the tablist runs right-to-left.
 *
 * Only the inline axis reverses: ArrowUp/ArrowDown keep their meaning, and
 * Home/End are already logical — first and last, not leftmost and rightmost.
 */
const MIRRORED_KEYS = new Map([
    ['ArrowRight', 'ArrowLeft'],
    ['ArrowLeft', 'ArrowRight'],
]);

/**
 * Accessible tabs over server-rendered markup.
 *
 * Expected markup: an element with `role="tablist"` containing
 * `role="tab"` buttons, each pointing at a `role="tabpanel"` through
 * `aria-controls`.
 *
 * @element vui-tabs
 * @fires vui-tabs#tab:changed
 */
export class Tabs extends Component {
    /** @type {readonly string[]} */
    static properties = Object.freeze(['selectedIndex']);

    /** @returns {string[]} */
    static get observedAttributes() {
        return ['selected-index'];
    }

    /** @type {number} */
    #selectedIndex = 0;

    /** @type {HTMLElement[]} */
    #tabs = [];

    /** @type {HTMLElement[]} */
    #panels = [];

    /**
     * The element the tabs were collected from. Kept because it is also the
     * element whose writing direction decides which way the arrow keys point.
     *
     * @type {Element|null}
     */
    #tablist = null;

    /**
     * Index requested before the tabs were collected, e.g. by a property
     * assigned prior to upgrade. An explicit assignment outranks the
     * server-rendered attribute.
     *
     * @type {number|null}
     */
    #pendingIndex = null;

    #reflecting = false;

    /**
     * Index of the selected tab.
     *
     * @returns {number}
     */
    get selectedIndex() {
        return this.#selectedIndex;
    }

    /** @param {number} index */
    set selectedIndex(index) {
        this.select(index, { source: 'property' });
    }

    /**
     * Activation model, following the WAI-ARIA tabs pattern.
     *
     * `automatic` (default) selects a tab as soon as it receives focus;
     * `manual` moves focus only and waits for Enter or Space. Manual activation
     * is the right choice when selecting a tab is expensive.
     *
     * @returns {'automatic'|'manual'}
     */
    get activation() {
        return this.getAttribute('activation') === 'manual' ? 'manual' : 'automatic';
    }

    /** @returns {HTMLElement|null} The currently selected tab element. */
    get selectedTab() {
        return this.#tabs[this.#selectedIndex] ?? null;
    }

    /** @returns {HTMLElement|null} The currently visible panel element. */
    get selectedPanel() {
        return this.#panels[this.#selectedIndex] ?? null;
    }

    /**
     * Enhancement mode: adopt existing markup, never replace it.
     *
     * @returns {void}
     */
    mount() {
        this.refresh({ emit: false });
        this.bindEvents();
    }

    /** @returns {void} */
    bindEvents() {
        this.addEventListener('click', this.#handleClick, { signal: this.signal });
        this.addEventListener('keydown', this.#handleKeydown, { signal: this.signal });
    }

    /** @returns {void} */
    unmount() {
        this.#tabs = [];
        this.#panels = [];
        this.#tablist = null;
    }

    /**
     * Re-read tabs and panels from the DOM.
     *
     * Call this after replacing the tablist through an AJAX fragment. It is
     * cheap and idempotent; delegated listeners are unaffected.
     *
     * @param {Object} [options]
     * @param {boolean} [options.emit=true] Emit `tab:changed` if the resolved
     *   selection differs from the previous one.
     * @returns {void}
     */
    refresh(options = {}) {
        this.#collect();

        if (this.#tabs.length === 0) {
            return;
        }

        const requested = this.#pendingIndex ?? this.#readIndexAttribute() ?? this.#selectedIndex;
        this.#pendingIndex = null;
        const index = this.#clampIndex(requested);

        this.#applySelection(index, { source: 'refresh', emit: options.emit ?? true });
    }

    /**
     * Select a tab by index.
     *
     * Out-of-range indexes are clamped rather than throwing: a server template
     * that renders one tab fewer than expected should degrade, not break.
     *
     * @param {number} index
     * @param {Object} [options]
     * @param {'user'|'property'|'attribute'|'refresh'} [options.source='property']
     * @param {boolean} [options.focus=false] Move focus to the selected tab.
     * @returns {void}
     */
    select(index, options = {}) {
        if (this.#tabs.length === 0) {
            // Not mounted yet: remember the request for the next collection.
            this.#pendingIndex = Math.max(0, Math.trunc(Number(index) || 0));
            this.#selectedIndex = this.#pendingIndex;

            return;
        }

        const next = this.#clampIndex(index);
        this.#applySelection(next, { source: options.source ?? 'property', emit: true });

        if (options.focus) {
            this.#tabs[next]?.focus();
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

        if (name === 'selected-index') {
            const parsed = Number(newValue);

            if (Number.isFinite(parsed)) {
                this.select(parsed, { source: 'attribute' });
            }
        }
    }

    /** @returns {void} */
    #collect() {
        const tablist = this.querySelector('[role="tablist"]') ?? this;
        this.#tablist = tablist;

        this.#tabs = /** @type {HTMLElement[]} */ (
            Array.from(tablist.querySelectorAll('[role="tab"]')).filter(tab => this.#ownsNode(tab))
        );

        this.#panels = this.#tabs.map(tab => this.#resolvePanel(tab));
    }

    /**
     * A nested `<vui-tabs>` owns its own tabs. Without this guard an outer
     * component would steal the inner one's keyboard handling.
     *
     * @param {Element} node
     * @returns {boolean}
     */
    #ownsNode(node) {
        return node.closest(this.localName) === this;
    }

    /**
     * @param {HTMLElement} tab
     * @returns {HTMLElement}
     */
    #resolvePanel(tab) {
        const id = tab.getAttribute('aria-controls');
        const panel = id ? this.querySelector(`#${CSS.escape(id)}`) : null;

        if (!panel) {
            throw new Error(
                `<${this.localName}>: tab "${tab.textContent?.trim() ?? ''}" must reference an ` +
                    'existing panel through aria-controls.',
            );
        }

        return /** @type {HTMLElement} */ (panel);
    }

    /**
     * @param {number} index
     * @param {{ source: string, emit: boolean }} options
     * @returns {void}
     */
    #applySelection(index, options) {
        const previous = this.#selectedIndex;
        const changed = previous !== index;
        this.#selectedIndex = index;

        this.#tabs.forEach((tab, position) => {
            const selected = position === index;
            const panel = this.#panels[position];

            tab.setAttribute('aria-selected', String(selected));
            // Roving tabindex: exactly one tab is in the tab order, and arrow
            // keys move between the rest.
            tab.tabIndex = selected ? 0 : -1;

            if (panel) {
                panel.hidden = !selected;

                if (tab.id) {
                    panel.setAttribute('aria-labelledby', tab.id);
                }
            }
        });

        if (this.#readIndexAttribute() !== index) {
            this.#reflecting = true;
            this.setAttribute('selected-index', String(index));
            this.#reflecting = false;
        }

        if (!changed || !options.emit) {
            return;
        }

        /**
         * The selected tab changed.
         *
         * @event vui-tabs#tab:changed
         * @type {CustomEvent<{ index: number, previousIndex: number, tabId: string|null, panelId: string|null, source: string }>}
         */
        this.emit('tab:changed', {
            index,
            previousIndex: previous,
            tabId: this.#tabs[index]?.id || null,
            panelId: this.#panels[index]?.id || null,
            source: options.source,
        });
    }

    /** @returns {number|null} */
    #readIndexAttribute() {
        const raw = this.getAttribute('selected-index');

        if (raw === null) {
            return null;
        }

        const parsed = Number(raw);

        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }

    /**
     * @param {number} index
     * @returns {number}
     */
    #clampIndex(index) {
        const parsed = Math.trunc(Number(index));

        if (!Number.isFinite(parsed)) {
            return 0;
        }

        return Math.min(Math.max(parsed, 0), Math.max(this.#tabs.length - 1, 0));
    }

    /**
     * @param {MouseEvent} event
     * @returns {void}
     */
    #handleClick = event => {
        const target = /** @type {Element|null} */ (event.target);
        const tab = /** @type {HTMLElement|null} */ (target?.closest('[role="tab"]'));

        if (!tab || !this.#ownsNode(tab)) {
            return;
        }

        const index = this.#tabs.indexOf(tab);

        if (index !== -1) {
            this.select(index, { source: 'user', focus: true });
        }
    };

    /**
     * A navigation key expressed on the logical axis, so the rest of the
     * handler can reason in "next" and "previous" rather than left and right.
     *
     * A horizontal tablist laid out under `dir="rtl"` runs right-to-left, so
     * there ArrowRight moves to the *previous* tab. The direction is read from
     * computed style on the tablist rather than from `document.documentElement`,
     * because a subtree carries its own direction: an Arabic section inside an
     * English page is the ordinary case, and it is precisely where a check
     * against the document goes wrong. The tablist is asked rather than the
     * focused tab, because a tab may carry `dir` for its own label without
     * changing the order its siblings are laid out in.
     *
     * Style is read per keypress rather than cached at mount: a language
     * switcher may flip `dir` while the component is connected, and one
     * `getComputedStyle` per arrow press is not a cost worth a stale answer.
     *
     * The WAI-ARIA APG does not state this flip in the tabs pattern itself. Its
     * general rule — move focus in a pattern matching the reading order of the
     * page's language — is what it follows from.
     *
     * @param {string} key
     * @returns {string}
     */
    #navigationKey(key) {
        const element = this.#tablist ?? this;

        if (getComputedStyle(element).direction !== 'rtl') {
            return key;
        }

        return MIRRORED_KEYS.get(key) ?? key;
    }

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    #handleKeydown = event => {
        const target = /** @type {Element|null} */ (event.target);
        const tab = /** @type {HTMLElement|null} */ (target?.closest('[role="tab"]'));

        if (!tab || !this.#ownsNode(tab)) {
            return;
        }

        const current = this.#tabs.indexOf(tab);

        if (current === -1) {
            return;
        }

        if ((event.key === 'Enter' || event.key === ' ') && this.activation === 'manual') {
            event.preventDefault();
            this.select(current, { source: 'user', focus: true });

            return;
        }

        if (!NAVIGATION_KEYS.has(event.key)) {
            return;
        }

        event.preventDefault();

        const last = this.#tabs.length - 1;
        let next = current;

        switch (this.#navigationKey(event.key)) {
            case 'ArrowRight':
            case 'ArrowDown':
                next = current === last ? 0 : current + 1;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                next = current === 0 ? last : current - 1;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = last;
                break;
            default:
                break;
        }

        if (this.activation === 'manual') {
            this.#tabs[next]?.focus();

            return;
        }

        this.select(next, { source: 'user', focus: true });
    };
}

define('vui-tabs', Tabs);
