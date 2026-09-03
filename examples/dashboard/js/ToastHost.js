/**
 * @file `<kit-toast-host>` — a notification stack.
 *
 * Admin kit example code, not library API.
 *
 * This is the component that most often leaks in a hand-rolled implementation,
 * because every toast owns a dismissal timer. Timers are not covered by the
 * lifecycle signal, so they are tracked and cleared explicitly in `unmount()`.
 */

import './prefix.js';
import { Component } from '../../../resources/js/core/Component.js';
import { define } from '../../../resources/js/core/register.js';

/**
 * @typedef {Object} ToastOptions
 * @property {string} [title]
 * @property {string} [message]
 * @property {'info'|'success'|'warning'|'error'} [variant='info']
 * @property {number} [timeout=5000] Milliseconds; `0` keeps it until dismissed.
 */

let sequence = 0;

/**
 * Place one per page, usually at the end of the layout:
 *
 * ```html
 * <kit-toast-host></kit-toast-host>
 * ```
 *
 * ```js
 * document.querySelector('kit-toast-host').show({
 *     variant: 'success',
 *     title: 'Saved',
 *     message: 'The customer was created.',
 * });
 * ```
 *
 * @element kit-toast-host
 * @fires kit-toast-host#toast:shown
 * @fires kit-toast-host#toast:dismissed
 */
export class ToastHost extends Component {
    /** @type {Map<string, ReturnType<typeof setTimeout>>} */
    #timers = new Map();

    /** @type {HTMLElement|null} */
    #list = null;

    /**
     * Errors are announced assertively; everything else politely, so a success
     * message does not interrupt whatever the user is reading.
     *
     * @returns {HTMLElement}
     */
    #requireList() {
        if (!this.#list || !this.contains(this.#list)) {
            this.render();
        }

        return /** @type {HTMLElement} */ (this.#list);
    }

    render() {
        if (this.#list && this.contains(this.#list)) {
            return;
        }

        const existing = this.querySelector(':scope > [data-toast-list]');

        if (existing) {
            this.#list = /** @type {HTMLElement} */ (existing);

            return;
        }

        const list = document.createElement('div');
        list.setAttribute('data-toast-list', '');
        list.setAttribute('role', 'status');
        list.setAttribute('aria-live', 'polite');
        list.setAttribute('aria-atomic', 'false');

        this.append(list);
        this.#list = list;
    }

    bindEvents() {
        this.bindActions();
    }

    /**
     * Clearing the timers is the whole point of this method. Without it, a
     * navigation that removes the host leaves callbacks scheduled against
     * detached nodes.
     *
     * The toasts themselves are discarded too. Clearing timers alone would
     * leave any visible toast frozen on screen after a reconnect, dismissable
     * only by hand — a notification is transient by definition, so leaving the
     * document ends it.
     */
    unmount() {
        for (const timer of this.#timers.values()) {
            clearTimeout(timer);
        }

        this.#timers.clear();
        this.#list?.replaceChildren();
        this.#list = null;
    }

    /**
     * @param {string} action
     * @param {HTMLElement} trigger
     */
    handleAction(action, trigger) {
        if (action === 'dismiss') {
            const toast = trigger.closest('[data-toast]');

            if (toast instanceof HTMLElement && toast.dataset.toast) {
                this.dismiss(toast.dataset.toast);
            }
        }
    }

    /**
     * Show a toast.
     *
     * @param {ToastOptions} options
     * @returns {string} The toast id, for use with {@link dismiss}.
     */
    show(options = {}) {
        const list = this.#requireList();
        const id = `toast-${++sequence}`;
        const variant = options.variant ?? 'info';
        const timeout = options.timeout ?? 5000;

        const toast = document.createElement('div');
        toast.dataset.toast = id;
        toast.dataset.variant = variant;

        if (options.title) {
            const title = document.createElement('p');
            title.setAttribute('data-toast-title', '');
            // textContent: a toast frequently carries a server message.
            title.textContent = options.title;
            toast.append(title);
        }

        if (options.message) {
            const message = document.createElement('p');
            message.setAttribute('data-toast-message', '');
            message.textContent = options.message;
            toast.append(message);
        }

        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.dataset.action = 'dismiss';
        dismiss.setAttribute('aria-label', this.getAttribute('dismiss-label') || 'Dismiss');
        dismiss.textContent = '×';
        toast.append(dismiss);

        list.append(toast);

        if (timeout > 0) {
            this.#timers.set(
                id,
                setTimeout(() => this.dismiss(id), timeout),
            );
        }

        this.emit('toast:shown', { id, variant });

        return id;
    }

    /**
     * @param {string} id
     * @returns {boolean} `false` when no such toast is showing.
     */
    dismiss(id) {
        const timer = this.#timers.get(id);

        if (timer) {
            clearTimeout(timer);
            this.#timers.delete(id);
        }

        const toast = this.querySelector(`[data-toast="${CSS.escape(id)}"]`);

        if (!toast) {
            return false;
        }

        toast.remove();
        this.emit('toast:dismissed', { id });

        return true;
    }

    /** @returns {void} */
    dismissAll() {
        for (const toast of this.findAll('[data-toast]')) {
            this.dismiss(/** @type {HTMLElement} */ (toast).dataset.toast ?? '');
        }
    }

    /** @returns {number} How many toasts are currently showing. */
    get count() {
        return this.findAll('[data-toast]').length;
    }
}

define('kit-toast-host', ToastHost);
