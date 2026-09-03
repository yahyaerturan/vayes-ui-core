<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $now = date('Y-m-d H:i:s');

        $rows = [
            ['name' => 'Ada Lovelace', 'email' => 'ada@example.test'],
            ['name' => 'Alan Turing', 'email' => 'alan@example.test'],
            ['name' => 'Grace Hopper', 'email' => 'grace@example.test'],
            ['name' => 'Katherine Johnson', 'email' => 'katherine@example.test'],
            ['name' => 'Barbara Liskov', 'email' => 'barbara@example.test'],
            ['name' => 'Radia Perlman', 'email' => 'radia@example.test'],
            // A deliberately hostile record. Every rendering path in the demo
            // and the tests must display this as text, never as markup
            // (docs/10-security.md).
            ['name' => '<img src=x onerror="window.__xss=1">', 'email' => 'xss@example.test'],
        ];

        foreach ($rows as $row) {
            $this->db->table('customers')->insert($row + [
                'archived'   => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
