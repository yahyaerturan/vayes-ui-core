<?php

declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Correlation id + CSRF token rotation.
 *
 * Two responsibilities that belong at the request boundary
 * (docs/19-observability-errors.md, docs/08-http-ajax.md):
 *
 * 1. accept or mint an `X-Request-Id` and echo it on the response, so a browser
 *    failure can be matched to a server log line;
 * 2. publish the current CSRF hash on the response, which is the agreed channel
 *    the JavaScript provider uses to pick up a rotated token.
 *
 * It also sets a strict Content-Security-Policy. That is not decoration: the
 * architecture claims CSP compatibility (docs/10-security.md), and the only
 * honest way to hold that claim is to run the demo under a policy that would
 * break the moment anything relied on inline script or `eval`.
 */
class RequestId implements FilterInterface
{
    public const HEADER = 'X-Request-Id';

    /**
     * @param list<string>|null $arguments
     */
    public function before(RequestInterface $request, $arguments = null): void
    {
        $incoming = $request->getHeaderLine(self::HEADER);
        $requestId = $incoming !== '' ? $incoming : bin2hex(random_bytes(8));

        // Stashing it on the request makes it available to controllers and to
        // the logger without a global.
        $request->requestId = $requestId;

        log_message('info', 'Request {id}: {method} {uri}', [
            'id'     => $requestId,
            'method' => $request->getMethod(),
            'uri'    => (string) $request->getUri(),
        ]);
    }

    /**
     * @param list<string>|null $arguments
     */
    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
    {
        $response->setHeader(self::HEADER, $request->requestId ?? '');

        // No 'unsafe-inline' and no 'unsafe-eval' anywhere. Boot configuration
        // travels in <meta> tags and an application/json block, neither of
        // which the browser executes.
        $response->setHeader('Content-Security-Policy', implode('; ', [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' data:",
            "connect-src 'self'",
            "base-uri 'none'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
        ]));

        // csrf_hash() returns the token for the *next* request, which is what
        // the client must send after rotation.
        $response->setHeader(csrf_header(), csrf_hash());
    }
}
