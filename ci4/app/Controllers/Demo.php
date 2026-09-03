<?php

declare(strict_types=1);

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * Demo pages and session helpers for the integration test suite.
 */
class Demo extends BaseController
{
    /**
     * The full page: layout, boot configuration and server-rendered components.
     */
    public function index(): string
    {
        return view('demo', [
            'customers' => model('CustomerModel')->orderBy('name')->findAll(5),
        ]);
    }

    /**
     * Liveness probe used by the Playwright web-server wait condition.
     */
    public function health(): ResponseInterface
    {
        return $this->response->setJSON(['status' => 'ok']);
    }

    /**
     * Grants a role for the authorisation demo. Authority lives on the server:
     * the browser cannot award itself a role by editing the DOM.
     */
    public function login(): ResponseInterface
    {
        $role = $this->request->getGet('role') === 'admin' ? 'admin' : 'viewer';
        session()->set('role', $role);

        return $this->response->setJSON(['role' => $role]);
    }

    public function logout(): ResponseInterface
    {
        session()->remove('role');

        return $this->response->setJSON(['role' => null]);
    }
}
