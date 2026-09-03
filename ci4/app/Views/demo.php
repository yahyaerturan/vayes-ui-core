<?php
/**
 * Demo page.
 *
 * Demonstrates all four rendering modes from docs/02-architecture.md:
 * server-first enhancement (`<vui-tabs>`), client-owned markup (`<vui-modal>`),
 * a JSON-driven component (`<vui-customer-selector>`), and AJAX-inserted
 * fragments containing further custom elements.
 *
 * @var list<array<string, mixed>> $customers
 */
?>
<!doctype html>
<html lang="<?= esc(service('request')->getLocale(), 'attr') ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Vayes UI Core — CodeIgniter 4 demo</title>

    <?php /* Boot configuration: rendered once, explicitly, never as loose globals. */ ?>
    <meta name="app-base-url" content="<?= esc(base_url(), 'attr') ?>">
    <meta name="csrf-header" content="<?= esc(csrf_header(), 'attr') ?>">
    <meta name="csrf-token-name" content="<?= esc(csrf_token(), 'attr') ?>">
    <meta name="csrf-token" content="<?= esc(csrf_hash(), 'attr') ?>">
    <meta name="locale" content="<?= esc(service('request')->getLocale(), 'attr') ?>">

    <?php /* Non-executable JSON: safe under a strict CSP. */ ?>
    <script type="application/json" id="app-config"><?= json_encode([
        'customerSearchEndpoint' => '/api/customers/search',
        'fragmentEndpoint'       => '/customers/table',
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) ?></script>

    <link rel="stylesheet" href="/assets/css/vayes-ui-core.css">
    <link rel="stylesheet" href="/assets/css/demo.css">
    <script type="module" src="/assets/js/app.js"></script>
</head>
<body>
    <header>
        <h1>Vayes UI Core</h1>
        <p id="role-indicator">Role: <strong data-role><?= esc(session('role') ?? 'anonymous') ?></strong></p>
    </header>

    <main>
        <!-- Mode A: server-rendered enhancement. The tabs already work as
             headings and sections before JavaScript upgrades the element. -->
        <section>
            <h2>Server-rendered enhancement</h2>
            <vui-tabs id="demo-tabs">
                <div role="tablist" aria-label="Customer sections">
                    <button id="tab-list" type="button" role="tab" aria-controls="panel-list">Customers</button>
                    <button id="tab-search" type="button" role="tab" aria-controls="panel-search">Search</button>
                    <button id="tab-counter" type="button" role="tab" aria-controls="panel-counter">Counter</button>
                </div>

                <section id="panel-list" role="tabpanel">
                    <button type="button" id="load-fragment">Load customer table</button>
                    <div id="fragment-target" aria-live="polite"></div>
                </section>

                <section id="panel-search" role="tabpanel">
                    <!-- Mode C: JSON-driven client component. -->
                    <label for="customer-search">Find a customer</label>
                    <vui-customer-selector
                        id="customer-search"
                        endpoint="/api/customers/search"
                        min-query="2"
                        limit="10"
                    ></vui-customer-selector>
                    <p id="selection-output" aria-live="polite"></p>
                </section>

                <section id="panel-counter" role="tabpanel">
                    <!-- Mode B: client-owned markup from an empty element. -->
                    <vui-counter id="demo-counter" value="1" step="1"></vui-counter>
                    <p id="counter-output" aria-live="polite"></p>
                </section>
            </vui-tabs>
        </section>

        <section>
            <h2>Client-owned dialog</h2>
            <button type="button" id="open-modal">Add customer</button>

            <vui-modal id="customer-modal" aria-labelledby="modal-title">
                <h2 id="modal-title">Add customer</h2>
                <form id="customer-form">
                    <p>
                        <label for="new-name">Name</label>
                        <input id="new-name" name="name" type="text" required>
                        <span class="field-error" data-error-for="name" aria-live="polite"></span>
                    </p>
                    <p>
                        <label for="new-email">Email</label>
                        <input id="new-email" name="email" type="email" required>
                        <span class="field-error" data-error-for="email" aria-live="polite"></span>
                    </p>
                    <p>
                        <button type="submit" id="submit-customer">Save</button>
                        <button type="button" data-action="close">Cancel</button>
                    </p>
                    <p id="form-status" role="status" aria-live="polite"></p>
                </form>
            </vui-modal>
        </section>
    </main>

    <script type="module" src="/assets/js/demo.js"></script>
</body>
</html>
