/**
 * Template-level CSS.
 *
 * @level Templates
 * Styles for the page shell and the sticky top navigation bar.
 * No component-specific styles here; only layout primitives.
 */

export const TEMPLATE_CSS = `
    /* ── Page shell ──────────────────────────────────────── */
    .shell { display: grid; grid-template-rows: auto 1fr; min-height: 100vh; }
    /* ── Topbar ──────────────────────────────────────────── */
    .topbar { background: var(--surface); border-bottom: 1px solid var(--gray-bdr);
              padding: .75rem 2rem; display: flex; align-items: center; gap: 1.5rem; }
    .topbar h1 { font-size: 1.125rem; font-weight: 700; }
    .topbar .meta { color: var(--gray); font-size: .8rem; margin-left: auto; }
    /* ── Body content area ───────────────────────────────── */
    .body { padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
`;
