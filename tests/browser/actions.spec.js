import { test, expect } from './support/fixtures.js';

/**
 * Phase 3 exit gate: dynamic descendant replacement works without rebinding,
 * and nested component actions do not leak to parents.
 */

const SETUP = async () => {
    const { Component } = await import('/resources/js/core/Component.js');
    const { define } = await import('/resources/js/core/register.js');

    /** @type {string[]} */
    window.__log = [];

    class Outer extends Component {
        render() {
            if (this.querySelector('[data-panel]')) {
                return;
            }

            this.innerHTML = `
                <button type="button" data-action="outer-save">Save</button>
                <div data-panel></div>
            `;
        }

        bindEvents() {
            this.bindActions();
        }

        handleAction(action, trigger) {
            window.__log.push(`outer:${action}:${trigger.dataset.marker ?? ''}`);
        }
    }

    class Inner extends Component {
        bindEvents() {
            this.bindActions();
        }

        handleAction(action) {
            window.__log.push(`inner:${action}`);
        }
    }

    define('vui-probe-outer', Outer);
    define('vui-probe-inner', Inner);
};

test('one delegated listener serves markup replaced after binding', async ({ page }) => {
    await page.evaluate(SETUP);

    const log = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-probe-outer></vui-probe-outer>';

        const outer = root.firstElementChild;
        outer.querySelector('[data-panel]').innerHTML =
            '<button type="button" data-action="row-delete" data-marker="a">Delete</button>';

        outer.querySelector('[data-marker="a"]').click();

        // Replace the panel content entirely: no rebinding happens anywhere.
        outer.querySelector('[data-panel]').innerHTML =
            '<button type="button" data-action="row-delete" data-marker="b">Delete</button>';
        outer.querySelector('[data-marker="b"]').click();

        return window.__log;
    });

    expect(log).toEqual(['outer:row-delete:a', 'outer:row-delete:b']);
});

test('an action inside a nested custom element does not reach the parent', async ({ page }) => {
    await page.evaluate(SETUP);

    const log = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-probe-outer></vui-probe-outer>';

        const outer = root.querySelector('vui-probe-outer');
        outer.querySelector('[data-panel]').innerHTML =
            '<vui-probe-inner><button type="button" data-action="inner-go">Go</button></vui-probe-inner>';

        outer.querySelector('[data-action="inner-go"]').click();
        outer.querySelector('[data-action="outer-save"]').click();

        return window.__log;
    });

    expect(log).toEqual(['inner:inner-go', 'outer:outer-save:']);
});

test('the trigger closest to the click wins', async ({ page }) => {
    await page.evaluate(SETUP);

    const log = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-probe-outer></vui-probe-outer>';

        const outer = root.querySelector('vui-probe-outer');
        outer.querySelector('[data-panel]').innerHTML = `
            <div data-action="wrapper" data-marker="wrapper">
                <button type="button" data-action="child" data-marker="child">
                    <span>label</span>
                </button>
            </div>
        `;

        outer.querySelector('span').click();

        return window.__log;
    });

    expect(log).toEqual(['outer:child:child']);
});

test('delegation is rebuilt cleanly across a reconnect', async ({ page }) => {
    await page.evaluate(SETUP);

    const log = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-probe-outer></vui-probe-outer>';

        const outer = root.querySelector('vui-probe-outer');
        outer.querySelector('[data-action="outer-save"]').click();

        outer.remove();
        root.append(outer);
        outer.querySelector('[data-action="outer-save"]').click();

        return window.__log;
    });

    expect(log).toEqual(['outer:outer-save:', 'outer:outer-save:']);
});

test('an empty data-action value is ignored', async ({ page }) => {
    await page.evaluate(SETUP);

    const log = await page.evaluate(() => {
        const root = document.getElementById('root');
        root.innerHTML = '<vui-probe-outer></vui-probe-outer>';

        const outer = root.querySelector('vui-probe-outer');
        outer.querySelector('[data-panel]').innerHTML =
            '<button type="button" data-action="">Nothing</button>';
        outer.querySelector('[data-panel] button').click();

        return window.__log;
    });

    expect(log).toEqual([]);
});
