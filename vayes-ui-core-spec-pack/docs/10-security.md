# 10 — Security Specification

## Threat model

Primary frontend risks include:

- XSS from interpolated server/user data;
- unsafe dynamic handler execution;
- CSRF failures;
- accidental credential/token exposure;
- HTML fragment trust confusion;
- URL injection;
- unsafe file handling;
- authorization assumptions in JavaScript.

## XSS rules

### Untrusted text

Use:

```js
node.textContent = value;
input.value = value;
node.setAttribute('title', value);
```

Do not use:

```js
node.innerHTML = `<span>${untrusted}</span>`;
```

### Trusted static component templates

Static template strings are allowed when values are not interpolated from untrusted sources.

### Trusted server fragments

HTML fragments returned from first-party CI4 endpoints may be treated as server-rendered application HTML only when the endpoint applies normal output escaping and the caller expects HTML.

The fragment insertion layer must not execute embedded scripts.

### Sanitization

Do not create a home-grown HTML sanitizer. If rich untrusted HTML becomes a requirement, introduce a dedicated, audited sanitizer through an ADR.

## No executable strings

Forbidden:

- `eval`;
- `new Function`;
- `setTimeout(string)`;
- `setInterval(string)`;
- resolving arbitrary handler paths from `window`;
- injecting event handler attributes from data.

Optional declarative actions resolve only pre-registered identifiers.

## CSP compatibility

The architecture should be compatible with a strict Content Security Policy:

- external/module scripts;
- no required inline executable scripts;
- no eval;
- no required inline `onclick` handlers.

Boot data may use non-executable JSON script blocks or meta tags.

## CSRF

Unsafe same-origin requests must apply the configured CI4 CSRF contract. Frontend disabling or bypassing CSRF for convenience is forbidden.

## Authorization

A hidden/disabled frontend control is not authorization. Every protected operation is re-authorized server-side.

## URLs

Dynamic URLs must be created with `URL`/`URLSearchParams` where appropriate rather than manual string concatenation.

Do not allow untrusted values to select arbitrary schemes for navigation/resource loading without validation.

## File uploads

Client checks for extension/size/type are UX only. Server performs authoritative validation, storage policy and malware/security controls.

Use `FormData`; do not base64-encode ordinary uploads without a concrete protocol requirement.

## Secrets

Never place in frontend configuration:

- database credentials;
- private API keys;
- signing secrets;
- privileged service tokens.

Any credential available to browser JavaScript must be assumed visible to the user.

## Error exposure

Production UI must not dump stack traces, SQL, internal filesystem paths or sensitive exception messages.

Where available, expose a correlation/request ID that support can use to find server-side details.

## Dependency security

The production runtime targets zero third-party JS dependencies. Development tooling should be pinned with lockfiles and updated deliberately.

## Security acceptance tests

At minimum:

- dynamic user text renders as text, not HTML;
- malicious strings cannot invoke ActionRegistry functions unless exact registered key matches;
- AJAX fragments do not execute returned `<script>` content;
- CSRF-protected calls fail without valid token and succeed with adapter;
- forbidden server action remains forbidden even if UI is manipulated;
- URLs reject/normalize invalid schemes where relevant.
