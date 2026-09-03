# ADR-007 — No Global DOM Initialization Scanner

**Status:** Accepted

## Decision

Do not scan the DOM after page load or AJAX insertion to initialize components. Native Custom Elements lifecycle provides initialization/upgrades.

A non-Custom-Element behavior may use explicit initialization only when truly necessary; it must not become the main architecture.
