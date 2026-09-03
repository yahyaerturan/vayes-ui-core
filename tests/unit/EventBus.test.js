import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, events } from '../../resources/js/core/EventBus.js';

describe('EventBus', () => {
    test('delivers detail payloads to subscribers', () => {
        const bus = new EventBus();
        /** @type {unknown[]} */
        const received = [];

        bus.on('session:changed', event => received.push(event.detail));
        bus.emit('session:changed', { userId: 7 });

        assert.deepEqual(received, [{ userId: 7 }]);
    });

    test('on() returns an unsubscribe function', () => {
        const bus = new EventBus();
        let calls = 0;

        const off = bus.on('ping', () => {
            calls += 1;
        });

        bus.emit('ping');
        off();
        bus.emit('ping');

        assert.equal(calls, 1);
    });

    test('unsubscribing twice is harmless', () => {
        const bus = new EventBus();
        const off = bus.on('ping', () => {});

        off();
        assert.doesNotThrow(off);
    });

    test('once() delivers exactly one event', () => {
        const bus = new EventBus();
        let calls = 0;

        bus.once('boot', () => {
            calls += 1;
        });

        bus.emit('boot');
        bus.emit('boot');

        assert.equal(calls, 1);
    });

    test('an AbortSignal cancels the subscription', () => {
        const bus = new EventBus();
        const controller = new AbortController();
        let calls = 0;

        bus.on(
            'tick',
            () => {
                calls += 1;
            },
            { signal: controller.signal },
        );

        bus.emit('tick');
        controller.abort();
        bus.emit('tick');

        assert.equal(calls, 1);
    });

    test('emit() reports cancellation through its return value', () => {
        const bus = new EventBus();

        bus.on('app:closing', event => event.preventDefault());

        assert.equal(bus.emit('app:closing', undefined, { cancelable: true }), false);
        assert.equal(bus.emit('app:other', undefined, { cancelable: true }), true);
    });

    test('non-cancelable events cannot be prevented', () => {
        const bus = new EventBus();

        bus.on('locale:changed', event => event.preventDefault());

        assert.equal(bus.emit('locale:changed'), true);
    });

    test('exports a shared default bus', () => {
        assert.ok(events instanceof EventBus);
    });
});
