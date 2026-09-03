# ADR-004 — No Reactive Runtime or Virtual DOM

**Status:** Accepted

## Decision

State is plain JavaScript. Components update the DOM through explicit methods. The core provides no signals, proxies, dependency tracking, hooks, virtual DOM or reconciliation.

## Consequence

Component authors may write several more explicit lines, but state → DOM control flow stays local, predictable and debuggable.
