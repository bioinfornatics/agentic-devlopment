/**
 * ChartCard — Molecule
 *
 * A titled surface containing a Chart.js canvas.
 * Heading text describes the chart; canvasId is the DOM contract
 * for the chartBuilders script.
 *
 * @level Molecule
 * @composition ChartCanvas (atom)
 */
import { ChartCanvas } from "../atoms/ChartCanvas.js";
import { esc }         from "../utils.js";

export function ChartCard(heading: string, canvasId: string, height: string): string {
  return `\
      <div class="chart-card">
        <h2>${esc(heading)}</h2>
        ${ChartCanvas(canvasId, height)}
      </div>`;
}
