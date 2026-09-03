import { test, expect } from './support/fixtures.js';

/**
 * Reference benchmarks from docs/13-performance.md.
 *
 * These are **regression indicators, not universal browser guarantees**. Two
 * design rules keep them useful rather than flaky:
 *
 * 1. structural assertions carry the real weight — listener counts, handler
 *    invocation counts and scaling behaviour are deterministic, while wall
 *    clock on a loaded CI runner is not;
 * 2. time budgets are generous by an order of magnitude. A budget here is
 *    tripped by an architectural mistake (a listener per row, a full rerender
 *    per keystroke), not by a slow afternoon.
 *
 * They run on Chromium only: they measure our own algorithmic behaviour, which
 * does not vary by engine, and tripling their cost would buy nothing.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'benchmarks run on one engine');

/** Registers a probe component and returns a timing helper in page context. */
const SETUP = async () => {
    const { Component } = await import('/resources/js/core/Component.js');
    const { define } = await import('/resources/js/core/register.js');

    window.__counts = { mounts: 0, unmounts: 0, handlers: 0 };

    class Probe extends Component {
        render() {
            if (this.firstElementChild) {
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = 'go';
            button.textContent = 'go';
            this.append(button);
        }

        mount() {
            window.__counts.mounts += 1;
            super.mount();
        }

        unmount() {
            window.__counts.unmounts += 1;
        }

        bindEvents() {
            this.bindActions();
        }

        handleAction() {
            window.__counts.handlers += 1;
        }
    }

    define('vui-probe-perf', Probe);
};

test('connecting 1,000 components scales linearly with 100', async ({ page }) => {
    await page.evaluate(SETUP);

    const result = await page.evaluate(() => {
        /** @param {number} count */
        const build = count => {
            const host = document.createElement('div');
            const fragment = document.createDocumentFragment();

            for (let index = 0; index < count; index += 1) {
                fragment.append(document.createElement('vui-probe-perf'));
            }

            document.body.append(host);

            const started = performance.now();
            host.append(fragment); // Connection, and therefore mounting, happens here.
            const elapsed = performance.now() - started;

            host.remove();

            return elapsed;
        };

        build(100); // Warm up the code paths before measuring.
        window.__counts.mounts = 0;

        const small = build(100);
        const smallMounts = window.__counts.mounts;

        window.__counts.mounts = 0;
        const large = build(1000);

        return { small, large, smallMounts, largeMounts: window.__counts.mounts };
    });

    // Every element mounted exactly once — the assertion that cannot be flaky.
    expect(result.smallMounts).toBe(100);
    expect(result.largeMounts).toBe(1000);

    // Ten times the elements must not cost dramatically more than ten times the
    // work. A per-element document scan or an O(n²) registry would blow this.
    const scaling = result.large / Math.max(result.small, 0.1);
    expect(scaling, `100→1000 scaling factor was ${scaling.toFixed(1)}×`).toBeLessThan(40);

    expect(result.large, 'connecting 1,000 components').toBeLessThan(1500);
});

test('repeated connect/disconnect cycles do not accumulate listeners', async ({ page }) => {
    await page.evaluate(SETUP);

    const result = await page.evaluate(() => {
        const host = document.createElement('div');
        document.body.append(host);

        const element = document.createElement('vui-probe-perf');
        host.append(element);

        const started = performance.now();

        for (let index = 0; index < 500; index += 1) {
            element.remove();
            host.append(element);
        }

        const elapsed = performance.now() - started;

        window.__counts.handlers = 0;
        element.querySelector('button').click();

        // Sample before detaching the host: removing it disconnects the element
        // once more, which would make the mount/unmount ledger look unbalanced.
        const counts = { ...window.__counts };
        host.remove();

        return {
            elapsed,
            handlers: counts.handlers,
            mounts: counts.mounts,
            unmounts: counts.unmounts,
        };
    });

    // The whole point: after 500 remounts, one click still runs one handler.
    expect(result.handlers).toBe(1);
    // 501 mounts (the initial one plus 500 remounts) against 500 unmounts: the
    // element is still connected at the moment the ledger is read.
    expect(result.mounts).toBe(501);
    expect(result.unmounts).toBe(500);
    expect(result.elapsed, '500 reconnect cycles').toBeLessThan(1000);
});

test('event delegation serves a 1,000-row list with a single listener', async ({ page }) => {
    await page.evaluate(SETUP);

    const result = await page.evaluate(() => {
        const host = document.createElement('div');
        document.body.append(host);

        const element = document.createElement('vui-probe-perf');
        host.append(element);

        // Replace the component's inner markup with a large list. No rebinding
        // happens: the single delegated listener already covers these nodes.
        const list = document.createElement('ul');

        for (let index = 0; index < 1000; index += 1) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = 'go';
            button.dataset.index = String(index);
            item.append(button);
            list.append(item);
        }

        const started = performance.now();
        element.replaceChildren(list);
        const buildTime = performance.now() - started;

        window.__counts.handlers = 0;

        const clickStarted = performance.now();
        element.querySelector('[data-index="999"]').click();
        element.querySelector('[data-index="0"]').click();
        const clickTime = performance.now() - clickStarted;

        const handlers = window.__counts.handlers;
        host.remove();

        return { buildTime, clickTime, handlers };
    });

    expect(result.handlers).toBe(2);
    expect(result.buildTime, 'building a 1,000-row list').toBeLessThan(500);
    // Delegation means the last row costs the same as the first.
    expect(result.clickTime, 'two delegated clicks').toBeLessThan(100);
});

test('repeated local state updates touch one node, not the subtree', async ({ page }) => {
    await page.evaluate(() => import('/resources/js/components/common/Counter.js'));

    const result = await page.evaluate(async () => {
        const host = document.createElement('div');
        document.body.append(host);
        host.innerHTML = '<vui-counter></vui-counter>'; // safe-html: test fixture literal.

        const counter = host.querySelector('vui-counter');
        const output = counter.querySelector('[data-value]');

        const started = performance.now();

        for (let index = 1; index <= 1000; index += 1) {
            counter.value = index;
        }

        const elapsed = performance.now() - started;

        // The identity check is the real assertion: a component that rebuilt its
        // markup on each change would have replaced this node 1,000 times,
        // destroying focus, selection and any listener bound to it.
        const sameNode = counter.querySelector('[data-value]') === output;
        const value = counter.value;

        host.remove();

        return { elapsed, sameNode, value, text: output.textContent };
    });

    expect(result.sameNode).toBe(true);
    expect(result.value).toBe(1000);
    expect(result.text).toBe('1000');
    expect(result.elapsed, '1,000 state updates').toBeLessThan(500);
});

test('a fragment carrying 200 components upgrades them in one insertion', async ({ page }) => {
    await page.evaluate(SETUP);

    const result = await page.evaluate(async () => {
        const { replaceFragment } = await import('/resources/js/core/fragments.js');

        const host = document.createElement('div');
        document.body.append(host);

        const html = Array.from(
            { length: 200 },
            (_value, index) =>
                `<tr><td>Row ${index}</td><td><vui-probe-perf></vui-probe-perf></td></tr>`,
        ).join('');

        window.__counts.mounts = 0;

        const started = performance.now();
        replaceFragment(host, `<table><tbody>${html}</tbody></table>`);
        const elapsed = performance.now() - started;

        const mounts = window.__counts.mounts;

        window.__counts.handlers = 0;
        host.querySelector('vui-probe-perf button').click();

        const handlers = window.__counts.handlers;
        host.remove();

        return { elapsed, mounts, handlers };
    });

    // Parsing, script stripping and 200 upgrades, in one synchronous insertion.
    expect(result.mounts).toBe(200);
    expect(result.handlers).toBe(1);
    expect(result.elapsed, 'inserting a fragment with 200 components').toBeLessThan(1000);
});
