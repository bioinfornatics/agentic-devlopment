/**
 * Organism-level CSS.
 *
 * @level Organisms
 * Styles for complex, standalone UI sections: the stat grid, the chart grid,
 * the subject results grid, and the full runs table (table chrome: thead/tbody/tr/td).
 */

export const ORGANISMS_CSS = `
    /* ── Stat grid ───────────────────────────────────────── */
    .stat-row { display: grid; grid-template-columns: repeat(auto-fill,minmax(160px,1fr)); gap: 1rem; }
    /* ── Chart grid ──────────────────────────────────────── */
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr 280px; gap: 1rem; }
    @media (max-width: 900px) { .chart-grid { grid-template-columns: 1fr; } }
    /* ── Subject results grid ────────────────────────────── */
    .subjects-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: .875rem; }
    .subjects-grid__heading { font-size: .875rem; font-weight: 600; color: var(--text-sm);
                               margin-bottom: .75rem; }
    /* ── Runs table card ─────────────────────────────────── */
    .table-card { background: var(--surface); border: 1px solid var(--gray-bdr); border-radius: var(--radius);
                  box-shadow: var(--shadow); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: var(--gray-lt); font-weight: 600; font-size: .78rem;
               text-transform: uppercase; letter-spacing: .04em; color: var(--text-sm);
               padding: .6rem .85rem; text-align: left; white-space: nowrap;
               border-bottom: 1px solid var(--gray-bdr); user-select: none; cursor: pointer; }
    thead th:hover { background: #e9ebef; }
    thead th.sorted-asc::after  { content: " ▲"; color: var(--blue); }
    thead th.sorted-desc::after { content: " ▼"; color: var(--blue); }
    tbody td { padding: .55rem .85rem; border-bottom: 1px solid var(--gray-bdr); font-size: .825rem; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #fafbfc; }
`;
