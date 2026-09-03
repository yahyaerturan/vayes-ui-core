# 20 — Forms and Validation

## Default strategy

Prefer ordinary HTML forms and native controls. Custom Elements should enhance form UX, not replace the browser form model without a concrete requirement.

## Server authority

CodeIgniter validation remains canonical. Client rules improve feedback latency only.

The same operation must remain safe/correct if client-side validation is bypassed.

## Native form integration

A component that wraps ordinary form controls should, where practical, keep real `<input>`, `<select>`, `<textarea>` elements in Light DOM so normal form submission, labels, autofill and browser behavior continue to work.

Example:

```html
<vui-money-input>
    <input type="text" name="amount" inputmode="decimal">
</vui-money-input>
```

The custom element enhances formatting/behavior while the native field remains the submitted control.

## Form-associated Custom Elements

`ElementInternals` / `formAssociated` may be used for components that truly need to behave as standalone form controls.

This is **advanced/opt-in**, because it introduces more browser, validation and accessibility obligations.

Before using it, document and test:

- submitted form value;
- reset behavior;
- disabled state;
- constraint validation;
- label association;
- autofill expectations;
- browser support baseline.

## Validation response contract

For JSON-based forms, standardize one application schema, for example:

```json
{
    "message": "Validation failed",
    "errors": {
        "email": ["The email field is required."],
        "name": ["The name must be at least 2 characters."]
    }
}
```

Do not bake one universal schema into the generic component core; adapt it in the host application/form service.

## Field error rendering

A form component should expose explicit methods such as:

```js
setErrors(errors)
clearErrors()
```

The implementation must associate messages with fields accessibly and must not interpolate untrusted messages through unsafe HTML.

## Submission state

Explicit state methods:

```js
setSubmitting(true)
setSubmitting(false)
```

Expected behavior may include:

- prevent accidental duplicate submission;
- set `aria-busy` where meaningful;
- disable only controls that should be disabled;
- restore state in `finally`.

Do not globally block the page for every request.

## Dirty state

Do not implement a universal reactive dirty-tracking system in core. A form that needs dirty detection should compare explicit initial/current values or use native events in an application-level helper.

## File inputs

Do not clone/recreate file inputs gratuitously. Use `FormData` and server-side validation.

## Tests

For form-related components, test as applicable:

- normal native submission semantics;
- JSON submission flow;
- duplicate-submit prevention;
- server validation mapping;
- focus/announcement of errors;
- reset;
- disabled state;
- disconnect during in-flight submit;
- CSRF-protected submit;
- malicious error/value strings render safely.
