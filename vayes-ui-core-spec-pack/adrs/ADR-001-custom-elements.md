# ADR-001 — Custom Elements as the Component Primitive

**Status:** Accepted

## Decision

Reusable markup-level components use native Custom Elements (`HTMLElement` + `customElements`).

## Why

- native lifecycle;
- automatic upgrade for elements already in or later inserted into the DOM;
- declarative HTML configuration;
- framework independence;
- browser interoperability.

## Consequences

- names require a hyphen;
- reconnect lifecycle semantics must be handled correctly;
- public rich properties require the pre-definition upgrade pattern;
- real-browser tests are required.

## Rejected

- manual `data-component` initialization scanners;
- frontend framework runtimes;
- a home-grown component registry recreating native lifecycle.
