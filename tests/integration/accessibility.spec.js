import AxeBuilder from '@axe-core/playwright';

import { test, expect } from '@playwright/test';

/**
 * Accessibility audit of the live demo page.
 *
 * The isolated component audit in `tests/browser/accessibility.spec.js` checks
 * each component on its own; this one checks them composed into a real
 * server-rendered page, in each of its states. Page-level findings are in scope
 * here, because the demo is also the worked example of how to host these
 * components.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [selector]
 */
function audit(page, selector = undefined) {
    const builder = new AxeBuilder({ page }).withTags(WCAG);

    return (selector ? builder.include(selector) : builder).analyze();
}

/**
 * @param {import('axe-core').AxeResults} results
 * @returns {string[]}
 */
function describe(results) {
    return results.violations.flatMap(violation =>
        violation.nodes.map(node => `${violation.id} (${violation.impact}): ${node.html}`),
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('the page has no violations on load', async ({ page }) => {
    expect(describe(await audit(page))).toEqual([]);
});

test('the page has no violations with an AJAX fragment inserted', async ({ page }) => {
    await page.click('#load-fragment');
    await expect(page.locator('#fragment-target table')).toBeVisible();

    expect(describe(await audit(page))).toEqual([]);
});

test('the page has no violations with the dialog open', async ({ page }) => {
    await page.click('#open-modal');
    await expect(page.locator('vui-modal dialog')).toBeVisible();

    expect(describe(await audit(page))).toEqual([]);
});

test('the page has no violations with search results open', async ({ page }) => {
    await page.click('#tab-search');
    await page.fill('#customer-search input', 'ada');
    await expect(page.locator('#customer-search [role="option"]')).toHaveCount(1);

    expect(describe(await audit(page))).toEqual([]);
});

test('the page has no violations with field errors shown', async ({ page }) => {
    await page.click('#open-modal');
    await page.fill('#new-name', 'x');
    await page.fill('#new-email', 'ada@example.test');
    await page.click('#submit-customer');
    await expect(page.locator('[data-error-for="email"]')).toContainText('unique value');

    expect(describe(await audit(page))).toEqual([]);
});

/**
 * The accessible name is asserted directly, not left to axe.
 *
 * axe accepts a `placeholder` as a last-resort accessible name, so a component
 * that is named *only* by its placeholder passes the automated rule while still
 * being wrong: placeholders vanish on input, are often skipped by translation,
 * and are announced inconsistently. This test states what the name must
 * actually be.
 */
test('the customer selector is named by its label, not its placeholder', async ({ page }) => {
    await page.click('#tab-search');

    const combobox = page.getByRole('combobox', { name: 'Find a customer', exact: true });

    // The demo's markup is the obvious thing an author would write:
    // `<label for="customer-search">` beside `<vui-customer-selector
    // id="customer-search">`. A custom element is not labelable, so that label
    // is inert on its own; the component resolves it. The placeholder is still
    // present, and is still not the name.
    await expect(combobox).toBeVisible();
    await expect(combobox).toHaveAttribute('placeholder', /.+/);
});

test('the dialog is named on the live page', async ({ page }) => {
    await page.click('#open-modal');

    await expect(page.getByRole('dialog', { name: 'Add customer', exact: true })).toHaveCount(1);
});
