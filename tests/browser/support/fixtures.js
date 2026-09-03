import { test as base, expect } from '@playwright/test';

/**
 * Every browser test starts on a blank page that loads nothing but the
 * component stylesheet, then imports runtime modules on demand.
 *
 * Uncaught page errors and console errors fail the test: a component that
 * throws inside an unrelated lifecycle callback must never pass silently. A
 * test that deliberately provokes a programmer error declares it with
 * `allowErrors(/pattern/)`.
 */
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        /** @type {string[]} */
        const errors = [];
        /** @type {RegExp[]} */
        const allowed = [];

        testInfo.allowedErrorPatterns = allowed;

        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => {
            if (message.type() === 'error') {
                errors.push(message.text());
            }
        });

        await page.goto('/tests/fixtures/blank.html');
        await use(page);

        const unexpected = errors.filter(error => !allowed.some(pattern => pattern.test(error)));

        expect(unexpected, 'no unexpected console/page errors').toEqual([]);
    },

    /**
     * Whitelist expected page/console errors for the current test.
     *
     * @example
     * test('fails loudly', async ({ page, allowErrors }) => {
     *     allowErrors(/must reference an existing panel/);
     * });
     */
    allowErrors: async ({ page: _page }, use, testInfo) => {
        await use(pattern => testInfo.allowedErrorPatterns.push(pattern));
    },
});

export { expect };
