<?php /** Example only; adapt to host escaping/configuration. */ ?>

<meta name="app-base-url" content="<?= esc(base_url(), 'attr') ?>">
<meta name="csrf-header" content="<?= esc(csrf_header(), 'attr') ?>">
<meta name="csrf-token" content="<?= esc(csrf_hash(), 'attr') ?>">

<vui-tabs>
    <div role="tablist" aria-label="Customer sections">
        <button type="button" role="tab" aria-controls="general-panel">General</button>
        <button type="button" role="tab" aria-controls="billing-panel">Billing</button>
    </div>
    <section id="general-panel" role="tabpanel">...</section>
    <section id="billing-panel" role="tabpanel">...</section>
</vui-tabs>

<vui-customer-selector endpoint="/api/customers/search" min-query="2"></vui-customer-selector>
