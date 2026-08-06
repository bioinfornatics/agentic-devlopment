/**
 * Stat metric atoms — StatLabel, StatValue, StatSub.
 *
 * Three atoms that compose into a StatCard molecule.
 * Each is independently testable and stylable.
 *
 * @level Atoms
 */
import { esc } from "../utils.js";

/** Upper-case muted category label, e.g. "Total Runs". */
export function StatLabel(text: string): string {
  return `<div class="label">${esc(text)}</div>`;
}

/** Large numeric or text value with optional colour utility class. */
export function StatValue(value: string, colorClass = ""): string {
  const cls = colorClass ? ` ${colorClass}` : "";
  return `<div class="value${cls}">${value}</div>`;
}

/** Small muted sub-text beneath the value. */
export function StatSub(text: string): string {
  return `<div class="sub">${esc(text)}</div>`;
}
