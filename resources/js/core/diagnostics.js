/**
 * @file Opt-in development diagnostics.
 * @see docs/19-observability-errors.md
 *
 * Importing this module installs nothing. There is no `window.onerror` hook, no
 * global listener and no side effect until the application explicitly calls a
 * factory here and wires the result up. Diagnostics never alter control flow.
 */

/**
 * Header and field names whose values are replaced before logging. CSRF tokens
 * and credentials must never reach a log sink, including a developer console
 * that may be screen-shared.
 */
export const DEFAULT_REDACTED_KEYS = Object.freeze([
    'authorization',
    'cookie',
    'set-cookie',
    'proxy-authorization',
    'x-csrf-token',
    'x-xsrf-token',
    'csrf_test_name',
    'password',
    'password_confirm',
    'token',
    'secret',
]);

const REDACTED = '[redacted]';

/**
 * @typedef {Object} Logger
 * @property {(...args: unknown[]) => void} debug
 * @property {(...args: unknown[]) => void} warn
 */

/**
 * Copy a header set with sensitive values masked.
 *
 * @param {Headers|Record<string, string>} headers
 * @param {readonly string[]} [redactedKeys]
 * @returns {Record<string, string>}
 */
export function redactHeaders(headers, redactedKeys = DEFAULT_REDACTED_KEYS) {
    const entries = headers instanceof Headers ? [...headers] : Object.entries(headers ?? {});
    const blocked = new Set(redactedKeys.map(key => key.toLowerCase()));

    /** @type {Record<string, string>} */
    const result = {};

    for (const [key, value] of entries) {
        result[key] = blocked.has(key.toLowerCase()) ? REDACTED : value;
    }

    return result;
}

/**
 * Build a {@link RequestObserver} that logs request metadata.
 *
 * Bodies are never logged: they routinely carry personal data and CSRF fields.
 *
 * @param {Object} [options]
 * @param {Logger} [options.logger=console]
 * @param {readonly string[]} [options.redact]
 * @param {boolean} [options.enabled=true]
 * @returns {import('./HttpClient.js').RequestObserver}
 */
export function createHttpObserver(options = {}) {
    const logger = options.logger ?? console;
    const redact = options.redact ?? DEFAULT_REDACTED_KEYS;
    const enabled = options.enabled ?? true;

    if (!enabled) {
        return {};
    }

    return {
        onRequest(context) {
            logger.debug('[vui:http] →', context.method, context.url.href, {
                headers: redactHeaders(context.headers, redact),
            });
        },
        onResponse(context) {
            logger.debug(
                '[vui:http] ←',
                context.response.status,
                context.method,
                context.url.href,
                `${context.durationMs}ms`,
            );
        },
        onError(context) {
            const error = /** @type {{ name?: string, message?: string }} */ (context.error);
            logger.warn(
                '[vui:http] ✕',
                error?.name ?? 'Error',
                context.method,
                context.url.href,
                `${context.durationMs}ms`,
                error?.message ?? '',
            );
        },
    };
}

/**
 * Log public component events observed at a DOM root.
 *
 * Because component events bubble by default, one listener at `document`
 * captures the whole application's event traffic — the fastest way to answer
 * "which component emitted that, and what did it carry?".
 *
 * @param {Object} [options]
 * @param {EventTarget} [options.root=document]
 * @param {readonly string[]} [options.events] Event names to observe. Required;
 *   there is no way to enumerate custom event types at runtime.
 * @param {Logger} [options.logger=console]
 * @returns {() => void} Dispose function that removes every listener.
 */
export function observeComponentEvents(options = {}) {
    const root = options.root ?? document;
    const logger = options.logger ?? console;
    const names = options.events ?? [];
    const controller = new AbortController();

    for (const name of names) {
        root.addEventListener(
            name,
            event => {
                const custom = /** @type {CustomEvent} */ (event);
                logger.debug('[vui:event]', name, {
                    target: /** @type {Element} */ (event.target)?.localName,
                    detail: custom.detail,
                });
            },
            { signal: controller.signal },
        );
    }

    return () => controller.abort();
}
