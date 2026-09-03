import AxeBuilder from '@axe-core/playwright';

import { test as base, expect } from '@playwright/test';

/**
 * @file Behaviour tests for the admin kit in `examples/dashboard/`.
 *
 * The kit is example code rather than library API, but untested example code is
 * how a "fast start" becomes a slow debugging session for whoever copies it.
 * These run against the real showcase page, so the markup people copy is the
 * markup under test.
 */

const test = base.extend({
    page: async ({ page }, use) => {
        /** @type {string[]} */
        const errors = [];

        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => {
            if (message.type() === 'error') {
                errors.push(message.text());
            }
        });

        await page.goto('/examples/dashboard/index.html');
        await use(page);

        expect(errors, 'no unexpected console/page errors').toEqual([]);
    },
});

test.describe('kit-dropdown', () => {
    test('opens, exposes ARIA state, and closes on Escape', async ({ page }) => {
        const trigger = page.locator('kit-dropdown [data-trigger]').first();
        const menu = page.locator('kit-dropdown [data-menu]').first();

        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toHaveAttribute('aria-haspopup', 'true');
        await expect(menu).toBeHidden();

        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(menu).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test('ArrowDown from the trigger opens and focuses the first item', async ({ page }) => {
        const trigger = page.locator('kit-dropdown [data-trigger]').first();

        await trigger.focus();
        await page.keyboard.press('ArrowDown');

        await expect(page.locator('kit-dropdown [role="menuitem"]').first()).toBeFocused();
    });

    test('arrow keys wrap through the items', async ({ page }) => {
        const trigger = page.locator('kit-dropdown [data-trigger]').first();
        const items = page.locator('kit-dropdown').first().locator('[role="menuitem"]');

        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');

        // Up from the first item wraps to the last.
        await expect(items.last()).toBeFocused();

        await page.keyboard.press('ArrowDown');
        await expect(items.first()).toBeFocused();

        await page.keyboard.press('End');
        await expect(items.last()).toBeFocused();

        await page.keyboard.press('Home');
        await expect(items.first()).toBeFocused();
    });

    test('clicking outside closes it without stealing focus back', async ({ page }) => {
        const trigger = page.locator('kit-dropdown [data-trigger]').first();

        await trigger.click();
        await page.locator('h1').click();

        await expect(page.locator('kit-dropdown [data-menu]').first()).toBeHidden();
        await expect(trigger).not.toBeFocused();
    });

    test('the menu carries an accessible name from its trigger', async ({ page }) => {
        await page.locator('kit-dropdown [data-trigger]').first().click();

        await expect(
            page.getByRole('menu', { name: 'Actions', exact: true }).first(),
        ).toBeVisible();
    });

    test('only the clicked dropdown opens', async ({ page }) => {
        await page.locator('kit-dropdown [data-trigger]').nth(1).click();

        await expect(page.locator('kit-dropdown [data-menu]').nth(0)).toBeHidden();
        await expect(page.locator('kit-dropdown [data-menu]').nth(1)).toBeVisible();
    });
});

test.describe('kit-sortable-table', () => {
    /** @param {import('@playwright/test').Page} page */
    const names = page =>
        page
            .locator('td[data-name]')
            .allTextContents()
            .then(list => list.map(t => t.trim()));

    test('sorts by a numeric column using data-sort-value', async ({ page }) => {
        await page.locator('th[data-sort="spend"] button').click();

        expect(await names(page)).toEqual([
            'Alan Turing',
            'Ada Lovelace',
            'Katherine Johnson',
            'Grace Hopper',
        ]);
        await expect(page.locator('th[data-sort="spend"]')).toHaveAttribute(
            'aria-sort',
            'ascending',
        );
    });

    test('clicking the same column again reverses the order', async ({ page }) => {
        await page.locator('th[data-sort="spend"] button').click();
        await page.locator('th[data-sort="spend"] button').click();

        expect(await names(page)).toEqual([
            'Grace Hopper',
            'Katherine Johnson',
            'Ada Lovelace',
            'Alan Turing',
        ]);
        await expect(page.locator('th[data-sort="spend"]')).toHaveAttribute(
            'aria-sort',
            'descending',
        );
    });

    test('exactly one column reports a sort at a time', async ({ page }) => {
        await page.locator('th[data-sort="email"] button').click();

        await expect(page.locator('th[data-sort="email"]')).toHaveAttribute(
            'aria-sort',
            'ascending',
        );
        await expect(page.locator('th[data-sort="name"]')).toHaveAttribute('aria-sort', 'none');
        await expect(page.locator('th[data-sort="spend"]')).toHaveAttribute('aria-sort', 'none');
    });

    test('emits table:sorted for a server-side implementation to use', async ({ page }) => {
        const detail = await page.evaluate(async () => {
            /** @type {unknown} */
            let received = null;
            document.addEventListener('table:sorted', e => (received = e.detail), { once: true });
            document.querySelector('th[data-sort="email"] button').click();

            return received;
        });

        expect(detail).toEqual({ column: 'email', direction: 'ascending', clientSorted: true });
    });

    test('sorting moves existing rows rather than rebuilding them', async ({ page }) => {
        // Node identity is the assertion: a table that re-rendered its rows
        // would destroy every component inside a cell, including an open
        // dropdown and any focused control.
        const preserved = await page.evaluate(() => {
            const firstRow = document.querySelector('tbody tr');
            document.querySelector('th[data-sort="spend"] button').click();

            return document.querySelector('tbody').contains(firstRow);
        });

        expect(preserved).toBe(true);
    });

    test('header controls are real buttons, so the keyboard already works', async ({ page }) => {
        await page.locator('th[data-sort="spend"] button').focus();
        await page.keyboard.press('Enter');

        await expect(page.locator('th[data-sort="spend"]')).toHaveAttribute(
            'aria-sort',
            'ascending',
        );
    });
});

test.describe('kit-async-button', () => {
    test('shows a busy state and restores it on success', async ({ page }) => {
        const host = page.locator('#save-settings');
        const button = host.locator('button');

        await button.click();

        await expect(host).toHaveAttribute('busy', '');
        await expect(button).toBeDisabled();
        await expect(button).toHaveText('Saving…');

        await expect(button).toHaveText('Save changes', { timeout: 5000 });
        await expect(host).not.toHaveAttribute('busy', '');
        await expect(button).toBeEnabled();
    });

    test('restores the button even when the work fails', async ({ page }) => {
        await page.locator('#simulate-failure').check();
        const host = page.locator('#save-settings');
        const button = host.locator('button');

        await button.click();
        await expect(button).toHaveText('Saving…');

        await expect(button).toHaveText('Save changes', { timeout: 5000 });
        await expect(button).toBeEnabled();
        await expect(page.locator('[data-toast]')).toContainText('Could not save');
    });

    test('a second click while busy does not start a second run', async ({ page }) => {
        const button = page.locator('#save-settings button');

        await button.click();
        // The button is disabled, so force the click through to prove the
        // capture-phase guard works and not merely the disabled attribute.
        await button.dispatchEvent('click');

        await expect(page.locator('[data-toast]')).toHaveCount(1, { timeout: 5000 });
    });
});

test.describe('kit-toast-host', () => {
    test('shows and auto-dismisses a toast', async ({ page }) => {
        await page.locator('#toast-demo').click();

        const toast = page.locator('[data-toast]');
        await expect(toast).toHaveCount(1);
        await expect(toast).toContainText('Report ready');

        await expect(toast).toHaveCount(0, { timeout: 8000 });
    });

    test('a toast can be dismissed manually', async ({ page }) => {
        await page.locator('#toast-demo').click();
        await expect(page.locator('[data-toast]')).toHaveCount(1);

        await page.locator('[data-toast] [data-action="dismiss"]').click();

        await expect(page.locator('[data-toast]')).toHaveCount(0);
    });

    test('toasts stack and are announced politely', async ({ page }) => {
        await page.locator('#toast-demo').click();
        await page.locator('#toast-demo').click();

        await expect(page.locator('[data-toast]')).toHaveCount(2);
        await expect(page.locator('[data-toast-list]')).toHaveAttribute('aria-live', 'polite');
    });

    test('removing the host clears its pending timers', async ({ page }) => {
        const cleared = await page.evaluate(async () => {
            const host = document.querySelector('kit-toast-host');
            host.show({ title: 'Pending', timeout: 50 });

            const parent = host.parentElement;
            host.remove();

            // If the timer survived, it would fire against a detached tree.
            await new Promise(resolve => {
                setTimeout(resolve, 150);
            });

            parent.append(host);

            return host.count;
        });

        // Reconnecting renders a fresh, empty list — no ghost toast, no error.
        expect(cleared).toBe(0);
    });
});

test.describe('kit-confirm-dialog', () => {
    /** @param {import('@playwright/test').Page} page */
    async function openDeleteConfirm(page) {
        await page.locator('kit-dropdown [data-trigger]').first().click();
        await page.locator('[role="menuitem"][data-value="delete"]').first().click();
    }

    test('is named, centred and focuses the safe choice', async ({ page }) => {
        await openDeleteConfirm(page);

        await expect(
            page.getByRole('dialog', { name: 'Delete customer?', exact: true }),
        ).toBeVisible();
        await expect(page.locator('[data-action="cancel"]')).toBeFocused();

        // Tailwind's preflight zeroes every margin, which removes the centring a
        // modal <dialog> gets from the browser's default `margin: auto`. The kit
        // restores it; this asserts the restoration.
        const box = await page.locator('kit-confirm-dialog dialog').boundingBox();
        const viewport = page.viewportSize();
        expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    });

    test('cancelling resolves false and leaves the row alone', async ({ page }) => {
        const before = await page.locator('tbody tr').count();

        await openDeleteConfirm(page);
        await page.locator('[data-action="cancel"]').click();

        await expect(page.locator('tbody tr')).toHaveCount(before);
        await expect(page.locator('kit-confirm-dialog dialog')).toBeHidden();
    });

    test('Escape declines', async ({ page }) => {
        const before = await page.locator('tbody tr').count();

        await openDeleteConfirm(page);
        await page.keyboard.press('Escape');

        await expect(page.locator('tbody tr')).toHaveCount(before);
    });

    test('confirming resolves true and the caller acts', async ({ page }) => {
        const before = await page.locator('tbody tr').count();

        await openDeleteConfirm(page);
        await page.locator('[data-action="confirm"]').click();

        await expect(page.locator('tbody tr')).toHaveCount(before - 1);
        await expect(page.locator('[data-toast]')).toContainText('Deleted');
    });

    test('the message renders untrusted text as text', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const dialog = document.querySelector('kit-confirm-dialog');
            const pending = dialog.confirm({
                title: '<img src=x onerror="window.__xss=1">',
                message: '<script>window.__xss = 1</script>',
            });

            const shown = {
                xss: window.__xss ?? false,
                images: dialog.querySelectorAll('img').length,
                scripts: dialog.querySelectorAll('script').length,
                title: dialog.querySelector('[data-title]').textContent,
            };

            dialog.querySelector('[data-action="cancel"]').click();
            await pending;

            return shown;
        });

        expect(result.xss).toBe(false);
        expect(result.images).toBe(0);
        expect(result.scripts).toBe(0);
        expect(result.title).toContain('<img src=x onerror=');
    });

    test('reconnecting does not append a second dialog', async ({ page }) => {
        // render() runs again on every mount. Without recovering the element it
        // built last time, each reconnect leaves another <dialog> behind and the
        // component ends up driving the wrong one.
        const counts = await page.evaluate(() => {
            const host = document.querySelector('kit-confirm-dialog');
            const parent = host.parentElement;
            const before = host.querySelectorAll('dialog').length;

            host.remove();
            parent.append(host);
            host.remove();
            parent.append(host);

            return { before, after: host.querySelectorAll('dialog').length };
        });

        expect(counts).toEqual({ before: 1, after: 1 });
    });

    test('disconnecting resolves a pending question rather than hanging', async ({ page }) => {
        const resolved = await page.evaluate(async () => {
            const dialog = document.querySelector('kit-confirm-dialog');
            const parent = dialog.parentElement;
            const pending = dialog.confirm({ title: 'Still there?' });

            dialog.remove();

            // Without the guard in unmount() this promise never settles and the
            // awaiting caller is stuck forever.
            const value = await Promise.race([
                pending,
                new Promise(resolve => {
                    setTimeout(() => resolve('TIMED OUT'), 1000);
                }),
            ]);

            parent.append(dialog);

            return value;
        });

        expect(resolved).toBe(false);
    });
});

test.describe('showcase accessibility', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'audit runs on one engine');

    const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

    /** @param {import('axe-core').AxeResults} results */
    const describeViolations = results =>
        results.violations.flatMap(violation =>
            violation.nodes.map(node => `${violation.id} (${violation.impact}): ${node.html}`),
        );

    /**
     * Every overlay, in both themes.
     *
     * Enumerated rather than written one test at a time, because the gap this
     * closes was a missing case: an earlier version audited the dropdown, the
     * confirm dialog and a toast, but never opened the invite modal — where the
     * title was rendering black on a dark panel. A table of states is harder to
     * leave a hole in than a list of hand-written tests.
     */
    const STATES = [
        { name: 'default', open: async () => {} },
        {
            name: 'dropdown open',
            open: async page => page.locator('kit-dropdown [data-trigger]').first().click(),
        },
        {
            name: 'confirm dialog open',
            open: async page => {
                await page.locator('kit-dropdown [data-trigger]').first().click();
                await page.locator('[role="menuitem"][data-value="delete"]').first().click();
                await expect(page.locator('kit-confirm-dialog dialog')).toBeVisible();
            },
        },
        {
            name: 'invite modal open',
            open: async page => {
                await page.locator('#modal-demo').click();
                await expect(page.locator('vui-modal dialog')).toBeVisible();
            },
        },
        {
            name: 'toast showing',
            open: async page => {
                await page.locator('#toast-demo').click();
                await expect(page.locator('[data-toast]')).toHaveCount(1);
            },
        },
    ];

    for (const theme of ['light', 'dark']) {
        for (const state of STATES) {
            test(`no violations — ${state.name}, ${theme} theme`, async ({ page }) => {
                if (theme === 'dark') {
                    await page.locator('#theme-toggle').click();
                }

                await state.open(page);

                expect(
                    describeViolations(await new AxeBuilder({ page }).withTags(WCAG).analyze()),
                ).toEqual([]);
            });
        }
    }

    /**
     * A <dialog> does not inherit text colour from the page: the user-agent
     * stylesheet sets `color: CanvasText`, which is a real declaration and so
     * breaks inheritance. Under a dark theme that paints black text on a dark
     * panel — which is exactly what shipped, because axe was never pointed at
     * this dialog. The contrast audits above would now catch it; this asserts
     * the mechanism directly, so a regression names its own cause.
     */
    test('dialog content inherits a readable colour in dark mode', async ({ page }) => {
        await page.locator('#theme-toggle').click();
        await page.locator('#modal-demo').click();
        await expect(page.locator('vui-modal dialog')).toBeVisible();

        const measured = await page.evaluate(() => {
            const title = document.getElementById('invite-title');
            const dialog = document.querySelector('vui-modal dialog');

            return {
                titleColor: getComputedStyle(title).color,
                dialogColor: getComputedStyle(dialog).color,
                rootScheme: getComputedStyle(document.documentElement).colorScheme,
            };
        });

        expect(measured.titleColor).not.toBe('rgb(0, 0, 0)');
        expect(measured.dialogColor).not.toBe('rgb(0, 0, 0)');
        // color-scheme tells the browser too, so native controls and scrollbars
        // inside the dialog follow the theme rather than staying light.
        expect(measured.rootScheme).toBe('dark');
    });
});
