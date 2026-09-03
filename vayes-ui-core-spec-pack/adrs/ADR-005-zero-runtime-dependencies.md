# ADR-005 — Zero Runtime Dependencies

**Status:** Accepted

## Decision

The stable core has no production/runtime third-party JavaScript dependencies. Testing/lint/build dependencies are allowed.

Any future runtime dependency requires a new ADR explaining necessity, browser-native alternatives, security/maintenance cost, size and exit strategy.
