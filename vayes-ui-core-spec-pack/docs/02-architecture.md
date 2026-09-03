# 02 — Architecture

## High-level architecture

```text
CodeIgniter 4
│
├── Routes / Filters
├── Controllers
├── Services / Domain
├── Validation / Authorization
├── Models / Repositories
└── Views / HTML fragments
        │
        ▼
Browser DOM
│
├── Custom Elements
│   ├── Component lifecycle
│   ├── local state
│   ├── explicit DOM updates
│   └── component CustomEvents
│
├── EventBus (only for non-DOM application events)
│
├── HttpClient
│   ├── fetch
│   ├── CSRF policy
│   ├── JSON / text / HTML handling
│   ├── timeout / abort
│   └── normalized transport errors
│
└── Application subscribers/services
```

## Layer responsibilities

### Core runtime

The core runtime may contain:

- `Component`
- `EventBus`
- `HttpClient`
- `HttpError`
- `ActionRegistry` (optional, narrowly scoped)
- small DOM/type helpers only when repeated use justifies them
- component registration helpers

It must not contain application-specific components or endpoints.

### Reusable UI components

Examples:

- modal
- tabs
- dropdown/menu
- toast/notification host
- confirm dialog
- async button
- optional autocomplete/select

Components have their own styles/markup behavior but consume only core contracts.

### Application components

Examples:

- customer selector
- invoice totals
- media picker
- user permissions editor

Application components can depend on application services and data contracts. They should still follow the same lifecycle/event conventions.

### Application services

Services coordinate HTTP/domain-facing calls:

```text
CustomerSelector -> CustomerService -> HttpClient -> CI4 endpoint
```

The component should not have to know CSRF, response headers, error normalization or request instrumentation.

## Folder structure

Recommended source structure:

```text
resources/
└── js/
    ├── core/
    │   ├── Component.js
    │   ├── EventBus.js
    │   ├── HttpClient.js
    │   ├── HttpError.js
    │   ├── ActionRegistry.js
    │   ├── register.js
    │   └── index.js
    │
    ├── components/
    │   ├── common/
    │   │   ├── Modal.js
    │   │   ├── Tabs.js
    │   │   └── AsyncButton.js
    │   └── customer/
    │       └── CustomerSelector.js
    │
    ├── services/
    │   ├── CustomerService.js
    │   └── InvoiceService.js
    │
    ├── actions/
    │   └── invoiceActions.js
    │
    └── app.js
```

Recommended tests:

```text
tests/
├── unit/
├── browser/
├── integration/
└── fixtures/
```

## Dependency direction

Allowed:

```text
Application Component
    ↓
Application Service
    ↓
Core HttpClient
```

Allowed:

```text
Reusable Component
    ↓
Core Component
```

Not allowed:

```text
Core Component
    ↓
Application Component
```

Not allowed:

```text
HttpClient
    ↓
Modal / Toast / UI component
```

Transport errors may emit an application-neutral event or throw an error. Presentation decisions belong above the transport layer.

## Runtime initialization

The application entry module imports definitions:

```js
import './components/common/Modal.js';
import './components/common/Tabs.js';
import './components/customer/CustomerSelector.js';
```

When the module defining a custom element is evaluated:

```js
if (!customElements.get('vui-customer-selector')) {
    customElements.define('vui-customer-selector', CustomerSelector);
}
```

No DOM-ready initialization loop is required for Custom Elements. Existing matching elements upgrade when registered; subsequently inserted elements initialize automatically when connected.

## Multiple rendering modes

### Server-first enhancement

```html
<vui-customer-card customer-id="...">
    <h3>Server rendered name</h3>
    <button data-action="edit">Edit</button>
</vui-customer-card>
```

JS attaches behavior while preserving meaningful server markup.

### Client-owned markup

```html
<vui-modal></vui-modal>
```

The component creates its internal light DOM on first connection.

### JavaScript-created component

```js
const el = document.createElement('vui-customer-card');
el.customer = customer;
container.append(el);
```

### AJAX fragment

CI4 returns:

```html
<vui-customer-card customer-id="..."></vui-customer-card>
```

The client inserts it. The native custom-element lifecycle performs initialization.

## Architectural boundary test

Before adding a core abstraction, ask:

1. Is this behavior available directly through a stable browser primitive?
2. Does wrapping it create a consistent policy used in multiple places?
3. Can the wrapper remain understandable in one file?
4. Does the abstraction hide important control flow?
5. Does it move business logic into the frontend?

If answers 2–3 are weak or 4–5 are true, do not add the abstraction.
