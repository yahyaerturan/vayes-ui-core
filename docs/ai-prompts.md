# Prompts for building components with an AI agent

This repository was specified for coding agents — `AGENTS.md` and the spec pack
exist for exactly that. These prompts are tuned to produce components that pass
the gates on the first or second attempt, instead of ones you have to argue with.

---

## Give the agent the right context first

Attach these, in this order. Without them the agent will write a perfectly good
React-shaped component that violates six rules.

| File                                              | Why it matters                                           |
| ------------------------------------------------- | -------------------------------------------------------- |
| `AGENTS.md`                                       | The hard constraints and the rules that catch people out |
| `docs/authoring-components.md`                    | The procedure and the test matrix                        |
| `examples/component-template/CharacterCounter.js` | A working component to imitate                           |
| `tests/browser/example-template.spec.js`          | The test shape expected                                  |
| One existing component close to yours             | Concrete house style                                     |

> **The single highest-leverage instruction** is "follow the patterns in
> `examples/component-template/CharacterCounter.js`". Agents imitate a concrete
> example far more reliably than they follow a list of rules.

---

## What agents get wrong here, specifically

Not general bugs — these are the mistakes that recur in _this_ architecture,
because they contradict habits learned from framework code. Naming them in the
prompt prevents most of them.

| Mistake                                     | Why it happens                              | What to say                                                                                                         |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `render()` appends a duplicate on reconnect | Framework components mount once             | "`render()` must recover its previous output by querying the DOM; test that reconnecting does not duplicate markup" |
| Listeners without `{ signal: this.signal }` | `useEffect` cleanup has no equivalent habit | "Every listener must take `{ signal: this.signal }`"                                                                |
| Missing `static properties`                 | No framework equivalent                     | "Declare public properties in `static properties`"                                                                  |
| Rebuilding the subtree on state change      | Re-render is the default mental model       | "Update the smallest affected node; never rebuild"                                                                  |
| Treating an abort as an error               | `catch` catches everything                  | "A cancelled request is not a failure — check `isAbortError()` first"                                               |
| `innerHTML` with interpolated data          | Ubiquitous elsewhere                        | "Untrusted values go through `textContent`"                                                                         |
| Inventing a `label` attribute               | Seems friendlier than ARIA                  | "Forward the host's `aria-label`/`aria-labelledby` to the internal control"                                         |
| Adding a dependency                         | Reflex                                      | "Zero runtime dependencies. No exceptions without an ADR"                                                           |

---

## Prompt 1 — A new component

Fill in the bracketed parts and delete what does not apply.

```text
Create a component for Vayes UI Core.

CONTEXT
Read AGENTS.md and docs/authoring-components.md first. Follow the patterns in
examples/component-template/CharacterCounter.js — same structure, same comment
style, same rigour.

WHAT IT DOES
[One sentence. If it takes two, it is probably two components.]

CONTRACT
- Tag: [app-thing]
- Ownership mode: [enhancement | client-owned | hybrid]
- Attributes: [name (type, default, observed?), …]
- Properties: [name (type, default), …]
- Methods: [name(args) → returns, …]
- Events: [name — when, bubbles?, cancelable?, detail shape]
- Keyboard: [key → behaviour, …]
- Non-goals: [what it must never do]

CONSTRAINTS — non-negotiable
- Zero runtime dependencies. Native DOM APIs only.
- Every listener takes { signal: this.signal }. Never bind in the constructor.
- render() is idempotent: recover previous output by querying the DOM, because
  unmount() clears cached references and it runs again on every reconnect.
- Declare public properties in `static properties`.
- Update the smallest affected node. Never rebuild a subtree.
- Untrusted values go through textContent, never innerHTML.
- Dispose timers, observers and in-flight requests in unmount().
- No Tailwind or framework classes in the component: toggle semantic state
  (hidden, aria-*, data-state) and leave styling to CSS.

DELIVERABLES
1. The component, with JSDoc on every public member.
2. A Playwright browser test covering the matrix in docs/authoring-components.md,
   including: reconnect without duplicated markup, reconnect without duplicated
   listeners, property assigned before definition, public event detail,
   keyboard, and XSS-sensitive rendering.
3. A specification in docs/components/, following COMPONENT_SPEC_TEMPLATE.md.

Then run: npm run arch:check && npm run lint && npm run test:browser
Fix what fails. Do not weaken a test to make it pass.
```

### Worked example

```text
Create a component for Vayes UI Core.

CONTEXT
Read AGENTS.md and docs/authoring-components.md first. Follow the patterns in
examples/component-template/CharacterCounter.js.

WHAT IT DOES
A file drop zone that accepts drag-and-drop or a file picker and lists the
selected files before upload.

CONTRACT
- Tag: app-file-drop
- Ownership mode: hybrid — server renders the <input type="file">, the component
  adds the drop target and the file list
- Attributes: accept (string, none, not observed), max-files (number, 5, observed),
  disabled (boolean, absent, observed)
- Properties: files (File[], read-only)
- Methods: clear() → void
- Events: files:selected — after files are added; bubbles; detail { files, count }
          files:rejected — when a file fails a client check; detail { file, reason }
- Keyboard: the native <input> handles activation; the drop zone is not a
  separate tab stop
- Non-goals: no upload, no progress, no image preview, no chunking

CONSTRAINTS — non-negotiable
[…as above…]

DELIVERABLES
[…as above…]

ALSO
- Client-side checks are UX only; say so in the spec. The server re-validates.
- Show file names with textContent — a filename is untrusted input.
- Remove drag listeners on disconnect; a drop zone that outlives its component
  is a real bug.
```

---

## Prompt 2 — A complex async component

For anything that talks to the server. The extra paragraphs exist because
cancellation is where agents reliably go wrong.

```text
Create an async component for Vayes UI Core.

CONTEXT
Read AGENTS.md, docs/authoring-components.md, and study
resources/js/components/customer/CustomerSelector.js — it is the reference for
async behaviour. Match its approach exactly.

WHAT IT DOES
[One sentence.]

CONTRACT
[…as in Prompt 1…]
- Service: injected via a `service` property; falls back to a default built from
  an `endpoint` attribute
- States: idle | loading | results | empty | error, exposed as data-state

ASYNC RULES — these are where this goes wrong
- Abort the previous request before starting a new one.
- ALSO carry a monotonic request token and discard responses whose token is
  stale. The abort alone is not sufficient: a request can be aborted after the
  server has already replied, and the stale response can still win the race.
- A cancelled request is NOT an error. Check isAbortError(error) and return
  silently, or every superseded keystroke flashes an error state.
- Never call fetch directly. Go through the service, which goes through
  HttpClient.
- Set aria-busy while loading and announce state in a role="status" region.
- Abort the in-flight request and clear any debounce timer in unmount().

TESTS — must include
- A slow first request superseded by a fast second: assert the stale result
  never renders.
- Cancellation does not produce the error state.
- The server error path sets the error state and does not leak the server's
  message into the UI.
- Disconnecting mid-flight leaves nothing behind.

Stub the network with page.route() so the whole path — component, service,
HttpClient, fetch — actually runs.
```

---

## Prompt 3 — Convert existing code

```text
Convert this to a Vayes UI Core component.

CURRENT CODE
[paste]

CURRENT MARKUP
[paste]

CONTEXT
Read AGENTS.md and docs/existing-project.md. This is an enhancement component:
the server owns the markup and it must keep working unchanged.

REQUIREMENTS
- Keep the existing HTML. Do not restructure it, do not rename classes.
- Delete every re-initialisation call this replaces — that deletion is the point
  of the conversion, not a side effect.
- Anything the old code called directly becomes an emitted CustomEvent. List the
  events you introduce and what previously called what.
- Preserve current behaviour exactly, including quirks. Note any you believe are
  bugs; do not fix them in the same change.

DELIVERABLES
1. The component.
2. A browser test proving parity, plus reconnect safety the old code lacked.
3. A short note on what a caller must change.
```

---

## Prompt 4 — Review a component

Useful on anything an agent wrote, including its own work in a fresh session.

```text
Review this component against the Vayes UI Core rules.

Read AGENTS.md and docs/authoring-components.md, then check specifically:

1. Does render() append a duplicate if the element is disconnected and
   reconnected? Prove it with a test rather than reasoning about it.
2. Is every listener bound with { signal: this.signal }?
3. Are timers, observers and in-flight requests disposed in unmount()?
4. Are public properties declared in `static properties`?
5. Does any state change rebuild a subtree instead of updating one node?
6. Does untrusted data reach innerHTML?
7. If it wraps a control, does it have an accessible name — and is that name
   something other than the placeholder?
8. Are aborts distinguished from errors?
9. Which rows of the test matrix are missing?

For each finding: the file and line, why it is wrong, and the smallest fix.
Do not rewrite the component. Report first.
```

---

## Prompt 5 — Debug a lifecycle problem

```text
Debug this in a Vayes UI Core component.

SYMPTOM
[what you see]

REPRODUCTION
[steps]

Read docs/troubleshooting.md first — the common causes are listed there with
their diagnostics.

Work in this order:
1. Reproduce it in a failing browser test. Do not propose a fix before the test
   fails for the right reason.
2. Identify the root cause. "Handler fires twice" is a symptom; a listener bound
   without the lifecycle signal is a cause.
3. Fix the cause.
4. Verify by reverting the fix and confirming the test fails again.

Report the root cause, the fix, and the evidence from step 4.
```

---

## Prompt 6 — A Tailwind pattern for the admin kit

```text
Add a pattern to the admin kit in examples/dashboard/.

WHAT IT IS
[e.g. a filter bar with a search field, two selects and a clear button]

RULES
- If it has no behaviour, it is markup and classes only — no custom element.
  A card is a <div>, not a component.
- If it does need behaviour, put the behaviour in a kit- component with NO
  Tailwind classes in the JavaScript: toggle hidden, aria-*, data-state, and
  leave styling to kit.css.
- Reuse the existing utilities (kit-card, kit-button-primary, kit-input,
  kit-label, kit-badge-*) before adding new ones.
- Shared primitives go in @utility, not @layer components — in Tailwind v4
  @apply resolves utilities only.
- Every colour needs a dark: variant, and both must pass WCAG AA contrast.

AFTER
- npm run kit:css
- Add the state to the enumerated audit table in tests/browser/kit.spec.js if it
  introduces a new overlay.
- npx playwright test tests/browser/kit.spec.js
```

---

## Getting better results

**Ask for the test first.** "Write a failing browser test for X, then make it
pass" produces markedly better components than asking for the component alone.
It also stops the agent asserting that something works.

**Make it run the gates.** End with `npm run arch:check && npm run lint &&
npm run test:browser`. An agent that has seen its own failure fixes the real
problem; one that has not will describe the code it hoped it wrote.

**Reject "I weakened the test."** If an agent loosens an assertion to get green,
the component is wrong. `AGENTS.md` says this explicitly: fix the implementation,
not the test.

**One component per session.** These are small. An agent asked for four at once
produces four mediocre ones and no tests.

**Push back on new core APIs.** Agents like adding helpers to the base class. The
rule is two call sites before anything reaches the core.

### Verify these four things yourself

An agent will tell you it did them. Check:

```bash
npm run arch:check     # layer boundaries, HTML sinks, dynamic globals
npm run lint
npm run test:browser   # all three engines
git diff --stat        # did it touch resources/js/core/ ? it probably should not
```

Then read the test file. Tests that assert what the code does, rather than what
the contract requires, are the most common way this goes quietly wrong.
