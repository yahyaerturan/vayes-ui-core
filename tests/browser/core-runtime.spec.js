import { test, expect } from './support/fixtures.js';

/**
 * Phase 1 + 2 exit gates (docs/16-implementation-plan.md).
 *
 * These assertions are why ADR-010 exists: upgrade order, reconnect semantics
 * and event propagation are browser behaviours, not library behaviours, so a
 * simulated DOM would be testing our own assumptions back at us.
 */

test.describe('Component lifecycle', () => {
    test('connect, disconnect and reconnect run in the documented order', async ({ page }) => {
        const log = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            /** @type {string[]} */
            const calls = [];

            class Probe extends Component {
                mount() {
                    calls.push(`mount:${this.mounted}`);
                    super.mount();
                }
                render() {
                    calls.push('render');
                }
                bindEvents() {
                    calls.push(`bind:${this.signal.aborted}`);
                }
                unmount() {
                    // The signal must still be live here, so cleanup code can
                    // read state and touch listeners.
                    calls.push(`unmount:${this.signal.aborted}`);
                }
            }

            define('vui-probe-order', Probe);

            const element = document.createElement('vui-probe-order');
            const root = document.getElementById('root');

            root.append(element);
            calls.push(`mounted:${element.mounted}`);
            element.remove();
            calls.push(`mounted:${element.mounted}`);
            root.append(element);
            calls.push(`mounted:${element.mounted}`);

            return calls;
        });

        expect(log).toEqual([
            'mount:true',
            'render',
            'bind:false',
            'mounted:true',
            'unmount:false',
            'mounted:false',
            'mount:true',
            'render',
            'bind:false',
            'mounted:true',
        ]);
    });

    test('a duplicate connectedCallback does not mount twice', async ({ page }) => {
        const mounts = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            let count = 0;

            class Probe extends Component {
                mount() {
                    count += 1;
                }
            }

            define('vui-probe-double', Probe);

            const element = document.createElement('vui-probe-double');
            document.getElementById('root').append(element);
            element.connectedCallback();
            element.connectedCallback();

            return count;
        });

        expect(mounts).toBe(1);
    });

    test('a disconnectedCallback without a mount is ignored', async ({ page }) => {
        const unmounts = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            let count = 0;

            class Probe extends Component {
                unmount() {
                    count += 1;
                }
            }

            define('vui-probe-orphan', Probe);

            const element = document.createElement('vui-probe-orphan');
            element.disconnectedCallback();

            return count;
        });

        expect(unmounts).toBe(0);
    });

    test('reconnecting does not duplicate listeners on the element, document or window', async ({
        page,
    }) => {
        const counts = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            const seen = { self: 0, document: 0, window: 0 };

            class Probe extends Component {
                bindEvents() {
                    this.addEventListener('probe', () => (seen.self += 1), { signal: this.signal });
                    document.addEventListener('probe', () => (seen.document += 1), {
                        signal: this.signal,
                    });
                    window.addEventListener('probe', () => (seen.window += 1), {
                        signal: this.signal,
                    });
                }
            }

            define('vui-probe-listeners', Probe);

            const root = document.getElementById('root');
            const element = document.createElement('vui-probe-listeners');
            root.append(element);

            // Mount cycle 1
            element.dispatchEvent(new CustomEvent('probe', { bubbles: true }));
            const afterFirst = { ...seen };

            // Remove, re-add, fire once more.
            element.remove();
            root.append(element);
            element.dispatchEvent(new CustomEvent('probe', { bubbles: true }));
            const afterSecond = { ...seen };

            // While detached, nothing may respond.
            element.remove();
            document.dispatchEvent(new CustomEvent('probe'));
            window.dispatchEvent(new CustomEvent('probe'));

            return { afterFirst, afterSecond, afterDetached: { ...seen } };
        });

        expect(counts.afterFirst).toEqual({ self: 1, document: 1, window: 1 });
        expect(counts.afterSecond).toEqual({ self: 2, document: 2, window: 2 });
        expect(counts.afterDetached).toEqual({ self: 2, document: 2, window: 2 });
    });

    test('the lifecycle signal aborts on disconnect and is replaced on reconnect', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {}
            define('vui-probe-signal', Probe);

            const root = document.getElementById('root');
            const element = document.createElement('vui-probe-signal');
            root.append(element);

            const first = element.signal;
            element.remove();
            root.append(element);
            const second = element.signal;

            let throwsWhenDetached = false;
            element.remove();

            try {
                void element.signal;
            } catch {
                throwsWhenDetached = true;
            }

            return {
                firstAborted: first.aborted,
                secondAborted: second.aborted,
                distinct: first !== second,
                throwsWhenDetached,
            };
        });

        expect(result).toEqual({
            firstAborted: true,
            secondAborted: true,
            distinct: true,
            throwsWhenDetached: true,
        });
    });

    test('in-flight requests owned by the mount cycle abort on disconnect', async ({ page }) => {
        const aborted = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            let wasAborted = false;

            class Probe extends Component {
                bindEvents() {
                    this.signal.addEventListener('abort', () => {
                        wasAborted = true;
                    });
                }
            }

            define('vui-probe-request', Probe);

            const element = document.createElement('vui-probe-request');
            document.getElementById('root').append(element);
            element.remove();

            return wasAborted;
        });

        expect(aborted).toBe(true);
    });
});

test.describe('Custom element upgrade', () => {
    test('an element already in the document upgrades when the class is defined', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const root = document.getElementById('root');
            root.innerHTML = '<vui-probe-late></vui-probe-late>';

            const element = root.firstElementChild;
            const beforeDefinition = element.constructor.name;

            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {
                render() {
                    this.textContent = 'upgraded';
                }
            }

            define('vui-probe-late', Probe);
            await customElements.whenDefined('vui-probe-late');

            return {
                beforeDefinition,
                afterDefinition: element.constructor.name,
                mounted: element.mounted,
                text: element.textContent,
            };
        });

        expect(result.beforeDefinition).toBe('HTMLElement');
        expect(result.afterDefinition).toBe('Probe');
        expect(result.mounted).toBe(true);
        expect(result.text).toBe('upgraded');
    });

    test('a rich property assigned before definition reaches the accessor', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const root = document.getElementById('root');
            root.innerHTML = '<vui-probe-upgrade id="target"></vui-probe-upgrade>';

            const element = document.getElementById('target');

            // The classic trap: this creates an own property that would shadow
            // the accessor installed by the class definition below.
            element.customer = { id: '7', name: 'Ada Lovelace' };

            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {
                static properties = ['customer'];
                #customer = null;

                get customer() {
                    return this.#customer;
                }

                set customer(value) {
                    this.#customer = value;

                    if (this.mounted) {
                        this.textContent = value?.name ?? '';
                    }
                }
            }

            define('vui-probe-upgrade', Probe);
            await customElements.whenDefined('vui-probe-upgrade');

            return {
                viaAccessor: element.customer,
                rendered: element.textContent,
                hasOwnProperty: Object.prototype.hasOwnProperty.call(element, 'customer'),
            };
        });

        expect(result.viaAccessor).toEqual({ id: '7', name: 'Ada Lovelace' });
        expect(result.rendered).toBe('Ada Lovelace');
        expect(result.hasOwnProperty).toBe(false);
    });

    test('define() is idempotent and validates names and prefixes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {}

            define('vui-probe-idempotent', Probe);
            let secondCallThrew = false;

            try {
                define('vui-probe-idempotent', Probe);
            } catch {
                secondCallThrew = true;
            }

            /** @param {string} name */
            const rejects = name => {
                try {
                    define(name, class extends Component {});

                    return false;
                } catch {
                    return true;
                }
            };

            return {
                secondCallThrew,
                registered: customElements.get('vui-probe-idempotent')?.name,
                rejectsNoHyphen: rejects('probe'),
                rejectsForeignPrefix: rejects('app-probe'),
                rejectsReserved: rejects('annotation-xml'),
            };
        });

        expect(result).toEqual({
            secondCallThrew: false,
            registered: 'Probe',
            rejectsNoHyphen: true,
            rejectsForeignPrefix: true,
            rejectsReserved: true,
        });
    });
});

test.describe('Component events', () => {
    test('emit() bubbles, crosses shadow boundaries and reports cancellation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {}
            define('vui-probe-emit', Probe);

            const root = document.getElementById('root');
            const element = document.createElement('vui-probe-emit');
            root.append(element);

            /** @type {Array<{ at: string, detail: unknown }>} */
            const heard = [];

            document.addEventListener('thing:changed', event =>
                heard.push({ at: 'document', detail: event.detail }),
            );
            root.addEventListener('thing:changed', event =>
                heard.push({ at: 'ancestor', detail: event.detail }),
            );

            const defaults = element.emit('thing:changed', { id: 1 });

            let composed = false;
            let bubbles = false;
            document.addEventListener(
                'thing:probe',
                event => {
                    composed = event.composed;
                    bubbles = event.bubbles;
                },
                { once: true },
            );
            element.emit('thing:probe');

            document.addEventListener('thing:cancelable', event => event.preventDefault(), {
                once: true,
            });
            const prevented = element.emit('thing:cancelable', null, { cancelable: true });

            document.addEventListener('thing:local', () =>
                heard.push({ at: 'leaked', detail: null }),
            );
            element.emit('thing:local', null, { bubbles: false });

            return { heard, defaults, composed, bubbles, prevented };
        });

        expect(result.heard).toEqual([
            { at: 'ancestor', detail: { id: 1 } },
            { at: 'document', detail: { id: 1 } },
        ]);
        expect(result.defaults).toBe(true);
        expect(result.composed).toBe(true);
        expect(result.bubbles).toBe(true);
        expect(result.prevented).toBe(false);
    });

    test('an ancestor consumes a descendant event without knowing the publisher', async ({
        page,
    }) => {
        const received = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Publisher extends Component {
                announce() {
                    this.emit('customer:selected', { id: 'c-1' });
                }
            }

            class Consumer extends Component {
                received = null;

                bindEvents() {
                    this.addEventListener(
                        'customer:selected',
                        event => {
                            this.received = event.detail;
                        },
                        { signal: this.signal },
                    );
                }
            }

            define('vui-probe-publisher', Publisher);
            define('vui-probe-consumer', Consumer);

            document.getElementById('root').innerHTML =
                '<vui-probe-consumer><div><vui-probe-publisher></vui-probe-publisher></div></vui-probe-consumer>';

            document.querySelector('vui-probe-publisher').announce();

            return document.querySelector('vui-probe-consumer').received;
        });

        expect(received).toEqual({ id: 'c-1' });
    });

    test('EventBus subscriptions honour the component lifecycle signal', async ({ page }) => {
        const counts = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');
            const { EventBus } = await import('/resources/js/core/EventBus.js');

            const bus = new EventBus();
            let calls = 0;

            class Probe extends Component {
                bindEvents() {
                    bus.on('session:changed', () => (calls += 1), { signal: this.signal });
                }
            }

            define('vui-probe-bus', Probe);

            const root = document.getElementById('root');
            const element = document.createElement('vui-probe-bus');
            root.append(element);

            bus.emit('session:changed');
            const whileMounted = calls;

            element.remove();
            bus.emit('session:changed');
            const afterUnmount = calls;

            root.append(element);
            bus.emit('session:changed');

            return { whileMounted, afterUnmount, afterRemount: calls };
        });

        expect(counts).toEqual({ whileMounted: 1, afterUnmount: 1, afterRemount: 2 });
    });
});

test.describe('Query helpers', () => {
    test('find returns a node and findAll returns a real array', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { Component } = await import('/resources/js/core/Component.js');
            const { define } = await import('/resources/js/core/register.js');

            class Probe extends Component {
                render() {
                    this.innerHTML = '<b class="x">1</b><b class="x">2</b>';
                }
            }

            define('vui-probe-query', Probe);

            const element = document.createElement('vui-probe-query');
            document.getElementById('root').append(element);

            return {
                found: element.find('.x')?.textContent,
                missing: element.find('.nope'),
                all: element.findAll('.x').map(node => node.textContent),
                isArray: Array.isArray(element.findAll('.x')),
            };
        });

        expect(result).toEqual({ found: '1', missing: null, all: ['1', '2'], isArray: true });
    });
});

test.describe('Module side effects', () => {
    test('importing the core defines no elements and installs no global handlers', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const before = {
                onerror: window.onerror,
                onunhandledrejection: window.onunhandledrejection,
                listenerCount: document.body.childElementCount,
            };

            await import('/resources/js/core/index.js');

            return {
                sameOnError: window.onerror === before.onerror,
                sameOnRejection: window.onunhandledrejection === before.onunhandledrejection,
                definesNoElements: [
                    'vui-counter',
                    'vui-tabs',
                    'vui-modal',
                    'vui-customer-selector',
                ].every(name => customElements.get(name) === undefined),
                domUntouched: document.body.childElementCount === before.listenerCount,
            };
        });

        expect(result).toEqual({
            sameOnError: true,
            sameOnRejection: true,
            definesNoElements: true,
            domUntouched: true,
        });
    });
});
