<?php

declare(strict_types=1);

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * Thin controller: validate → authorise → delegate → respond
 * (docs/09-ci4-integration.md, "Controller discipline").
 */
class Customers extends BaseController
{
    private const MAX_LIMIT = 50;

    /**
     * JSON search endpoint consumed by `<vui-customer-selector>`.
     */
    public function search(): ResponseInterface
    {
        $query = trim((string) $this->request->getGet('q'));
        $limit = (int) ($this->request->getGet('limit') ?? 20);
        $limit = max(1, min($limit, self::MAX_LIMIT));

        if ($query === '') {
            return $this->response->setJSON(['data' => []]);
        }

        // A slow response is useful for exercising loading and abort behaviour
        // from the browser tests without resorting to network throttling.
        $delay = (int) ($this->request->getGet('delay') ?? 0);

        if ($delay > 0) {
            usleep(min($delay, 2000) * 1000);
        }

        return $this->response->setJSON([
            'data' => model('CustomerModel')->search($query, $limit),
        ]);
    }

    /**
     * Server-rendered HTML fragment. Every dynamic value passes through `esc()`,
     * which is what makes the fragment trustworthy for `replaceFragment()`
     * (ADR-009).
     */
    public function table(): string
    {
        $query = trim((string) $this->request->getGet('q'));

        $customers = $query === ''
            ? model('CustomerModel')->where('archived', 0)->orderBy('name')->findAll(20)
            : model('CustomerModel')->search($query, 20);

        return view('fragments/customer_table', [
            'customers' => $customers,
            'query'     => $query,
        ]);
    }

    /**
     * CSRF-protected write with server-authoritative validation.
     */
    public function create(): ResponseInterface
    {
        // Content negotiation is explicit: `getJSON()` throws on a
        // form-encoded body, and both shapes are supported by design
        // (docs/08-http-ajax.md, "Body handling").
        $data = str_contains($this->request->getHeaderLine('Content-Type'), 'json')
            ? ($this->request->getJSON(true) ?? [])
            : $this->request->getPost();

        if (! model('CustomerModel')->insert($data)) {
            return $this->response
                ->setStatusCode(422)
                ->setJSON([
                    'message' => 'Validation failed',
                    'errors'  => model('CustomerModel')->errors(),
                ]);
        }

        $id = model('CustomerModel')->getInsertID();

        return $this->response
            ->setStatusCode(201)
            ->setJSON([
                'data' => model('CustomerModel')->select('id, name, email')->find($id),
            ]);
    }

    /**
     * Authorisation is re-checked here regardless of what the UI shows. A
     * hidden or disabled button is not a permission (ADR-006).
     */
    public function archive(int $id): ResponseInterface
    {
        if (session('role') !== 'admin') {
            return $this->response
                ->setStatusCode(403)
                ->setJSON(['message' => 'You are not allowed to archive customers.']);
        }

        $customer = model('CustomerModel')->find($id);

        if ($customer === null) {
            return $this->response
                ->setStatusCode(404)
                ->setJSON(['message' => 'Customer not found.']);
        }

        model('CustomerModel')->update($id, ['archived' => 1]);

        return $this->response->setJSON(['data' => ['id' => $id, 'archived' => true]]);
    }
}
