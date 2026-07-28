/**
 * PaginationBar — Molecule
 *
 * Prev/Next navigation strip with current-page info and row-range text.
 *
 * DOM contracts (consumed by tableController script):
 *   #pgPrev  — previous-page button
 *   #pgNext  — next-page button
 *   #pgInfo  — "Page N / M" text span
 *   #pgRange — "X–Y of Z" text span
 *
 * @level Molecule
 * @composition PaginationButton (atom)
 */
import { PaginationButton } from "../atoms/PaginationButton.js";

export function PaginationBar(): string {
  return `\
      <div class="pagination">
        ${PaginationButton("pgPrev", "‹ Prev")}
        <span id="pgInfo">Page 1</span>
        ${PaginationButton("pgNext", "Next ›")}
        <span style="margin-left:auto">Showing <span id="pgRange">—</span></span>
      </div>`;
}
