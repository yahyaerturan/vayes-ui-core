/**
 * @file `<kit-async-button>` — a button that owns its own in-flight state.
 *
 * Admin kit example code, not library API.
 *
 * The smallest component in the kit, and the one that removes the most
 * duplicated code: every place an admin screen calls the server has the same
 * four lines of disable-do-work-restore, and gets the `finally` wrong often
 * enough to leave buttons dead after an error.
 *
 * Enhancement mode — it wraps a real `<button>`, so form association, type,
 * name, value and native keyboard behaviour all keep working.
 */

import './prefix.js';
import { Component } from '../../../resources/js/core/Component.js';
import { define } from '../../../resources/js/core/register.js';

/**
 * ```html
 * <kit-async-button busy-label="Saving…">
 *     <button type="submit">Save</button>
 * </kit-async-button>
 * ```
 *
 * ```js
 * await asyncButton.run(() => http.post('/api/customers', data, { json: true }));
 * ```
 *
 * @element kit-async-button
 * @fires kit-async-button#async:started
 * @fires kit-async-button#async:settled
 */
export class AsyncButton extends Component {
    /** @type {HTMLButtonElement|null} */
    #button = null;

    /** Label to restore when work finishes. */
    #idleLabel = '';

    #busy = false;

    /** @returns {boolean} */
    get busy() {
        return this.#busy;
    }

    /** @returns {HTMLButtonElement|null} The wrapped native button. */
    get button() {
        return this.#button;
    }

    mount() {
        this.#button = /** @type {HTMLButtonElement|null} */ (this.querySelector('button'));

        if (!this.#button) {
            throw new Error(`<${this.localName}> requires a <button> child.`);
        }

        this.#idleLabel = this.#button.textContent ?? '';
        this.bindEvents();
    }

    bindEvents() {
        // Swallow clicks while busy at the capture phase, before any application
        // handler runs. Disabling the button alone is not enough: a click
        // already dispatched during the same task would still be delivered.
        this.addEventListener(
            'click',
            event => {
                if (this.#busy) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            { capture: true, signal: this.signal },
        );
    }

    unmount() {
        // Leaving the DOM mid-flight should not strand the button in a busy
        // state if it is reconnected later.
        if (this.#busy) {
            this.setBusy(false);
        }

        this.#button = null;
    }

    /**
     * Toggle the in-flight state.
     *
     * @param {boolean} busy
     * @returns {void}
     */
    setBusy(busy) {
        const button = this.#button;

        if (!button || busy === this.#busy) {
            return;
        }

        this.#busy = busy;
        button.disabled = busy;
        this.toggleAttribute('busy', busy);
        this.dataset.state = busy ? 'busy' : 'idle';

        // `aria-busy` on the host announces the state; `aria-live` is not used
        // because a label change on a focused control is announced already.
        this.toggleAttribute('aria-busy', busy);

        const busyLabel = this.getAttribute('busy-label');

        if (busyLabel) {
            button.textContent = busy ? busyLabel : this.#idleLabel;
        }
    }

    /**
     * Run async work with the busy state managed for you.
     *
     * The state is always restored, including when the work throws — which is
     * the bug this component exists to prevent.
     *
     * @template T
     * @param {() => Promise<T>} work
     * @returns {Promise<T>}
     */
    async run(work) {
        if (this.#busy) {
            throw new Error(`<${this.localName}>: already running.`);
        }

        this.setBusy(true);
        this.emit('async:started');

        try {
            const result = await work();
            this.emit('async:settled', { ok: true });

            return result;
        } catch (error) {
            this.emit('async:settled', { ok: false });

            throw error;
        } finally {
            this.setBusy(false);
        }
    }
}

define('kit-async-button', AsyncButton);
