# 08 — HTTP and AJAX

## Goals

Centralize transport behavior without turning the HTTP client into a data framework.

## HttpClient responsibilities

- create `fetch` requests;
- add standard headers;
- handle CSRF adapter integration;
- support request cancellation/timeouts;
- normalize non-2xx responses as `HttpError`;
- expose response parsing helpers;
- optionally surface request IDs for logging;
- remain independent from UI components.

## Default request behavior

Recommended defaults:

```js
{
    method: 'GET',
    credentials: 'same-origin',
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
    },
}
```

Do not add `Content-Type: application/json` to requests without a JSON body; this can change CORS behavior and is semantically wrong.

## Body handling

### JSON

```js
await http.post('/customers', customer, {
    json: true,
});
```

The client may serialize JSON only when explicitly requested or when a dedicated JSON method is used.

### FormData

Pass `FormData` directly and allow the browser to create the multipart boundary. Never manually set `multipart/form-data` content type.

### URLSearchParams

Supported as a native body type.

## Response helpers

### JSON

```js
const data = await http.json('/api/customers');
```

### HTML

```js
const html = await http.html('/customers/fragment');
```

`html()` returns text. DOM insertion remains an explicit caller decision unless a separate helper is created.

### Raw response

`request()` returns the raw successful `Response` for cases needing headers/streams/status details.

## HTTP error semantics

- 4xx/5xx should throw `HttpError`.
- Validation errors remain normal HTTP errors with machine-readable server content.
- Network failures remain native/normalized network errors distinguishable from `HttpError`.
- Abort should remain distinguishable from failure so canceled searches do not show false errors.

## Request cancellation

Search/autocomplete components should abort stale requests:

```js
this.searchController?.abort();
this.searchController = new AbortController();

const results = await http.json(url, {
    signal: this.searchController.signal,
});
```

On component disconnect, the lifecycle signal should also cancel owned requests where practical.

## Timeout

If the core provides timeouts, implement via `AbortController`/`AbortSignal.timeout()` where supported by the chosen browser baseline, with a simple fallback only if necessary.

The client must distinguish a configured timeout from a user/component cancellation when that distinction matters to presentation.

## CSRF adapter contract

Do not hard-code one CodeIgniter CSRF configuration. The application supplies a strategy.

Possible interface:

```js
class CsrfProvider {
    getRequestHeaders(request) { return {}; }
    getRequestBodyFields(request) { return {}; }
    updateFromResponse(response) {}
}
```

A simpler function-based contract is preferred if sufficient.

Recommended first-party CI4 strategy:

- server renders current token metadata in `<meta>` tags or another explicit boot configuration;
- HttpClient adds the configured token/header for unsafe same-origin requests;
- if token regeneration is enabled, update token from an agreed response header or returned boot metadata;
- integration tests verify consecutive unsafe requests.

Exact CI4 names/behavior should be implemented against the project's configured CSRF mode rather than guessed by the generic core.

## Request IDs

If the backend provides a request/correlation ID header, `HttpError` and optional diagnostics should retain it. This creates a trace from browser failure to server logs.

## Retries

Core policy:

- no automatic retry for POST/PUT/PATCH/DELETE;
- optional explicit retry helper for idempotent GET only if a real use case emerges;
- respect abort signals;
- never create hidden exponential retry loops.

## HTML fragment insertion

Use a separate explicit utility, for example:

```js
const html = await http.html('/customers/table');
replaceFragment(container, html);
```

This preserves separation between transport and DOM mutation.

## Loading state

Components own loading presentation:

```js
this.setLoading(true);
try {
    ...
} finally {
    this.setLoading(false);
}
```

The HttpClient must not toggle spinners or global overlays by itself.
