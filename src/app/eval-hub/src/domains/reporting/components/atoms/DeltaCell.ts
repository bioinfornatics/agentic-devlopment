/**
 * DeltaCell — Atom
 *
 * Table cell containing a formatted delta value.
 * Applies delta-pos / delta-neg / delta-neu CSS class based on the numeric delta.
 *
 * @level Atom
 */
export function DeltaCell(delta: number | null, deltaFmt: string): string {
  const cls =
    delta == null ? "delta-neu"
    : delta > 0   ? "delta-pos"
    : delta < 0   ? "delta-neg"
    :               "delta-neu";
  return `<td class="${cls}">${deltaFmt}</td>`;
}
