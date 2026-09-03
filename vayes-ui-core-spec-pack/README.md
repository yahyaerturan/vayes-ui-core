# Vayes UI Core — Native Component Architecture Specification

**Status:** Implementation specification  
**Audience:** AI coding agents, lead developers, reviewers, maintainers  
**Primary backend:** CodeIgniter 4  
**Frontend runtime:** Browser-native JavaScript only  
**Runtime framework dependencies:** **None**

Vayes UI Core is a deliberately small frontend component layer for server-oriented web applications. It provides reusable/configurable UI components, explicit lifecycle management, native component events, an optional application event bus, controlled HTTP/AJAX integration, and support for both server-rendered and client-rendered components.

It is **not** a React/Vue/Svelte replacement and must never evolve into one. The browser is the platform. The library exists only to standardize the few patterns that browsers expose at a lower level than we want to repeat throughout application code.

## Required browser primitives

The implementation is built on:

- `HTMLElement` and Custom Elements (`customElements.define`)
- `EventTarget`, `Event`, and `CustomEvent`
- `AbortController` / `AbortSignal`
- `fetch`
- ES modules
- standard DOM APIs (`querySelector`, `closest`, `dataset`, `classList`, etc.)
- optional `<template>` elements
- optional `ElementInternals` for advanced form-associated components
- optional Shadow DOM only when isolation is a genuine requirement

## Core design promise

A developer inspecting the DOM and JavaScript should be able to determine:

1. which component owns a behavior;
2. which DOM event caused the behavior;
3. which server endpoint was called;
4. which event was emitted after the change;
5. which subscriber reacted to that event;
6. how the component cleans itself up.

No invisible dependency graph, reactive proxy, hook scheduler, virtual DOM, compiler, decorator system, or proprietary template language is permitted.

## Read order for implementation agents

1. `AGENTS.md`
2. `docs/01-vision-principles.md`
3. `docs/02-architecture.md`
4. `docs/03-core-api.md`
5. `docs/04-component-lifecycle.md`
6. `docs/05-configuration-state.md`
7. `docs/06-rendering-dom.md`
8. `docs/07-events-actions.md`
9. `docs/08-http-ajax.md`
10. `docs/09-ci4-integration.md`
11. `docs/10-security.md`
12. `docs/11-testing.md`
13. `docs/12-accessibility.md`
14. `docs/13-performance.md`
15. `docs/14-build-packaging.md`
16. `docs/15-reference-components.md`
17. `docs/16-implementation-plan.md`
18. `docs/17-acceptance-criteria.md`
19. `docs/18-maintenance-versioning.md`
20. ADRs in `adrs/`

## Deliverable target

The first stable release should contain only a compact core plus a small reference component set. A target of roughly **500–1,500 lines for the core runtime** is healthy. Component implementations, tests, examples, and documentation are not counted in that number.

The core should remain small enough that a competent developer can understand the full runtime in one focused review.
