/**
 * Atom-level CSS.
 *
 * @level Atoms
 * Styles for the smallest named UI elements: utility colour classes,
 * kind badges, delta indicators, count badge, empty-state, pg-btn.
 */

export const ATOMS_CSS = `
    /* ── Utility colours ─────────────────────────────────── */
    .text-green { color: var(--green); }
    .text-red   { color: var(--red); }
    .text-blue  { color: var(--blue); }
    /* ── Kind badge ──────────────────────────────────────── */
    .kind-badge { display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600; }
    .kind-skills  { background: var(--blue-dim);  color: #1d4ed8; }
    .kind-agents  { background: var(--green-dim); color: #15803d; }
    .kind-recipes { background: var(--red-dim);   color: #b91c1c; }
    /* ── Delta cell colours ──────────────────────────────── */
    .delta-pos { color: var(--green); font-weight: 600; }
    .delta-neg { color: var(--red);   font-weight: 600; }
    .delta-neu { color: var(--gray); }
    /* ── Count badge ─────────────────────────────────────── */
    .count-badge { background: var(--gray-lt); border-radius: 999px; padding: .15rem .65rem;
                   font-size: .75rem; color: var(--gray); white-space: nowrap; }
    /* ── Empty table state ───────────────────────────────── */
    .tbl-empty { text-align: center; padding: 3rem; color: var(--gray); }
    /* ── Pagination buttons ──────────────────────────────── */
    .pg-btn { border: 1px solid var(--gray-bdr); background: var(--surface); border-radius: .375rem;
              padding: .25rem .65rem; cursor: pointer; font-size: .8rem; }
    .pg-btn:hover:not(:disabled) { background: var(--gray-lt); }
    .pg-btn:disabled { opacity: .4; cursor: default; }
`;
