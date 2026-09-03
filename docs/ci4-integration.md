# CodeIgniter 4 integration guide

CodeIgniter is the application. This library is an interaction layer, not a
second application server (ADR-006).

## 1. Render boot configuration once

In your layout `<head>`:

```php
<meta name="app-base-url"    content="<?= esc(base_url(), 'attr') ?>">
<meta name="csrf-header"     content="<?= esc(csrf_header(), 'attr') ?>">
<meta name="csrf-token-name" content="<?= esc(csrf_token(), 'attr') ?>">
<meta name="csrf-token"      content="<?= esc(csrf_hash(), 'attr') ?>">
<meta name="locale"          content="<?= esc(service('request')->getLocale(), 'attr') ?>">

<script type="application/json" id="app-config"><?= json_encode($config,
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
```

`type="application/json"` is never executed by the browser, so the page stays
compatible with a strict CSP. Do not create loose global JavaScript variables.

## 2. Build the client

```js
import { createCodeIgniterClient } from '@vayes/ui-core/ci4';

const { http, csrf, config } = createCodeIgniterClient();
```

That reads the meta tags, builds a `CodeIgniterCsrfProvider` and returns an
`HttpClient` configured for your base URL.

## 3. Publish the rotated CSRF token

With `Config\Security::$regenerate = true` (the CI4 default) the hash changes on
every verified unsafe request. The browser has no way to learn the new value
unless you send it, so publish it from an `after` filter:

```php
public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
{
    $response->setHeader(csrf_header(), csrf_hash());
}
```

`CodeIgniterCsrfProvider.updateFromResponse()` reads that header from **every**
response, so the token survives validation failures too. A readable CSRF cookie
is supported as a fallback via the `csrf-cookie` meta tag.

Set `Config\Security::$redirect = false` for API routes. A 303 to a login page
is unreadable to `fetch`, which follows the redirect and reports a confusing
`200`.

## 4. Correlation ids

Accept or mint a request id in a `before` filter and echo it in `after`:

```php
$response->setHeader('X-Request-Id', $request->requestId);
```

`HttpError.requestId` then carries it, giving support a key that matches the
server log line. See `ci4/app/Filters/RequestId.php`.

## 5. Endpoint patterns

| Pattern                     | Returns               | Consumed by                         |
| --------------------------- | --------------------- | ----------------------------------- |
| `GET /customers`            | full page             | the browser                         |
| `GET /customers/table`      | trusted HTML fragment | `http.html()` + `replaceFragment()` |
| `GET /api/customers/search` | JSON                  | a client-rendered component         |
| `POST /api/customers`       | JSON, CSRF-protected  | an application form handler         |

Enable CSRF for the API surface in `Config\Filters`:

```php
public array $filters = [
    'csrf' => ['before' => ['api/*']],
];
```

The filter only verifies POST/PUT/PATCH/DELETE, so read endpoints are
unaffected.

## 6. HTML fragments

Escape every dynamic value with `esc()` and include no `<script>`. The client
parser strips scripts and inline handlers anyway, but the server is the trust
boundary (ADR-009).

Custom elements inside a fragment initialise through the native lifecycle on
insertion. There is no `initWidgets()` pass, and there must never be one.

## 7. Validation

Server rules are canonical. Return a predictable shape:

```json
{ "message": "Validation failed", "errors": { "email": "…" } }
```

`HttpError.isValidationError` is true for `422`, and for `400` carrying an
`errors` object. Map fields to inputs in application code — the transport layer
must not choose UI copy.

## 8. Authorisation

Re-check permissions in the controller for every protected operation. A hidden
or disabled control in the browser is not a permission; the integration suite
asserts that a forbidden action stays forbidden after the DOM is tampered with.

## 9. Assets

For development, serve `resources/` directly as ES modules — that is what the
demo application does through a `public/assets` symlink, and it keeps one copy
of the source. For production run `npm run build` and read
`public/build/.vite/manifest.json` from a view helper.

## Reference application

`ci4/` contains a working CodeIgniter 4.7 application demonstrating all of the
above, backed by SQLite. Set it up with:

```bash
composer create-project codeigniter4/appstarter ci4   # first time only
npm run ci4:install
npm run ci4:serve
```

It is also the host for `npm run test:integration`.
