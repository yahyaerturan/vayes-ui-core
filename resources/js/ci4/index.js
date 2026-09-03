/**
 * @file CodeIgniter 4 adapter entry point.
 *
 * The core stays application-agnostic; everything that encodes a CI4
 * convention lives here (docs/02-architecture.md).
 */

import { HttpClient } from '../core/HttpClient.js';
import { readBootConfig } from './bootConfig.js';
import { CodeIgniterCsrfProvider } from './CodeIgniterCsrf.js';

export { readBootConfig, readMeta, readJsonConfig } from './bootConfig.js';
export { CodeIgniterCsrfProvider } from './CodeIgniterCsrf.js';

/**
 * Build an `HttpClient` wired to the CI4 conventions rendered into the page.
 *
 * @param {Object} [options]
 * @param {Document} [options.document]
 * @param {number} [options.timeout] Default request timeout in ms.
 * @param {import('../core/HttpClient.js').RequestObserver|null} [options.observer]
 * @returns {{ http: HttpClient, csrf: CodeIgniterCsrfProvider, config: import('./bootConfig.js').BootConfig }}
 */
export function createCodeIgniterClient(options = {}) {
    const doc = options.document ?? document;
    const config = readBootConfig({ document: doc });
    const csrf = CodeIgniterCsrfProvider.fromBootConfig(config, doc);

    const http = new HttpClient({
        baseUrl: config.baseUrl,
        csrf,
        timeout: options.timeout ?? 0,
        observer: options.observer ?? null,
    });

    return { http, csrf, config };
}
