/**
 * StatRow — Organism
 *
 * A responsive auto-grid of StatCard molecules showing top-level run statistics.
 * Receives its data from the page component; renders no hardcoded values.
 *
 * @level Organism
 * @composition StatCard (molecule)
 */
import { StatCard, type StatCardData } from "../molecules/StatCard.js";

export function StatRow(cards: StatCardData[]): string {
  return `<div class="stat-row">
${cards.map(StatCard).join("\n")}
    </div>`;
}
