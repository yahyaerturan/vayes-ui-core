# ADR-003 — Native Events as the Communication Protocol

**Status:** Accepted

## Decision

Components communicate outward using native `CustomEvent`. Non-DOM global application communication uses an `EventTarget`-based EventBus.

## Rejected

- mandatory centralized event brokers for all changes;
- direct reusable-component calls to application globals;
- framework-specific emitter systems.
