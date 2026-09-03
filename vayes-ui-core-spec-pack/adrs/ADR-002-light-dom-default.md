# ADR-002 — Light DOM by Default

**Status:** Accepted

## Decision

First-party application components use Light DOM by default. Shadow DOM is opt-in per component.

## Rationale

Light DOM integrates naturally with application CSS, CodeIgniter server rendering, forms, accessibility and DevTools. Shadow DOM is justified for strong isolation/third-party embedding, not as a universal default.
