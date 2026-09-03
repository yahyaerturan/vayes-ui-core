/**
 * @file Idempotent custom element registration with name-policy validation.
 * @see docs/03-core-api.md
 */

/**
 * Names the HTML specification reserves for SVG/MathML compatibility. They
 * contain a hyphen but are not valid custom element names.
 */
const RESERVED_NAMES = new Set([
    'annotation-xml',
    'color-profile',
    'font-face',
    'font-face-src',
    'font-face-uri',
    'font-face-format',
    'font-face-name',
    'missing-glyph',
]);

/**
 * Conservative approximation of the HTML `PotentialCustomElementName`
 * production: starts with an ASCII lower alpha, contains a hyphen, and uses
 * only characters that are safe in an HTML tag name across our browser policy.
 */
const NAME_PATTERN = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;

/** @type {string[]} */
let allowedPrefixes = ['vui-'];

/**
 * Replace the project prefix allowlist.
 *
 * One repository should not mix component prefixes casually
 * (docs/03-core-api.md, "Naming policy"); an application shipping its own
 * product prefix declares it once, at boot.
 *
 * @param {string[]} prefixes Non-empty list of prefixes, each ending in `-`.
 * @returns {void}
 * @throws {TypeError} When the list is empty or a prefix is malformed.
 */
export function setAllowedPrefixes(prefixes) {
    if (!Array.isArray(prefixes) || prefixes.length === 0) {
        throw new TypeError('setAllowedPrefixes() requires a non-empty array of prefixes.');
    }

    for (const prefix of prefixes) {
        if (typeof prefix !== 'string' || !prefix.endsWith('-') || prefix.length < 2) {
            throw new TypeError(`Invalid component prefix: ${String(prefix)}`);
        }
    }

    allowedPrefixes = [...prefixes];
}

/**
 * The prefixes currently accepted by {@link define}.
 *
 * @returns {string[]}
 */
export function getAllowedPrefixes() {
    return [...allowedPrefixes];
}

/**
 * Whether a string is a syntactically valid custom element name.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function isValidCustomElementName(name) {
    return typeof name === 'string' && NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name);
}

/**
 * Whether a name satisfies the project prefix policy.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function hasAllowedPrefix(name) {
    return allowedPrefixes.some(prefix => name.startsWith(prefix));
}

/**
 * Register a custom element once.
 *
 * Modules defining components are frequently imported from several entry
 * points; re-defining a name throws a `NotSupportedError` in the platform, so
 * registration is made idempotent here rather than at every call site.
 *
 * @template {CustomElementConstructor} T
 * @param {string} name Custom element tag name, e.g. `vui-modal`.
 * @param {T} constructor
 * @param {ElementDefinitionOptions} [options]
 * @returns {T} The constructor, for convenient `export default define(...)`.
 * @throws {TypeError} When the name is invalid or violates the prefix policy.
 */
export function define(name, constructor, options = undefined) {
    if (!isValidCustomElementName(name)) {
        throw new TypeError(
            `"${String(name)}" is not a valid custom element name. ` +
                'Names must start with a lowercase letter and contain a hyphen.',
        );
    }

    if (!hasAllowedPrefix(name)) {
        throw new TypeError(
            `"${name}" does not use an allowed component prefix ` +
                `(${allowedPrefixes.join(', ')}). Call setAllowedPrefixes() to change the policy.`,
        );
    }

    const existing = customElements.get(name);

    if (existing) {
        if (existing !== constructor) {
            console.warn(
                `[vayes-ui-core] "${name}" is already defined by a different constructor. ` +
                    'The existing definition is kept.',
            );
        }

        return constructor;
    }

    customElements.define(name, constructor, options);

    return constructor;
}
