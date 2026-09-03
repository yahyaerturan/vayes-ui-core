/**
 * @file `<kit-dropdown>` — a menu button.
 *
 * Part of the admin kit, which is **example code, not library API**. Copy it
 * into your application and own it from there; it is not exported from the
 * package and carries no compatibility promise.
 *
 * Note what is absent: there is not one Tailwind class in this file. The
 * component toggles semantic state — `hidden`, `aria-expanded`, `data-state` —
 * and styling lives entirely in the markup you write and in `kit.css`. That is
 * what keeps it usable under Bootstrap, or plain CSS, or nothing at all
 * (docs/21-styling.md).
 */

import './prefix.js';
import { Component } from '../../../resources/js/core/Component.js';
import { define } from '../../../resources/js/core/register.js';

/** Keys that move focus within an open menu. */
const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * Expected markup:
 *
 * ```html
 * <kit-dropdown>
 *     <button type="button" data-trigger>Actions</button>
 *     <div data-menu hidden>
 *         <button type="button" role="menuitem" data-value="edit">Edit</button>
 *         <button type="button" role="menuitem" data-value="delete">Delete</button>
 *     </div>
 * </kit-dropdown>
 * ```
 *
 * @element kit-dropdown
 * @fires kit-dropdown#dropdown:opened
 * @fires kit-dropdown#dropdown:closed
 * @fires kit-dropdown#dropdown:selected
 */
export class Dropdown extends Component {
    /** @type {HTMLButtonElement|null} */
    #trigger = null;

    /** @type {HTMLElement|null} */
    #menu = null;

    #open = false;

    /** @returns {boolean} */
    get isOpen() {
        return this.#open;
    }

    /**
     * Placement is a styling concern, exposed as an attribute so CSS can hook
     * it. The component itself never positions anything.
     *
     * @returns {string}
     */
    get placement() {
        return this.getAttribute('placement') || 'bottom-start';
    }

    /** Enhancement mode: the server owns the markup. */
    mount() {
        this.#trigger = /** @type {HTMLButtonElement|null} */ (this.find('[data-trigger]'));
        this.#menu = /** @type {HTMLElement|null} */ (this.find('[data-menu]'));

        if (!this.#trigger || !this.#menu) {
            throw new Error(
                `<${this.localName}> requires a [data-trigger] control and a [data-menu] container.`,
            );
        }

        this.#applyStaticAria();
        this.close({ focusTrigger: false, emit: false });
        this.bindEvents();
    }

    bindEvents() {
        this.addEventListener('click', this.#handleClick, { signal: this.signal });
        this.addEventListener('keydown', this.#handleKeydown, { signal: this.signal });

        // Closing on an outside interaction needs a document listener. The
        // lifecycle signal removes it, so a dropdown inside a table row that
        // gets replaced by an AJAX refresh leaves nothing behind.
        document.addEventListener('pointerdown', this.#handleOutside, { signal: this.signal });
        document.addEventListener('focusin', this.#handleOutside, { signal: this.signal });

        // Escape is also handled at the document, not only on this element.
        // Safari does not focus a button when it is clicked, so after opening
        // the menu with the mouse there focus is still on <body> and a
        // component-scoped keydown listener never sees the key. Dismissal
        // should not depend on where focus happens to be.
        document.addEventListener('keydown', this.#handleEscape, { signal: this.signal });
    }

    unmount() {
        this.#trigger = null;
        this.#menu = null;
        this.#open = false;
    }

    /**
     * @param {Object} [options]
     * @param {boolean} [options.focusFirst=false] Move focus to the first item.
     * @returns {boolean} `false` when it was already open.
     */
    open(options = {}) {
        if (this.#open || !this.#menu || !this.#trigger) {
            return false;
        }

        this.#open = true;
        this.#menu.hidden = false;
        this.#trigger.setAttribute('aria-expanded', 'true');
        this.dataset.state = 'open';

        if (options.focusFirst) {
            this.#items()[0]?.focus();
        }

        this.emit('dropdown:opened');

        return true;
    }

    /**
     * @param {Object} [options]
     * @param {boolean|'auto'} [options.focusTrigger='auto'] Whether to return
     *   focus to the trigger. `'auto'` does so only when focus is currently
     *   inside the component; `true` always; `false` never.
     * @param {boolean} [options.emit=true]
     * @returns {boolean} `false` when it was already closed.
     */
    close(options = {}) {
        const wasOpen = this.#open;

        if (!this.#menu || !this.#trigger) {
            return false;
        }

        this.#open = false;
        this.#menu.hidden = true;
        this.#trigger.setAttribute('aria-expanded', 'false');
        this.dataset.state = 'closed';

        if (!wasOpen) {
            return false;
        }

        // Three cases, because "did the user mean to come back here?" has three
        // answers. Escape is an explicit dismissal and always returns focus, as
        // the menu button pattern requires. An outside click or a Tab away
        // means the user has moved on, and yanking focus back would be hostile.
        // Everything else follows focus: reclaim it only if it is still inside.
        //
        // The distinction is not academic. Safari does not focus a button when
        // it is clicked, so after opening the menu with the mouse there focus is
        // on <body> — and a rule of "only if focus is inside" would silently
        // drop the user at the top of the document on Escape.
        const focusMode = options.focusTrigger ?? 'auto';
        const shouldFocus =
            focusMode === true || (focusMode === 'auto' && this.contains(document.activeElement));

        if (shouldFocus) {
            this.#trigger.focus();
        }

        if (options.emit !== false) {
            this.emit('dropdown:closed');
        }

        return true;
    }

    /** @returns {void} */
    toggle() {
        if (this.#open) {
            this.close();
        } else {
            this.open();
        }
    }

    /** @returns {HTMLElement[]} Enabled menu items, in DOM order. */
    #items() {
        return /** @type {HTMLElement[]} */ (
            this.findAll('[role="menuitem"]').filter(
                item => !(/** @type {HTMLButtonElement} */ (item).disabled),
            )
        );
    }

    /** @returns {void} */
    #applyStaticAria() {
        const trigger = /** @type {HTMLButtonElement} */ (this.#trigger);
        const menu = /** @type {HTMLElement} */ (this.#menu);

        trigger.setAttribute('aria-haspopup', 'true');

        if (!menu.id) {
            menu.id = `${this.localName}-menu-${Math.random().toString(36).slice(2, 8)}`;
        }

        trigger.setAttribute('aria-controls', menu.id);

        if (!menu.hasAttribute('role')) {
            menu.setAttribute('role', 'menu');
        }

        // A menu needs a name; the trigger's own label is the natural source.
        if (!menu.hasAttribute('aria-label') && !menu.hasAttribute('aria-labelledby')) {
            if (!trigger.id) {
                trigger.id = `${menu.id}-trigger`;
            }

            menu.setAttribute('aria-labelledby', trigger.id);
        }

        for (const item of this.findAll('[role="menuitem"]')) {
            item.setAttribute('tabindex', '-1');
        }
    }

    /** @type {(event: MouseEvent) => void} */
    #handleClick = event => {
        const target = /** @type {Element|null} */ (event.target);

        if (target?.closest('[data-trigger]') === this.#trigger) {
            this.toggle();

            return;
        }

        const item = /** @type {HTMLElement|null} */ (target?.closest('[role="menuitem"]'));

        if (item && this.contains(item)) {
            this.emit('dropdown:selected', {
                value: item.dataset.value ?? null,
                label: item.textContent?.trim() ?? '',
            });
            this.close();
        }
    };

    /** @type {(event: KeyboardEvent) => void} */
    #handleKeydown = event => {
        const items = this.#items();
        const onTrigger = /** @type {Element|null} */ (event.target)?.closest('[data-trigger]');

        if (onTrigger) {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.open({ focusFirst: true });
            }

            return;
        }

        if (!this.#open) {
            return;
        }

        if (event.key === 'Tab') {
            // Tabbing out is a legitimate way to dismiss; do not trap.
            this.close({ focusTrigger: false });

            return;
        }

        if (!NAVIGATION_KEYS.has(event.key) || items.length === 0) {
            return;
        }

        event.preventDefault();

        const current = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
        const last = items.length - 1;
        let next = current;

        switch (event.key) {
            case 'ArrowDown':
                next = current >= last ? 0 : current + 1;
                break;
            case 'ArrowUp':
                next = current <= 0 ? last : current - 1;
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

        items[next]?.focus();
    };

    /** @type {(event: KeyboardEvent) => void} */
    #handleEscape = event => {
        if (event.key !== 'Escape' || !this.#open) {
            return;
        }

        event.preventDefault();
        this.close({ focusTrigger: true });
    };

    /** @type {(event: Event) => void} */
    #handleOutside = event => {
        if (!this.#open) {
            return;
        }

        const target = /** @type {Node|null} */ (event.target);

        if (target && !this.contains(target)) {
            this.close({ focusTrigger: false });
        }
    };
}

define('kit-dropdown', Dropdown);
