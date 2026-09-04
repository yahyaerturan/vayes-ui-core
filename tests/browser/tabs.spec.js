import { test, expect } from './support/fixtures.js';

const MARKUP = `
<vui-tabs>
    <div role="tablist" aria-label="Customer sections">
        <button id="tab-general" type="button" role="tab" aria-controls="panel-general">General</button>
        <button id="tab-billing" type="button" role="tab" aria-controls="panel-billing">Billing</button>
        <button id="tab-notes" type="button" role="tab" aria-controls="panel-notes">Notes</button>
    </div>
    <section id="panel-general" role="tabpanel">General content</section>
    <section id="panel-billing" role="tabpanel">Billing content</section>
    <section id="panel-notes" role="tabpanel"><input id="notes-field"></section>
</vui-tabs>`;

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [markup]
 */
async function mount(page, markup = MARKUP) {
    await page.evaluate(async html => {
        document.getElementById('root').innerHTML = html;
        await import('/resources/js/components/common/Tabs.js');
        await customElements.whenDefined('vui-tabs');
    }, markup);
}

test.describe('<vui-tabs>', () => {
    test('enhances server markup without rebuilding it', async ({ page }) => {
        await page.evaluate(html => {
            document.getElementById('root').innerHTML = html;
        }, MARKUP);

        const before = await page.locator('vui-tabs').innerHTML();
        await page.evaluate(() => import('/resources/js/components/common/Tabs.js'));

        // The original nodes must survive: only attributes change.
        await expect(page.locator('#panel-general')).toHaveText('General content');
        expect(before).toContain('General content');

        await expect(page.locator('#tab-general')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#tab-billing')).toHaveAttribute('aria-selected', 'false');
        await expect(page.locator('#panel-billing')).toBeHidden();
    });

    test('applies a roving tabindex', async ({ page }) => {
        await mount(page);

        await expect(page.locator('#tab-general')).toHaveAttribute('tabindex', '0');
        await expect(page.locator('#tab-billing')).toHaveAttribute('tabindex', '-1');
    });

    test('selects by click and emits tab:changed once', async ({ page }) => {
        await mount(page);

        const heard = await page.evaluate(() => {
            /** @type {unknown[]} */
            const events = [];
            document.addEventListener('tab:changed', event => events.push(event.detail));

            document.getElementById('tab-billing').click();
            document.getElementById('tab-billing').click();

            return events;
        });

        expect(heard).toEqual([
            {
                index: 1,
                previousIndex: 0,
                tabId: 'tab-billing',
                panelId: 'panel-billing',
                source: 'user',
            },
        ]);
        await expect(page.locator('#panel-billing')).toBeVisible();
        await expect(page.locator('#panel-general')).toBeHidden();
    });

    test('arrow keys wrap and activate automatically', async ({ page }) => {
        await mount(page);

        await page.locator('#tab-general').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#tab-billing')).toBeFocused();
        await expect(page.locator('#panel-billing')).toBeVisible();

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#tab-general')).toBeFocused();

        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('#tab-notes')).toBeFocused();

        await page.keyboard.press('Home');
        await expect(page.locator('#tab-general')).toBeFocused();

        await page.keyboard.press('End');
        await expect(page.locator('#tab-notes')).toBeFocused();
    });

    /**
     * Under `dir="rtl"` a horizontal tablist is laid out right-to-left, so the
     * key that moves to the next tab is ArrowLeft. Without the flip the arrows
     * walk backwards through every RTL tablist — a defect no axe rule can see,
     * because the DOM and the ARIA are both perfectly correct.
     */
    test('arrow keys follow reading order in an RTL tablist', async ({ page }) => {
        await mount(page, MARKUP.replace('role="tablist"', 'role="tablist" dir="rtl"'));

        await page.locator('#tab-general').focus();

        // ArrowLeft is "next": the second tab renders to the left of the first.
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('#tab-billing')).toBeFocused();
        await expect(page.locator('#panel-billing')).toBeVisible();

        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#tab-general')).toBeFocused();

        // Wrapping still works, in the mirrored direction.
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#tab-notes')).toBeFocused();

        // The block axis never mirrors: only the inline axis has a direction.
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('#tab-general')).toBeFocused();

        await page.keyboard.press('ArrowUp');
        await expect(page.locator('#tab-notes')).toBeFocused();

        // Home and End are already logical — first and last, not left and right.
        await page.keyboard.press('Home');
        await expect(page.locator('#tab-general')).toBeFocused();

        await page.keyboard.press('End');
        await expect(page.locator('#tab-notes')).toBeFocused();
    });

    /**
     * The direction that matters is the tablist's own, not the document's. An
     * LTR quotation, table or embedded report inside an RTL page is the common
     * case, and a check against `document.documentElement.dir` gets it wrong in
     * exactly this configuration.
     */
    test('direction is read from the tablist, not the document', async ({ page }) => {
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
        await mount(page, MARKUP.replace('role="tablist"', 'role="tablist" dir="ltr"'));

        await page.locator('#tab-general').focus();
        await page.keyboard.press('ArrowRight');

        await expect(page.locator('#tab-billing')).toBeFocused();
    });

    test('manual activation moves focus without selecting until Enter or Space', async ({
        page,
    }) => {
        await mount(page, MARKUP.replace('<vui-tabs>', '<vui-tabs activation="manual">'));

        await page.locator('#tab-general').focus();
        await page.keyboard.press('ArrowRight');

        await expect(page.locator('#tab-billing')).toBeFocused();
        await expect(page.locator('#panel-general')).toBeVisible();

        await page.keyboard.press('Enter');
        await expect(page.locator('#panel-billing')).toBeVisible();

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press(' ');
        await expect(page.locator('#panel-notes')).toBeVisible();
    });

    test('selected-index configures the initial tab and stays in sync', async ({ page }) => {
        await mount(page, MARKUP.replace('<vui-tabs>', '<vui-tabs selected-index="2">'));

        await expect(page.locator('#panel-notes')).toBeVisible();

        const result = await page.evaluate(() => {
            const tabs = document.querySelector('vui-tabs');
            tabs.setAttribute('selected-index', '1');
            const afterAttribute = tabs.selectedIndex;

            tabs.selectedIndex = 0;

            return { afterAttribute, reflected: tabs.getAttribute('selected-index') };
        });

        expect(result).toEqual({ afterAttribute: 1, reflected: '0' });
    });

    test('an out-of-range index is clamped rather than throwing', async ({ page }) => {
        await mount(page);

        const index = await page.evaluate(() => {
            const tabs = document.querySelector('vui-tabs');
            tabs.selectedIndex = 99;

            return tabs.selectedIndex;
        });

        expect(index).toBe(2);
    });

    test('a selectedIndex assigned before definition wins over the attribute', async ({ page }) => {
        const result = await page.evaluate(
            async html => {
                document.getElementById('root').innerHTML = html;
                const tabs = document.querySelector('vui-tabs');
                tabs.selectedIndex = 2;

                await import('/resources/js/components/common/Tabs.js');
                await customElements.whenDefined('vui-tabs');

                return {
                    index: tabs.selectedIndex,
                    visible: document.getElementById('panel-notes').hidden === false,
                };
            },
            MARKUP.replace('<vui-tabs>', '<vui-tabs selected-index="1">'),
        );

        expect(result).toEqual({ index: 2, visible: true });
    });

    test('reconnecting keeps the selection and does not double-fire', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const root = document.getElementById('root');
            const tabs = root.querySelector('vui-tabs');

            tabs.selectedIndex = 1;

            let events = 0;
            document.addEventListener('tab:changed', () => (events += 1));

            tabs.remove();
            root.append(tabs);

            document.getElementById('tab-notes').click();

            return { events, index: tabs.selectedIndex };
        });

        expect(result).toEqual({ events: 1, index: 2 });
    });

    test('nested tab components do not steal each other keyboard events', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <vui-tabs id="outer">
                    <div role="tablist">
                        <button id="o1" type="button" role="tab" aria-controls="op1">Outer 1</button>
                        <button id="o2" type="button" role="tab" aria-controls="op2">Outer 2</button>
                    </div>
                    <section id="op1" role="tabpanel">
                        <vui-tabs id="inner">
                            <div role="tablist">
                                <button id="i1" type="button" role="tab" aria-controls="ip1">Inner 1</button>
                                <button id="i2" type="button" role="tab" aria-controls="ip2">Inner 2</button>
                            </div>
                            <section id="ip1" role="tabpanel">Inner one</section>
                            <section id="ip2" role="tabpanel">Inner two</section>
                        </vui-tabs>
                    </section>
                    <section id="op2" role="tabpanel">Outer two</section>
                </vui-tabs>`;

            await import('/resources/js/components/common/Tabs.js');
            await customElements.whenDefined('vui-tabs');
        });

        await page.locator('#i1').focus();
        await page.keyboard.press('ArrowRight');

        const result = await page.evaluate(() => ({
            outer: document.getElementById('outer').selectedIndex,
            inner: document.getElementById('inner').selectedIndex,
        }));

        expect(result).toEqual({ outer: 0, inner: 1 });
    });

    test('refresh() re-reads tabs replaced by an AJAX fragment', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(async () => {
            const { replaceFragment } = await import('/resources/js/core/fragments.js');
            const tabs = document.querySelector('vui-tabs');

            replaceFragment(
                tabs,
                `<div role="tablist">
                    <button id="new-1" type="button" role="tab" aria-controls="new-p1">One</button>
                    <button id="new-2" type="button" role="tab" aria-controls="new-p2">Two</button>
                 </div>
                 <section id="new-p1" role="tabpanel">One</section>
                 <section id="new-p2" role="tabpanel">Two</section>`,
            );

            tabs.refresh();
            document.getElementById('new-2').click();

            return {
                index: tabs.selectedIndex,
                visible: document.getElementById('new-p2').hidden === false,
            };
        });

        expect(result).toEqual({ index: 1, visible: true });
    });

    test('a tab pointing at a missing panel fails loudly', async ({ page, allowErrors }) => {
        allowErrors(/must reference an existing panel/);

        const message = await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <vui-tabs>
                    <div role="tablist">
                        <button type="button" role="tab" aria-controls="nowhere">Broken</button>
                    </div>
                </vui-tabs>`;

            await import('/resources/js/components/common/Tabs.js');

            try {
                document.querySelector('vui-tabs').refresh();

                return null;
            } catch (error) {
                return error.message;
            }
        });

        expect(message).toContain('aria-controls');
    });
});
