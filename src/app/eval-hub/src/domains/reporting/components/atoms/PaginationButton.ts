/**
 * PaginationButton — Atom
 *
 * A single pg-btn pagination control. The id is the stable DOM contract
 * consumed by the tableController script (pgPrev / pgNext).
 *
 * @level Atom
 */
export function PaginationButton(id: string, label: string): string {
  return `<button class="pg-btn" id="${id}">${label}</button>`;
}
