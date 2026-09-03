<?php
/**
 * Server-rendered HTML fragment (ADR-009).
 *
 * Two things make this safe to hand to `replaceFragment()`:
 * every dynamic value passes through `esc()`, and the endpoint contains no
 * `<script>` — the client-side parser would strip one anyway.
 *
 * The fragment contains further custom elements. They initialise through the
 * native lifecycle when inserted; nothing scans the DOM for them.
 *
 * @var list<array<string, mixed>> $customers
 * @var string                     $query
 */
?>
<table class="customer-table" data-fragment-query="<?= esc($query, 'attr') ?>">
    <caption>Customers (<?= count($customers) ?>)</caption>
    <thead>
        <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Priority</th>
        </tr>
    </thead>
    <tbody>
        <?php foreach ($customers as $customer): ?>
            <tr data-customer-id="<?= esc((string) $customer['id'], 'attr') ?>">
                <td class="customer-name"><?= esc($customer['name']) ?></td>
                <td><?= esc($customer['email']) ?></td>
                <td>
                    <?php /* A custom element inside an AJAX fragment. */ ?>
                    <vui-counter value="0" step="1"></vui-counter>
                </td>
            </tr>
        <?php endforeach ?>
    </tbody>
</table>
