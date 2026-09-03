import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CodeIgniterCsrfProvider } from '../../resources/js/ci4/CodeIgniterCsrf.js';

/** @type {import('../../resources/js/core/HttpClient.js').RequestContext} */
const CONTEXT = /** @type {never} */ ({ method: 'POST' });

describe('CodeIgniterCsrfProvider', () => {
    test('uses CI4 defaults for the header and field names', () => {
        const provider = new CodeIgniterCsrfProvider({ token: 'abc' });

        assert.equal(provider.headerName, 'X-CSRF-TOKEN');
        assert.equal(provider.tokenName, 'csrf_test_name');
        assert.deepEqual(provider.getRequestHeaders(CONTEXT), { 'X-CSRF-TOKEN': 'abc' });
        assert.deepEqual(provider.getRequestBodyFields(CONTEXT), { csrf_test_name: 'abc' });
    });

    test('honours a customised CI4 security configuration', () => {
        const provider = new CodeIgniterCsrfProvider({
            headerName: 'X-Vayes-Csrf',
            tokenName: 'vayes_csrf',
            token: 'abc',
        });

        assert.deepEqual(provider.getRequestHeaders(CONTEXT), { 'X-Vayes-Csrf': 'abc' });
        assert.deepEqual(provider.getRequestBodyFields(CONTEXT), { vayes_csrf: 'abc' });
    });

    test('contributes nothing when no token is known', () => {
        const provider = new CodeIgniterCsrfProvider();

        assert.deepEqual(provider.getRequestHeaders(CONTEXT), {});
        assert.deepEqual(provider.getRequestBodyFields(CONTEXT), {});
    });

    test('adopts a rotated token from the response header', () => {
        const provider = new CodeIgniterCsrfProvider({ token: 'first' });

        provider.updateFromResponse(new Response(null, { headers: { 'X-CSRF-TOKEN': 'second' } }));

        assert.equal(provider.token, 'second');
        assert.deepEqual(provider.getRequestHeaders(CONTEXT), { 'X-CSRF-TOKEN': 'second' });
    });

    test('keeps the current token when a response carries none', () => {
        const provider = new CodeIgniterCsrfProvider({ token: 'first' });

        provider.updateFromResponse(new Response(null));

        assert.equal(provider.token, 'first');
    });

    test('falls back to a readable CSRF cookie', () => {
        const doc = { cookie: 'other=1; csrf_cookie_name=cookie%20token; another=2' };
        const provider = new CodeIgniterCsrfProvider({
            cookieName: 'csrf_cookie_name',
            document: /** @type {never} */ (doc),
        });

        assert.equal(provider.getRequestHeaders(CONTEXT)['X-CSRF-TOKEN'], 'cookie token');
    });

    test('prefers the response header over the cookie when rotating', () => {
        const doc = { cookie: 'csrf_cookie_name=stale' };
        const provider = new CodeIgniterCsrfProvider({
            token: 'first',
            cookieName: 'csrf_cookie_name',
            document: /** @type {never} */ (doc),
        });

        provider.updateFromResponse(new Response(null, { headers: { 'X-CSRF-TOKEN': 'fresh' } }));

        assert.equal(provider.token, 'fresh');
    });

    test('setToken() supports applications that receive the token in JSON', () => {
        const provider = new CodeIgniterCsrfProvider({ token: 'first' });

        provider.setToken('third');

        assert.equal(provider.token, 'third');
    });

    test('builds from server-rendered boot configuration', () => {
        const provider = CodeIgniterCsrfProvider.fromBootConfig(
            /** @type {never} */ ({
                csrfHeader: 'X-CSRF-TOKEN',
                csrfTokenName: 'csrf_test_name',
                csrfToken: 'boot-token',
                csrfCookie: null,
            }),
        );

        assert.equal(provider.token, 'boot-token');
    });
});
