# ADR-009 — Trusted Server HTML Fragments Are First-Class

**Status:** Accepted

## Decision

CI4 may intentionally return escaped server-rendered HTML fragments for insertion into application regions, alongside JSON-driven component flows.

Rules:

- endpoint intentionally returns HTML;
- normal server output escaping applies;
- insertion helper does not execute scripts;
- contained custom elements initialize natively;
- no manual component scan;
- transport and DOM insertion remain separate responsibilities.
