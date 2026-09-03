import { test, expect } from './support/fixtures.js';

/**
 * Phase 6 exit gate: a server HTML fragment containing components works with
 * zero `initAll()` / DOM scanning, and nothing inside it executes.
 */

const DEFINE_PROBE = async () => {
    const { Component } = await import('/resources/js/core/Component.js');
    const { define } = await import('/resources/js/core/register.js');

    class Probe extends Component {
        render() {
            this.dataset.upgraded = 'yes';
        }

        bindEvents() {
            this.bindActions();
        }

        handleAction(action) {
            this.dataset.lastAction = action;
        }
    }

    define('vui-probe-fragment', Probe);
};

test('custom elements inside an inserted fragment initialise with no scan', async ({ page }) => {
    await page.evaluate(DEFINE_PROBE);

    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');

        const container = document.getElementById('root');
        replaceFragment(
            container,
            `<div class="table">
                <vui-probe-fragment id="a"><button data-action="go">go</button></vui-probe-fragment>
                <vui-probe-fragment id="b"></vui-probe-fragment>
            </div>`,
        );

        document.querySelector('#a button').click();

        return {
            upgraded: [...document.querySelectorAll('vui-probe-fragment')].map(
                node => node.dataset.upgraded,
            ),
            mounted: document.getElementById('a').mounted,
            lastAction: document.getElementById('a').dataset.lastAction,
        };
    });

    expect(result.upgraded).toEqual(['yes', 'yes']);
    expect(result.mounted).toBe(true);
    expect(result.lastAction).toBe('go');
});

test('elements inserted before their module loads upgrade retroactively', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');

        replaceFragment(
            document.getElementById('root'),
            '<vui-probe-latefragment id="late"></vui-probe-latefragment>',
        );

        const before = document.getElementById('late').dataset.upgraded ?? null;

        const { Component } = await import('/resources/js/core/Component.js');
        const { define } = await import('/resources/js/core/register.js');

        class Probe extends Component {
            render() {
                this.dataset.upgraded = 'yes';
            }
        }

        define('vui-probe-latefragment', Probe);
        await customElements.whenDefined('vui-probe-latefragment');

        return { before, after: document.getElementById('late').dataset.upgraded };
    });

    expect(result).toEqual({ before: null, after: 'yes' });
});

test('scripts in a fragment are removed and never execute', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');

        window.__executed = false;

        replaceFragment(
            document.getElementById('root'),
            `<p>safe</p>
             <script>window.__executed = true;</script>
             <script src="/tests/fixtures/does-not-exist.js"></script>`,
        );

        // Give any (incorrectly) scheduled script a chance to run.
        await new Promise(resolve => {
            setTimeout(resolve, 50);
        });

        return {
            executed: window.__executed,
            scriptCount: document.querySelectorAll('#root script').length,
            text: document.querySelector('#root p').textContent,
        };
    });

    expect(result).toEqual({ executed: false, scriptCount: 0, text: 'safe' });
});

test('inline event handler attributes are stripped', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');

        window.__handlerRan = false;

        replaceFragment(
            document.getElementById('root'),
            '<button id="evil" onclick="window.__handlerRan = true">click</button>',
        );

        document.getElementById('evil').click();

        return {
            handlerRan: window.__handlerRan,
            hasAttribute: document.getElementById('evil').hasAttribute('onclick'),
        };
    });

    expect(result).toEqual({ handlerRan: false, hasAttribute: false });
});

test('replaceFragment disconnects the components it removes', async ({ page }) => {
    await page.evaluate(DEFINE_PROBE);

    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');
        const container = document.getElementById('root');

        replaceFragment(container, '<vui-probe-fragment id="old"></vui-probe-fragment>');
        const old = document.getElementById('old');

        replaceFragment(container, '<vui-probe-fragment id="new"></vui-probe-fragment>');

        return {
            oldMounted: old.mounted,
            newMounted: document.getElementById('new').mounted,
            childCount: container.children.length,
        };
    });

    expect(result).toEqual({ oldMounted: false, newMounted: true, childCount: 1 });
});

test('appendFragment preserves existing children', async ({ page }) => {
    const html = await page.evaluate(async () => {
        const { appendFragment } = await import('/resources/js/core/fragments.js');
        const container = document.getElementById('root');

        container.innerHTML = '<p id="first">first</p>';
        appendFragment(container, '<p id="second">second</p>');

        return container.innerHTML;
    });

    expect(html).toBe('<p id="first">first</p><p id="second">second</p>');
});

test('table row fragments parse correctly', async ({ page }) => {
    const cells = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');
        const container = document.getElementById('root');

        container.innerHTML = '<table><tbody id="body"></tbody></table>';
        replaceFragment(
            document.getElementById('body'),
            '<tr><td>Ada</td><td>ada@example.test</td></tr>',
        );

        return [...document.querySelectorAll('#body td')].map(cell => cell.textContent);
    });

    expect(cells).toEqual(['Ada', 'ada@example.test']);
});
