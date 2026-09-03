# `<vui-component-name>` — Component Specification

## Purpose

Describe one clear responsibility.

## Rendering mode

- [ ] Server-rendered enhancement
- [ ] Client-owned
- [ ] Hybrid

DOM mode: **Light DOM** unless an ADR/justification below says otherwise.

## Attributes

| Attribute | Type | Default | Observed? | Description |
|---|---|---|---:|---|

## Properties

| Property | Type | Default | Reflected? | Description |
|---|---|---|---:|---|

## Methods

### `methodName(...)`

Parameters:  
Returns:  
Side effects:  
Errors:

## Events

| Event | Bubbles | Cancelable | Detail | When emitted |
|---|---:|---:|---|---|

## Internal state

List canonical state only.

## DOM contract

Server-owned markup:  
Component-owned markup:  
Stable selectors/data hooks:  
Focus-sensitive elements:

## Internal actions

| `data-action` | Handler | Description |
|---|---|---|

## Async/HTTP behavior

Service:  
Cancellation:  
Loading state:  
Error state:  
Stale response policy:

## Accessibility

Semantics:  
Keyboard:  
Focus:  
ARIA:

## Security

Untrusted inputs:  
Safe rendering method:  
Trusted HTML boundary (if any):

## Lifecycle cleanup

- listeners:
- EventBus subscriptions:
- observers:
- timers:
- requests:

## Tests

- [ ] pre/post definition upgrade
- [ ] connect/disconnect/reconnect
- [ ] no duplicate listeners
- [ ] configuration
- [ ] public events
- [ ] keyboard/focus
- [ ] dynamic insertion
- [ ] error/abort behavior
- [ ] XSS-sensitive data

## Non-goals

Explicitly list behavior this component will not own.
