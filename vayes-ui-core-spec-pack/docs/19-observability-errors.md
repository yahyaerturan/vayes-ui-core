# 19 — Error Handling and Observability

## Principle

Failures must remain traceable from the browser to CodeIgniter logs without turning the frontend core into a logging framework.

## Error ownership

### Transport layer

`HttpClient` detects transport/HTTP failures and exposes structured error information. It does not choose UI copy or display notifications.

### Component/application layer

The caller decides whether an error becomes:

- inline field feedback;
- component error state;
- retry affordance;
- application notification;
- authentication/session redirect/flow;
- silent cancellation for superseded requests.

### Server layer

CI4 retains authoritative diagnostics, stack traces in appropriate non-production environments, audit records and request correlation.

## Error taxonomy

Keep these cases distinguishable:

- request intentionally aborted;
- request timeout;
- network failure;
- 4xx HTTP error;
- 5xx HTTP error;
- validation error;
- authorization error;
- conflict/stale-write error;
- component programmer error.

Do not collapse all failures into `Something went wrong` internally, even if the user-facing message is generic.

## Correlation IDs

Where the host application supports a request ID/correlation ID:

1. CI4 generates or accepts it at the request boundary;
2. response includes it in an agreed header;
3. `HttpClient` retains it in `HttpError`;
4. application error UI may show a support/reference ID;
5. server logs include the same ID.

This is the preferred bridge between client symptoms and server diagnostics.

## Frontend diagnostics

Development builds may expose an opt-in diagnostics module that can log:

- component connected/disconnected;
- component public events;
- HTTP request start/end/failure metadata;
- unknown declarative action IDs;
- invalid component configuration.

Diagnostics must:

- be disabled or low-noise in production by default;
- never log secrets/CSRF tokens/passwords;
- never alter control flow;
- remain optional and removable.

## Programmer errors

Invalid required configuration should fail clearly during development rather than silently producing undefined behavior.

Example:

```js
if (!this.endpoint) {
    throw new Error('<vui-customer-selector> requires an endpoint attribute.');
}
```

For recoverable user/data conditions, render an explicit state instead of throwing.

## Global error handling

The core must not install invasive global `window.onerror`/`unhandledrejection` handlers automatically. The host application may install an observability adapter explicitly.

## Audit/activity distinction

Frontend diagnostic events are **not audit logs**. Meaningful business actions must be recorded server-side after authorization and successful/failed domain execution according to the application's audit policy.

## Tests

- request ID survives into `HttpError`;
- abort does not trigger generic failure UI in reference async component;
- server 500 can render generic component error while retaining correlation ID;
- development diagnostics redact configured sensitive fields;
- no global handler is installed merely by importing core modules.
