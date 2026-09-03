/**
 * @file Shared transport policy over native `fetch`.
 * @see docs/08-http-ajax.md
 * @see docs/09-ci4-integration.md
 */

import { HttpError, NetworkError, TimeoutError, isAbortError } from './HttpError.js';

/**
 * HTTP methods that may change server state and therefore require CSRF
 * protection.
 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Largest error body we will read into memory for diagnostics. */
const MAX_ERROR_BODY_BYTES = 64 * 1024;

/**
 * Pluggable CSRF strategy. Every method is optional; the client calls whichever
 * exist. Implementations live outside the core so the core never encodes one
 * CodeIgniter configuration (docs/08-http-ajax.md).
 *
 * @typedef {Object} CsrfProvider
 * @property {(context: RequestContext) => Record<string, string>} [getRequestHeaders]
 * @property {(context: RequestContext) => Record<string, string>} [getRequestBodyFields]
 * @property {(response: Response) => void} [updateFromResponse]
 */

/**
 * Optional diagnostics hook. Never alters control flow.
 *
 * @typedef {Object} RequestObserver
 * @property {(context: RequestContext) => void} [onRequest]
 * @property {(context: RequestContext & { response: Response, durationMs: number }) => void} [onResponse]
 * @property {(context: RequestContext & { error: unknown, durationMs: number }) => void} [onError]
 */

/**
 * @typedef {Object} RequestContext
 * @property {string} method Upper-case HTTP method.
 * @property {URL} url Resolved request URL.
 * @property {Headers} headers Outgoing headers.
 * @property {BodyInit|null} body Outgoing body.
 * @property {boolean} sameOrigin Whether the URL matches the document origin.
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method='GET']
 * @property {Record<string, string>|Headers} [headers]
 * @property {BodyInit|null} [body] `FormData`, `URLSearchParams`, string, Blob…
 * @property {boolean} [json=false] Serialise `body` as JSON and set the content type.
 * @property {Record<string, unknown>|URLSearchParams} [query] Appended to the URL.
 * @property {AbortSignal} [signal] Caller cancellation.
 * @property {number} [timeout] Milliseconds; `0` disables. Defaults to client config.
 * @property {RequestCredentials} [credentials]
 * @property {string} [accept] Convenience for the `Accept` header.
 */

/**
 * `HttpClient` owns transport policy and nothing else: it never renders a
 * spinner, never picks an error message and never knows a component exists
 * (docs/02-architecture.md, "Dependency direction").
 *
 * @example
 * const http = new HttpClient({ csrf: csrfProvider });
 * const customers = await http.json('/api/customers/search', { query: { q: 'ada' } });
 */
export class HttpClient {
    /** @type {string|undefined} */
    #baseUrl;

    /** @type {Record<string, string>} */
    #headers;

    /** @type {RequestCredentials} */
    #credentials;

    /** @type {number} */
    #timeout;

    /** @type {CsrfProvider|null} */
    #csrf;

    /** @type {typeof fetch} */
    #fetch;

    /** @type {string} */
    #requestIdHeader;

    /** @type {RequestObserver|null} */
    #observer;

    /**
     * @param {Object} [config]
     * @param {string} [config.baseUrl] Base for relative URLs. Defaults to the document base.
     * @param {Record<string, string>} [config.headers] Extra default headers.
     * @param {RequestCredentials} [config.credentials='same-origin']
     * @param {number} [config.timeout=0] Default timeout in ms; `0` disables.
     * @param {CsrfProvider|null} [config.csrf=null]
     * @param {typeof fetch} [config.fetch] Injectable for tests.
     * @param {string} [config.requestIdHeader='X-Request-Id']
     * @param {RequestObserver|null} [config.observer=null]
     */
    constructor(config = {}) {
        this.#baseUrl = config.baseUrl;
        this.#headers = { ...(config.headers ?? {}) };
        this.#credentials = config.credentials ?? 'same-origin';
        this.#timeout = config.timeout ?? 0;
        this.#csrf = config.csrf ?? null;
        this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
        this.#requestIdHeader = config.requestIdHeader ?? 'X-Request-Id';
        this.#observer = config.observer ?? null;
    }

    /**
     * Perform a request and return the raw successful `Response`.
     *
     * Use this when headers, status or streaming matter. Use {@link json},
     * {@link text} or {@link html} when only the payload matters.
     *
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     * @throws {HttpError} On a non-2xx response.
     * @throws {TimeoutError} When the configured timeout elapsed.
     * @throws {NetworkError} When no response was produced.
     * @throws {DOMException} Named `AbortError` when the caller cancelled.
     */
    async request(url, options = {}) {
        const method = (options.method ?? 'GET').toUpperCase();
        const resolved = this.#resolveUrl(url, options.query);
        const sameOrigin = this.#isSameOrigin(resolved);
        const headers = this.#buildHeaders(options);
        const body = this.#buildBody(method, options, headers);

        /** @type {RequestContext} */
        const context = { method, url: resolved, headers, body, sameOrigin };

        if (this.#csrf && sameOrigin && UNSAFE_METHODS.has(method)) {
            this.#applyCsrf(context);
        }

        const { signal, dispose, didTimeout, timeout } = this.#createSignal(options);
        const startedAt = Date.now();

        this.#observer?.onRequest?.(context);

        /** @type {Response} */
        let response;

        try {
            response = await this.#fetch(resolved, {
                method,
                headers,
                body: context.body,
                credentials: options.credentials ?? this.#credentials,
                signal,
            });
        } catch (error) {
            const failure = this.#normaliseFailure(error, { context, didTimeout, timeout });
            this.#observer?.onError?.({
                ...context,
                error: failure,
                durationMs: Date.now() - startedAt,
            });
            throw failure;
        } finally {
            dispose();
        }

        this.#csrf?.updateFromResponse?.(response);
        this.#observer?.onResponse?.({
            ...context,
            response,
            durationMs: Date.now() - startedAt,
        });

        if (!response.ok) {
            const error = await this.#createHttpError(response, context);
            this.#observer?.onError?.({
                ...context,
                error,
                durationMs: Date.now() - startedAt,
            });
            throw error;
        }

        return response;
    }

    /**
     * Request and parse a JSON payload.
     *
     * A `204 No Content` or empty body resolves to `null` rather than throwing,
     * because "nothing to report" is a normal success for write endpoints.
     *
     * @template T
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<T|null>}
     */
    async json(url, options = {}) {
        const response = await this.request(url, {
            ...options,
            accept: options.accept ?? 'application/json',
        });

        return /** @type {Promise<T|null>} */ (parseJsonResponse(response));
    }

    /**
     * Request and return the response body as text.
     *
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<string>}
     */
    async text(url, options = {}) {
        const response = await this.request(url, options);

        return response.text();
    }

    /**
     * Request a server-rendered HTML fragment as text.
     *
     * Insertion is deliberately *not* performed here: transport and DOM
     * mutation stay separate responsibilities (ADR-009). Pass the result to
     * `replaceFragment()` from `core/fragments.js`.
     *
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<string>}
     */
    async html(url, options = {}) {
        return this.text(url, {
            ...options,
            accept: options.accept ?? 'text/html, application/xhtml+xml',
        });
    }

    /**
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     */
    get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * @param {string|URL} url
     * @param {BodyInit|Record<string, unknown>|null} [body]
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     */
    post(url, body = null, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    /**
     * @param {string|URL} url
     * @param {BodyInit|Record<string, unknown>|null} [body]
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     */
    put(url, body = null, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    /**
     * @param {string|URL} url
     * @param {BodyInit|Record<string, unknown>|null} [body]
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     */
    patch(url, body = null, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body });
    }

    /**
     * @param {string|URL} url
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>}
     */
    delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    /**
     * @param {string|URL} url
     * @param {Record<string, unknown>|URLSearchParams|undefined} query
     * @returns {URL}
     */
    #resolveUrl(url, query) {
        const base = this.#baseUrl ?? globalThis.document?.baseURI ?? globalThis.location?.href;

        let resolved;

        try {
            resolved = base ? new URL(String(url), base) : new URL(String(url));
        } catch {
            throw new TypeError(
                `Cannot resolve "${String(url)}" against base "${base ?? '(none)'}". ` +
                    'Pass an absolute URL or configure HttpClient with a baseUrl.',
            );
        }

        if (query) {
            const params = query instanceof URLSearchParams ? query : toSearchParams(query);

            for (const [key, value] of params) {
                resolved.searchParams.append(key, value);
            }
        }

        return resolved;
    }

    /**
     * @param {URL} url
     * @returns {boolean}
     */
    #isSameOrigin(url) {
        const origin = globalThis.location?.origin;

        if (!origin || origin === 'null') {
            // Non-browser context (unit tests, workers with opaque origins):
            // the configured base URL is the only origin we know about.
            return true;
        }

        return url.origin === origin;
    }

    /**
     * @param {RequestOptions} options
     * @returns {Headers}
     */
    #buildHeaders(options) {
        const headers = new Headers({
            // CI4's `IncomingRequest::isAJAX()` reads this. It is a
            // content-negotiation hint only, never an authorization signal.
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
            ...this.#headers,
        });

        if (options.accept) {
            headers.set('Accept', options.accept);
        }

        if (options.headers) {
            const extra = new Headers(options.headers);
            for (const [key, value] of extra) {
                headers.set(key, value);
            }
        }

        return headers;
    }

    /**
     * Body policy (docs/08-http-ajax.md):
     *
     * - `FormData` / `URLSearchParams` / string / Blob / stream pass through
     *   untouched, so the browser can pick the correct content type and
     *   multipart boundary;
     * - a plain object is serialised **only** with an explicit `json: true`,
     *   because silently JSON-encoding is how `[object Object]` reaches
     *   production;
     * - no `Content-Type` is invented for bodyless requests, which would
     *   needlessly turn same-origin requests into CORS preflights.
     *
     * @param {string} method
     * @param {RequestOptions} options
     * @param {Headers} headers
     * @returns {BodyInit|null}
     */
    #buildBody(method, options, headers) {
        const body = options.body ?? null;

        if (method === 'GET' || method === 'HEAD') {
            if (body !== null) {
                throw new TypeError(`A ${method} request cannot have a body.`);
            }

            return null;
        }

        if (body === null || body === undefined) {
            return null;
        }

        if (options.json === true) {
            headers.set('Content-Type', 'application/json');
            if (!options.accept) {
                headers.set('Accept', 'application/json');
            }

            return JSON.stringify(body);
        }

        if (isPassThroughBody(body)) {
            return /** @type {BodyInit} */ (body);
        }

        throw new TypeError(
            'HttpClient received a plain object body without `json: true`. ' +
                'Pass FormData/URLSearchParams/string, or set `json: true` to serialise it.',
        );
    }

    /**
     * @param {RequestContext} context
     * @returns {void}
     */
    #applyCsrf(context) {
        const headers = this.#csrf?.getRequestHeaders?.(context) ?? {};

        for (const [key, value] of Object.entries(headers)) {
            context.headers.set(key, value);
        }

        const fields = this.#csrf?.getRequestBodyFields?.(context) ?? {};
        const entries = Object.entries(fields);

        if (entries.length === 0) {
            return;
        }

        // Only body types we can extend without re-encoding the payload.
        if (context.body instanceof FormData || context.body instanceof URLSearchParams) {
            for (const [key, value] of entries) {
                context.body.set(key, value);
            }
        }
    }

    /**
     * Compose the caller signal with an optional timeout, keeping the two
     * causes distinguishable after the fact.
     *
     * @param {RequestOptions} options
     * @returns {{ signal: AbortSignal|undefined, dispose: () => void, didTimeout: () => boolean, timeout: number }}
     */
    #createSignal(options) {
        const timeout = options.timeout ?? this.#timeout;
        const external = options.signal;

        if (!timeout || timeout <= 0) {
            return {
                signal: external,
                dispose: () => {},
                didTimeout: () => false,
                timeout: 0,
            };
        }

        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        const signal = external
            ? AbortSignal.any([external, controller.signal])
            : controller.signal;

        return {
            signal,
            dispose: () => clearTimeout(timer),
            didTimeout: () => timedOut,
            timeout,
        };
    }

    /**
     * @param {unknown} error
     * @param {{ context: RequestContext, didTimeout: () => boolean, timeout: number }} info
     * @returns {unknown}
     */
    #normaliseFailure(error, { context, didTimeout, timeout }) {
        if (isAbortError(error)) {
            if (didTimeout()) {
                return new TimeoutError(timeout, {
                    url: context.url.href,
                    method: context.method,
                });
            }

            // A caller-initiated cancellation stays a native AbortError so that
            // `signal.reason` and standard checks keep working.
            return error;
        }

        return new NetworkError(`Network request failed: ${context.method} ${context.url.href}`, {
            url: context.url.href,
            method: context.method,
            cause: error,
        });
    }

    /**
     * @param {Response} response
     * @param {RequestContext} context
     * @returns {Promise<HttpError>}
     */
    async #createHttpError(response, context) {
        return new HttpError(response, {
            url: context.url.href,
            method: context.method,
            body: await readErrorBody(response),
            requestId: response.headers.get(this.#requestIdHeader),
        });
    }
}

/**
 * Parse a JSON response, tolerating empty success bodies.
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
export async function parseJsonResponse(response) {
    if (response.status === 204 || response.status === 205) {
        return null;
    }

    const text = await response.text();

    if (text.trim() === '') {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new SyntaxError(
            `Expected JSON from ${response.url || 'the server'} but parsing failed: ${
                /** @type {Error} */ (error).message
            }`,
        );
    }
}

/**
 * Read an error response body without risking a huge allocation. Returns
 * `undefined` when the payload is absent, oversized or unparsable.
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readErrorBody(response) {
    const length = Number(response.headers.get('Content-Length') ?? '0');

    if (length > MAX_ERROR_BODY_BYTES) {
        return undefined;
    }

    const type = response.headers.get('Content-Type') ?? '';

    try {
        const clone = response.clone();

        if (type.includes('json')) {
            return await parseJsonResponse(clone);
        }

        const text = await clone.text();

        return text.slice(0, MAX_ERROR_BODY_BYTES) || undefined;
    } catch {
        return undefined;
    }
}

/**
 * @param {unknown} body
 * @returns {boolean}
 */
function isPassThroughBody(body) {
    return (
        typeof body === 'string' ||
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        body instanceof Blob ||
        body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body) ||
        (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    );
}

/**
 * Build query parameters explicitly rather than concatenating strings
 * (docs/10-security.md, "URLs"). `null`/`undefined` values are omitted; arrays
 * repeat the key.
 *
 * @param {Record<string, unknown>} source
 * @returns {URLSearchParams}
 */
export function toSearchParams(source) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(source)) {
        if (value === null || value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item !== null && item !== undefined) {
                    params.append(key, String(item));
                }
            }

            continue;
        }

        params.append(key, String(value));
    }

    return params;
}
