/**
 * @file Application entry point for the demo/host application.
 *
 * Two responsibilities only:
 *
 * 1. import the component modules that should exist on this page — importing a
 *    module registers its custom element, and every matching element in the
 *    document upgrades automatically, including elements that arrive later in
 *    an AJAX fragment (ADR-007);
 * 2. wire application-level services and subscribers.
 *
 * There is no `initWidgets()` pass, no DOM scan and no ready handler that walks
 * the tree looking for things to activate.
 */

import { events } from './core/EventBus.js';
import { replaceFragment } from './core/fragments.js';
import { createCodeIgniterClient } from './ci4/index.js';
import { CustomerService } from './services/CustomerService.js';

import './components/common/Counter.js';
import './components/common/Tabs.js';
import './components/common/Modal.js';
import './components/customer/CustomerSelector.js';

const { http, csrf, config } = createCodeIgniterClient();

/**
 * The single place the application exposes its services to page-level scripts.
 * One namespace, explicitly assigned — not dozens of implicit globals
 * (docs/09-ci4-integration.md).
 */
const app = {
    config,
    http,
    csrf,
    events,
    replaceFragment,
    customers: new CustomerService(http, {
        endpoint: /** @type {string} */ (
            config.extra.customerSearchEndpoint ?? '/api/customers/search'
        ),
    }),
};

globalThis.VayesApp = app;

// Components created from markup cannot receive a rich property from the
// server, so the application injects the configured service as elements appear.
// `customElements.whenDefined` guarantees the accessor exists before assignment.
customElements.whenDefined('vui-customer-selector').then(() => {
    for (const element of document.querySelectorAll('vui-customer-selector')) {
        /** @type {{ service?: CustomerService }} */ (element).service = app.customers;
    }
});

export default app;
