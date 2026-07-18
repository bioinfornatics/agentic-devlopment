/**
 * SubjectResultsGrid — Organism
 *
 * Responsive grid of EvalResultCard molecules — one card per evaluated subject.
 * Renders each subject's latest metrics as a self-contained surface; the grid
 * collapses to a single column on narrow viewports.
 *
 * This organism replaces the earlier pattern of listing subject results only
 * inside the chart data payload or as anonymous table rows. Each card is
 * independently meaningful: kind badge, subject name, with%, base%, and Δ.
 *
 * Empty-state: when no subjects have been evaluated the section is hidden
 * via a CSS display:none on the wrapper to avoid an empty grid.
 *
 * @level Organism
 * @composition EvalResultCard (molecule)
 */
import { EvalResultCard, type EvalResultCardData } from "../molecules/EvalResultCard.js";

export function SubjectResultsGrid(cards: EvalResultCardData[]): string {
  if (cards.length === 0) return "";

  const cardHtml = cards.map(EvalResultCard).join("\n");

  return `<div>
      <p class="subjects-grid__heading">Subject Results</p>
      <div class="subjects-grid">
${cardHtml}
      </div>
    </div>`;
}
