/**
 * @file `<kit-sortable-table>` — column sorting for a server-rendered table.
 *
 * Admin kit example code, not library API.
 *
 * `docs/15-reference-components.md` warns against starting with a DataTable,
 * because sorting, filtering, pagination, selection and virtualisation together
 * hide architectural problems behind a mass of feature code. This component
 * takes the warning seriously and does exactly one thing: it sorts rows that
 * are already on the page.
 *
 * It has no pagination, no filtering, no selection, no virtualisation and no
 * fetching. For server-side sorting, listen for `table:sorted` and reload the
 * fragment yourself — `docs/recipes.md` shows that pattern.
 */

import './prefix.js';
import { Component } from '../../../resources/js/core/Component.js';
import { define } from '../../../resources/js/core/register.js';

/**
 * Expected markup — an ordinary table the server already rendered:
 *
 * ```html
 * <kit-sortable-table sort-column="name" sort-direction="ascending">
 *     <table>
 *         <thead>
 *             <tr>
 *                 <th data-sort="name">Name</th>
 *                 <th data-sort="created" data-sort-type="number">Created</th>
 *                 <th>Actions</th>
 *             </tr>
 *         </thead>
 *         <tbody>…</tbody>
 *     </table>
 * </kit-sortable-table>
 * ```
 *
 * A cell may carry `data-sort-value` to sort by something other than its text,
 * which is how you sort a formatted date or a currency amount correctly.
 *
 * @element kit-sortable-table
 * @fires kit-sortable-table#table:sorted
 */
export class SortableTable extends Component {
    /** @returns {string[]} */
    static get observedAttributes() {
        return ['sort-column', 'sort-direction'];
    }

    /** @type {HTMLTableElement|null} */
    #table = null;

    #reflecting = false;

    /** @returns {string|null} The column key currently sorted by. */
    get sortColumn() {
        return this.getAttribute('sort-column');
    }

    /** @returns {'ascending'|'descending'} */
    get sortDirection() {
        return this.getAttribute('sort-direction') === 'descending' ? 'descending' : 'ascending';
    }

    /**
     * Whether to reorder rows in the browser.
     *
     * Off by default: on a paginated table, sorting only the visible page is a
     * lie. Turn it on when the table holds the complete set.
     *
     * @returns {boolean}
     */
    get clientSort() {
        return this.hasAttribute('client-sort');
    }

    /** Enhancement mode: the server owns the markup. */
    mount() {
        this.#table = /** @type {HTMLTableElement|null} */ (this.querySelector('table'));

        if (!this.#table) {
            throw new Error(`<${this.localName}> requires a <table> child.`);
        }

        this.#applyHeaders();
        this.bindEvents();
    }

    bindEvents() {
        this.addEventListener('click', this.#handleClick, { signal: this.signal });
        this.addEventListener('keydown', this.#handleKeydown, { signal: this.signal });
    }

    unmount() {
        this.#table = null;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue || this.#reflecting || !this.mounted) {
            return;
        }

        void name;
        this.#applyHeaders();

        if (this.clientSort) {
            this.#sortRows();
        }
    }

    /**
     * Sort by a column.
     *
     * @param {string} column Value of the header's `data-sort`.
     * @param {Object} [options]
     * @param {'ascending'|'descending'} [options.direction] Defaults to toggling.
     * @returns {void}
     */
    sortBy(column, options = {}) {
        const header = this.#headers().find(candidate => candidate.dataset.sort === column);

        if (!header) {
            return;
        }

        const direction =
            options.direction ??
            (this.sortColumn === column && this.sortDirection === 'ascending'
                ? 'descending'
                : 'ascending');

        this.#reflecting = true;
        this.setAttribute('sort-column', column);
        this.setAttribute('sort-direction', direction);
        this.#reflecting = false;

        this.#applyHeaders();

        if (this.clientSort) {
            this.#sortRows();
        }

        /**
         * The sort changed. Listen for this to reload a server-sorted fragment.
         *
         * @event kit-sortable-table#table:sorted
         * @type {CustomEvent<{ column: string, direction: 'ascending'|'descending', clientSorted: boolean }>}
         */
        this.emit('table:sorted', {
            column,
            direction,
            clientSorted: this.clientSort,
        });
    }

    /** @returns {HTMLTableCellElement[]} Sortable header cells. */
    #headers() {
        return /** @type {HTMLTableCellElement[]} */ (
            this.findAll('th[data-sort]').filter(header => header.closest(this.localName) === this)
        );
    }

    /**
     * Make headers operable and announce sort state.
     *
     * `aria-sort` goes on the `<th>`, and the control inside it is a real
     * `<button>` so that keyboard and screen-reader behaviour come from the
     * platform rather than from a `tabindex` and a keydown handler.
     *
     * @returns {void}
     */
    #applyHeaders() {
        const active = this.sortColumn;

        for (const header of this.#headers()) {
            const isActive = header.dataset.sort === active;

            header.setAttribute('aria-sort', isActive ? this.sortDirection : 'none');
            header.dataset.state = isActive ? 'sorted' : 'unsorted';

            let button = header.querySelector('button[data-sort-button]');

            if (!button) {
                // Wrap the existing header content once, preserving whatever
                // the server rendered inside it.
                button = document.createElement('button');
                button.type = 'button';
                button.setAttribute('data-sort-button', '');
                button.append(...header.childNodes);
                header.append(button);
            }
        }
    }

    /** @returns {void} */
    #sortRows() {
        const table = this.#table;
        const column = this.sortColumn;

        if (!table || !column) {
            return;
        }

        const body = table.tBodies[0];
        const header = this.#headers().find(candidate => candidate.dataset.sort === column);

        if (!body || !header) {
            return;
        }

        const index = header.cellIndex;
        const numeric = header.dataset.sortType === 'number';
        const factor = this.sortDirection === 'descending' ? -1 : 1;

        const rows = Array.from(body.rows);
        const collator = new Intl.Collator(document.documentElement.lang || undefined, {
            numeric: true,
            sensitivity: 'base',
        });

        rows.sort((left, right) => {
            const a = cellValue(left, index);
            const b = cellValue(right, index);

            if (numeric) {
                return (Number(a) - Number(b)) * factor;
            }

            return collator.compare(a, b) * factor;
        });

        // One append moves each row in order; the browser reuses the existing
        // nodes rather than recreating them, so anything inside a cell — a
        // component, an open dropdown, a focused control — survives.
        body.append(...rows);
    }

    /** @type {(event: MouseEvent) => void} */
    #handleClick = event => {
        const header = /** @type {HTMLElement|null} */ (
            /** @type {Element|null} */ (event.target)?.closest('th[data-sort]')
        );

        if (header && header.closest(this.localName) === this && header.dataset.sort) {
            this.sortBy(header.dataset.sort);
        }
    };

    /** @type {(event: KeyboardEvent) => void} */
    #handleKeydown = event => {
        // The header control is a real button, so Enter and Space already
        // produce a click. This only adds the convention that Escape clears.
        if (event.key !== 'Escape' || !this.sortColumn) {
            return;
        }

        const target = /** @type {Element|null} */ (event.target);

        if (!target?.closest('th[data-sort]')) {
            return;
        }

        this.#reflecting = true;
        this.removeAttribute('sort-column');
        this.removeAttribute('sort-direction');
        this.#reflecting = false;

        this.#applyHeaders();
        this.emit('table:sorted', { column: null, direction: null, clientSorted: false });
    };
}

/**
 * @param {HTMLTableRowElement} row
 * @param {number} index
 * @returns {string}
 */
function cellValue(row, index) {
    const cell = /** @type {HTMLElement|undefined} */ (row.cells[index]);

    if (!cell) {
        return '';
    }

    // An explicit sort value lets a formatted cell ("3 Sep 2026", "₺1.234,50")
    // sort by the underlying value instead of by its display text.
    return cell.dataset.sortValue ?? cell.textContent?.trim() ?? '';
}

define('kit-sortable-table', SortableTable);
