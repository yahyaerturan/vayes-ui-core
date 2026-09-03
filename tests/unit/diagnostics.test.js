import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    redactHeaders,
    createHttpObserver,
    DEFAULT_REDACTED_KEYS,
} from '../../resources/js/core/diagnostics.js';

describe('diagnostics redaction', () => {
    test('masks credentials and CSRF tokens regardless of header casing', () => {
        const headers = new Headers({
            'X-Requested-With': 'XMLHttpRequest',
            Authorization: 'Bearer secret',
            'X-CSRF-TOKEN': 'token-value',
        });

        const redacted = redactHeaders(headers);

        assert.equal(redacted['x-requested-with'], 'XMLHttpRequest');
        assert.equal(redacted.authorization, '[redacted]');
        assert.equal(redacted['x-csrf-token'], '[redacted]');
    });

    test('accepts a custom redaction list', () => {
        const redacted = redactHeaders({ 'X-Tenant': 'acme' }, ['x-tenant']);

        assert.equal(redacted['X-Tenant'], '[redacted]');
    });

    test('ships a conservative default list', () => {
        assert.ok(DEFAULT_REDACTED_KEYS.includes('cookie'));
        assert.ok(DEFAULT_REDACTED_KEYS.includes('password'));
    });
});

describe('diagnostics http observer', () => {
    test('never logs request bodies and redacts headers', () => {
        /** @type {unknown[][]} */
        const lines = [];
        const observer = createHttpObserver({
            logger: { debug: (...args) => lines.push(args), warn: (...args) => lines.push(args) },
        });

        observer.onRequest?.({
            method: 'POST',
            url: new URL('https://app.test/api/customers'),
            headers: new Headers({ 'X-CSRF-TOKEN': 'secret-token' }),
            body: 'password=hunter2',
            sameOrigin: true,
        });

        const serialized = JSON.stringify(lines);

        assert.ok(!serialized.includes('secret-token'));
        assert.ok(!serialized.includes('hunter2'));
        assert.ok(serialized.includes('[redacted]'));
    });

    test('disabled returns an inert observer', () => {
        assert.deepEqual(createHttpObserver({ enabled: false }), {});
    });
});

describe('module side effects', () => {
    // docs/19: "no global handler is installed merely by importing core modules".
    // The DOM-dependent half of this guarantee is asserted in
    // tests/browser/core-runtime.spec.js, which can import Component.js.
    test('importing the browser-independent core modules installs no globals', async () => {
        const before = {
            error: globalThis.onerror ?? null,
            rejection: globalThis.onunhandledrejection ?? null,
        };

        await import('../../resources/js/core/diagnostics.js');
        await import('../../resources/js/core/ActionRegistry.js');
        await import('../../resources/js/core/HttpClient.js');

        assert.equal(globalThis.onerror ?? null, before.error);
        assert.equal(globalThis.onunhandledrejection ?? null, before.rejection);
    });
});
