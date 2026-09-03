/**
 * @file `<vui-modal>` — reference component R3.
 * @see docs/15-reference-components.md
 * @see docs/components/vui-modal.md
 *
 * Proves client-owned markup, a cancelable pre-event, document-level
 * interaction cleaned up by the lifecycle signal, and focus management.
 *
 * Built on native `<dialog>` + `showModal()` deliberately (docs/12-accessibility.md
 * asks that native semantics be evaluated first). The platform then provides
 * the focus trap, inertness of the background, the top layer, `::backdrop`, and
 * Escape handling — all of which are laborious and easy to get subtly wrong in
 * a hand-rolled dialog.
 */

import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';

/**
 * Reason a close was initiated. Consumers can branch on it in
 * `modal:before-close` — for example, to confirm before discarding a draft on
 * Escape but not on an explicit Save.
 *
 * @typedef {'method'|'escape'|'backdrop'|'action'|'disconnect'} CloseReason
 */

/**
 * A modal dialog that wraps its light-DOM children.
 *
 * @element vui-modal
 * @fires vui-modal#modal:opened
 * @fires vui-modal#modal:before-close
 * @fires vui-modal#modal:closed
 *
 * @example
 * <vui-modal aria-label="Edit customer">
 *     <h2>Edit customer</h2>
 *     <button type="button" data-action="close">Cancel</button>
 * </vui-modal>
 */
export class Modal extends Component {
    /** @returns {string[]} */
    static get observedAttributes() {
        return ['open', 'aria-label', 'aria-labelledby'];
    }

    /** @type {HTMLDialogElement|null} */
    #dialog = null;

    /** Element focus should return to when the dialog closes. */
    #invoker = null;

    #reflecting = false;

    /**
     * Whether the dialog is currently shown.
     *
     * The state is *also* reflected to an `open` attribute on the host, which
     * is what stylesheets should target. The boolean lives on `isOpen` rather
     * than `open` so that `open()` can stay a verb, as the spec requires.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return this.#dialog?.open ?? false;
    }

    /**
     * Whether Escape and backdrop clicks may dismiss the dialog. Dismissal
     * still passes through the cancelable `modal:before-close` event.
     *
     * @returns {boolean}
     */
    get dismissible() {
        return !this.hasAttribute('no-dismiss');
    }

    /**
     * Creates the `<dialog>` wrapper once and adopts existing children as its
     * content, so server-rendered modal bodies work unchanged.
     *
     * @returns {void}
     */
    render() {
        if (this.#dialog && this.contains(this.#dialog)) {
            return;
        }

        const existing = /** @type {HTMLDialogElement|null} */ (
            this.querySelector(':scope > dialog[data-vui-modal]')
        );

        if (existing) {
            this.#dialog = existing;

            return;
        }

        const dialog = document.createElement('dialog');
        dialog.className = 'vui-modal__dialog';
        dialog.setAttribute('data-vui-modal', '');

        const content = document.createElement('div');
        content.className = 'vui-modal__content';
        content.setAttribute('data-content', '');
        content.append(...this.childNodes);

        dialog.append(content);
        this.append(dialog);
        this.#dialog = dialog;
        this.#applyLabel();
    }

    /** @returns {void} */
    bindEvents() {
        const dialog = this.#requireDialog();

        // The platform fires `cancel` for Escape. Intercepting it routes the
        // dismissal through our cancelable contract instead of letting the
        // browser close the dialog behind the application's back.
        dialog.addEventListener(
            'cancel',
            event => {
                event.preventDefault();

                if (this.dismissible) {
                    this.close('escape');
                }
            },
            { signal: this.signal },
        );

        // A click whose target is the dialog itself landed on the backdrop:
        // the content lives in a child element.
        dialog.addEventListener(
            'click',
            event => {
                if (event.target === dialog && this.dismissible) {
                    this.close('backdrop');
                }
            },
            { signal: this.signal },
        );

        this.bindActions();
    }

    /**
     * A disconnected dialog leaves the top layer, so its open state cannot be
     * preserved. Closing here keeps DOM and component state consistent and
     * restores focus; no events are emitted, because a removal is not a user
     * decision to close.
     *
     * @returns {void}
     */
    unmount() {
        if (this.#dialog?.open) {
            this.#dialog.close();
            this.#reflectOpen(false);
            this.#restoreFocus();
        }
    }

    /**
     * @param {string} action
     * @returns {void}
     */
    handleAction(action) {
        if (action === 'close') {
            this.close('action');
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

        if (name === 'aria-label' || name === 'aria-labelledby') {
            this.#applyLabel();

            return;
        }

        if (name !== 'open' || !this.mounted) {
            return;
        }

        if (newValue === null) {
            this.close('method');
        } else {
            this.open();
        }
    }

    /**
     * Show the dialog.
     *
     * @param {Object} [options]
     * @param {HTMLElement|null} [options.invoker] Element focus returns to on
     *   close. Defaults to whatever had focus when `open()` was called.
     * @returns {boolean} `false` when the dialog was already open.
     * @throws {Error} When called while disconnected — `showModal()` requires a
     *   connected element.
     */
    open(options = {}) {
        const dialog = this.#requireDialog();

        if (dialog.open) {
            return false;
        }

        if (!this.isConnected) {
            throw new Error(`<${this.localName}>: open() requires the element to be connected.`);
        }

        this.#invoker =
            options.invoker ?? /** @type {HTMLElement|null} */ (document.activeElement) ?? null;

        dialog.showModal();
        this.#reflectOpen(true);

        /**
         * The dialog became visible.
         *
         * @event vui-modal#modal:opened
         * @type {CustomEvent<{}>}
         */
        this.emit('modal:opened');

        return true;
    }

    /**
     * Close the dialog unless a listener prevents `modal:before-close`.
     *
     * @param {CloseReason} [reason='method']
     * @returns {boolean} `false` when the dialog was closed already or the
     *   close was prevented.
     */
    close(reason = 'method') {
        const dialog = this.#requireDialog();

        if (!dialog.open) {
            return false;
        }

        /**
         * About to close. Call `preventDefault()` to keep the dialog open.
         *
         * @event vui-modal#modal:before-close
         * @type {CustomEvent<{ reason: CloseReason }>}
         */
        const allowed = this.emit('modal:before-close', { reason }, { cancelable: true });

        if (!allowed) {
            return false;
        }

        dialog.close();
        this.#reflectOpen(false);
        this.#restoreFocus();

        /**
         * The dialog was closed.
         *
         * @event vui-modal#modal:closed
         * @type {CustomEvent<{ reason: CloseReason }>}
         */
        this.emit('modal:closed', { reason });

        return true;
    }

    /**
     * Convenience toggle.
     *
     * @param {boolean} [force]
     * @returns {boolean}
     */
    toggle(force = undefined) {
        const shouldOpen = force ?? !this.isOpen;

        return shouldOpen ? this.open() : this.close();
    }

    /**
     * Delegate the host's accessible name onto the `<dialog>`.
     *
     * The dialog role lives on the internal `<dialog>`, not on the host, so an
     * `aria-label` written on `<vui-modal>` names an element with no role and
     * leaves the dialog anonymous. Assistive technology then announces a dialog
     * with no name, which is exactly the sort of defect an automated audit
     * misses: axe's `aria-dialog-name` rule matches `[role="dialog"]`, and a
     * native `<dialog>` has only an implicit role.
     *
     * Authors keep writing plain ARIA on the element they can see; the
     * component forwards it to the element that needs it.
     *
     * @returns {void}
     */
    #applyLabel() {
        const dialog = this.#dialog;

        if (!dialog) {
            return;
        }

        const labelledBy = this.getAttribute('aria-labelledby');
        const label = this.getAttribute('aria-label');

        // Id references resolve document-wide, so copying the attribute is
        // enough — the referenced element does not need to move.
        if (labelledBy) {
            dialog.setAttribute('aria-labelledby', labelledBy);
            dialog.removeAttribute('aria-label');

            return;
        }

        if (label) {
            dialog.setAttribute('aria-label', label);
            dialog.removeAttribute('aria-labelledby');

            return;
        }

        dialog.removeAttribute('aria-label');
        dialog.removeAttribute('aria-labelledby');
    }

    /** @returns {HTMLDialogElement} */
    #requireDialog() {
        if (!this.#dialog) {
            this.render();
        }

        if (!this.#dialog) {
            throw new Error(`<${this.localName}>: dialog element is unavailable.`);
        }

        return this.#dialog;
    }

    /**
     * @param {boolean} open
     * @returns {void}
     */
    #reflectOpen(open) {
        this.#reflecting = true;
        this.toggleAttribute('open', open);
        this.#reflecting = false;
    }

    /** @returns {void} */
    #restoreFocus() {
        const invoker = this.#invoker;
        this.#invoker = null;

        if (invoker && invoker.isConnected && typeof invoker.focus === 'function') {
            invoker.focus();
        }
    }
}

define('vui-modal', Modal);
