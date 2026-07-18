/**
 * EvalResultCard — Molecule
 *
 * A card showing a single subject's latest evaluation result.
 * Composed from the KindBadge atom and the StatLabel / StatValue atoms,
 * with delta coloured via the same CSS classes as DeltaCell.
 *
 * This is the atomic unit the old monolithic report used to render inline
 * for every subject: it holds only structural layout for one subject's
 * metrics — no data fetching, no sorting, no pagination logic.
 *
 * Rendered server-side (static HTML string); the SubjectResultsGrid
 * organism collects these cards into a responsive grid.
 *
 * @level Molecule
 * @composition KindBadge (atom), StatLabel, StatValue (atoms)
 */
import { KindBadge }            from "../atoms/KindBadge.js";
import { StatLabel, StatValue } from "../atoms/StatMetric.js";
import { esc }                  from "../utils.js";

/** Data contract for a single subject's eval result card. */
export interface EvalResultCardData {
  /** Subject identifier, e.g. "code-review". */
  subject:  string;
  /** Eval kind: "skills" | "agents" | "recipes". */
  kind:     string;
  /** Pre-formatted pass rate with skill/recipe, e.g. "80%" or "—". */
  withPct:  string;
  /** Pre-formatted baseline pass rate, e.g. "40%" or "—". */
  basePct:  string;
  /** Pre-formatted delta, e.g. "+40.0%" or "—". */
  deltaFmt: string;
  /** Raw numeric delta (−1 to +1) for CSS colour class selection; null = no comparison available. */
  delta:    number | null;
}

/** Maps a raw delta to the correct CSS colour utility class. */
function deltaClass(delta: number | null): string {
  if (delta == null) return "delta-neu";
  if (delta > 0)     return "delta-pos";
  if (delta < 0)     return "delta-neg";
  return "delta-neu";
}

export function EvalResultCard(data: EvalResultCardData): string {
  return `\
      <div class="eval-result-card">
        <div class="eval-result-card__header">
          ${KindBadge(data.kind)}
          <span class="eval-result-card__subject" title="${esc(data.subject)}">${esc(data.subject)}</span>
        </div>
        <div class="eval-result-card__metrics">
          <div class="eval-result-card__metric">
            ${StatLabel("With")}
            ${StatValue(data.withPct)}
          </div>
          <div class="eval-result-card__metric">
            ${StatLabel("Base")}
            ${StatValue(data.basePct)}
          </div>
          <div class="eval-result-card__metric">
            ${StatLabel("Δ")}
            <div class="value ${deltaClass(data.delta)}">${esc(data.deltaFmt)}</div>
          </div>
        </div>
      </div>`;
}
