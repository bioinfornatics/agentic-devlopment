/**
 * TableRow — Molecule
 *
 * A single data row in the runs table.
 * Composed from the KindBadge and DeltaCell atoms.
 *
 * NOTE: The client-side tableController script also renders rows dynamically.
 * Keep both renderers in sync: any change to the column order here must be
 * mirrored in scripts/tableController.ts.
 *
 * @level Molecule
 * @composition KindBadge, DeltaCell (atoms)
 */
import { KindBadge }  from "../atoms/KindBadge.js";
import { DeltaCell }  from "../atoms/DeltaCell.js";
import { esc }        from "../utils.js";

/** Shape of a single runs-table row — shared with htmlBuilder's data pipeline. */
export interface RunRow {
  date:       string;
  kind:       string;
  subject:    string;
  withPct:    string;
  basePct:    string;
  delta:      number | null;
  deltaFmt:   string;
  turns:      string;
  maxReached: string;
}

export function TableRow(r: RunRow): string {
  return `\
        <tr>
          <td>${esc(r.date)}</td>
          <td>${KindBadge(r.kind)}</td>
          <td>${esc(r.subject)}</td>
          <td>${r.withPct}</td>
          <td>${r.basePct}</td>
          ${DeltaCell(r.delta, r.deltaFmt)}
          <td>${r.turns}</td>
          <td>${r.maxReached}</td>
        </tr>`;
}
