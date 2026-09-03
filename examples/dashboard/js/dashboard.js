/**
 * @file Wiring for the admin showcase.
 *
 * This is the application layer: the place where decisions live. Notice that no
 * component below knows what a toast is, and the toast host knows nothing about
 * customers. Components announce facts; this file decides what they mean.
 */

import './prefix.js';

import './Dropdown.js';
import './ToastHost.js';
import './ConfirmDialog.js';
import './AsyncButton.js';
import './SortableTable.js';

import '../../../resources/js/components/common/Counter.js';
import '../../../resources/js/components/common/Tabs.js';
import '../../../resources/js/components/common/Modal.js';

const toasts = /** @type {import('./ToastHost.js').ToastHost} */ (
    document.querySelector('kit-toast-host')
);
const confirmDialog = /** @type {import('./ConfirmDialog.js').ConfirmDialog} */ (
    document.querySelector('kit-confirm-dialog')
);

// --- Row actions ---------------------------------------------------------

document.addEventListener('dropdown:selected', async event => {
    const detail = /** @type {CustomEvent<{ value: string|null, label: string }>} */ (event).detail;
    const row = /** @type {HTMLElement} */ (event.target).closest('tr');
    const name = row?.querySelector('[data-name]')?.textContent?.trim() ?? 'this record';

    if (detail.value === 'delete') {
        // The destructive path asks first. `confirm()` returns a promise, which
        // is what lets this read as one decision rather than a callback maze.
        const confirmed = await confirmDialog.confirm({
            title: 'Delete customer?',
            message: `${name} will be removed. This cannot be undone.`,
            confirmLabel: 'Delete',
            variant: 'danger',
        });

        if (!confirmed) {
            return;
        }

        row?.remove();
        toasts.show({ variant: 'success', title: 'Deleted', message: `${name} was removed.` });

        return;
    }

    toasts.show({ variant: 'info', title: detail.label, message: `Applied to ${name}.` });
});

// --- Sorting -------------------------------------------------------------

document.addEventListener('table:sorted', event => {
    const detail = /** @type {CustomEvent<{ column: string|null, direction: string|null }>} */ (
        event
    ).detail;
    const status = document.getElementById('sort-status');

    if (!status) {
        return;
    }

    // In a real application this is where you would reload a server-sorted
    // fragment instead, using the same event.
    status.textContent = detail.column
        ? `Sorted by ${detail.column}, ${detail.direction}.`
        : 'Sort cleared.';
});

// --- Async work ----------------------------------------------------------

// The id belongs on the component, not on the button it wraps. An earlier draft
// put it on the inner <button>; `saveButton.run` was then undefined, and the
// TypeError landed in the catch below and became a plausible-looking error
// toast. The behaviour test caught it, the console did not.
const saveButton = /** @type {import('./AsyncButton.js').AsyncButton} */ (
    document.querySelector('#save-settings')
);

saveButton?.addEventListener('click', async () => {
    try {
        await saveButton.run(async () => {
            // Stand-in for a real request; the point is the state handling.
            await new Promise(resolve => {
                setTimeout(resolve, 1200);
            });

            if (document.querySelector('#simulate-failure')?.checked) {
                throw new Error('[expected] simulated failure');
            }
        });

        toasts.show({ variant: 'success', title: 'Settings saved' });
    } catch (error) {
        // Only expected failures become a toast. Anything else is a programmer
        // error and is re-reported, because a catch broad enough to swallow a
        // TypeError is how bugs become invisible (AGENTS.md §2).
        if (!(error instanceof Error) || !error.message.includes('[expected]')) {
            console.error(error);
        }

        // The button is restored by `run()`'s finally block whatever happens,
        // which is the bug this component exists to prevent.
        toasts.show({
            variant: 'error',
            title: 'Could not save',
            message: 'The server did not accept the change. Try again.',
        });
    }
});

// --- Demonstration triggers ---------------------------------------------

document.querySelector('#toast-demo')?.addEventListener('click', () => {
    toasts.show({
        variant: 'info',
        title: 'Report ready',
        message: 'The September export finished processing.',
        timeout: 4000,
    });
});

document.querySelector('#modal-demo')?.addEventListener('click', event => {
    /** @type {import('../../../resources/js/components/common/Modal.js').Modal} */ (
        document.querySelector('#invite-modal')
    ).open({ invoker: /** @type {HTMLElement} */ (event.currentTarget) });
});

document.addEventListener('counter:changed', event => {
    const detail = /** @type {CustomEvent<{ value: number }>} */ (event).detail;
    const output = document.getElementById('seats-total');

    if (output) {
        output.textContent = String(detail.value * 12);
    }
});

// --- Theme ---------------------------------------------------------------

const themeToggle = document.querySelector('#theme-toggle');

themeToggle?.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    themeToggle.setAttribute('aria-pressed', String(dark));
});
