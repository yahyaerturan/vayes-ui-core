/**
 * @file Safe insertion of server-rendered HTML fragments.
 * @see docs/06-rendering-dom.md
 * @see ADR-009
 */

/**
 * Content attributes that install an inline event handler. Server fragments
 * must not carry executable code (docs/10-security.md), and a strict CSP would
 * refuse to run them anyway, so they are removed rather than silently kept.
 */
const EVENT_HANDLER_ATTRIBUTE = /^on[a-z]/i;

/**
 * Parse a trusted server-rendered HTML fragment into an inert
 * `DocumentFragment`.
 *
 * Two things make this safe to insert:
 *
 * 1. `<template>` parsing produces nodes in an inert document, so images and
 *    iframes do not begin loading while we inspect the markup;
 * 2. `<script>` elements and inline handler attributes are removed before the
 *    nodes are adopted. This matters: a script parsed inside a template *does*
 *    execute once it is moved into the live document, so merely using a
 *    template is not sufficient protection.
 *
 * Custom elements inside the fragment upgrade automatically on insertion — and
 * later, if their module is imported afterwards. No initialisation scan runs
 * (ADR-007).
 *
 * @param {string} html Trusted, server-escaped HTML from a first-party endpoint.
 * @returns {DocumentFragment}
 */
export function parseFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html);

    for (const script of template.content.querySelectorAll('script')) {
        script.remove();
    }

    for (const element of template.content.querySelectorAll('*')) {
        for (const attribute of Array.from(element.attributes)) {
            if (EVENT_HANDLER_ATTRIBUTE.test(attribute.name)) {
                element.removeAttribute(attribute.name);
            }
        }
    }

    return template.content;
}

/**
 * Replace every child of `container` with a parsed fragment.
 *
 * `replaceChildren()` is a single atomic mutation, so delegated listeners bound
 * on the container survive and disconnected custom elements run their cleanup
 * exactly once.
 *
 * @param {Element} container
 * @param {string} html
 * @returns {Element} The container, for chaining.
 */
export function replaceFragment(container, html) {
    container.replaceChildren(parseFragment(html));

    return container;
}

/**
 * Append a parsed fragment to `container` without disturbing existing children.
 *
 * @param {Element} container
 * @param {string} html
 * @returns {Element} The container, for chaining.
 */
export function appendFragment(container, html) {
    container.append(parseFragment(html));

    return container;
}
