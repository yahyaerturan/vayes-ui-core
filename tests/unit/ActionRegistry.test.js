import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ActionRegistry } from '../../resources/js/core/ActionRegistry.js';

describe('ActionRegistry', () => {
    test('invokes a handler registered under an exact key', () => {
        const registry = new ActionRegistry();
        /** @type {unknown[]} */
        const calls = [];

        registry.register('invoice.customerSelected', context => {
            calls.push(context);

            return 'done';
        });

        const result = registry.invoke('invoice.customerSelected', { detail: { id: 7 } });

        assert.equal(result, 'done');
        assert.deepEqual(calls, [{ detail: { id: 7 }, action: 'invoice.customerSelected' }]);
    });

    test('register() returns an unregister function', () => {
        const registry = new ActionRegistry();
        const off = registry.register('a.b', () => {});

        assert.equal(registry.has('a.b'), true);
        off();
        assert.equal(registry.has('a.b'), false);
    });

    test('refuses to silently replace an existing handler', () => {
        const registry = new ActionRegistry();
        registry.register('a.b', () => {});

        assert.throws(() => registry.register('a.b', () => {}), /already registered/);
    });

    test('validates its inputs', () => {
        const registry = new ActionRegistry();

        assert.throws(() => registry.register('', () => {}), TypeError);
        assert.throws(() => registry.register('a.b', 'not a function'), TypeError);
    });

    test('an unknown action throws a diagnosable error instead of failing silently', () => {
        const registry = new ActionRegistry();

        assert.throws(() => registry.invoke('missing.handler'), /No handler is registered/);
    });

    // docs/10-security.md: "malicious strings cannot invoke ActionRegistry
    // functions unless exact registered key matches".
    test('no string reaches a function that was not registered', () => {
        const registry = new ActionRegistry();
        registry.register('safe.handler', () => 'safe');

        const attacks = [
            '__proto__',
            'constructor',
            'constructor.prototype',
            'toString',
            'hasOwnProperty',
            'valueOf',
            'safe.handler ',
            'SAFE.HANDLER',
            'safe.handler; alert(1)',
            'window.alert',
            'alert',
        ];

        for (const attack of attacks) {
            assert.equal(registry.has(attack), false, `${attack} must not resolve`);
            assert.throws(() => registry.invoke(attack), /No handler is registered/);
        }

        assert.equal(registry.invoke('safe.handler'), 'safe');
    });

    test('non-string keys never resolve', () => {
        const registry = new ActionRegistry();
        registry.register('safe.handler', () => 'safe');

        for (const key of [null, undefined, 1, {}, [], Symbol('x')]) {
            assert.equal(registry.has(/** @type {never} */ (key)), false);
            assert.equal(registry.get(/** @type {never} */ (key)), undefined);
        }
    });

    test('lists registered names for diagnostics', () => {
        const registry = new ActionRegistry();
        registry.register('a', () => {});
        registry.register('b', () => {});

        assert.deepEqual(registry.names.sort(), ['a', 'b']);
    });
});
