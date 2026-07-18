/**
 * chartBuildersScript — Script fragment
 *
 * Returns the client-side JavaScript that initialises the three Chart.js charts.
 *
 * Canvas IDs must match ChartGrid organism output:
 *   barChart   — horizontal delta bar chart
 *   lineChart  — pass-rate trend line chart
 *   donutChart — overall with/without doughnut
 *
 * Data variables consumed (injected by EvalReportPage before this runs):
 *   BAR_DATA   — { label, value, color }[]
 *   TREND_DATA — { labels: string[], with: number[], base: number[] }
 *   DONUT_DATA — { with: number, base: number }
 *
 * @level Script (inline JS fragment, not a UI component)
 */
export function chartBuildersScript(): string {
  return `
/* ── Bar chart — delta by subject ───────────────────── */
(function buildBar() {
  const ctx = document.getElementById("barChart");
  if (!ctx) return;
  const labels = BAR_DATA.map(d => d.label);
  const values = BAR_DATA.map(d => d.value);
  const colors = BAR_DATA.map(d => d.color);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Δ pass rate (%)", data: values, backgroundColor: colors, borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => (ctx.parsed.x >= 0 ? "+" : "") + ctx.parsed.x.toFixed(1) + "%"
      }}},
      scales: {
        x: { grid: { color: "#f1f3f5" }, ticks: { callback: v => (v >= 0 ? "+" : "") + v + "%" } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    }
  });
})();

/* ── Line chart — trend ─────────────────────────────── */
(function buildLine() {
  const ctx = document.getElementById("lineChart");
  if (!ctx) return;
  new Chart(ctx, {
    type: "line",
    data: {
      labels: TREND_DATA.labels,
      datasets: [
        { label: "With skill/agent",  data: TREND_DATA.with, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,.08)",
          tension: .3, fill: true, pointRadius: 3, borderWidth: 2 },
        { label: "Baseline (without)", data: TREND_DATA.base, borderColor: "#94a3b8", backgroundColor: "rgba(148,163,184,.08)",
          tension: .3, fill: true, pointRadius: 3, borderWidth: 2, borderDash: [4,3] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 20 } },
                 tooltip: { callbacks: { label: c => c.dataset.label + ": " + (c.parsed.y ?? "—") + "%" } }},
      scales: {
        y: { min: 0, max: 100, grid: { color: "#f1f3f5" }, ticks: { callback: v => v + "%" } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
      },
    }
  });
})();

/* ── Doughnut chart — overall pass rates ────────────── */
(function buildDonut() {
  const ctx = document.getElementById("donutChart");
  if (!ctx) return;
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["With (" + DONUT_DATA.with + "%)", "Without (" + DONUT_DATA.base + "%)"],
      datasets: [{ data: [DONUT_DATA.with, DONUT_DATA.base],
        backgroundColor: ["rgba(34,197,94,.85)", "rgba(148,163,184,.6)"],
        borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "70%",
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 14 } } },
    }
  });
})();
`;
}
