/**
 * @file Reading server-rendered boot configuration.
 * @see docs/09-ci4-integration.md
 *
 * CodeIgniter renders the handful of values JavaScript needs **once**, into
 * markup, instead of scattering implicit globals. Two carriers are supported:
 *
 * ```html
 * <meta name="app-base-url" content="https://app.example/">
 * <meta name="csrf-header" content="X-CSRF-TOKEN">
 * <meta name="csrf-token" content="…">
 * ```
 *
 * ```html
 * <script type="application/json" id="app-config">{"locale":"en"}</script>
 * ```
 *
 * A JSON `<script>` block is data, not code: the browser never executes
 * `type="application/json"`, which keeps the page compatible with a strict CSP.
 */

/**
 * @typedef {Object} BootConfig
 * @property {string} baseUrl Absolute application base URL.
 * @property {string} locale Active locale, defaulting to the document language.
 * @property {string|null} csrfHeader Header name CI4 expects, e.g. `X-CSRF-TOKEN`.
 * @property {string|null} csrfTokenName Form field name, e.g. `csrf_test_name`.
 * @property {string|null} csrfToken Current token value.
 * @property {string|null} csrfCookie Cookie carrying a rotated token, when configured.
 * @property {Record<string, unknown>} extra Everything from the JSON block.
 */

/**
 * Read one `<meta name="…" content="…">` value.
 *
 * @param {string} name
 * @param {Document} [doc=document]
 * @returns {string|null}
 */
export function readMeta(name, doc = document) {
    const meta = doc.querySelector(`meta[name="${CSS.escape(name)}"]`);

    return meta?.getAttribute('content') ?? null;
}

/**
 * Read and parse a non-executable JSON configuration block.
 *
 * @param {string} [id='app-config']
 * @param {Document} [doc=document]
 * @returns {Record<string, unknown>}
 * @throws {SyntaxError} When the block exists but is not valid JSON — a server
 *   template bug that must not be swallowed.
 */
export function readJsonConfig(id = 'app-config', doc = document) {
    const element = doc.getElementById(id);

    if (!element) {
        return {};
    }

    const text = element.textContent?.trim() ?? '';

    if (text === '') {
        return {};
    }

    try {
        const parsed = JSON.parse(text);

        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        throw new SyntaxError(
            `Boot configuration in #${id} is not valid JSON: ${/** @type {Error} */ (error).message}`,
        );
    }
}

/**
 * Collect boot configuration from the current document.
 *
 * @param {Object} [options]
 * @param {Document} [options.document]
 * @param {string} [options.jsonId='app-config']
 * @returns {BootConfig}
 */
export function readBootConfig(options = {}) {
    const doc = options.document ?? document;
    const extra = readJsonConfig(options.jsonId ?? 'app-config', doc);

    return {
        baseUrl: readMeta('app-base-url', doc) ?? doc.baseURI,
        locale: readMeta('locale', doc) ?? doc.documentElement.lang ?? 'en',
        csrfHeader: readMeta('csrf-header', doc),
        csrfTokenName: readMeta('csrf-token-name', doc),
        csrfToken: readMeta('csrf-token', doc),
        csrfCookie: readMeta('csrf-cookie', doc),
        extra,
    };
}
