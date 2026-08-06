/**
 * ChartCanvas — Atom
 *
 * A correctly-sized chart-wrap container holding a Chart.js canvas element.
 * The canvas id is the stable contract consumed by the chartBuilders script.
 *
 * @level Atom
 */
export function ChartCanvas(id: string, height: string): string {
  return `<div class="chart-wrap" style="height:${height}"><canvas id="${id}"></canvas></div>`;
}
