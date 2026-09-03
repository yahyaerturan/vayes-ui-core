/**
 * The worked example from docs/getting-started.md, kept executable.
 *
 * A tutorial that no longer runs is worse than no tutorial: it is the first
 * thing a new reader tries. This spec and `examples/toggle/Toggle.js` are the
 * same code the guide prints, so an API change that breaks the example breaks
 * the build.
 */
import { test, expect } from './support/fixtures.js';

const load = page => page.evaluate(() => import('/examples/toggle/Toggle.js'));

test('toggles and announces the change', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        document.getElementById('root').innerHTML = '<vui-toggle></vui-toggle>';
    });

    const heard = await page.evaluate(() => {
        const seen = [];
        document.addEventListener('toggle:changed', e => seen.push(e.detail));
        document.querySelector('button').click();

        return seen;
    });

    expect(heard).toEqual([{ on: true, source: 'user' }]);
    await expect(page.locator('button')).toHaveAttribute('aria-pressed', 'true');
});

test('reconnecting does not duplicate the handler', async ({ page }) => {
    await load(page);

    const count = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-toggle></vui-toggle>';

        const toggle = root.querySelector('vui-toggle');
        let events = 0;
        document.addEventListener('toggle:changed', () => (events += 1));

        toggle.remove();
        root.append(toggle);
        toggle.querySelector('button').click();

        return events;
    });

    expect(count).toBe(1);
});
