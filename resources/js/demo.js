/**
 * @file Application-level wiring for the CodeIgniter demo page.
 *
 * This is where an application's own decisions live. Note what the reusable
 * components did *not* do: no component knows about `#selection-output`, none
 * calls a global function, and none decided what an HTTP error should say.
 */

import app from './app.js';
import { HttpError, isAbortError } from './core/HttpError.js';
import { replaceFragment } from './core/fragments.js';

const output = {
    selection: document.getElementById('selection-output'),
    counter: document.getElementById('counter-output'),
    form: document.getElementById('form-status'),
};

// --- Subscribing to component events -------------------------------------
// The selector emits a fact; this page decides what the fact means.

document.addEventListener('customer:selected', event => {
    const { customer } = event.detail;

    // textContent, because the name is untrusted server data.
    output.selection.textContent = `Selected: ${customer.name} (${customer.email ?? 'no email'})`;
});

document.addEventListener('customer:cleared', () => {
    output.selection.textContent = 'Selection cleared.';
});

document.addEventListener('counter:changed', event => {
    const { value, source } = event.detail;
    output.counter.textContent = `Counter is ${value} (changed by ${source}).`;
});

// --- AJAX HTML fragment ---------------------------------------------------

document.getElementById('load-fragment')?.addEventListener('click', async event => {
    const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
    const target = document.getElementById('fragment-target');

    button.disabled = true;

    try {
        const html = await app.http.html(app.config.extra.fragmentEndpoint ?? '/customers/table');

        // Transport returned text; the DOM mutation is a separate, explicit
        // decision made here. Custom elements inside the fragment initialise
        // on insertion with no init pass.
        replaceFragment(target, html);
    } catch (error) {
        target.textContent = describeFailure(error);
    } finally {
        button.disabled = false;
    }
});

// --- Modal + CSRF-protected write ----------------------------------------

const modal = /** @type {import('./components/common/Modal.js').Modal} */ (
    document.getElementById('customer-modal')
);

document.getElementById('open-modal')?.addEventListener('click', event => {
    modal.open({ invoker: /** @type {HTMLElement} */ (event.currentTarget) });
});

document.getElementById('customer-form')?.addEventListener('submit', async event => {
    event.preventDefault();

    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const submit = /** @type {HTMLButtonElement} */ (form.querySelector('#submit-customer'));

    clearFieldErrors(form);
    output.form.textContent = '';
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');

    try {
        const response = await app.http.post(
            '/api/customers',
            Object.fromEntries(new FormData(form)),
            { json: true },
        );
        const payload = await response.json();

        output.form.textContent = `Created ${payload.data.name}.`;
        form.reset();
        modal.close();
    } catch (error) {
        // The application decides how each failure mode is presented; the
        // transport layer only reported what happened.
        if (error instanceof HttpError && error.isValidationError) {
            showFieldErrors(
                form,
                /** @type {{ errors?: Record<string, string> }} */ (error.body)?.errors ?? {},
            );
            output.form.textContent = 'Please correct the highlighted fields.';
        } else {
            output.form.textContent = describeFailure(error);
        }
    } finally {
        submit.disabled = false;
        form.removeAttribute('aria-busy');
    }
});

/**
 * @param {HTMLFormElement} form
 * @param {Record<string, string|string[]>} errors
 * @returns {void}
 */
function showFieldErrors(form, errors) {
    for (const [field, message] of Object.entries(errors)) {
        const target = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
        const input = form.querySelector(`[name="${CSS.escape(field)}"]`);

        if (target) {
            // Server messages are data, not markup.
            target.textContent = Array.isArray(message) ? message.join(' ') : String(message);
        }

        if (input) {
            input.setAttribute('aria-invalid', 'true');
        }
    }

    /** @type {HTMLElement|null} */ (form.querySelector('[aria-invalid="true"]'))?.focus();
}

/**
 * @param {HTMLFormElement} form
 * @returns {void}
 */
function clearFieldErrors(form) {
    for (const node of form.querySelectorAll('[data-error-for]')) {
        node.textContent = '';
    }

    for (const node of form.querySelectorAll('[aria-invalid]')) {
        node.removeAttribute('aria-invalid');
    }
}

/**
 * Map a transport failure onto user-facing copy. Deliberately generic, with a
 * correlation id for support rather than a server stack trace
 * (docs/10-security.md, docs/19-observability-errors.md).
 *
 * @param {unknown} error
 * @returns {string}
 */
function describeFailure(error) {
    if (isAbortError(error)) {
        return '';
    }

    if (error instanceof HttpError) {
        if (error.status === 403) {
            return 'You do not have permission to do that.';
        }

        if (error.status === 401) {
            return 'Your session has expired. Please sign in again.';
        }

        const reference = error.requestId ? ` (reference ${error.requestId})` : '';

        return `The server could not complete the request${reference}.`;
    }

    return 'Could not reach the server. Check your connection and try again.';
}
