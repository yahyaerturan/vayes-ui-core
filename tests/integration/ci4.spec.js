import { test, expect } from '@playwright/test';

/**
 * Phase 5 exit gate: the transport contract proven against a real CodeIgniter
 * host, not a mock.
 *
 * These tests drive the same modules the browser suite uses, but every request
 * crosses the wire to PHP: CSRF verification, token rotation, server-side
 * validation, authorisation, correlation ids and HTML fragment rendering are
 * all the real implementations.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('boot configuration', () => {
    test('the server renders configuration once, as data', async ({ page }) => {
        const config = await page.evaluate(async () => {
            const { readBootConfig } = await import('/assets/js/ci4/bootConfig.js');

            return readBootConfig();
        });

        expect(config.baseUrl).toBe('http://127.0.0.1:8081/');
        expect(config.csrfHeader).toBe('X-CSRF-TOKEN');
        expect(config.csrfTokenName).toBe('csrf_test_name');
        expect(config.csrfToken).toMatch(/^[a-f0-9]{32}$/);
        expect(config.extra).toMatchObject({ customerSearchEndpoint: '/api/customers/search' });
    });

    test('the JSON config block is inert data, not a script', async ({ page }) => {
        const type = await page.getAttribute('#app-config', 'type');

        expect(type).toBe('application/json');
    });
});

test.describe('content security policy', () => {
    // docs/10-security.md claims strict-CSP compatibility. The demo serves a
    // policy with no 'unsafe-inline' and no 'unsafe-eval', so any reliance on
    // an inline handler, an inline <script>, or eval would fail this test
    // rather than remaining a comfortable assumption.
    test('the page runs under a strict policy with no inline script or eval', async ({ page }) => {
        const response = await page.goto('/');
        const policy = response.headers()['content-security-policy'];

        expect(policy).toContain("script-src 'self'");
        expect(policy).not.toContain('unsafe-inline');
        expect(policy).not.toContain('unsafe-eval');

        // The components still work under that policy.
        await page.click('#tab-counter');
        await page.click('#demo-counter [data-action="increment"]');
        await expect(page.locator('#counter-output')).toHaveText('Counter is 2 (changed by user).');

        await page.click('#tab-list');
        await page.click('#load-fragment');
        await expect(page.locator('#fragment-target table')).toBeVisible();
    });

    test('CSP violations are not reported while exercising the demo', async ({ page }) => {
        /** @type {string[]} */
        const violations = [];

        await page.addInitScript(() => {
            window.__cspViolations = [];
            document.addEventListener('securitypolicyviolation', event => {
                window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
            });
        });

        await page.goto('/');
        await page.click('#open-modal');
        await expect(page.locator('vui-modal dialog')).toBeVisible();
        await page.click('vui-modal [data-action="close"]');

        violations.push(...(await page.evaluate(() => window.__cspViolations)));

        expect(violations).toEqual([]);
    });
});

test.describe('JSON endpoints', () => {
    test('the AJAX header reaches CodeIgniter and JSON round-trips', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const payload = await window.VayesApp.http.json('/api/customers/search', {
                query: { q: 'ada' },
            });

            return payload;
        });

        expect(result.data).toEqual([{ id: 1, name: 'Ada Lovelace', email: 'ada@example.test' }]);
    });

    test('X-Requested-With is sent on every request', async ({ page }) => {
        const [request] = await Promise.all([
            page.waitForRequest(url => url.url().includes('/api/customers/search')),
            page.evaluate(() =>
                window.VayesApp.http.json('/api/customers/search', { query: { q: 'alan' } }),
            ),
        ]);

        expect(request.headers()['x-requested-with']).toBe('XMLHttpRequest');
    });

    test('the response request id is retained on HttpError', async ({ page }) => {
        const result = await page.evaluate(async () => {
            try {
                await window.VayesApp.http.json('/api/customers/999999/archive', {
                    method: 'POST',
                });

                return { threw: false };
            } catch (error) {
                return {
                    threw: true,
                    name: error.name,
                    status: error.status,
                    requestId: error.requestId,
                };
            }
        });

        expect(result.threw).toBe(true);
        expect(result.name).toBe('HttpError');
        expect(result.status).toBe(403);
        expect(result.requestId).toMatch(/^[a-f0-9]{16}$/);
    });

    test('a client-supplied request id is echoed back for correlation', async ({ page }) => {
        const requestId = await page.evaluate(async () => {
            const response = await window.VayesApp.http.get('/api/customers/search?q=ada', {
                headers: { 'X-Request-Id': 'client-generated-id' },
            });

            return response.headers.get('X-Request-Id');
        });

        expect(requestId).toBe('client-generated-id');
    });
});

test.describe('CSRF contract', () => {
    test('an unsafe request without a token is rejected', async ({ page }) => {
        const status = await page.evaluate(async () => {
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'No Token', email: 'no-token@example.test' }),
            });

            return response.status;
        });

        expect(status).toBe(403);
    });

    test('the configured provider makes an unsafe request succeed', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const response = await window.VayesApp.http.post(
                '/api/customers',
                { name: 'First Write', email: `first-${Date.now()}@example.test` },
                { json: true },
            );

            return { status: response.status, body: await response.json() };
        });

        expect(result.status).toBe(201);
        expect(result.body.data.name).toBe('First Write');
    });

    // docs/09-ci4-integration.md: "second unsafe request after token
    // regeneration if enabled".
    test('consecutive unsafe requests survive token rotation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { http, csrf } = window.VayesApp;
            const tokens = [csrf.token];
            const statuses = [];

            for (let index = 0; index < 3; index += 1) {
                const response = await http.post(
                    '/api/customers',
                    {
                        name: `Rotation ${index}`,
                        email: `rotation-${Date.now()}-${index}@example.test`,
                    },
                    { json: true },
                );

                statuses.push(response.status);
                tokens.push(csrf.token);
            }

            return { statuses, tokens };
        });

        expect(result.statuses).toEqual([201, 201, 201]);
        // Every request must have rotated the token; a repeat would mean the
        // client is replaying a spent hash.
        expect(new Set(result.tokens).size).toBe(result.tokens.length);
    });

    test('a stale token is rejected once the server has rotated', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { http, csrf } = window.VayesApp;
            const stale = csrf.token;

            await http.post(
                '/api/customers',
                { name: 'Rotator', email: `rotator-${Date.now()}@example.test` },
                { json: true },
            );

            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': stale },
                body: JSON.stringify({
                    name: 'Replay',
                    email: `replay-${Date.now()}@example.test`,
                }),
            });

            return { staleRejected: response.status };
        });

        expect(result.staleRejected).toBe(403);
    });

    test('a form-encoded body receives the token as a field', async ({ page }) => {
        const [request, status] = await Promise.all([
            page.waitForRequest(url => url.url().endsWith('/api/customers')),
            page.evaluate(async () => {
                const body = new URLSearchParams({
                    name: 'Form Body',
                    email: `form-${Date.now()}@example.test`,
                });

                const response = await window.VayesApp.http.post('/api/customers', body);

                return response.status;
            }),
        ]);

        expect(status).toBe(201);
        expect(request.postData()).toContain('csrf_test_name=');
    });
});

test.describe('server-authoritative validation', () => {
    test('invalid input returns 422 with per-field errors', async ({ page }) => {
        const result = await page.evaluate(async () => {
            try {
                await window.VayesApp.http.post(
                    '/api/customers',
                    { name: 'x', email: 'not-an-email' },
                    { json: true },
                );

                return { threw: false };
            } catch (error) {
                return {
                    threw: true,
                    status: error.status,
                    isValidationError: error.isValidationError,
                    fields: Object.keys(error.body.errors ?? {}),
                };
            }
        });

        expect(result.threw).toBe(true);
        expect(result.status).toBe(422);
        expect(result.isValidationError).toBe(true);
        expect(result.fields.sort()).toEqual(['email', 'name']);
    });

    // The inputs below pass the browser's own constraint validation: `x` is a
    // non-empty required field and the address is well-formed. Only the server
    // knows that the name is too short and the address is taken, which is
    // precisely the point of ADR-006.
    test('validation errors render into the form without executing markup', async ({ page }) => {
        await page.click('#open-modal');
        await page.fill('#new-name', 'x');
        await page.fill('#new-email', 'ada@example.test');
        await page.click('#submit-customer');

        await expect(page.locator('[data-error-for="name"]')).toContainText(
            'at least 2 characters',
        );
        await expect(page.locator('[data-error-for="email"]')).toContainText('unique value');
        await expect(page.locator('#new-name')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#form-status')).toHaveText(
            'Please correct the highlighted fields.',
        );
        await expect(page.locator('vui-modal dialog')).toBeVisible();
    });

    test('a valid submission closes the dialog and reports success', async ({ page }) => {
        await page.click('#open-modal');
        await page.fill('#new-name', 'Valid Person');
        await page.fill('#new-email', `valid-${Date.now()}@example.test`);
        await page.click('#submit-customer');

        await expect(page.locator('#form-status')).toContainText('Created Valid Person.');
        await expect(page.locator('vui-modal dialog')).toBeHidden();
    });
});

test.describe('authorisation', () => {
    // docs/10-security.md: "forbidden server action remains forbidden even if
    // UI is manipulated".
    test('a forbidden action stays forbidden however the UI is manipulated', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Simulate a user enabling a hidden control in DevTools.
            document.body.dataset.role = 'admin';

            try {
                await window.VayesApp.http.post('/api/customers/1/archive', null, {});

                return { status: 200 };
            } catch (error) {
                return { status: error.status, message: error.body?.message };
            }
        });

        expect(result.status).toBe(403);
    });

    test('the same action succeeds once the server grants the role', async ({ page }) => {
        const result = await page.evaluate(async () => {
            await window.VayesApp.http.json('/demo/login?role=admin');

            const response = await window.VayesApp.http.post('/api/customers/2/archive');

            return { status: response.status, body: await response.json() };
        });

        expect(result.status).toBe(200);
        expect(result.body.data).toEqual({ id: 2, archived: true });
    });
});

test.describe('HTML fragments', () => {
    test('a fragment endpoint returns HTML that upgrades on insertion', async ({ page }) => {
        await page.click('#load-fragment');

        await expect(page.locator('#fragment-target table')).toBeVisible();

        // Custom elements inside the fragment initialised with no init pass.
        const counters = page.locator('#fragment-target vui-counter');
        await expect(counters.first()).toBeVisible();
        await expect(counters.first().locator('[data-value]')).toHaveText('0');

        await counters.first().locator('[data-action="increment"]').click();
        await expect(counters.first().locator('[data-value]')).toHaveText('1');
    });

    test('server-escaped data in a fragment renders as text', async ({ page }) => {
        await page.click('#load-fragment');
        await expect(page.locator('#fragment-target table')).toBeVisible();

        const result = await page.evaluate(() => ({
            xss: window.__xss ?? false,
            images: document.querySelectorAll('#fragment-target img').length,
            hostileCell: [...document.querySelectorAll('#fragment-target .customer-name')]
                .map(cell => cell.textContent)
                .find(text => text.includes('<img')),
        }));

        expect(result.xss).toBe(false);
        expect(result.images).toBe(0);
        expect(result.hostileCell).toContain('<img src=x onerror=');
    });

    test('the fragment carries no script and none executes', async ({ page }) => {
        const html = await page.evaluate(() => window.VayesApp.http.html('/customers/table'));

        expect(html).not.toContain('<script');

        await page.click('#load-fragment');
        await expect(page.locator('#fragment-target table')).toBeVisible();
        expect(await page.locator('#fragment-target script').count()).toBe(0);
    });
});

test.describe('end-to-end component behaviour', () => {
    test('the selector searches the live API and announces the selection', async ({ page }) => {
        await page.click('#tab-search');
        await page.fill('#customer-search input', 'gra');

        await expect(page.locator('#customer-search [role="option"]')).toHaveCount(1);
        await page.click('#customer-search [role="option"]');

        await expect(page.locator('#selection-output')).toHaveText(
            'Selected: Grace Hopper (grace@example.test)',
        );
    });

    test('a hostile name from the database is rendered as text end to end', async ({ page }) => {
        await page.click('#tab-search');
        await page.fill('#customer-search input', 'onerror');

        await expect(page.locator('#customer-search [role="option"]')).toHaveCount(1);

        const result = await page.evaluate(() => ({
            xss: window.__xss ?? false,
            images: document.querySelectorAll('#customer-search img').length,
            text: document.querySelector('#customer-search [role="option"]').textContent,
        }));

        expect(result.xss).toBe(false);
        expect(result.images).toBe(0);
        expect(result.text).toContain('<img src=x onerror=');
    });

    test('a component event crosses to an unrelated part of the page', async ({ page }) => {
        await page.click('#tab-counter');
        await page.click('#demo-counter [data-action="increment"]');

        await expect(page.locator('#counter-output')).toHaveText('Counter is 2 (changed by user).');
    });

    test('tabs are keyboard operable on the live page', async ({ page }) => {
        await page.locator('#tab-list').focus();
        await page.keyboard.press('ArrowRight');

        await expect(page.locator('#panel-search')).toBeVisible();
        await expect(page.locator('#panel-list')).toBeHidden();
    });

    test('components survive removal and reinsertion on the live page', async ({ page }) => {
        await page.click('#tab-counter');

        const events = await page.evaluate(() => {
            const counter = document.getElementById('demo-counter');
            const parent = counter.parentElement;
            let count = 0;

            document.addEventListener('counter:changed', () => (count += 1));

            counter.remove();
            parent.append(counter);
            counter.querySelector('[data-action="increment"]').click();

            return count;
        });

        expect(events).toBe(1);
    });
});
