import { test, expect } from './support/fixtures.js';

/**
 * @file Tests for the component template in `examples/component-template/`.
 *
 * These double as the worked example of the test matrix in
 * `docs/authoring-components.md`: each `test.describe` below is one row of it.
 * Copy this file alongside the component and rename.
 */

const MARKUP = `
<app-character-counter max="20" warn-at="15">
    <label for="bio">Short bio</label>
    <textarea id="bio" name="bio"></textarea>
</app-character-counter>`;

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [markup]
 */
async function mount(page, markup = MARKUP) {
    await page.evaluate(async html => {
        document.getElementById('root').innerHTML = html; // safe-html: test fixture literal.
        await import('/examples/component-template/CharacterCounter.js');
        await customElements.whenDefined('app-character-counter');
    }, markup);
}

test.describe('rendering and configuration', () => {
    test('renders a count from the server-provided field', async ({ page }) => {
        await mount(page);

        await expect(page.locator('[data-counter-output]')).toHaveText('20 characters remaining');
        await expect(page.locator('app-character-counter')).toHaveAttribute('data-state', 'ok');
    });

    test('reads attributes and falls back for unusable values', async ({ page }) => {
        await mount(page, MARKUP.replace('max="20"', 'max="not-a-number"'));

        // Documented fallback: max 0 disables the limit and shows a raw count.
        await expect(page.locator('[data-counter-output]')).toHaveText('0');
    });

    test('reacts to an observed attribute changing while mounted', async ({ page }) => {
        await mount(page);

        await page.evaluate(() =>
            document.querySelector('app-character-counter').setAttribute('max', '50'),
        );

        await expect(page.locator('[data-counter-output]')).toHaveText('50 characters remaining');
    });

    test('accepts a rich property', async ({ page }) => {
        await mount(page);

        await page.evaluate(() => {
            document.querySelector('app-character-counter').labels = {
                remaining: 'karakter kaldı',
            };
        });

        await expect(page.locator('[data-counter-output]')).toHaveText('20 karakter kaldı');
    });

    test('a property assigned before definition survives the upgrade', async ({ page }) => {
        const text = await page.evaluate(async html => {
            document.getElementById('root').innerHTML = html; // safe-html: test fixture literal.

            const element = document.querySelector('app-character-counter');
            element.labels = { remaining: 'left' };

            await import('/examples/component-template/CharacterCounter.js');
            await customElements.whenDefined('app-character-counter');

            return element.querySelector('[data-counter-output]').textContent;
        }, MARKUP);

        expect(text).toBe('20 left');
    });
});

test.describe('behaviour', () => {
    test('counts as the user types and warns near the limit', async ({ page }) => {
        await mount(page);
        const host = page.locator('app-character-counter');

        await page.locator('#bio').fill('0123456789');
        await expect(page.locator('[data-counter-output]')).toHaveText('10 characters remaining');
        await expect(host).toHaveAttribute('data-state', 'ok');

        await page.locator('#bio').fill('0123456789012345');
        await expect(host).toHaveAttribute('data-state', 'warning');
    });

    test('emits on the transition, not on every keystroke', async ({ page }) => {
        await mount(page);

        const events = await page.evaluate(async () => {
            /** @type {string[]} */
            const seen = [];
            document.addEventListener('counter:limit-exceeded', () => seen.push('exceeded'));
            document.addEventListener('counter:limit-restored', () => seen.push('restored'));

            const field = document.getElementById('bio');
            const type = async value => {
                field.value = value;
                field.dispatchEvent(new Event('input'));
                await new Promise(resolve => {
                    setTimeout(resolve, 180);
                });
            };

            await type('0'.repeat(25));
            await type('0'.repeat(30)); // still over: must not emit again
            await type('0'.repeat(5)); // back under: one restore

            return seen;
        });

        expect(events).toEqual(['exceeded', 'restored']);
    });

    test('marks the field invalid when over the limit', async ({ page }) => {
        await mount(page);

        await page.locator('#bio').fill('0'.repeat(25));

        await expect(page.locator('#bio')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('app-character-counter')).toHaveAttribute(
            'data-state',
            'exceeded',
        );
    });

    test('updating does not disturb the caret', async ({ page }) => {
        await mount(page);

        const caret = await page.evaluate(async () => {
            const field = /** @type {HTMLTextAreaElement} */ (document.getElementById('bio'));
            field.focus();
            field.value = 'hello world';
            field.setSelectionRange(5, 5);
            field.dispatchEvent(new Event('input'));

            await new Promise(resolve => {
                setTimeout(resolve, 200);
            });

            return { start: field.selectionStart, focused: document.activeElement === field };
        });

        expect(caret).toEqual({ start: 5, focused: true });
    });
});

test.describe('lifecycle', () => {
    test('reconnecting does not duplicate the output or the listener', async ({ page }) => {
        await mount(page);

        const result = await page.evaluate(async () => {
            const root = document.getElementById('root');
            const host = root.querySelector('app-character-counter');

            host.remove();
            root.append(host);

            const field = document.getElementById('bio');
            field.value = 'abc';
            field.dispatchEvent(new Event('input'));

            await new Promise(resolve => {
                setTimeout(resolve, 200);
            });

            return {
                outputs: host.querySelectorAll('[data-counter-output]').length,
                text: host.querySelector('[data-counter-output]').textContent,
            };
        });

        expect(result).toEqual({ outputs: 1, text: '17 characters remaining' });
    });

    test('the pending timer is cleared on disconnect', async ({ page }) => {
        await mount(page);

        const errors = await page.evaluate(async () => {
            /** @type {string[]} */
            const caught = [];
            window.addEventListener('error', event => caught.push(event.message));

            const field = document.getElementById('bio');
            field.value = 'typing';
            field.dispatchEvent(new Event('input'));

            // Remove before the debounce fires. An uncleared timer would run
            // against a detached component.
            document.querySelector('app-character-counter').remove();

            await new Promise(resolve => {
                setTimeout(resolve, 250);
            });

            return caught;
        });

        expect(errors).toEqual([]);
    });

    test('missing required markup fails loudly', async ({ page, allowErrors }) => {
        allowErrors(/requires an <input> or <textarea> child/);

        const message = await page.evaluate(async () => {
            await import('/examples/component-template/CharacterCounter.js');

            try {
                // safe-html: test fixture literal.
                document.getElementById('root').innerHTML =
                    '<app-character-counter></app-character-counter>';

                return null;
            } catch (error) {
                return error.message;
            }
        });

        // The throw happens inside connectedCallback, which the platform
        // reports as an uncaught error rather than propagating to the caller.
        expect(message).toBeNull();
    });
});

test.describe('accessibility', () => {
    test('the count is associated with the field and announced politely', async ({ page }) => {
        await mount(page);

        const output = page.locator('[data-counter-output]');

        await expect(output).toHaveAttribute('role', 'status');
        await expect(output).toHaveAttribute('aria-live', 'polite');

        const describedBy = await page.locator('#bio').getAttribute('aria-describedby');
        const outputId = await output.getAttribute('id');

        expect(describedBy).toBe(outputId);
    });

    test('renders hostile input as text', async ({ page }) => {
        await mount(page, MARKUP.replace('max="20"', 'max="0"'));

        const result = await page.evaluate(async () => {
            const field = document.getElementById('bio');
            field.value = '<img src=x onerror="window.__xss = 1">';
            field.dispatchEvent(new Event('input'));

            await new Promise(resolve => {
                setTimeout(resolve, 200);
            });

            return {
                xss: window.__xss ?? false,
                images: document.querySelectorAll('app-character-counter img').length,
            };
        });

        expect(result).toEqual({ xss: false, images: 0 });
    });
});
