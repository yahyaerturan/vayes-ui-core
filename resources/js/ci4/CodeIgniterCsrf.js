/**
 * @file CodeIgniter 4 CSRF strategy for `HttpClient`.
 * @see docs/08-http-ajax.md
 * @see docs/09-ci4-integration.md
 */

/**
 * Supplies CI4's CSRF token on unsafe requests and keeps it current when the
 * server rotates tokens (`Config\Security::$regenerate = true`).
 *
 * The token reaches the server two ways, because CI4 accepts both:
 *
 * - as a request header (`csrf_header()`, default `X-CSRF-TOKEN`) — used for
 *   JSON and any body we must not re-encode;
 * - as a body field (`csrf_token()`, default `csrf_test_name`) — added to
 *   `FormData`/`URLSearchParams` bodies, matching a normal form post.
 *
 * Rotation is handled by reading, in order of preference, an agreed response
 * header, then the CSRF cookie. Reading the cookie only works when CI4 is
 * configured with a non-`HttpOnly` CSRF cookie; header rotation is the
 * dependable path and the one the demo application implements.
 */
export class CodeIgniterCsrfProvider {
    /** @type {string} */
    #headerName;

    /** @type {string} */
    #tokenName;

    /** @type {string|null} */
    #token;

    /** @type {string|null} */
    #cookieName;

    /** @type {Document|undefined} */
    #document;

    /**
     * @param {Object} [options]
     * @param {string} [options.headerName='X-CSRF-TOKEN'] Value of `csrf_header()`.
     * @param {string} [options.tokenName='csrf_test_name'] Value of `csrf_token()`.
     * @param {string|null} [options.token] Initial value of `csrf_hash()`.
     * @param {string|null} [options.cookieName] CSRF cookie name, when readable.
     * @param {Document} [options.document] Injectable for tests.
     */
    constructor(options = {}) {
        this.#headerName = options.headerName || 'X-CSRF-TOKEN';
        this.#tokenName = options.tokenName || 'csrf_test_name';
        this.#token = options.token ?? null;
        this.#cookieName = options.cookieName ?? null;
        this.#document = options.document;
    }

    /**
     * Build a provider from server-rendered boot configuration.
     *
     * @param {import('./bootConfig.js').BootConfig} config
     * @param {Document} [doc]
     * @returns {CodeIgniterCsrfProvider}
     */
    static fromBootConfig(config, doc = undefined) {
        return new CodeIgniterCsrfProvider({
            headerName: config.csrfHeader ?? undefined,
            tokenName: config.csrfTokenName ?? undefined,
            token: config.csrfToken,
            cookieName: config.csrfCookie,
            document: doc,
        });
    }

    /** @returns {string|null} The token that will be sent next. */
    get token() {
        return this.#token;
    }

    /** @returns {string} */
    get headerName() {
        return this.#headerName;
    }

    /** @returns {string} */
    get tokenName() {
        return this.#tokenName;
    }

    /**
     * @param {import('../core/HttpClient.js').RequestContext} _context
     * @returns {Record<string, string>}
     */
    getRequestHeaders(_context) {
        const token = this.#currentToken();

        return token ? { [this.#headerName]: token } : {};
    }

    /**
     * @param {import('../core/HttpClient.js').RequestContext} _context
     * @returns {Record<string, string>}
     */
    getRequestBodyFields(_context) {
        const token = this.#currentToken();

        return token ? { [this.#tokenName]: token } : {};
    }

    /**
     * Adopt a rotated token from the response.
     *
     * @param {Response} response
     * @returns {void}
     */
    updateFromResponse(response) {
        const rotated = response.headers.get(this.#headerName);

        if (rotated) {
            this.#token = rotated;

            return;
        }

        const fromCookie = this.#readCookie();

        if (fromCookie) {
            this.#token = fromCookie;
        }
    }

    /**
     * Replace the token explicitly, for applications that receive it in a JSON
     * payload instead of a header.
     *
     * @param {string} token
     * @returns {void}
     */
    setToken(token) {
        this.#token = token;
    }

    /** @returns {string|null} */
    #currentToken() {
        return this.#token ?? this.#readCookie();
    }

    /** @returns {string|null} */
    #readCookie() {
        if (!this.#cookieName) {
            return null;
        }

        const doc = this.#document ?? globalThis.document;
        const cookies = doc?.cookie ?? '';

        for (const part of cookies.split(';')) {
            const [name, ...rest] = part.trim().split('=');

            if (name === this.#cookieName) {
                return decodeURIComponent(rest.join('='));
            }
        }

        return null;
    }
}
