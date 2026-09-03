<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

/**
 * Customers used by the reference components.
 */
class CustomerModel extends Model
{
    protected $table         = 'customers';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $allowedFields = ['name', 'email', 'archived'];

    /**
     * Canonical validation rules. They live on the model so the JSON endpoint
     * and any future form post share one definition (ADR-006).
     *
     * @var array<string, string>
     */
    protected $validationRules = [
        'name'  => 'required|min_length[2]|max_length[120]',
        'email' => 'required|valid_email|is_unique[customers.email,id,{id}]',
    ];

    /**
     * @param string $query
     * @param int    $limit
     *
     * @return list<array<string, mixed>>
     */
    public function search(string $query, int $limit): array
    {
        return $this->select('id, name, email')
            ->where('archived', 0)
            ->groupStart()
            ->like('name', $query)
            ->orLike('email', $query)
            ->groupEnd()
            ->orderBy('name')
            ->findAll($limit);
    }
}
