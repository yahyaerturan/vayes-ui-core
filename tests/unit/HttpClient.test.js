import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { HttpClient, toSearchParams } from '../../resources/js/core/HttpClient.js';
import {
    HttpError,
    NetworkError,
    TimeoutError,
    isAbortError,
} from '../../resources/js/core/HttpError.js';
import { createFetchStub, neverResolving, jsonResponse } from './helpers/fetchStub.js';

const BASE = 'https://app.test';

/**
 * @param {(request: import('./helpers/fetchStub.js').RecordedRequest) => Response|Promise<Response>} handler
 * @param {Record<string, unknown>} [config]
 */
function createClient(handler, config = {}) {
    const stub = createFetchStub(handler);
    const http = new HttpClient({ baseUrl: BASE, fetch: stub.fetch, ...config });

    return { http, calls: stub.calls };
}

describe('HttpClient request policy', () => {
    test('sends the CI4 AJAX header and same-origin credentials by default', async () => {
        const { http, calls } = createClient(() => jsonResponse({ ok: true }));

        await http.json('/api/customers');

        assert.equal(calls[0].headers.get('X-Requested-With'), 'XMLHttpRequest');
        assert.equal(calls[0].credentials, 'same-origin');
        assert.equal(calls[0].url, 'https://app.test/api/customers');
    });

    test('json() narrows the Accept header', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));

        await http.json('/api/customers');

        assert.equal(calls[0].headers.get('Accept'), 'application/json');
    });

    test('html() asks for HTML and returns text', async () => {
        const { http, calls } = createClient(
            () =>
                new Response('<vui-counter value="2"></vui-counter>', {
                    headers: { 'Content-Type': 'text/html' },
                }),
        );

        const html = await http.html('/customers/table');

        assert.match(calls[0].headers.get('Accept') ?? '', /text\/html/);
        assert.equal(html, '<vui-counter value="2"></vui-counter>');
    });

    test('per-request headers override defaults', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));

        await http.json('/api/x', { headers: { 'X-Requested-With': 'custom', 'X-Extra': '1' } });

        assert.equal(calls[0].headers.get('X-Requested-With'), 'custom');
        assert.equal(calls[0].headers.get('X-Extra'), '1');
    });

    test('builds query strings through URLSearchParams', async () => {
        const { http, calls } = createClient(() => jsonResponse([]));

        await http.json('/api/customers/search', {
            query: { q: 'ada & co', limit: 20, archived: null, tags: ['a', 'b'] },
        });

        const url = new URL(calls[0].url);

        assert.equal(url.searchParams.get('q'), 'ada & co');
        assert.equal(url.searchParams.get('limit'), '20');
        assert.equal(url.searchParams.has('archived'), false, 'null values are omitted');
        assert.deepEqual(url.searchParams.getAll('tags'), ['a', 'b']);
    });

    test('preserves query parameters already present on the URL', async () => {
        const { http, calls } = createClient(() => jsonResponse([]));

        await http.json('/api/customers?page=2', { query: { q: 'x' } });

        const url = new URL(calls[0].url);

        assert.equal(url.searchParams.get('page'), '2');
        assert.equal(url.searchParams.get('q'), 'x');
    });

    test('rejects a body on GET', async () => {
        const { http } = createClient(() => jsonResponse({}));

        await assert.rejects(() => http.request('/api/x', { body: 'nope' }), TypeError);
    });
});

describe('HttpClient body policy', () => {
    test('serialises JSON only when explicitly requested', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));

        await http.post('/api/customers', { name: 'Ada' }, { json: true });

        assert.equal(calls[0].headers.get('Content-Type'), 'application/json');
        assert.equal(calls[0].body, '{"name":"Ada"}');
    });

    test('refuses a plain object body without json: true', async () => {
        const { http } = createClient(() => jsonResponse({}));

        await assert.rejects(
            () => http.post('/api/customers', { name: 'Ada' }),
            /plain object body without `json: true`/,
        );
    });

    test('passes FormData through without inventing a content type', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));
        const form = new FormData();
        form.set('name', 'Ada');

        await http.post('/api/customers', form);

        assert.equal(calls[0].headers.get('Content-Type'), null);
        assert.ok(calls[0].body instanceof FormData);
    });

    test('passes URLSearchParams through', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));

        await http.post('/api/customers', new URLSearchParams({ name: 'Ada' }));

        assert.ok(calls[0].body instanceof URLSearchParams);
    });

    test('adds no content type to a bodyless POST', async () => {
        const { http, calls } = createClient(() => jsonResponse({}));

        await http.post('/api/ping');

        assert.equal(calls[0].headers.get('Content-Type'), null);
        assert.equal(calls[0].body, null);
    });
});

describe('HttpClient response parsing', () => {
    test('parses JSON payloads', async () => {
        const { http } = createClient(() => jsonResponse({ data: [{ id: 1 }] }));

        assert.deepEqual(await http.json('/api/customers'), { data: [{ id: 1 }] });
    });

    test('treats 204 and empty bodies as null rather than a parse failure', async () => {
        const { http } = createClient(() => new Response(null, { status: 204 }));

        assert.equal(await http.json('/api/customers/1'), null);
    });

    test('reports malformed JSON as a SyntaxError naming the source', async () => {
        const { http } = createClient(
            () =>
                new Response('<!doctype html>', {
                    headers: { 'Content-Type': 'application/json' },
                }),
        );

        await assert.rejects(() => http.json('/api/customers'), SyntaxError);
    });

    test('request() returns the raw response for header access', async () => {
        const { http } = createClient(
            () => new Response('ok', { headers: { 'X-Total-Count': '42' } }),
        );

        const response = await http.get('/api/customers');

        assert.equal(response.headers.get('X-Total-Count'), '42');
    });
});

describe('HttpClient failure taxonomy', () => {
    test('throws HttpError with status, url, method and parsed body', async () => {
        const { http } = createClient(() =>
            jsonResponse(
                { message: 'Validation failed', errors: { email: ['required'] } },
                { status: 422, statusText: 'Unprocessable Content' },
            ),
        );

        const error = await http
            .json('/api/customers', { method: 'POST', body: '{}' })
            .catch(e => e);

        assert.ok(error instanceof HttpError);
        assert.equal(error.name, 'HttpError');
        assert.equal(error.status, 422);
        assert.equal(error.method, 'POST');
        assert.equal(error.url, 'https://app.test/api/customers');
        assert.deepEqual(error.body.errors, { email: ['required'] });
        assert.equal(error.isValidationError, true);
        assert.equal(error.isClientError, true);
        assert.equal(error.isServerError, false);
    });

    test('classifies 5xx separately', async () => {
        const { http } = createClient(() => new Response('boom', { status: 500 }));

        const error = await http.get('/api/x').catch(e => e);

        assert.equal(error.isServerError, true);
        assert.equal(error.isValidationError, false);
    });

    test('retains the server request id for correlation', async () => {
        const { http } = createClient(
            () => new Response('nope', { status: 500, headers: { 'X-Request-Id': 'req-123' } }),
        );

        const error = await http.get('/api/x').catch(e => e);

        assert.equal(error.requestId, 'req-123');
    });

    test('the request id header name is configurable', async () => {
        const { http } = createClient(
            () => new Response('nope', { status: 500, headers: { 'X-Correlation-Id': 'c-9' } }),
            { requestIdHeader: 'X-Correlation-Id' },
        );

        const error = await http.get('/api/x').catch(e => e);

        assert.equal(error.requestId, 'c-9');
    });

    test('wraps a transport failure as NetworkError preserving the cause', async () => {
        const cause = new TypeError('Failed to fetch');
        const { http } = createClient(() => {
            throw cause;
        });

        const error = await http.get('/api/x').catch(e => e);

        assert.ok(error instanceof NetworkError);
        assert.equal(error.cause, cause);
        assert.equal(isAbortError(error), false);
    });

    test('a caller abort stays a native AbortError, not a failure', async () => {
        const { http } = createClient(neverResolving);
        const controller = new AbortController();

        const pending = http.get('/api/x', { signal: controller.signal }).catch(e => e);
        controller.abort();
        const error = await pending;

        assert.equal(isAbortError(error), true);
        assert.equal(error instanceof NetworkError, false);
        assert.equal(error instanceof TimeoutError, false);
    });

    test('a configured timeout is distinguishable from a caller abort', async () => {
        const { http } = createClient(neverResolving, { timeout: 10 });

        const error = await http.get('/api/x').catch(e => e);

        assert.ok(error instanceof TimeoutError);
        assert.equal(error.timeout, 10);
        assert.equal(isAbortError(error), false);
    });

    test('a caller abort during a timed request is still an abort', async () => {
        const { http } = createClient(neverResolving, { timeout: 5_000 });
        const controller = new AbortController();

        const pending = http.get('/api/x', { signal: controller.signal }).catch(e => e);
        controller.abort();

        assert.equal(isAbortError(await pending), true);
    });

    test('a per-request timeout overrides the client default', async () => {
        const { http } = createClient(neverResolving, { timeout: 5_000 });

        const error = await http.get('/api/x', { timeout: 10 }).catch(e => e);

        assert.ok(error instanceof TimeoutError);
        assert.equal(error.timeout, 10);
    });
});

describe('HttpClient CSRF integration', () => {
    /** @returns {{ provider: object, seen: string[] }} */
    function createProvider() {
        /** @type {string[]} */
        const seen = [];

        return {
            seen,
            provider: {
                getRequestHeaders(context) {
                    seen.push(`headers:${context.method}`);

                    return { 'X-CSRF-TOKEN': 'token-1' };
                },
                getRequestBodyFields() {
                    return { csrf_test_name: 'token-1' };
                },
                updateFromResponse(response) {
                    seen.push(`update:${response.status}`);
                },
            },
        };
    }

    test('applies the token to unsafe requests only', async () => {
        const { provider, seen } = createProvider();
        const { http, calls } = createClient(() => jsonResponse({}), { csrf: provider });

        await http.get('/api/customers');
        assert.equal(calls[0].headers.get('X-CSRF-TOKEN'), null);
        assert.ok(!seen.includes('headers:GET'));

        await http.post('/api/customers', new FormData());
        assert.equal(calls[1].headers.get('X-CSRF-TOKEN'), 'token-1');
    });

    test('adds token fields to form bodies', async () => {
        const { provider } = createProvider();
        const { http, calls } = createClient(() => jsonResponse({}), { csrf: provider });
        const form = new FormData();
        form.set('name', 'Ada');

        await http.post('/api/customers', form);

        assert.equal(/** @type {FormData} */ (calls[0].body).get('csrf_test_name'), 'token-1');
        assert.equal(/** @type {FormData} */ (calls[0].body).get('name'), 'Ada');
    });

    test('leaves a JSON body untouched and relies on the header', async () => {
        const { provider } = createProvider();
        const { http, calls } = createClient(() => jsonResponse({}), { csrf: provider });

        await http.post('/api/customers', { name: 'Ada' }, { json: true });

        assert.equal(calls[0].body, '{"name":"Ada"}');
        assert.equal(calls[0].headers.get('X-CSRF-TOKEN'), 'token-1');
    });

    test('gives the provider every response so it can rotate the token', async () => {
        const { provider, seen } = createProvider();
        const { http } = createClient(() => jsonResponse({}, { status: 200 }), { csrf: provider });

        await http.get('/api/customers');

        assert.ok(seen.includes('update:200'));
    });
});

describe('HttpClient observability hook', () => {
    test('reports request, response and error without altering results', async () => {
        /** @type {string[]} */
        const log = [];
        const observer = {
            onRequest: c => log.push(`req ${c.method} ${c.url.pathname}`),
            onResponse: c => log.push(`res ${c.response.status}`),
            onError: c => log.push(`err ${c.error.name}`),
        };

        const { http } = createClient(
            request => {
                return request.url.includes('bad')
                    ? new Response('x', { status: 500 })
                    : jsonResponse({});
            },
            { observer },
        );

        await http.json('/api/good');
        await http.json('/api/bad').catch(() => {});

        assert.deepEqual(log, [
            'req GET /api/good',
            'res 200',
            'req GET /api/bad',
            'res 500',
            'err HttpError',
        ]);
    });
});

describe('toSearchParams', () => {
    test('omits null and undefined, stringifies the rest, repeats arrays', () => {
        const params = toSearchParams({ a: 1, b: null, c: undefined, d: false, e: ['x', 'y'] });

        assert.equal(params.toString(), 'a=1&d=false&e=x&e=y');
    });
});
