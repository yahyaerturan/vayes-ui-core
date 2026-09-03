<?php

declare(strict_types=1);

namespace Config;

use CodeIgniter\Router\RouteCollection;

/**
 * Routes for the Vayes UI Core demo and integration-test application.
 *
 * The set is deliberately small and mirrors docs/09-ci4-integration.md:
 * a page route, an HTML fragment route, JSON read routes, a protected write
 * route, and an authorisation-protected route.
 */

/** @var RouteCollection $routes */
$routes->get('/', 'Demo::index');
$routes->get('health', 'Demo::health');

// Session helpers used by the authorisation tests. A real application would
// use a proper authentication package; the point here is only that the server
// decides, not the UI.
$routes->get('demo/login', 'Demo::login');
$routes->get('demo/logout', 'Demo::logout');

// Server-rendered HTML fragment containing custom elements.
$routes->get('customers/table', 'Customers::table');

// JSON API.
$routes->get('api/customers/search', 'Customers::search');
$routes->post('api/customers', 'Customers::create');
$routes->post('api/customers/(:num)/archive', 'Customers::archive/$1');
