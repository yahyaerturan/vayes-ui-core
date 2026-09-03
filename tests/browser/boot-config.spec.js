import { test as base, expect } from '@playwright/test';

/**
 * Boot configuration parsing against a static fixture.
 *
 * The integration suite proves this works against real CodeIgniter output; this
 * suite covers the shapes CI4 will not produce on a good day — a missing tag, a
 * malformed JSON block — which must still behave predictably.
 */
const test = base.extend({
    page: async ({ page }, use) => {
        await page.goto('/tests/fixtures/boot-config.html');
        await use(page);
    },
});

test('reads meta tags and the JSON block', async ({ page }) => {
    const config = await page.evaluate(async () => {
        const { readBootConfig } = await import('/resources/js/ci4/bootConfig.js');

        return readBootConfig();
    });

    expect(config).toMatchObject({
        baseUrl: 'https://app.test/',
        locale: 'tr',
        csrfHeader: 'X-CSRF-TOKEN',
        csrfTokenName: 'csrf_test_name',
        csrfToken: 'boot-token-1',
        csrfCookie: null,
    });
    expect(config.extra).toEqual({
        customerSearchEndpoint: '/api/customers/search',
        featureFlags: { beta: true },
    });
});

test('a missing meta tag returns null rather than an empty string', async ({ page }) => {
    const value = await page.evaluate(async () => {
        const { readMeta } = await import('/resources/js/ci4/bootConfig.js');

        return readMeta('not-rendered');
    });

    expect(value).toBeNull();
});

test('an absent JSON block yields an empty object', async ({ page }) => {
    const value = await page.evaluate(async () => {
        const { readJsonConfig } = await import('/resources/js/ci4/bootConfig.js');

        return readJsonConfig('no-such-block');
    });

    expect(value).toEqual({});
});

test('a malformed JSON block throws instead of failing silently', async ({ page }) => {
    const message = await page.evaluate(async () => {
        const { readJsonConfig } = await import('/resources/js/ci4/bootConfig.js');

        const broken = document.createElement('script');
        broken.type = 'application/json';
        broken.id = 'broken-config';
        broken.textContent = '{ not json';
        document.head.append(broken);

        try {
            readJsonConfig('broken-config');

            return null;
        } catch (error) {
            return error.message;
        }
    });

    expect(message).toContain('not valid JSON');
});

test('the JSON block is data, never executed', async ({ page }) => {
    const executed = await page.evaluate(async () => {
        const block = document.createElement('script');
        block.type = 'application/json';
        block.id = 'inert-config';
        block.textContent = '{"x": 1}';
        document.head.append(block);

        await new Promise(resolve => {
            setTimeout(resolve, 20);
        });

        return window.__executed ?? false;
    });

    expect(executed).toBe(false);
});

test('the CSRF provider is built from what the server rendered', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { readBootConfig } = await import('/resources/js/ci4/bootConfig.js');
        const { CodeIgniterCsrfProvider } = await import('/resources/js/ci4/CodeIgniterCsrf.js');

        const provider = CodeIgniterCsrfProvider.fromBootConfig(readBootConfig());

        return {
            headers: provider.getRequestHeaders({ method: 'POST' }),
            fields: provider.getRequestBodyFields({ method: 'POST' }),
        };
    });

    expect(result.headers).toEqual({ 'X-CSRF-TOKEN': 'boot-token-1' });
    expect(result.fields).toEqual({ csrf_test_name: 'boot-token-1' });
});
