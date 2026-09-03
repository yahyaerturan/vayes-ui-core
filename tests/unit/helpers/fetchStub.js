/**
 * @file Test double for `fetch`.
 *
 * Recording the outgoing request is the point: most transport rules
 * (headers, body encoding, CSRF, query building) are only observable there.
 */

/**
 * @typedef {Object} RecordedRequest
 * @property {string} url
 * @property {string} method
 * @property {Headers} headers
 * @property {BodyInit|null} body
 * @property {RequestCredentials|undefined} credentials
 * @property {AbortSignal|undefined} signal
 */

/**
 * @param {(request: RecordedRequest) => Response|Promise<Response>} handler
 * @returns {{ fetch: typeof fetch, calls: RecordedRequest[] }}
 */
export function createFetchStub(handler) {
    /** @type {RecordedRequest[]} */
    const calls = [];

    /** @type {typeof fetch} */
    const stub = async (input, init = {}) => {
        /** @type {RecordedRequest} */
        const record = {
            url: String(input),
            method: init.method ?? 'GET',
            headers: new Headers(init.headers ?? {}),
            body: init.body ?? null,
            credentials: init.credentials,
            signal: init.signal ?? undefined,
        };

        calls.push(record);

        if (record.signal?.aborted) {
            throw record.signal.reason ?? new DOMException('Aborted', 'AbortError');
        }

        return handler(record);
    };

    return { fetch: stub, calls };
}

/**
 * A response that never settles until the request signal aborts, for testing
 * cancellation and timeouts.
 *
 * @param {RecordedRequest} request
 * @returns {Promise<Response>}
 */
export function neverResolving(request) {
    return new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
            reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        });
    });
}

/**
 * @param {unknown} body
 * @param {ResponseInit} [init]
 * @returns {Response}
 */
export function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        statusText: init.statusText,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
}
