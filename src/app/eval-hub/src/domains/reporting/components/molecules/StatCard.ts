/**
 * StatCard — Molecule
 *
 * A summary stat card: upper-case label + large coloured value + small sub-text.
 * Composed from the StatLabel, StatValue, and StatSub atoms.
 *
 * @level Molecule
 * @composition StatLabel, StatValue, StatSub (atoms)
 */
import { StatLabel, StatValue, StatSub } from "../atoms/StatMetric.js";

export interface StatCardData {
  label:       string;
  value:       string;
  valueClass?: string;
  sub:         string;
}

export function StatCard({ label, value, valueClass, sub }: StatCardData): string {
  return `\
      <div class="stat-card">
        ${StatLabel(label)}
        ${StatValue(value, valueClass)}
        ${StatSub(sub)}
      </div>`;
}
