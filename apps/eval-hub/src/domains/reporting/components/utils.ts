/**
 * Shared HTML-escaping utility.
 *
 * Lives at the components root so every layer (atoms → pages) can import it
 * without creating cross-layer dependency cycles.
 */

/** Escape HTML special chars so user-supplied strings are safe to embed. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a pass-rate fraction (0–1) as a percentage string, e.g. "75%". */
export function fmtPct(rate: number | null | undefined, decimals = 0): string {
  if (rate == null) return "—";
  return (rate * 100).toFixed(decimals) + "%";
}

/** Format a delta fraction (−1–+1) with leading sign, e.g. "+37%" or "−8%". */
export function fmtDelta(delta: number | null, decimals = 1): string {
  if (delta === null) return "—";
  return (delta >= 0 ? "+" : "") + (delta * 100).toFixed(decimals) + "%";
}
