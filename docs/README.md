# Documentation

Start wherever matches what you are doing.

## Learning it

| Document                                   | Read it when                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| [installation.md](installation.md)         | You are installing it. Three routes, with a verification checklist.                |
| [concepts.md](concepts.md)                 | You want the mental model before touching code. Six ideas, and what each replaces. |
| [getting-started.md](getting-started.md)   | You want a working component in a new or empty project in about ten minutes.       |
| [existing-project.md](existing-project.md) | You have a CodeIgniter application already and want to adopt this incrementally.   |

## Building with it

| Document                                           | Read it when                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [authoring-components.md](authoring-components.md) | You are creating a component: the procedure, rules and test matrix.      |
| [ai-prompts.md](ai-prompts.md)                     | You are building components with a coding agent.                         |
| [recipes.md](recipes.md)                           | You have a specific task: a form, a filtered list, a confirm dialog.     |
| [core-api.md](core-api.md)                         | You need the exact signature, option or event contract.                  |
| [ci4-integration.md](ci4-integration.md)           | You are wiring boot config, CSRF, fragments or validation on the server. |

## Reference

| Document                                                           | Contents                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [components/](components/)                                         | One full specification per reference component.                   |
| [../examples/component-template/](../examples/component-template/) | A working component to copy and rename.                           |
| [../examples/dashboard/](../examples/dashboard/)                   | Tailwind admin kit — patterns and components to copy.             |
| [troubleshooting.md](troubleshooting.md)                           | Symptom → cause → fix for the failure modes people actually hit.  |
| [testing.md](testing.md)                                           | Test layers, what belongs in each, and why three browser engines. |
| [acceptance-criteria.md](acceptance-criteria.md)                   | Every specification criterion mapped to the test that backs it.   |
| [../AGENTS.md](../AGENTS.md)                                       | Rules for changing this repository.                               |
| `../vayes-ui-core-spec-pack/`                                      | The authoritative architecture specification and ADRs.            |

## The short version

Components are native Custom Elements. They configure themselves from attributes
and properties, update the DOM through explicit methods, announce changes with
bubbling `CustomEvent`s, and clean themselves up through one `AbortSignal` per
mount cycle. HTTP goes through a shared client that knows nothing about UI.
CodeIgniter stays in charge of everything that matters.

There is no virtual DOM, no reactivity, no hooks, no router, no global store and
no runtime dependency. If you already know the DOM, you already know most of
this.
