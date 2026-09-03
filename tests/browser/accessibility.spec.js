import AxeBuilder from '@axe-core/playwright';

import { test, expect } from './support/fixtures.js';

/**
 * Automated accessibility audit of each component in isolation.
 *
 * docs/12-accessibility.md is explicit that automated tooling "is useful but
 * not sufficient" — the keyboard and focus tests in the other suites remain the
 * primary evidence. What axe adds is coverage of the things a behavioural test
 * cannot see: accessible names, ARIA relationships, and roles used incorrectly.
 *
 * Audits are scoped to the component subtree with `.include()`. Auditing the
 * whole fixture page would report page-level findings (no landmarks, no `h1`)
 * that belong to the host application, not to the library.
 *
 * Chromium only: axe computes results from the DOM and ARIA, and running the
 * same computation on three engines would triple the cost for nearly identical
 * output.
 */
// axe computes from the DOM and ARIA, and Playwright's role/name queries use
// its own accessible-name implementation rather than each browser's a11y tree,
// so running this file on three engines would triple the cost for identical
// output. Engine-specific behaviour is covered by the keyboard and focus tests,
// which do run everywhere.
test.skip(({ browserName }) => browserName !== 'chromium', 'audit runs on one engine');

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} selector Component subtree to audit.
 */
function audit(page, selector) {
    return new AxeBuilder({ page }).include(selector).withTags(WCAG).analyze();
}

/**
 * Report violations in a form that names the rule and the offending node,
 * rather than dumping axe's full JSON into the failure output.
 *
 * @param {import('axe-core').AxeResults} results
 * @returns {string[]}
 */
function describe(results) {
    return results.violations.flatMap(violation =>
        violation.nodes.map(node => `${violation.id} (${violation.impact}): ${node.html}`),
    );
}

test.describe('component accessibility', () => {
    test('<vui-counter> has no violations', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = '<vui-counter value="3"></vui-counter>'; // safe-html: test fixture literal.
            await import('/resources/js/components/common/Counter.js');
            await customElements.whenDefined('vui-counter');
        });

        expect(describe(await audit(page, 'vui-counter'))).toEqual([]);
    });

    test('<vui-tabs> has no violations', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <vui-tabs>
                    <div role="tablist" aria-label="Sections">
                        <button id="t1" type="button" role="tab" aria-controls="p1">General</button>
                        <button id="t2" type="button" role="tab" aria-controls="p2">Billing</button>
                    </div>
                    <section id="p1" role="tabpanel">General</section>
                    <section id="p2" role="tabpanel">Billing</section>
                </vui-tabs>`; // safe-html: test fixture literal.
            await import('/resources/js/components/common/Tabs.js');
            await customElements.whenDefined('vui-tabs');
        });

        expect(describe(await audit(page, 'vui-tabs'))).toEqual([]);
    });

    test('<vui-modal> has no violations while open', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <vui-modal aria-labelledby="modal-title">
                    <h2 id="modal-title">Edit customer</h2>
                    <p>Body copy.</p>
                    <button type="button" data-action="close">Close</button>
                </vui-modal>`; // safe-html: test fixture literal.
            await import('/resources/js/components/common/Modal.js');
            await customElements.whenDefined('vui-modal');
            document.querySelector('vui-modal').open();
        });

        expect(describe(await audit(page, 'vui-modal'))).toEqual([]);
    });

    test('<vui-customer-selector> has no violations when idle', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `<label for="sel">Find a customer</label>
                 <vui-customer-selector id="sel" endpoint="/api/x"></vui-customer-selector>`; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        expect(describe(await audit(page, 'vui-customer-selector'))).toEqual([]);
    });

    test('<vui-customer-selector> has no violations with results open', async ({ page }) => {
        await page.route('**/api/x*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [
                        { id: '1', name: 'Ada Lovelace', email: 'ada@example.test' },
                        { id: '2', name: 'Alan Turing', email: 'alan@example.test' },
                    ],
                }),
            }),
        );

        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `<label for="sel">Find a customer</label>
                 <vui-customer-selector id="sel" endpoint="/api/x" debounce="0"></vui-customer-selector>`; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        await page.fill('vui-customer-selector input', 'ada');
        await expect(page.locator('[role="option"]')).toHaveCount(2);

        expect(describe(await audit(page, 'vui-customer-selector'))).toEqual([]);
    });
});

/**
 * Accessible names, asserted directly.
 *
 * These assertions exist because the axe pass above was **clean while two real
 * naming defects were present**, which is docs/12-accessibility.md's warning
 * that automated tooling "is useful but not sufficient", demonstrated rather
 * than quoted:
 *
 * - the modal's `<dialog>` was anonymous. axe's `aria-dialog-name` rule matches
 *   `[role="dialog"]`, and a native `<dialog>` carries only an implicit role,
 *   so the rule never looked at it.
 * - the combobox was named by its `placeholder`. axe accepts that as a
 *   last-resort name, so the rule passed on a name that vanishes the moment the
 *   user types.
 *
 * Querying by role *and* expected name uses the platform's own accessible-name
 * computation, which is the thing that actually reaches a screen reader.
 */
test.describe('accessible names', () => {
    test('the dialog is named by the host ARIA attributes', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <vui-modal id="a" aria-labelledby="a-title">
                    <h2 id="a-title">Named by reference</h2>
                </vui-modal>
                <vui-modal id="b" aria-label="Named directly"></vui-modal>`; // safe-html: test fixture literal.
            await import('/resources/js/components/common/Modal.js');
            await customElements.whenDefined('vui-modal');
            document.getElementById('a').open();
        });

        await expect(
            page.getByRole('dialog', { name: 'Named by reference', exact: true }),
        ).toHaveCount(1);

        await page.evaluate(() => {
            document.getElementById('a').close();
            document.getElementById('b').open();
        });

        await expect(page.getByRole('dialog', { name: 'Named directly', exact: true })).toHaveCount(
            1,
        );
    });

    test('the dialog name follows a changed host attribute', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML =
                '<vui-modal aria-label="Before"></vui-modal>'; // safe-html: test fixture literal.
            await import('/resources/js/components/common/Modal.js');
            await customElements.whenDefined('vui-modal');
            document.querySelector('vui-modal').open();
        });

        await expect(page.getByRole('dialog', { name: 'Before' })).toHaveCount(1);

        await page.evaluate(() =>
            document.querySelector('vui-modal').setAttribute('aria-label', 'After'),
        );

        await expect(page.getByRole('dialog', { name: 'After' })).toHaveCount(1);
    });

    test('the combobox resolves a name through all four documented routes', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML = `
                <label for="s1">Via label for</label>
                <vui-customer-selector id="s1" endpoint="/api/x"></vui-customer-selector>

                <vui-customer-selector id="s2" endpoint="/api/x" aria-label="Via aria-label"></vui-customer-selector>

                <h3 id="s3-ref">Via aria-labelledby</h3>
                <vui-customer-selector id="s3" endpoint="/api/x" aria-labelledby="s3-ref"></vui-customer-selector>

                <label for="s4-input">Via native label for the input</label>
                <vui-customer-selector id="s4" endpoint="/api/x"></vui-customer-selector>`; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        // `exact: true` matters here: Playwright matches accessible names by
        // substring unless told otherwise, and these fixture names deliberately
        // overlap ("Via aria-label" is a prefix of "Via aria-labelledby").
        for (const name of [
            'Via label for',
            'Via aria-label',
            'Via aria-labelledby',
            'Via native label for the input',
        ]) {
            await expect(page.getByRole('combobox', { name, exact: true }), name).toHaveCount(1);
        }
    });

    test('the internal input carries a stable id derived from the host id', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML =
                '<vui-customer-selector id="customer-search" endpoint="/api/x"></vui-customer-selector>'; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        await expect(page.locator('#customer-search input')).toHaveAttribute(
            'id',
            'customer-search-input',
        );
    });

    test('the placeholder is never the accessible name', async ({ page }) => {
        await page.evaluate(async () => {
            document.getElementById('root').innerHTML =
                '<label for="s">Real name</label><vui-customer-selector id="s" endpoint="/api/x" placeholder="Type here"></vui-customer-selector>'; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        await expect(page.getByRole('combobox', { name: 'Real name', exact: true })).toHaveCount(1);
        await expect(page.getByRole('combobox', { name: 'Type here', exact: true })).toHaveCount(0);
    });

    test('the results listbox is named too', async ({ page }) => {
        await page.route('**/api/x*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: [{ id: '1', name: 'Ada Lovelace' }] }),
            }),
        );

        await page.evaluate(async () => {
            document.getElementById('root').innerHTML =
                '<label for="s">Find a customer</label><vui-customer-selector id="s" endpoint="/api/x" debounce="0"></vui-customer-selector>'; // safe-html: test fixture literal.
            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');
        });

        await page.fill('#s input', 'ada');
        await expect(page.locator('[role="option"]')).toHaveCount(1);

        await expect(
            page.getByRole('listbox', { name: 'Find a customer', exact: true }),
        ).toHaveCount(1);
    });
});
