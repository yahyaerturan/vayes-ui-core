import { test, expect } from './support/fixtures.js';

/**
 * Async component contract: stale-request cancellation, distinct loading /
 * empty / error states, combobox keyboard semantics and XSS-safe rendering.
 *
 * The endpoint is stubbed at the network layer rather than by replacing the
 * service, so the whole path — component → service → HttpClient → fetch — runs
 * exactly as it will in production.
 */

const CUSTOMERS = [
    { id: '1', name: 'Ada Lovelace', email: 'ada@example.test' },
    { id: '2', name: 'Alan Turing', email: 'alan@example.test' },
    { id: '3', name: 'Grace Hopper', email: 'grace@example.test' },
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 * @param {string} [options.attributes]
 */
async function mount(page, options = {}) {
    await page.evaluate(async attributes => {
        document.getElementById('root').innerHTML =
            `<vui-customer-selector endpoint="/api/customers/search" debounce="0" ${attributes}></vui-customer-selector>`;

        await import('/resources/js/components/customer/CustomerSelector.js');
        await customElements.whenDefined('vui-customer-selector');
    }, options.attributes ?? '');
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {(url: URL) => { status?: number, body?: unknown, delay?: number }} handler
 */
async function stubSearch(page, handler) {
    await page.route('**/api/customers/search*', async route => {
        const url = new URL(route.request().url());
        const result = handler(url);

        if (result.delay) {
            await new Promise(resolve => {
                setTimeout(resolve, result.delay);
            });
        }

        await route.fulfill({
            status: result.status ?? 200,
            contentType: 'application/json',
            body: JSON.stringify(result.body ?? { data: [] }),
        });
    });
}

test.describe('<vui-customer-selector>', () => {
    test('renders an accessible combobox', async ({ page }) => {
        await mount(page);

        const input = page.locator('vui-customer-selector input');

        await expect(input).toHaveAttribute('role', 'combobox');
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(input).toHaveAttribute('aria-autocomplete', 'list');
        await expect(page.locator('vui-customer-selector [role="listbox"]')).toBeHidden();
        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'idle');
    });

    test('does not search below the minimum query length', async ({ page }) => {
        let requests = 0;
        await page.route('**/api/customers/search*', route => {
            requests += 1;

            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        await mount(page, { attributes: 'min-query="3"' });
        await page.locator('input').fill('ad');
        await page.waitForTimeout(100);

        expect(requests).toBe(0);
        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'idle');
    });

    test('searches, renders options and reports the results state', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);

        await page.locator('input').fill('ad');
        await page.locator('input').fill('ada');

        await expect(page.locator('[role="option"]')).toHaveCount(3);
        await expect(page.locator('[role="option"]').first()).toContainText('Ada Lovelace');
        await expect(page.locator('[role="option"]').first()).toContainText('ada@example.test');
        await expect(page.locator('vui-customer-selector')).toHaveAttribute(
            'data-state',
            'results',
        );
        await expect(page.locator('input')).toHaveAttribute('aria-expanded', 'true');
    });

    test('sends the configured limit and query to the endpoint', async ({ page }) => {
        /** @type {URL[]} */
        const seen = [];
        await stubSearch(page, url => {
            seen.push(url);

            return { body: { data: [] } };
        });

        await mount(page, { attributes: 'limit="5"' });
        await page.locator('input').fill('ada');
        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'empty');

        expect(seen.at(-1)?.searchParams.get('q')).toBe('ada');
        expect(seen.at(-1)?.searchParams.get('limit')).toBe('5');
    });

    test('renders the empty state when nothing matches', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: [] } }));
        await mount(page);

        await page.locator('input').fill('zzz');

        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'empty');
        await expect(page.locator('[data-status]')).toHaveText('No customers found.');
        await expect(page.locator('[role="listbox"]')).toBeHidden();
    });

    test('renders an error state for a server failure and keeps the request id private', async ({
        page,
        allowErrors,
    }) => {
        // Chromium logs every 5xx to the console; the assertion below is that
        // the component turns it into a state, not that the browser stays quiet.
        allowErrors(/status of 500/);

        await page.route('**/api/customers/search*', route =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                headers: { 'X-Request-Id': 'req-42' },
                body: JSON.stringify({ message: 'Internal error at /var/www/app/Models/X.php:31' }),
            }),
        );
        await mount(page);

        const detail = await page.evaluate(async () => {
            /** @type {unknown} */
            let received = null;
            document.addEventListener('customer:search-failed', event => (received = event.detail));

            const input = document.querySelector('input');
            input.value = 'ada';
            await document.querySelector('vui-customer-selector').search('ada');

            return received;
        });

        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'error');
        await expect(page.locator('[data-status]')).toHaveText('Could not load customers.');

        // The user-facing message is generic; the correlation id travels in the
        // event for the application to surface (docs/19-observability-errors.md).
        expect(detail).toEqual({
            query: 'ada',
            error: { name: 'HttpError', status: 500, requestId: 'req-42' },
        });
        await expect(page.locator('[data-status]')).not.toContainText('/var/www');
    });

    test('aborts superseded requests and never renders a stale result', async ({ page }) => {
        /** @type {string[]} */
        const started = [];

        await page.route('**/api/customers/search*', async route => {
            const query = new URL(route.request().url()).searchParams.get('q') ?? '';
            started.push(query);

            // The first query answers slowly with the wrong data.
            if (query === 'ad') {
                await new Promise(resolve => {
                    setTimeout(resolve, 400);
                });

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: [{ id: '99', name: 'STALE RESULT' }] }),
                });
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: CUSTOMERS }),
            });
        });

        await mount(page);

        await page.evaluate(() => {
            const selector = document.querySelector('vui-customer-selector');
            selector.search('ad');
            selector.search('ada');
        });

        await expect(page.locator('[role="option"]')).toHaveCount(3);
        await page.waitForTimeout(600);

        await expect(page.locator('[role="option"]')).toHaveCount(3);
        await expect(page.locator('vui-customer-selector')).not.toContainText('STALE RESULT');
        await expect(page.locator('vui-customer-selector')).toHaveAttribute(
            'data-state',
            'results',
        );
    });

    test('a cancelled request never renders the error state', async ({ page }) => {
        await page.route('**/api/customers/search*', async route => {
            await new Promise(resolve => {
                setTimeout(resolve, 300);
            });

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: [] }),
            });
        });

        await mount(page);

        await page.evaluate(async () => {
            const selector = document.querySelector('vui-customer-selector');
            const pending = selector.search('ada');
            selector.clear();
            await pending;
        });

        await page.waitForTimeout(500);
        await expect(page.locator('vui-customer-selector')).toHaveAttribute('data-state', 'idle');
        await expect(page.locator('[data-status]')).toHaveText('');
    });

    test('marks itself busy while loading', async ({ page }) => {
        await stubSearch(page, () => ({ delay: 300, body: { data: CUSTOMERS } }));
        await mount(page);

        await page.locator('input').fill('ada');

        await expect(page.locator('vui-customer-selector')).toHaveAttribute(
            'data-state',
            'loading',
        );
        await expect(page.locator('vui-customer-selector')).toHaveAttribute('aria-busy', '');
        await expect(page.locator('[data-status]')).toHaveText('Searching…');

        await expect(page.locator('vui-customer-selector')).toHaveAttribute(
            'data-state',
            'results',
        );
    });

    test('selecting an option by click emits customer:selected', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);

        await page.locator('input').fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);

        const detail = await page.evaluate(async () => {
            /** @type {unknown} */
            let received = null;
            document.addEventListener('customer:selected', event => (received = event.detail));

            await new Promise(resolve => {
                setTimeout(resolve, 50);
            });
            document.querySelectorAll('[role="option"]')[1].click();

            return received;
        });

        expect(detail).toEqual({
            id: '2',
            customer: { id: '2', name: 'Alan Turing', email: 'alan@example.test' },
            source: 'user',
        });
        await expect(page.locator('input')).toHaveValue('Alan Turing');
        await expect(page.locator('[role="listbox"]')).toBeHidden();
    });

    test('keyboard: arrows move the active option, Enter selects, Escape closes', async ({
        page,
    }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);

        const input = page.locator('input');
        await input.fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);

        await input.press('ArrowDown');
        await expect(page.locator('[role="option"]').first()).toHaveAttribute(
            'aria-selected',
            'true',
        );
        await expect(input).toHaveAttribute('aria-activedescendant', /option-0$/);

        await input.press('ArrowDown');
        await expect(page.locator('[role="option"]').nth(1)).toHaveAttribute(
            'aria-selected',
            'true',
        );

        await input.press('ArrowUp');
        await input.press('ArrowUp');
        await expect(page.locator('[role="option"]').nth(2)).toHaveAttribute(
            'aria-selected',
            'true',
            // ArrowUp from the first option wraps to the last.
        );

        await input.press('Home');
        await expect(page.locator('[role="option"]').first()).toHaveAttribute(
            'aria-selected',
            'true',
        );
        await input.press('End');
        await expect(page.locator('[role="option"]').nth(2)).toHaveAttribute(
            'aria-selected',
            'true',
        );

        await input.press('Enter');
        await expect(input).toHaveValue('Grace Hopper');
        await expect(page.locator('[role="listbox"]')).toBeHidden();
    });

    test('Escape closes the list without clearing the query', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);

        const input = page.locator('input');
        await input.fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);

        await input.press('Escape');

        await expect(page.locator('[role="listbox"]')).toBeHidden();
        await expect(input).toHaveValue('ada');
        await expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    test('clicking outside closes the list', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);
        await page.evaluate(() => {
            const outside = document.createElement('button');
            outside.id = 'outside';
            outside.textContent = 'Elsewhere';
            // Above the selector: the result list is absolutely positioned
            // below the input and would otherwise cover the target.
            document.body.prepend(outside);
        });

        await page.locator('input').fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);

        await page.locator('#outside').click();

        await expect(page.locator('[role="listbox"]')).toBeHidden();
        await expect(page.locator('input')).toHaveAttribute('aria-expanded', 'false');
    });

    test('clear() empties the selection and emits customer:cleared once', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            const selector = document.querySelector('vui-customer-selector');
            /** @type {unknown[]} */
            const heard = [];
            document.addEventListener('customer:cleared', event => heard.push(event.detail));

            selector.selected = { id: '1', name: 'Ada Lovelace' };
            selector.clear();
            selector.clear();

            return {
                heard,
                value: selector.querySelector('input').value,
                selected: selector.selected,
            };
        });

        expect(result.heard).toEqual([
            { previous: { id: '1', name: 'Ada Lovelace', email: undefined } },
        ]);
        expect(result.value).toBe('');
        expect(result.selected).toBeNull();
    });

    test('assigning selected pre-fills without emitting a selection event', async ({ page }) => {
        await mount(page);

        const events = await page.evaluate(() => {
            let count = 0;
            document.addEventListener('customer:selected', () => (count += 1));

            document.querySelector('vui-customer-selector').selected = {
                id: '1',
                name: 'Ada Lovelace',
            };

            return count;
        });

        expect(events).toBe(0);
        await expect(page.locator('input')).toHaveValue('Ada Lovelace');
        await expect(page.locator('[data-action="clear"]')).toBeVisible();
    });

    test('a selected customer assigned before definition survives the upgrade', async ({
        page,
    }) => {
        const value = await page.evaluate(async () => {
            document.getElementById('root').innerHTML =
                '<vui-customer-selector id="s" endpoint="/api/customers/search"></vui-customer-selector>';

            const element = document.getElementById('s');
            element.selected = { id: '9', name: 'Katherine Johnson' };

            await import('/resources/js/components/customer/CustomerSelector.js');
            await customElements.whenDefined('vui-customer-selector');

            return element.querySelector('input').value;
        });

        expect(value).toBe('Katherine Johnson');
    });

    test('an injected service replaces the default transport path', async ({ page }) => {
        const result = await page.evaluate(async () => {
            await import('/resources/js/components/customer/CustomerSelector.js');

            const element = document.createElement('vui-customer-selector');
            element.setAttribute('debounce', '0');

            /** @type {string[]} */
            const queries = [];

            element.service = {
                async search(query) {
                    queries.push(query);

                    return [{ id: '1', name: 'Injected Result' }];
                },
            };

            document.getElementById('root').append(element);
            await element.search('ada');

            return {
                queries,
                option: document.querySelector('[role="option"]')?.textContent?.trim(),
            };
        });

        expect(result.queries).toEqual(['ada']);
        expect(result.option).toBe('Injected Result');
    });

    // docs/10-security.md: "dynamic user text renders as text, not HTML".
    test('renders hostile customer names as text', async ({ page }) => {
        await stubSearch(page, () => ({
            body: {
                data: [
                    {
                        id: '1',
                        name: '<img src=x onerror="window.__xss = true">',
                        email: '<b>x</b>',
                    },
                    { id: '2', name: '"><script>window.__xss = true</script>' },
                ],
            },
        }));
        await mount(page);

        await page.locator('input').fill('evil');
        await expect(page.locator('[role="option"]')).toHaveCount(2);

        const result = await page.evaluate(() => {
            const options = [...document.querySelectorAll('[role="option"]')];

            return {
                xss: window.__xss ?? false,
                images: document.querySelectorAll('vui-customer-selector img').length,
                scripts: document.querySelectorAll('vui-customer-selector script').length,
                bold: document.querySelectorAll('vui-customer-selector b').length,
                firstText: options[0].textContent,
            };
        });

        expect(result.xss).toBe(false);
        expect(result.images).toBe(0);
        expect(result.scripts).toBe(0);
        expect(result.bold).toBe(0);
        expect(result.firstText).toContain('<img src=x onerror=');
    });

    test('a hostile selected name is written to the input as a literal value', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(() => {
            document.querySelector('vui-customer-selector').selected = {
                id: '1',
                name: '<img src=x onerror="window.__xss = true">',
            };

            return {
                xss: window.__xss ?? false,
                value: document.querySelector('input').value,
            };
        });

        expect(result.xss).toBe(false);
        expect(result.value).toBe('<img src=x onerror="window.__xss = true">');
    });

    test('disabled blocks interaction and closes the list', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: CUSTOMERS } }));
        await mount(page);

        await page.locator('input').fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);

        await page.evaluate(
            () => (document.querySelector('vui-customer-selector').disabled = true),
        );

        await expect(page.locator('input')).toBeDisabled();
        await expect(page.locator('[role="listbox"]')).toBeHidden();
    });

    test('disconnecting cancels in-flight work and removes the document listener', async ({
        page,
    }) => {
        await stubSearch(page, () => ({ delay: 200, body: { data: CUSTOMERS } }));
        await mount(page);

        const result = await page.evaluate(async () => {
            const root = document.getElementById('root');
            const selector = root.querySelector('vui-customer-selector');

            const pending = selector.search('ada');
            selector.remove();
            await pending;

            await new Promise(resolve => {
                setTimeout(resolve, 300);
            });

            // Clicking the document must not throw now that internals are gone.
            document.body.click();

            return {
                mounted: selector.mounted,
                optionCount: selector.querySelectorAll('[role="option"]').length,
            };
        });

        expect(result.mounted).toBe(false);
        expect(result.optionCount).toBe(0);
    });

    test('a selector with no endpoint and no service fails loudly', async ({
        page,
        allowErrors,
    }) => {
        allowErrors(/requires an "endpoint" attribute/);

        const message = await page.evaluate(async () => {
            await import('/resources/js/components/customer/CustomerSelector.js');

            try {
                document.getElementById('root').innerHTML =
                    '<vui-customer-selector></vui-customer-selector>';

                return null;
            } catch (error) {
                return error.message;
            }
        });

        // The throw happens inside connectedCallback, which the platform
        // reports as an uncaught error rather than propagating to the caller.
        expect(message).toBeNull();
    });

    test('localised labels come from a property, not a global catalogue', async ({ page }) => {
        await stubSearch(page, () => ({ body: { data: [] } }));
        await mount(page);

        await page.evaluate(() => {
            document.querySelector('vui-customer-selector').labels = {
                empty: 'Müşteri bulunamadı.',
                loading: 'Aranıyor…',
            };
        });

        await page.locator('input').fill('zzz');

        await expect(page.locator('[data-status]')).toHaveText('Müşteri bulunamadı.');
    });

    test('reconnect does not duplicate search handling', async ({ page }) => {
        let requests = 0;
        await page.route('**/api/customers/search*', route => {
            requests += 1;

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: CUSTOMERS }),
            });
        });

        await mount(page);

        await page.evaluate(() => {
            const root = document.getElementById('root');
            const selector = root.querySelector('vui-customer-selector');
            selector.remove();
            root.append(selector);
        });

        await page.locator('input').fill('ada');
        await expect(page.locator('[role="option"]')).toHaveCount(3);
        await page.waitForTimeout(150);

        expect(requests).toBe(1);
    });
});
