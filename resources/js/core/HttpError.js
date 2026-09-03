/**
 * @file Transport error taxonomy.
 * @see docs/08-http-ajax.md
 * @see docs/19-observability-errors.md
 *
 * Four failure modes must stay distinguishable, because they demand different
 * UI: a superseded autocomplete request (abort) must render nothing at all,
 * a timeout may offer retry, a network failure is often transient, and an HTTP
 * error carries a server-authored body worth showing.
 *
 * - abort   → native `DOMException` named `AbortError` (use {@link isAbortError})
 * - timeout → {@link TimeoutError}
 * - network → {@link NetworkError}
 * - 4xx/5xx → {@link HttpError}
 */

/**
 * A non-2xx HTTP response. The request reached the server and the server
 * answered; the answer was an error.
 */
export class HttpError extends Error {
    /**
     * @param {Response} response
     * @param {Object} [context]
     * @param {string} [context.url] Effective request URL.
     * @param {string} [context.method] Request method.
     * @param {unknown} [context.body] Parsed response body, when safely available.
     * @param {string|null} [context.requestId] Server correlation id.
     */
    constructor(response, context = {}) {
        const url = context.url ?? response.url;
        const method = context.method ?? 'GET';

        super(
            `HTTP ${response.status} ${response.statusText || ''}`.trim() + ` for ${method} ${url}`,
        );

        /** @type {'HttpError'} */
        this.name = 'HttpError';

        /** @type {number} */
        this.status = response.status;

        /** @type {string} */
        this.statusText = response.statusText;

        /** @type {string} */
        this.url = url;

        /** @type {string} */
        this.method = method;

        /**
         * The original `Response`. Its body may already be consumed; use
         * {@link HttpError#body} for the parsed payload.
         *
         * @type {Response}
         */
        this.response = response;

        /**
         * Parsed response body when the content type allowed a safe read,
         * otherwise `undefined`. Never rendered as HTML by the core.
         *
         * @type {unknown}
         */
        this.body = context.body;

        /**
         * Correlation id echoed by the server, used to find the matching
         * server-side log entry.
         *
         * @type {string|null}
         */
        this.requestId = context.requestId ?? null;
    }

    /** @returns {boolean} Client error (4xx). */
    get isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    /** @returns {boolean} Server error (5xx). */
    get isServerError() {
        return this.status >= 500;
    }

    /** @returns {boolean} Validation-shaped response (`422`, or `400` with errors). */
    get isValidationError() {
        return (
            this.status === 422 ||
            (this.status === 400 &&
                Boolean(this.body && typeof this.body === 'object' && 'errors' in this.body))
        );
    }
}

/**
 * The request never produced an HTTP response: DNS failure, connection reset,
 * CORS rejection, offline browser. Wraps the native `TypeError` as `cause`.
 */
export class NetworkError extends Error {
    /**
     * @param {string} message
     * @param {{ url?: string, method?: string, cause?: unknown }} [context]
     */
    constructor(message, context = {}) {
        super(message, { cause: context.cause });

        /** @type {'NetworkError'} */
        this.name = 'NetworkError';

        /** @type {string|undefined} */
        this.url = context.url;

        /** @type {string|undefined} */
        this.method = context.method;
    }
}

/**
 * A configured client timeout elapsed. Distinct from a caller-initiated abort:
 * the user did not cancel this, so a retry affordance is usually appropriate.
 */
export class TimeoutError extends Error {
    /**
     * @param {number} timeout Milliseconds after which the request was aborted.
     * @param {{ url?: string, method?: string }} [context]
     */
    constructor(timeout, context = {}) {
        super(
            `Request timed out after ${timeout}ms: ${context.method ?? 'GET'} ${context.url ?? ''}`.trim(),
        );

        /** @type {'TimeoutError'} */
        this.name = 'TimeoutError';

        /** @type {number} */
        this.timeout = timeout;

        /** @type {string|undefined} */
        this.url = context.url;

        /** @type {string|undefined} */
        this.method = context.method;
    }
}

/**
 * Whether an error represents an intentional cancellation.
 *
 * Components use this to stay silent when a superseded request is discarded.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAbortError(error) {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'name' in error &&
        /** @type {{ name: unknown }} */ (error).name === 'AbortError',
    );
}
