/**
 * RunsTable — Organism
 *
 * Complete runs table section: toolbar + sortable column headers + empty tbody
 * placeholder + pagination bar. Row data is injected at runtime by the
 * tableController script — this organism only provides static chrome.
 *
 * @level Organism
 * @composition TableToolbar, PaginationBar (molecules)
 */
import { TableToolbar }  from "../molecules/TableToolbar.js";
import { PaginationBar } from "../molecules/PaginationBar.js";

export function RunsTable(): string {
  return `<div class="table-card">
      ${TableToolbar()}
      <table id="runsTable">
        <thead>
          <tr>
            <th data-col="date"       data-type="str">Date</th>
            <th data-col="kind"       data-type="str">Kind</th>
            <th data-col="subject"    data-type="str">Subject</th>
            <th data-col="withPct"    data-type="pct" title="Pass rate with skill/agent/recipe">With %</th>
            <th data-col="basePct"    data-type="pct" title="Pass rate baseline">Base %</th>
            <th data-col="delta"      data-type="num">Δ</th>
            <th data-col="turns"      data-type="num">Turns↗</th>
            <th data-col="maxReached" data-type="pct">Max%</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
      ${PaginationBar()}
    </div>`;
}
