# ADR-006 — CodeIgniter Remains Authoritative

**Status:** Accepted

## Decision

Business rules, authorization, canonical validation and persistence authority remain on the CodeIgniter server.

Client validation is UX only. Hidden/disabled controls are never authorization. Same-origin session cookies remain appropriate for normal CI4 applications.
