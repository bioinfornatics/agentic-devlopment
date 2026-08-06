/**
 * Design tokens — CSS custom properties and base reset.
 *
 * @level Quarks
 * These are the raw values that define the design language.
 * Pure CSS strings; no markup. Consumed by atom stylesheets.
 */

export const TOKENS_CSS = `
    /* ── Design tokens ───────────────────────────────────── */
    :root {
      --green:  #22c55e; --green-dim: rgba(34,197,94,.15);
      --red:    #ef4444; --red-dim:   rgba(239,68,68,.15);
      --amber:  #f59e0b;
      --blue:   #3b82f6; --blue-dim:  rgba(59,130,246,.12);
      --gray:   #6b7280; --gray-lt:   #f3f4f6; --gray-bdr: #e5e7eb;
      --bg:     #f8fafc; --surface:   #ffffff;
      --text:   #111827; --text-sm:   #374151;
      --radius: .75rem;  --shadow:    0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.05);
    }
    /* ── Reset ───────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; }
    body { font-family: system-ui,-apple-system,sans-serif; font-size: .875rem;
           background: var(--bg); color: var(--text); line-height: 1.5; }
`;
