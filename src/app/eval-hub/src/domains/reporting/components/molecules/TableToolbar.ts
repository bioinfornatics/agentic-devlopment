/**
 * TableToolbar — Molecule
 *
 * The control strip above the runs table: title, text-filter input,
 * kind selector, and row-count badge.
 *
 * DOM contracts (consumed by tableController script):
 *   #filterInput — text search input
 *   #kindSelect  — kind dropdown
 *   #countBadge  — live row count
 *
 * @level Molecule
 * @composition filter-input, kind-select, count-badge (atoms via CSS)
 */
export function TableToolbar(): string {
  return `\
      <div class="table-toolbar">
        <h2>All Runs</h2>
        <input id="filterInput" class="filter-input" type="search" placeholder="🔍 Filter by subject…">
        <select id="kindSelect" class="kind-select">
          <option value="">All kinds</option>
          <option value="skills">Skills</option>
          <option value="agents">Agents</option>
          <option value="recipes">Recipes</option>
        </select>
        <span class="count-badge" id="countBadge">— rows</span>
      </div>`;
}
