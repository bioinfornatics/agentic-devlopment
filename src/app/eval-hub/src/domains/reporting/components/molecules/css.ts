/**
 * Molecule-level CSS.
 *
 * @level Molecules
 * Styles for composed multi-atom components: stat cards, chart cards,
 * table toolbar, filter/select controls, pagination strip, and
 * the per-subject eval-result card.
 */

export const MOLECULES_CSS = `
    /* ── Stat cards ──────────────────────────────────────── */
    .stat-card { background: var(--surface); border: 1px solid var(--gray-bdr); border-radius: var(--radius);
                 box-shadow: var(--shadow); padding: 1rem 1.25rem; }
    .stat-card .label { color: var(--gray); font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; }
    .stat-card .value { font-size: 1.75rem; font-weight: 700; line-height: 1.2; margin-top: .25rem; }
    .stat-card .sub   { color: var(--gray); font-size: .75rem; margin-top: .15rem; }
    /* ── Chart card ──────────────────────────────────────── */
    .chart-card { background: var(--surface); border: 1px solid var(--gray-bdr); border-radius: var(--radius);
                  box-shadow: var(--shadow); padding: 1.25rem; }
    .chart-card h2 { font-size: .875rem; font-weight: 600; color: var(--text-sm); margin-bottom: 1rem; }
    .chart-wrap  { position: relative; }
    /* ── Table toolbar ───────────────────────────────────── */
    .table-toolbar { padding: .75rem 1rem; border-bottom: 1px solid var(--gray-bdr);
                     display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .table-toolbar h2 { font-size: .875rem; font-weight: 600; margin-right: auto; }
    .filter-input { border: 1px solid var(--gray-bdr); border-radius: .5rem; padding: .375rem .75rem;
                    font-size: .825rem; outline: none; width: 220px; background: var(--bg); }
    .filter-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-dim); }
    .kind-select { border: 1px solid var(--gray-bdr); border-radius: .5rem; padding: .375rem .75rem;
                   font-size: .825rem; background: var(--bg); cursor: pointer; }
    /* ── Pagination bar ──────────────────────────────────── */
    .pagination { padding: .6rem 1rem; border-top: 1px solid var(--gray-bdr);
                  display: flex; gap: .5rem; align-items: center; font-size: .8rem; color: var(--gray); }
    /* ── Eval result card ────────────────────────────────── */
    .eval-result-card { background: var(--surface); border: 1px solid var(--gray-bdr);
                        border-radius: var(--radius); box-shadow: var(--shadow); padding: .875rem 1rem; }
    .eval-result-card__header { display: flex; align-items: center; gap: .5rem; margin-bottom: .625rem; }
    .eval-result-card__subject { font-weight: 600; font-size: .85rem; color: var(--text); overflow: hidden;
                                  text-overflow: ellipsis; white-space: nowrap; }
    .eval-result-card__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: .25rem .5rem; }
    .eval-result-card__metric .label { font-size: .7rem; color: var(--gray); text-transform: uppercase;
                                        letter-spacing: .04em; }
    .eval-result-card__metric .value { font-size: 1rem; font-weight: 700; line-height: 1.3; }
`;
