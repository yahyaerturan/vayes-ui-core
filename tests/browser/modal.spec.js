import { test, expect } from './support/fixtures.js';

const MARKUP = `
<button id="opener" type="button">Open</button>
<button id="other" type="button">Other</button>
<vui-modal aria-label="Edit customer">
    <h2 id="title">Edit customer</h2>
    <input id="field" type="text">
    <button id="save" type="button">Save</button>
    <button id="cancel" type="button" data-action="close">Cancel</button>
</vui-modal>`;

/** @param {import('@playwright/test').Page} page */
async function mount(page, markup = MARKUP) {
    await page.evaluate(async html => {
        document.getElementById('root').innerHTML = html;
        await import('/resources/js/components/common/Modal.js');
        await customElements.whenDefined('vui-modal');
    }, markup);
}

test.describe('<vui-modal>', () => {
    test('wraps its light-DOM children in a native dialog', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const modal = document.querySelector('vui-modal');

            return {
                dialogs: modal.querySelectorAll('dialog').length,
                titleInsideDialog: Boolean(modal.querySelector('dialog #title')),
                isOpen: modal.isOpen,
            };
        });

        expect(result).toEqual({ dialogs: 1, titleInsideDialog: true, isOpen: false });
    });

    test('open() shows the dialog, reflects state and emits modal:opened', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            /** @type {unknown[]} */
            const heard = [];
            document.addEventListener('modal:opened', event => heard.push(event.type));

            const modal = document.querySelector('vui-modal');
            const opened = modal.open();

            return {
                opened,
                heard,
                hasAttribute: modal.hasAttribute('open'),
                isOpen: modal.isOpen,
                secondCall: modal.open(),
            };
        });

        expect(result).toEqual({
            opened: true,
            heard: ['modal:opened'],
            hasAttribute: true,
            isOpen: true,
            secondCall: false,
        });
        await expect(page.locator('vui-modal dialog')).toBeVisible();
    });

    test('close() emits a cancelable pre-event followed by modal:closed', async ({ page }) => {
        await mount(page);

        const heard = await page.evaluate(() => {
            /** @type {string[]} */
            const events = [];
            document.addEventListener('modal:before-close', e =>
                events.push(`before:${e.detail.reason}`),
            );
            document.addEventListener('modal:closed', e =>
                events.push(`closed:${e.detail.reason}`),
            );

            const modal = document.querySelector('vui-modal');
            modal.open();
            modal.close();

            return events;
        });

        expect(heard).toEqual(['before:method', 'closed:method']);
        await expect(page.locator('vui-modal dialog')).toBeHidden();
    });

    test('preventing modal:before-close keeps the dialog open', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const modal = document.querySelector('vui-modal');
            let closedFired = false;

            document.addEventListener('modal:before-close', event => event.preventDefault());
            document.addEventListener('modal:closed', () => (closedFired = true));

            modal.open();
            const returned = modal.close();

            return { returned, isOpen: modal.isOpen, closedFired };
        });

        expect(result).toEqual({ returned: false, isOpen: true, closedFired: false });
        await expect(page.locator('vui-modal dialog')).toBeVisible();
    });

    test('Escape closes through the cancelable contract', async ({ page }) => {
        await mount(page);
        await page.evaluate(() => {
            window.__reasons = [];
            document.addEventListener('modal:closed', e => window.__reasons.push(e.detail.reason));
            document.querySelector('vui-modal').open();
        });

        await page.keyboard.press('Escape');

        await expect(page.locator('vui-modal dialog')).toBeHidden();
        expect(await page.evaluate(() => window.__reasons)).toEqual(['escape']);
    });

    test('Escape can be vetoed by a listener', async ({ page }) => {
        await mount(page);
        await page.evaluate(() => {
            document.addEventListener('modal:before-close', event => event.preventDefault());
            document.querySelector('vui-modal').open();
        });

        await page.keyboard.press('Escape');

        await expect(page.locator('vui-modal dialog')).toBeVisible();
    });

    test('no-dismiss disables Escape while method close still works', async ({ page }) => {
        await mount(page, MARKUP.replace('<vui-modal ', '<vui-modal no-dismiss '));
        await page.evaluate(() => document.querySelector('vui-modal').open());

        await page.keyboard.press('Escape');
        await expect(page.locator('vui-modal dialog')).toBeVisible();

        await page.evaluate(() => document.querySelector('vui-modal').close());
        await expect(page.locator('vui-modal dialog')).toBeHidden();
    });

    test('a data-action="close" control closes with reason "action"', async ({ page }) => {
        await mount(page);
        await page.evaluate(() => {
            window.__reasons = [];
            document.addEventListener('modal:closed', e => window.__reasons.push(e.detail.reason));
            document.querySelector('vui-modal').open();
        });

        await page.locator('#cancel').click();

        expect(await page.evaluate(() => window.__reasons)).toEqual(['action']);
    });

    test('moves focus into the dialog and returns it to the invoker', async ({ page }) => {
        await mount(page);

        await page.locator('#opener').focus();
        await page.evaluate(() => document.querySelector('vui-modal').open());

        const focusedInside = await page.evaluate(() =>
            document.querySelector('vui-modal dialog').contains(document.activeElement),
        );
        expect(focusedInside).toBe(true);

        await page.evaluate(() => document.querySelector('vui-modal').close());
        await expect(page.locator('#opener')).toBeFocused();
    });

    test('an explicit invoker overrides the previously focused element', async ({ page }) => {
        await mount(page);

        await page.locator('#opener').focus();
        await page.evaluate(() => {
            const modal = document.querySelector('vui-modal');
            modal.open({ invoker: document.getElementById('other') });
            modal.close();
        });

        await expect(page.locator('#other')).toBeFocused();
    });

    test('a modal dialog traps focus inside the top layer', async ({ page }) => {
        await mount(page);
        await page.evaluate(() => document.querySelector('vui-modal').open());

        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        const inside = await page.evaluate(() =>
            document.querySelector('vui-modal dialog').contains(document.activeElement),
        );

        expect(inside).toBe(true);
    });

    test('background content cannot be clicked while the dialog is open', async ({ page }) => {
        await mount(page);
        await page.evaluate(() => document.querySelector('vui-modal').open());

        // showModal() puts the dialog in the top layer behind a backdrop, so a
        // real user click on background content is physically blocked. This is
        // the accessibility guarantee we get for free by not hand-rolling a
        // dialog out of divs.
        const clickFailed = await page
            .locator('#opener')
            .click({ timeout: 1000 })
            .then(() => false)
            .catch(() => true);

        expect(clickFailed).toBe(true);
    });

    test('the open attribute drives the dialog declaratively', async ({ page }) => {
        await mount(page);

        await page.evaluate(() => document.querySelector('vui-modal').setAttribute('open', ''));
        await expect(page.locator('vui-modal dialog')).toBeVisible();

        await page.evaluate(() => document.querySelector('vui-modal').removeAttribute('open'));
        await expect(page.locator('vui-modal dialog')).toBeHidden();
    });

    test('disconnecting closes the dialog and restores focus without emitting', async ({
        page,
    }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const root = document.getElementById('root');
            const modal = root.querySelector('vui-modal');
            let closedEvents = 0;

            document.addEventListener('modal:closed', () => (closedEvents += 1));
            document.getElementById('opener').focus();
            modal.open();

            modal.remove();
            const afterRemove = { isOpen: modal.isOpen, closedEvents };

            root.append(modal);

            return { afterRemove, reopened: modal.open(), isOpen: modal.isOpen };
        });

        expect(result.afterRemove).toEqual({ isOpen: false, closedEvents: 0 });
        expect(result.reopened).toBe(true);
        expect(result.isOpen).toBe(true);
    });

    test('reconnect does not duplicate the close listener', async ({ page }) => {
        await mount(page);

        const closeEvents = await page.evaluate(() => {
            const root = document.getElementById('root');
            const modal = root.querySelector('vui-modal');

            modal.remove();
            root.append(modal);

            let events = 0;
            document.addEventListener('modal:closed', () => (events += 1));

            modal.open();
            modal.querySelector('[data-action="close"]').click();

            return events;
        });

        expect(closeEvents).toBe(1);
    });

    test('open() on a disconnected element fails loudly', async ({ page }) => {
        await mount(page);

        const message = await page.evaluate(() => {
            const modal = document.querySelector('vui-modal');
            modal.remove();

            try {
                modal.open();

                return null;
            } catch (error) {
                return error.message;
            }
        });

        expect(message).toContain('requires the element to be connected');
    });

    test('toggle() flips the state', async ({ page }) => {
        await mount(page);

        const states = await page.evaluate(() => {
            const modal = document.querySelector('vui-modal');
            const first = (modal.toggle(), modal.isOpen);
            const second = (modal.toggle(), modal.isOpen);
            const forced = (modal.toggle(true), modal.isOpen);

            return [first, second, forced];
        });

        expect(states).toEqual([true, false, true]);
    });
});
