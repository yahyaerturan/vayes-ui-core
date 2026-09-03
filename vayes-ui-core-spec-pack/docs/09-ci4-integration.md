# 09 — CodeIgniter 4 Integration

## Principle

CodeIgniter remains the application host and authority. The frontend core is an interaction layer, not a second application server.

## Recommended server responsibilities

CI4 owns:

- routing;
- authentication/session;
- authorization;
- business/domain rules;
- validation;
- persistence;
- localization source data;
- server-rendered pages/fragments;
- canonical error semantics;
- CSRF configuration;
- audit/activity logs.

## Request detection

HttpClient sends:

```http
X-Requested-With: XMLHttpRequest
```

This allows CI4 AJAX-aware request handling where desired.

Do not make endpoint correctness depend solely on this header. It is a rendering/content-negotiation hint, not authorization.

## Endpoint patterns

### Page route

```text
GET /customers
```

Returns full layout + server content.

### Fragment route

```text
GET /customers/table?...filters
```

Returns a trusted HTML fragment intended for insertion into a known application region.

### JSON route

```text
GET /api/customers/search?q=...
```

Returns structured JSON for a client-rendered component.

A project may combine page and fragment behavior behind one route using explicit negotiation, but avoid opaque controller branches that become hard to test.

## Controller discipline

Controllers should remain thin:

```text
request -> validate -> authorize -> service -> response/view
```

Frontend components must not cause business logic to migrate into controllers or JavaScript.

## Server-rendered component markup

Plain view usage is preferred:

```php
<vui-customer-card
    customer-id="<?= esc($customer->uuid, 'attr') ?>"
>
    <h3><?= esc($customer->name) ?></h3>
</vui-customer-card>
```

An optional helper for attribute serialization may be introduced only if it demonstrably prevents repetitive escaping/boolean handling. It must remain transparent and testable.

## Boot configuration

Application-level configuration needed by JavaScript should be rendered once, explicitly.

Recommended pattern:

```html
<meta name="app-base-url" content="...">
<meta name="csrf-header" content="...">
<meta name="csrf-token" content="...">
<meta name="locale" content="en">
```

or a non-executable JSON block:

```html
<script type="application/json" id="app-config">{...}</script>
```

If JSON is used, it must be encoded safely for HTML context.

Do not create dozens of implicit global JS variables.

## Localization

Server-rendered text uses CI4 localization normally.

Client-owned components requiring translated strings should receive a small explicit dictionary or translation service containing only necessary keys.

Avoid shipping the entire application language catalogue to every page.

Example property:

```js
modal.labels = {
    close: 'Close',
    cancel: 'Cancel',
};
```

or boot-time scoped catalog.

## Validation

Client validation is UX assistance. Server validation is authoritative.

Server validation response should identify fields predictably, for example:

```json
{
    "message": "Validation failed",
    "errors": {
        "email": ["The email field is required."]
    }
}
```

The exact JSON schema should be standardized per application/API layer and tested end-to-end.

For server-rendered fragments, server may return the form with errors instead.

## Authentication

For same-origin CI4 applications, prefer normal secure session cookies rather than adding token authentication just because JavaScript uses `fetch`.

Do not expose session secrets to JavaScript.

## CSRF

The integration adapter must match the actual CI4 security configuration. Test:

- initial unsafe request;
- second unsafe request after token regeneration if enabled;
- expired/invalid token path;
- form and JSON request variants if both are supported.

## Activity logging

Meaningful domain actions should be logged server-side with authenticated actor, target entity, result and request/correlation ID where available. Frontend event logs are diagnostics, not authoritative audit logs.

## Error rendering

Map HTTP errors at the application/component layer:

- validation → field errors;
- unauthorized → login/session handling;
- forbidden → permission message;
- not found → contextual empty/error state;
- conflict → explicit stale/conflict UI;
- server error → generic UI + request ID for support.

The HTTP client itself must not decide the message language or UI component.

## Test application

The spec implementation should include a minimal CI4 integration/demo application or test routes demonstrating:

1. server-rendered enhancement component;
2. JSON-driven component;
3. AJAX HTML fragment containing Custom Elements;
4. CSRF-protected POST;
5. validation error display;
6. component event observed by another component;
7. disconnect/reconnect behavior.
