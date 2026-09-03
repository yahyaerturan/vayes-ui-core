/**
 * @file Application service mediating between components and the transport layer.
 * @see docs/02-architecture.md
 *
 * The dependency direction is one-way:
 * `CustomerSelector → CustomerService → HttpClient → CI4 endpoint`.
 * The component never learns about CSRF, headers or response shapes, and the
 * transport never learns that a customer exists.
 */

import { HttpClient } from '../core/HttpClient.js';

/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} name
 * @property {string} [email]
 */

/**
 * Reads customer data from the CodeIgniter JSON API.
 */
export class CustomerService {
    /** @type {HttpClient} */
    #http;

    /** @type {string} */
    #endpoint;

    /**
     * @param {HttpClient} [http] Shared client. A default same-origin client is
     *   created when omitted, so a component can work with only an `endpoint`.
     * @param {Object} [options]
     * @param {string} [options.endpoint='/api/customers/search']
     */
    constructor(http = undefined, options = {}) {
        this.#http = http ?? new HttpClient();
        this.#endpoint = options.endpoint ?? '/api/customers/search';
    }

    /** @returns {string} */
    get endpoint() {
        return this.#endpoint;
    }

    /**
     * Search customers.
     *
     * Cancellation is the caller's responsibility: the component owns the
     * `AbortController` because only it knows which request is still wanted.
     *
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.limit=20]
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<Customer[]>}
     * @throws {import('../core/HttpError.js').HttpError} On a non-2xx response.
     */
    async search(query, options = {}) {
        const payload = await this.#http.json(this.#endpoint, {
            query: { q: query, limit: options.limit ?? 20 },
            signal: options.signal,
        });

        return normalizeCustomers(payload);
    }
}

/**
 * Accept both a bare array and the `{ data: [...] }` envelope CI4 APIs commonly
 * return, and drop entries that cannot be rendered.
 *
 * @param {unknown} payload
 * @returns {Customer[]}
 */
export function normalizeCustomers(payload) {
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(/** @type {{ data?: unknown }} */ (payload)?.data)
          ? /** @type {{ data: unknown[] }} */ (payload).data
          : [];

    /** @type {Customer[]} */
    const customers = [];

    for (const row of rows) {
        if (!row || typeof row !== 'object') {
            continue;
        }

        const record = /** @type {Record<string, unknown>} */ (row);
        const id = record.id ?? record.uuid;

        if (id === undefined || id === null || record.name === undefined) {
            continue;
        }

        customers.push({
            id: String(id),
            name: String(record.name),
            email:
                record.email === undefined || record.email === null
                    ? undefined
                    : String(record.email),
        });
    }

    return customers;
}
