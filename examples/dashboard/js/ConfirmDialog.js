/**
 * @file `<kit-confirm-dialog>` — confirm before a destructive action.
 *
 * Admin kit example code, not library API.
 *
 * Built on the native `<dialog>` for the same reason `<vui-modal>` is: the
 * platform supplies the focus trap, background inertness, the top layer and
 * Escape handling, all of which are laborious to rebuild and easy to get subtly
 * wrong.
 *
 * The public method returns a promise, which is the shape this particular
 * interaction wants — `if (await dialog.confirm(…))` reads exactly like the
 * decision it represents. Events are still emitted for anything that wants to
 * observe rather than ask.
 */

import './prefix.js';
import { Component } from '../../../resources/js/core/Component.js';
import { define } from '../../../resources/js/core/register.js';

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title]
 * @property {string} [message]
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {'danger'|'default'} [variant='default']
 */

let titleSequence = 0;

/**
 * @param {string} tag
 * @param {Record<string, string>} attributes
 * @returns {HTMLElement}
 */
function create(tag, attributes) {
    const element = document.createElement(tag);

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    return element;
}

/**
 * ```html
 * <kit-confirm-dialog></kit-confirm-dialog>
 * ```
 *
 * ```js
 * const ok = await dialog.confirm({
 *     title: 'Archive customer?',
 *     message: 'They will no longer appear in search.',
 *     confirmLabel: 'Archive',
 *     variant: 'danger',
 * });
 * ```
 *
 * @element kit-confirm-dialog
 * @fires kit-confirm-dialog#confirm:resolved
 */
export class ConfirmDialog extends Component {
    /** @type {HTMLDialogElement|null} */
    #dialog = null;

    /** @type {((value: boolean) => void)|null} */
    #resolve = null;

    /** @type {HTMLElement|null} */
    #invoker = null;

    /** @type {Readonly<Record<string, string>>} */
    static defaults = Object.freeze({
        title: 'Are you sure?',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
    });

    render() {
        if (this.#dialog && this.contains(this.#dialog)) {
            return;
        }

        // Built with DOM methods rather than an HTML string. The values here
        // happen to be internal, so a template literal would be defensible —
        // but this is example code, and the pattern worth copying is the one
        // that cannot become an injection when someone later interpolates a
        // record name into it.
        const dialog = document.createElement('dialog');
        dialog.setAttribute('data-confirm-dialog', '');

        const panel = create('div', { 'data-panel': '' });
        const title = create('h2', {
            'data-title': '',
            id: `${this.localName}-title-${++titleSequence}`,
        });
        const message = create('p', { 'data-message': '' });
        const actions = create('div', { 'data-actions': '' });

        const cancel = create('button', { type: 'button', 'data-action': 'cancel' });
        const confirm = create('button', { type: 'button', 'data-action': 'confirm' });

        actions.append(cancel, confirm);
        panel.append(title, message, actions);
        dialog.append(panel);

        // The dialog carries the dialog role, so the name belongs on it — not
        // on the host, where it would name an element with a generic role.
        dialog.setAttribute('aria-labelledby', title.id);

        this.append(dialog);
        this.#dialog = dialog;
    }

    bindEvents() {
        const dialog = /** @type {HTMLDialogElement} */ (this.#dialog);

        // Escape reaches us as `cancel`; route it through the same path as the
        // Cancel button so there is exactly one way to decline.
        dialog.addEventListener(
            'cancel',
            event => {
                event.preventDefault();
                this.#settle(false, 'escape');
            },
            { signal: this.signal },
        );

        dialog.addEventListener(
            'click',
            event => {
                if (event.target === dialog) {
                    this.#settle(false, 'backdrop');
                }
            },
            { signal: this.signal },
        );

        this.bindActions();
    }

    /**
     * A pending promise must not be abandoned when the element is removed, or
     * the caller awaits forever. Disconnecting declines.
     */
    unmount() {
        if (this.#resolve) {
            this.#settle(false, 'disconnect');
        }

        this.#dialog = null;
    }

    /** @param {string} action */
    handleAction(action) {
        if (action === 'confirm') {
            this.#settle(true, 'confirm');
        }

        if (action === 'cancel') {
            this.#settle(false, 'cancel');
        }
    }

    /**
     * Ask the question.
     *
     * @param {ConfirmOptions} [options]
     * @returns {Promise<boolean>} Whether the user confirmed.
     */
    confirm(options = {}) {
        if (!this.isConnected) {
            throw new Error(`<${this.localName}>: confirm() requires a connected element.`);
        }

        // A second call supersedes the first rather than queueing; the earlier
        // caller is told no.
        if (this.#resolve) {
            this.#settle(false, 'superseded');
        }

        const dialog = /** @type {HTMLDialogElement} */ (this.#dialog);
        this.#apply(options);
        this.#invoker = /** @type {HTMLElement|null} */ (document.activeElement);

        dialog.showModal();

        // Focus the safe choice, not the destructive one.
        /** @type {HTMLButtonElement|null} */ (
            dialog.querySelector('[data-action="cancel"]')
        )?.focus();

        return new Promise(resolve => {
            this.#resolve = resolve;
        });
    }

    /**
     * @param {ConfirmOptions} options
     * @returns {void}
     */
    #apply(options) {
        const dialog = /** @type {HTMLDialogElement} */ (this.#dialog);
        const defaults = ConfirmDialog.defaults;

        dialog.dataset.variant = options.variant ?? 'default';

        // textContent throughout: these strings routinely include a record name
        // supplied by the server.
        dialog.querySelector('[data-title]').textContent = options.title ?? defaults.title;
        dialog.querySelector('[data-message]').textContent = options.message ?? defaults.message;
        dialog.querySelector('[data-action="confirm"]').textContent =
            options.confirmLabel ?? defaults.confirmLabel;
        dialog.querySelector('[data-action="cancel"]').textContent =
            options.cancelLabel ?? defaults.cancelLabel;
    }

    /**
     * @param {boolean} value
     * @param {string} reason
     * @returns {void}
     */
    #settle(value, reason) {
        const resolve = this.#resolve;
        this.#resolve = null;

        if (this.#dialog?.open) {
            this.#dialog.close();
        }

        const invoker = this.#invoker;
        this.#invoker = null;

        if (invoker?.isConnected && typeof invoker.focus === 'function') {
            invoker.focus();
        }

        if (!resolve) {
            return;
        }

        resolve(value);
        this.emit('confirm:resolved', { confirmed: value, reason });
    }
}

define('kit-confirm-dialog', ConfirmDialog);
