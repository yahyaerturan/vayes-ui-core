<?php

declare(strict_types=1);

/**
 * Router script for PHP's built-in web server.
 *
 * `php -S host:port -t public public/rewrite.php` serves existing files
 * directly and routes everything else through the front controller, which is
 * what a production rewrite rule does.
 *
 * `public/assets` is a symlink to the repository's `resources/` directory so
 * the demo loads the component source as native ES modules — the same files the
 * browser test suite loads, with no build step in between. The containment
 * check below therefore validates the *request path*, not the resolved
 * filesystem path, which would follow that symlink out of the document root.
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');

$isTraversal = $uri === ''
    || $uri[0] !== '/'
    || str_contains($uri, '..')
    || str_contains($uri, "\0");

if (! $isTraversal && $uri !== '/' && is_file(__DIR__ . $uri)) {
    return false;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';

require_once __DIR__ . '/index.php';
