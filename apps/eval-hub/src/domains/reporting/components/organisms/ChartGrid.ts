/**
 * ChartGrid — Organism
 *
 * Three-column chart panel: delta bar, trend line, and overall doughnut.
 * Canvas IDs are the stable DOM contract consumed by chartBuildersScript.
 *
 *   barChart   — horizontal bar: Δ per subject
 *   lineChart  — multi-line: pass-rate trend (last 30 runs)
 *   donutChart — doughnut: overall with vs without
 *
 * @level Organism
 * @composition ChartCard (molecule)
 */
import { ChartCard } from "../molecules/ChartCard.js";

export function ChartGrid(): string {
  return `<div class="chart-grid">
      ${ChartCard("Delta by Subject (latest run)", "barChart",   "320px")}
      ${ChartCard("Pass-Rate Trend (last 30 runs)", "lineChart",  "320px")}
      ${ChartCard("With vs Without (overall)",      "donutChart", "220px")}
    </div>`;
}
