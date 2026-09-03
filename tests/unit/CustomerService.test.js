import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CustomerService,
    normalizeCustomers,
} from '../../resources/js/services/CustomerService.js';
import { HttpClient } from '../../resources/js/core/HttpClient.js';
import { createFetchStub, jsonResponse } from './helpers/fetchStub.js';

describe('normalizeCustomers', () => {
    test('accepts a bare array and a data envelope alike', () => {
        const expected = [{ id: '1', name: 'Ada', email: undefined }];

        assert.deepEqual(normalizeCustomers([{ id: 1, name: 'Ada' }]), expected);
        assert.deepEqual(normalizeCustomers({ data: [{ id: 1, name: 'Ada' }] }), expected);
    });

    test('accepts uuid as the identifier', () => {
        assert.deepEqual(normalizeCustomers([{ uuid: 'u-1', name: 'Ada' }])[0].id, 'u-1');
    });

    test('drops rows that cannot be rendered', () => {
        const rows = [null, 'x', {}, { id: 1 }, { name: 'no id' }, { id: 2, name: 'Ok' }];

        assert.deepEqual(normalizeCustomers(rows), [{ id: '2', name: 'Ok', email: undefined }]);
    });

    test('returns an empty array for unusable payloads', () => {
        assert.deepEqual(normalizeCustomers(null), []);
        assert.deepEqual(normalizeCustomers({ data: 'nope' }), []);
    });

    test('coerces values to strings so the component never renders objects', () => {
        const [customer] = normalizeCustomers([{ id: 5, name: 7, email: 9 }]);

        assert.deepEqual(customer, { id: '5', name: '7', email: '9' });
    });
});

describe('CustomerService', () => {
    test('sends the query and limit to the configured endpoint', async () => {
        const stub = createFetchStub(() => jsonResponse({ data: [{ id: 1, name: 'Ada' }] }));
        const http = new HttpClient({ baseUrl: 'https://app.test', fetch: stub.fetch });
        const service = new CustomerService(http, { endpoint: '/api/customers/search' });

        const results = await service.search('ada', { limit: 5 });

        const url = new URL(stub.calls[0].url);
        assert.equal(url.pathname, '/api/customers/search');
        assert.equal(url.searchParams.get('q'), 'ada');
        assert.equal(url.searchParams.get('limit'), '5');
        assert.deepEqual(results, [{ id: '1', name: 'Ada', email: undefined }]);
    });

    test('forwards the caller abort signal', async () => {
        const stub = createFetchStub(() => jsonResponse([]));
        const http = new HttpClient({ baseUrl: 'https://app.test', fetch: stub.fetch });
        const service = new CustomerService(http);
        const controller = new AbortController();

        await service.search('ada', { signal: controller.signal });

        assert.equal(stub.calls[0].signal, controller.signal);
    });

    test('lets transport errors reach the caller unchanged', async () => {
        const stub = createFetchStub(() => new Response('nope', { status: 500 }));
        const http = new HttpClient({ baseUrl: 'https://app.test', fetch: stub.fetch });
        const service = new CustomerService(http);

        await assert.rejects(() => service.search('ada'), { name: 'HttpError', status: 500 });
    });
});
