# 15 — Reference Components

The first implementation should include a small set of reference components chosen to prove the architecture, not to create a full design system.

## R1. `<vui-counter>` — lifecycle/event smoke test

Proves local state, incremental DOM updates, `data-action` delegation, emitted events and reconnect safety.

## R2. `<vui-tabs>` — server-rendered enhancement

Requirements:

- consumes server-provided tab/panel markup;
- does not rebuild the initial DOM unnecessarily;
- keyboard support;
- selected tab through documented attribute/property;
- emits `tab:changed`;
- works when inserted dynamically.

## R3. `<vui-modal>` — client-owned UI and global interactions

Requirements:

- explicit `open()`/`close()`;
- cancelable `modal:before-close`;
- `modal:opened` / `modal:closed`;
- Escape and focus behavior;
- focus returns to invoker when appropriate;
- lifecycle-clean document listeners;
- evaluate native `<dialog>` before recreating dialog semantics.

## R4. `<vui-customer-selector>` — async component

Requirements:

- query input;
- configurable endpoint and minimum query length;
- aborts stale requests;
- loading/empty/error states;
- uses `CustomerService` → `HttpClient` rather than ad-hoc fetch;
- renders untrusted names with safe DOM APIs;
- emits `customer:selected` with documented detail;
- accepts initial selected customer through property;
- property-before-upgrade test.

## R5. AJAX fragment example

A CI4 route returns a fragment containing multiple registered custom elements. The client inserts it without any manual initialization scan. This proves the central dynamic-DOM requirement.

## Do not start with a DataTable

A feature-rich table can hide core flaws behind sorting, filtering, virtualization, selection and accessibility complexity. Build it only after lifecycle/event/http patterns are stable.
