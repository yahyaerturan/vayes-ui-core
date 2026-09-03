/**
 * @file Public entry point for the Vayes UI Core runtime.
 *
 * Importing this module has no side effects: it defines no custom element,
 * installs no global listener and touches no DOM. Component modules perform
 * their own registration when imported.
 *
 * `ActionRegistry` is deliberately absent — it is optional and imported from
 * `@vayes/ui-core/actions` by applications that need it (Phase 8).
 */

export { Component } from './Component.js';
export { EventBus, events } from './EventBus.js';
export { HttpClient, parseJsonResponse, toSearchParams } from './HttpClient.js';
export { HttpError, NetworkError, TimeoutError, isAbortError } from './HttpError.js';
export { parseFragment, replaceFragment, appendFragment } from './fragments.js';
export {
    define,
    isValidCustomElementName,
    hasAllowedPrefix,
    setAllowedPrefixes,
    getAllowedPrefixes,
} from './register.js';
