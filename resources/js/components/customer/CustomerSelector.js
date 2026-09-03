/**
 * @file `<vui-customer-selector>` — reference component R4.
 * @see docs/15-reference-components.md
 * @see docs/components/vui-customer-selector.md
 *
 * Proves the async half of the architecture: attribute + rich property
 * configuration, a service dependency instead of ad-hoc `fetch`, stale-request
 * cancellation, distinct loading/empty/error states, keyboard-operable
 * combobox semantics, and untrusted text rendered through `textContent`.
 */

import { Component } from '../../core/Component.js';
import { define } from '../../core/register.js';
import { isAbortError } from '../../core/HttpError.js';
import { CustomerService } from '../../services/CustomerService.js';

/** @typedef {import('../../services/CustomerService.js').Customer} Customer */

let instanceCounter = 0;

/**
 * Searchable customer picker.
 *
 * @element vui-customer-selector
 * @fires vui-customer-selector#customer:selected
 * @fires vui-customer-selector#customer:cleared
 *
 * @example
 * <vui-customer-selector endpoint="/api/customers/search" min-query="2"></vui-customer-selector>
 */
export class CustomerSelector extends Component {
    /** @type {readonly string[]} */
    static properties = Object.freeze(['selected', 'service', 'labels']);

    /** @returns {string[]} */
    static get observedAttributes() {
        return ['disabled', 'placeholder', 'aria-label', 'aria-labelledby'];
    }

    /** @type {Readonly<{ minQuery: number, limit: number, debounce: number }>} */
    static defaults = Object.freeze({ minQuery: 2, limit: 20, debounce: 250 });

    /** @type {Readonly<Record<string, string>>} */
    static labelDefaults = Object.freeze({
        loading: 'Searching…',
        empty: 'No customers found.',
        error: 'Could not load customers.',
        clear: 'Clear selection',
        hint: 'Type to search customers',
    });

    /** Canonical local state. */
    #state = {
        /** @type {Customer|null} */
        selected: null,
        /** @type {Customer[]} */
        results: [],
        /** @type {'idle'|'loading'|'results'|'empty'|'error'} */
        status: 'idle',
        /** @type {number} */
        activeIndex: -1,
        /** @type {boolean} */
        expanded: false,
    };

    /** @type {CustomerService|null} */
    #service = null;

    /** @type {Record<string, string>} */
    #labels = { ...CustomerSelector.labelDefaults };

    /** @type {AbortController|null} */
    #searchController = null;

    /** @type {ReturnType<typeof setTimeout>|null} */
    #debounceTimer = null;

    /**
     * Monotonic request counter. A response whose token is not the latest is
     * discarded, covering the case where an abort lost the race.
     */
    #requestToken = 0;

    /** @type {{ input: HTMLInputElement, list: HTMLUListElement, status: HTMLElement, clear: HTMLButtonElement }|null} */
    #elements = null;

    /** @type {string} */
    #uid = `vui-cs-${++instanceCounter}`;

    /**
     * Endpoint used by the default service.
     *
     * @returns {string|null}
     */
    get endpoint() {
        return this.getAttribute('endpoint');
    }

    /** @returns {number} Minimum query length before a request is issued. */
    get minQuery() {
        return this.#numericAttribute('min-query', CustomerSelector.defaults.minQuery);
    }

    /** @returns {number} Maximum results requested. */
    get limit() {
        return this.#numericAttribute('limit', CustomerSelector.defaults.limit);
    }

    /** @returns {number} Debounce delay in milliseconds. */
    get debounce() {
        return this.#numericAttribute('debounce', CustomerSelector.defaults.debounce);
    }

    /** @returns {boolean} */
    get disabled() {
        return this.hasAttribute('disabled');
    }

    /** @param {boolean} value */
    set disabled(value) {
        this.toggleAttribute('disabled', Boolean(value));
    }

    /**
     * Currently selected customer, or `null`.
     *
     * Assigning this property sets the displayed value but does **not** emit
     * `customer:selected`: pre-filling a form is not a user selection
     * (docs/05-configuration-state.md).
     *
     * @returns {Customer|null}
     */
    get selected() {
        return this.#state.selected;
    }

    /** @param {Customer|null} customer */
    set selected(customer) {
        this.#state.selected = normalizeCustomer(customer);
        this.#state.results = [];
        this.#state.activeIndex = -1;
        this.#closeList();
        this.#renderSelection();
    }

    /**
     * Service used for searching. Injecting it is how an application supplies a
     * client configured with CSRF, base URL and diagnostics.
     *
     * @returns {CustomerService|null}
     */
    get service() {
        return this.#service;
    }

    /** @param {CustomerService|null} service */
    set service(service) {
        this.#service = service ?? null;
    }

    /**
     * Localised strings. The server sends only the keys this component needs,
     * never the whole catalogue (docs/09-ci4-integration.md).
     *
     * @returns {Record<string, string>}
     */
    get labels() {
        return { ...this.#labels };
    }

    /** @param {Record<string, string>} labels */
    set labels(labels) {
        this.#labels = { ...CustomerSelector.labelDefaults, ...(labels ?? {}) };

        if (this.mounted) {
            this.#renderStatus();
        }
    }

    /** @returns {void} */
    render() {
        if (this.#elements && this.contains(this.#elements.input)) {
            return;
        }

        const listId = `${this.#uid}-list`;
        const statusId = `${this.#uid}-status`;

        // safe-html: the only interpolated values are `listId` and `statusId`,
        // both derived from an internal instance counter. No server or user data
        // reaches this template; results are rendered via textContent below.
        this.innerHTML = `
            <div class="vui-customer-selector__field">
                <input
                    class="vui-customer-selector__input"
                    type="text"
                    role="combobox"
                    autocomplete="off"
                    aria-autocomplete="list"
                    aria-expanded="false"
                    aria-controls="${listId}"
                    aria-describedby="${statusId}"
                    data-input
                >
                <button
                    class="vui-customer-selector__clear"
                    type="button"
                    data-action="clear"
                    hidden
                ></button>
            </div>
            <ul class="vui-customer-selector__list" id="${listId}" role="listbox" data-list hidden></ul>
            <p class="vui-customer-selector__status" id="${statusId}" role="status" aria-live="polite" data-status></p>
        `;

        this.#elements = {
            input: /** @type {HTMLInputElement} */ (this.find('[data-input]')),
            list: /** @type {HTMLUListElement} */ (this.find('[data-list]')),
            status: /** @type {HTMLElement} */ (this.find('[data-status]')),
            clear: /** @type {HTMLButtonElement} */ (this.find('[data-action="clear"]')),
        };

        this.#applyPlaceholder();
        this.#applyLabel();
        this.#renderSelection();

        // Publish the initial state so `[data-state]` is a reliable styling and
        // testing hook from the very first paint, not only after a transition.
        this.#setStatus(this.#state.status);
    }

    /**
     * Fail loudly on missing required configuration: a selector with no way to
     * search is a template bug, not a runtime state to render
     * (docs/19-observability-errors.md).
     *
     * @returns {void}
     */
    mount() {
        if (!this.endpoint && !this.#service) {
            throw new Error(
                `<${this.localName}> requires an "endpoint" attribute or an assigned "service" property.`,
            );
        }

        super.mount();
    }

    /** @returns {void} */
    bindEvents() {
        const { input } = this.#requireElements();

        input.addEventListener('input', this.#handleInput, { signal: this.signal });
        input.addEventListener('keydown', this.#handleKeydown, { signal: this.signal });
        input.addEventListener('focus', this.#handleFocus, { signal: this.signal });

        this.addEventListener('mousedown', this.#handleOptionMouseDown, { signal: this.signal });
        this.addEventListener('click', this.#handleOptionClick, { signal: this.signal });

        // A document-level listener is the classic leak in this kind of
        // component. The lifecycle signal removes it on disconnect.
        document.addEventListener('click', this.#handleDocumentClick, { signal: this.signal });

        this.bindActions();
        this.#updateDisabled();
    }

    /**
     * Everything owned by this mount cycle is released here. The lifecycle
     * signal removes the listeners; the timer and in-flight request are not
     * signal-bound and must be disposed explicitly.
     *
     * @returns {void}
     */
    unmount() {
        this.#cancelPendingSearch();
        this.#elements = null;
    }

    /**
     * @param {string} name
     * @param {string|null} oldValue
     * @param {string|null} newValue
     * @returns {void}
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue || !this.mounted) {
            return;
        }

        if (name === 'disabled') {
            this.#updateDisabled();
        }

        if (name === 'placeholder') {
            this.#applyPlaceholder();
        }

        if (name === 'aria-label' || name === 'aria-labelledby') {
            this.#applyLabel();
        }
    }

    /**
     * @param {string} action
     * @returns {void}
     */
    handleAction(action) {
        if (action === 'clear') {
            this.clear();
        }
    }

    /**
     * Run a search immediately, bypassing the debounce.
     *
     * @param {string} query
     * @returns {Promise<void>}
     */
    async search(query) {
        const trimmed = query.trim();

        if (trimmed.length < this.minQuery) {
            this.#cancelPendingSearch();
            this.#state.results = [];
            this.#setStatus('idle');
            this.#closeList();

            return;
        }

        this.#cancelPendingSearch();
        this.#searchController = new AbortController();
        const controller = this.#searchController;
        const token = ++this.#requestToken;

        this.#setStatus('loading');

        try {
            const results = await this.#resolveService().search(trimmed, {
                limit: this.limit,
                signal: controller.signal,
            });

            // A superseded response must not overwrite newer state, even if the
            // abort lost the race with the network.
            if (token !== this.#requestToken) {
                return;
            }

            this.#state.results = results;
            this.#renderResults();
            this.#setStatus(results.length === 0 ? 'empty' : 'results');
        } catch (error) {
            // A cancelled search is not a failure: rendering an error here is
            // the classic "every keystroke flashes red" bug.
            if (isAbortError(error) || token !== this.#requestToken) {
                return;
            }

            this.#state.results = [];
            this.#renderResults();
            this.#setStatus('error');

            this.emit('customer:search-failed', {
                query: trimmed,
                error: describeError(error),
            });
        } finally {
            if (this.#searchController === controller) {
                this.#searchController = null;
            }
        }
    }

    /**
     * Select a customer as if the user had picked it.
     *
     * @param {Customer} customer
     * @param {Object} [options]
     * @param {'user'|'api'} [options.source='api']
     * @returns {void}
     */
    selectCustomer(customer, options = {}) {
        const normalized = normalizeCustomer(customer);

        if (!normalized) {
            return;
        }

        this.#state.selected = normalized;
        this.#state.results = [];
        this.#state.activeIndex = -1;
        this.#closeList();
        this.#setStatus('idle');
        this.#renderSelection();

        /**
         * A customer was selected.
         *
         * @event vui-customer-selector#customer:selected
         * @type {CustomEvent<{ id: string, customer: Customer, source: 'user'|'api' }>}
         */
        this.emit('customer:selected', {
            id: normalized.id,
            customer: normalized,
            source: options.source ?? 'api',
        });
    }

    /**
     * Clear the current selection.
     *
     * @returns {void}
     */
    clear() {
        const previous = this.#state.selected;

        this.#cancelPendingSearch();
        this.#state.selected = null;
        this.#state.results = [];
        this.#state.activeIndex = -1;
        this.#closeList();
        this.#setStatus('idle');
        this.#renderSelection();

        if (!previous) {
            return;
        }

        /**
         * The selection was removed.
         *
         * @event vui-customer-selector#customer:cleared
         * @type {CustomEvent<{ previous: Customer }>}
         */
        this.emit('customer:cleared', { previous });
    }

    /** @returns {CustomerService} */
    #resolveService() {
        if (!this.#service) {
            this.#service = new CustomerService(undefined, {
                endpoint: this.endpoint ?? undefined,
            });
        }

        return this.#service;
    }

    /** @returns {{ input: HTMLInputElement, list: HTMLUListElement, status: HTMLElement, clear: HTMLButtonElement }} */
    #requireElements() {
        if (!this.#elements) {
            this.render();
        }

        if (!this.#elements) {
            throw new Error(`<${this.localName}>: internal markup is unavailable.`);
        }

        return this.#elements;
    }

    /** @returns {void} */
    #cancelPendingSearch() {
        if (this.#debounceTimer !== null) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#searchController?.abort();
        this.#searchController = null;
    }

    /**
     * @param {string} name
     * @param {number} fallback
     * @returns {number}
     */
    #numericAttribute(name, fallback) {
        const raw = this.getAttribute(name);

        if (raw === null) {
            return fallback;
        }

        const parsed = Number(raw);

        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    /**
     * @param {'idle'|'loading'|'results'|'empty'|'error'} status
     * @returns {void}
     */
    #setStatus(status) {
        this.#state.status = status;
        this.dataset.state = status;
        this.toggleAttribute('aria-busy', status === 'loading');
        this.#renderStatus();
    }

    /** @returns {void} */
    #renderStatus() {
        if (!this.#elements) {
            return;
        }

        const messages = {
            idle: '',
            loading: this.#labels.loading,
            results: '',
            empty: this.#labels.empty,
            error: this.#labels.error,
        };

        this.#elements.status.textContent = messages[this.#state.status] ?? '';
    }

    /** @returns {void} */
    #renderSelection() {
        if (!this.#elements) {
            return;
        }

        const { input, clear } = this.#elements;
        const selected = this.#state.selected;

        // `value` is a property assignment, never HTML interpolation, so a
        // customer named `<img onerror=…>` is displayed literally.
        input.value = selected ? selected.name : '';
        clear.hidden = !selected;
        clear.textContent = this.#labels.clear;
        this.toggleAttribute('data-has-selection', Boolean(selected));
    }

    /** @returns {void} */
    #renderResults() {
        const { list } = this.#requireElements();
        const fragment = document.createDocumentFragment();

        this.#state.results.forEach((customer, index) => {
            const option = document.createElement('li');
            option.className = 'vui-customer-selector__option';
            option.id = `${this.#uid}-option-${index}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.dataset.index = String(index);

            const name = document.createElement('span');
            name.className = 'vui-customer-selector__option-name';
            name.textContent = customer.name;
            option.append(name);

            if (customer.email) {
                const email = document.createElement('span');
                email.className = 'vui-customer-selector__option-email';
                email.textContent = customer.email;
                option.append(email);
            }

            fragment.append(option);
        });

        list.replaceChildren(fragment);
        this.#setExpanded(this.#state.results.length > 0);
        this.#renderActiveOption();
    }

    /** @returns {void} */
    #renderActiveOption() {
        const { input, list } = this.#requireElements();
        const options = Array.from(list.children);

        options.forEach((option, index) => {
            const active = index === this.#state.activeIndex;
            option.setAttribute('aria-selected', String(active));
            option.classList.toggle('is-active', active);
        });

        const active = options[this.#state.activeIndex];

        if (active) {
            input.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView?.({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    /**
     * @param {boolean} expanded
     * @returns {void}
     */
    #setExpanded(expanded) {
        const { input, list } = this.#requireElements();

        this.#state.expanded = expanded;
        list.hidden = !expanded;
        input.setAttribute('aria-expanded', String(expanded));
    }

    /** @returns {void} */
    #closeList() {
        if (!this.#elements) {
            return;
        }

        this.#state.activeIndex = -1;
        this.#setExpanded(false);
        this.#renderActiveOption();
    }

    /**
     * Give the combobox a real accessible name.
     *
     * A custom element is not a labelable element, so the natural authoring
     * pattern — `<label for="customer-search">` next to
     * `<vui-customer-selector id="customer-search">` — silently labels nothing:
     * `label.control` is `null` and the internal input is unnamed.
     *
     * That defect survives an automated audit, because axe accepts a
     * `placeholder` as a last-resort accessible name. A placeholder is a poor
     * name: it disappears as soon as the user types, is frequently missed by
     * translation, and is announced inconsistently. So the name is resolved
     * explicitly here, in documented order:
     *
     * 1. `aria-labelledby` on the host, copied to the input;
     * 2. `aria-label` on the host, copied to the input;
     * 3. a `<label for="{host id}">` in the document — the label is given an id
     *    if it lacks one, and the input points at it;
     * 4. a native `<label for="{host id}-input">`, which already works and
     *    needs nothing;
     * 5. nothing, in which case the input is left unnamed rather than falling
     *    back to the placeholder. That is an authoring error, and the test
     *    suite asserts a real name rather than accepting the fallback.
     *
     * Standard ARIA is delegated rather than a bespoke `label` attribute being
     * invented: authors already know these attributes, and this component
     * already has a `labels` property for translated strings, which a
     * near-identical `label` attribute would only confuse.
     *
     * @returns {void}
     */
    #applyLabel() {
        if (!this.#elements) {
            return;
        }

        const { input, list } = this.#elements;

        // A stable, documented id so a consumer can also use a native
        // `<label for>` and get click-to-focus for free.
        if (this.id && !input.id) {
            input.id = `${this.id}-input`;
        }

        const labelledBy = this.getAttribute('aria-labelledby');
        const ariaLabel = this.getAttribute('aria-label');

        /** @type {string|null} */
        let name = null;

        if (labelledBy) {
            input.setAttribute('aria-labelledby', labelledBy);
            input.removeAttribute('aria-label');
            name = referencedText(labelledBy);
        } else if (ariaLabel) {
            input.setAttribute('aria-label', ariaLabel);
            input.removeAttribute('aria-labelledby');
            name = ariaLabel;
        } else {
            const external = this.id
                ? document.querySelector(`label[for="${CSS.escape(this.id)}"]`)
                : null;

            if (external) {
                if (!external.id) {
                    external.id = `${this.#uid}-label`;
                }

                input.setAttribute('aria-labelledby', external.id);
                input.removeAttribute('aria-label');
                name = external.textContent?.trim() ?? null;
            } else {
                input.removeAttribute('aria-labelledby');
                input.removeAttribute('aria-label');
                name = input.labels?.[0]?.textContent?.trim() ?? null;
            }
        }

        // The popup needs its own name; it is a separate widget in the
        // accessibility tree from the field that controls it.
        if (name) {
            list.setAttribute('aria-label', name);
        } else {
            list.removeAttribute('aria-label');
        }
    }

    /** @returns {void} */
    #applyPlaceholder() {
        if (!this.#elements) {
            return;
        }

        this.#elements.input.placeholder = this.getAttribute('placeholder') ?? this.#labels.hint;
    }

    /** @returns {void} */
    #updateDisabled() {
        if (!this.#elements) {
            return;
        }

        const disabled = this.disabled;
        this.#elements.input.disabled = disabled;
        this.#elements.clear.disabled = disabled;

        if (disabled) {
            this.#cancelPendingSearch();
            this.#closeList();
        }
    }

    /**
     * @param {number} delta
     * @returns {void}
     */
    #moveActive(delta) {
        const count = this.#state.results.length;

        if (count === 0) {
            return;
        }

        const current = this.#state.activeIndex;
        const next =
            current === -1 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count;

        this.#state.activeIndex = next;
        this.#renderActiveOption();
    }

    /** @type {(event: Event) => void} */
    #handleInput = () => {
        const { input } = this.#requireElements();
        const query = input.value;

        if (this.#debounceTimer !== null) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {
            this.#debounceTimer = null;
            void this.search(query);
        }, this.debounce);
    };

    /** @type {(event: KeyboardEvent) => void} */
    #handleKeydown = event => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.#moveActive(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.#moveActive(-1);
                break;
            case 'Home':
                if (this.#state.expanded) {
                    event.preventDefault();
                    this.#state.activeIndex = 0;
                    this.#renderActiveOption();
                }
                break;
            case 'End':
                if (this.#state.expanded) {
                    event.preventDefault();
                    this.#state.activeIndex = this.#state.results.length - 1;
                    this.#renderActiveOption();
                }
                break;
            case 'Enter': {
                const candidate = this.#state.results[this.#state.activeIndex];

                if (candidate) {
                    event.preventDefault();
                    this.selectCustomer(candidate, { source: 'user' });
                }

                break;
            }
            case 'Escape':
                if (this.#state.expanded) {
                    event.preventDefault();
                    this.#closeList();
                }
                break;
            default:
                break;
        }
    };

    /** @type {(event: Event) => void} */
    #handleFocus = () => {
        if (this.#state.results.length > 0) {
            this.#setExpanded(true);
        }
    };

    /**
     * Keep focus in the input while an option is clicked; otherwise the input
     * blurs before `click` fires and the list closes underneath the pointer.
     *
     * @type {(event: MouseEvent) => void}
     */
    #handleOptionMouseDown = event => {
        if (/** @type {Element} */ (event.target)?.closest?.('[role="option"]')) {
            event.preventDefault();
        }
    };

    /** @type {(event: MouseEvent) => void} */
    #handleOptionClick = event => {
        const option = /** @type {HTMLElement|null} */ (
            /** @type {Element|null} */ (event.target)?.closest('[role="option"]')
        );

        if (!option || !this.contains(option)) {
            return;
        }

        const index = Number(option.dataset.index);
        const customer = this.#state.results[index];

        if (customer) {
            this.selectCustomer(customer, { source: 'user' });
        }
    };

    /** @type {(event: MouseEvent) => void} */
    #handleDocumentClick = event => {
        if (!this.#state.expanded) {
            return;
        }

        const target = /** @type {Node|null} */ (event.target);

        if (target && !this.contains(target)) {
            this.#closeList();
        }
    };
}

/**
 * Concatenated text of the elements an `aria-labelledby` token list references,
 * following the accessible-name computation closely enough to reuse the value
 * as the listbox's own label.
 *
 * @param {string} tokens Space-separated id reference list.
 * @returns {string|null}
 */
function referencedText(tokens) {
    const text = tokens
        .trim()
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');

    return text || null;
}

/**
 * @param {unknown} customer
 * @returns {Customer|null}
 */
function normalizeCustomer(customer) {
    if (!customer || typeof customer !== 'object') {
        return null;
    }

    const record = /** @type {Record<string, unknown>} */ (customer);

    if (record.id === undefined || record.id === null || record.name === undefined) {
        return null;
    }

    return {
        id: String(record.id),
        name: String(record.name),
        email:
            record.email === undefined || record.email === null ? undefined : String(record.email),
    };
}

/**
 * Reduce a transport failure to a small, log-safe descriptor. Server messages
 * are not forwarded to the UI here; the application decides what a user sees.
 *
 * @param {unknown} error
 * @returns {{ name: string, status: number|null, requestId: string|null }}
 */
function describeError(error) {
    const candidate = /** @type {{ name?: string, status?: number, requestId?: string }} */ (
        error ?? {}
    );

    return {
        name: candidate.name ?? 'Error',
        status: typeof candidate.status === 'number' ? candidate.status : null,
        requestId: candidate.requestId ?? null,
    };
}

define('vui-customer-selector', CustomerSelector);
