# Prompt for an AI Coding Agent

Implement **Vayes UI Core** using the complete specification in this repository.

## Mandatory preparation

Before writing code, read fully:

1. `AGENTS.md`;
2. all `docs/*.md`;
3. all accepted `adrs/*.md`;
4. `examples/` only as non-authoritative illustrations.

The specification/ADRs override examples.

## Execution model

Implement **one phase at a time** from `docs/16-implementation-plan.md`.

For each phase:

1. summarize requirements;
2. list expected file changes;
3. write/update tests for public behavior;
4. implement the smallest compliant solution;
5. run relevant tests, lint and build;
6. fix implementation failures rather than weakening valid tests;
7. compare against the phase exit gate and `docs/17-acceptance-criteria.md`;
8. update public docs;
9. stop after the phase unless explicitly told to continue.

## Critical prohibitions

Do not introduce React/Vue/Svelte/Alpine/HTMX/Stimulus, virtual DOM, JSX, reactive proxies/signals, hooks, frontend DI, global state stores, client routers, two-way binding, proprietary templates, `eval`, `new Function`, arbitrary `window` handler resolution, global DOM init scans, or runtime npm dependencies without an accepted ADR.

If you believe an architectural prohibition must be broken, **do not implement it**. Produce a proposed ADR with alternatives, trade-offs and compatibility impact.

## Quality bar

- correct connect/disconnect/reconnect lifecycle;
- property-before-definition upgrade support;
- AJAX fragment Custom Elements initialize natively;
- DOM CustomEvents are default communication;
- Light DOM by default;
- explicit incremental local updates;
- HttpClient has no UI responsibility;
- CodeIgniter remains authoritative;
- real-browser tests verify browser semantics;
- security-sensitive data uses safe DOM rendering;
- public APIs/events are documented and tested.

Start with **Phase 0 only** unless instructed otherwise.
