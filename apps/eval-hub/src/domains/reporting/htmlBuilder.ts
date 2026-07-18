/**
 * HtmlReportBuilder — standalone eval trend dashboard.
 *
 * Embeds Chart.js (from node_modules) and all CSS/JS inline — no CDN, works offline.
 *
 * Charts:
 *   • Horizontal bar  — latest Δ per subject, sorted, green/red
 *   • Multi-line      — pass-rate trend over last 30 layered runs (with vs without)
 *   • Doughnut        — overall with/without pass-rate split
 *
 * Table: sortable by any column, real-time filter by subject/kind.
 *
 * HTML/CSS/JS rendering is fully delegated to the atomic component hierarchy:
 *   components/quarks → atoms → molecules → organisms → templates → pages
 *
 * This class is responsible only for:
 *   1. Loading the Chart.js source once from node_modules.
 *   2. Aggregating raw HistoryRow / ResultRow data into page-level values.
 *   3. Invoking EvalReportPage with the prepared data.
 */
import fs from "node:fs/promises";
import type { HistoryRow, ResultRow } from "../persistence/ports.js";
import {
  EvalReportPage,
  type EvalReportPageData,
} from "./components/pages/EvalReportPage.js";
import type { RunRow }             from "./components/molecules/TableRow.js";
import type { EvalResultCardData } from "./components/molecules/EvalResultCard.js";

export interface TrendReportData {
  runs:        HistoryRow[];
  results:     ResultRow[];
  generatedAt: string;
}

// ── Chart.js source — loaded once from node_modules ───────────────────────────

let _chartJs: string | null = null;

async function chartJsSource(): Promise<string> {
  if (_chartJs) return _chartJs;
  try {
    // Resolve relative to the compiled output location:
    // dist/domains/reporting/htmlBuilder.js → ../../../node_modules/chart.js/dist/…
    const chartUrl = new URL(
      "../../../node_modules/chart.js/dist/chart.umd.min.js",
      import.meta.url,
    );
    _chartJs = await fs.readFile(chartUrl, "utf8");
  } catch {
    _chartJs = "/* chart.js unavailable — run: pnpm -C apps add chart.js */";
  }
  return _chartJs!;
}

// ── Data pipeline ─────────────────────────────────────────────────────────────

interface SubjectSummary {
  subject:   string;
  kind:      string;
  withRate:  number | null;
  baseRate:  number | null;
  delta:     number | null;
  runCount:  number;
  createdAt: string;
}

/** Collapse all runs for each subject to a single latest-run summary, sorted by delta desc. */
function buildSubjectSummaries(runs: HistoryRow[], results: ResultRow[]): SubjectSummary[] {
  const bySubject = new Map<string, HistoryRow[]>();
  for (const r of runs) {
    (bySubject.get(r.subject) ?? bySubject.set(r.subject, []).get(r.subject)!).push(r);
  }

  return [...bySubject.entries()].map(([subject, sruns]) => {
    const latest = sruns[0]!;
    const res    = results.filter(r => r.runId === latest.runId);
    const withR  = res.find(r => r.configuration.startsWith("with_"))?.passRate ?? null;
    const baseR  = res.find(r =>
      r.configuration.startsWith("without_") || r.configuration.endsWith("_only"),
    )?.passRate ?? null;
    return {
      subject,
      kind:      latest.kind,
      withRate:  withR,
      baseRate:  baseR,
      delta:     withR != null && baseR != null ? withR - baseR : null,
      runCount:  sruns.length,
      createdAt: latest.createdAt,
    };
  }).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
}

/** Format a 0–1 pass rate as "80%" or "—". */
const fmtPct = (v: number | null) =>
  v != null ? (v * 100).toFixed(0) + "%" : "—";

/** Format a delta fraction with sign, e.g. "+40.0%" or "—". */
const fmtDelta = (d: number | null) =>
  d == null ? "—" : (d >= 0 ? "+" : "") + (d * 100).toFixed(1) + "%";

/**
 * Convert SubjectSummary list into EvalResultCardData for the SubjectResultsGrid organism.
 * One card per unique subject, sorted by delta descending (best improvement first).
 */
function buildSubjectCards(summaries: SubjectSummary[]): EvalResultCardData[] {
  return summaries.map(s => ({
    subject:  s.subject,
    kind:     s.kind,
    withPct:  fmtPct(s.withRate),
    basePct:  fmtPct(s.baseRate),
    deltaFmt: fmtDelta(s.delta),
    delta:    s.delta,
  }));
}

/** Build the flat RunRow list used both by the client-side table and JSON serialisation. */
function buildRunRows(runs: HistoryRow[], results: ResultRow[]): RunRow[] {
  return runs.slice(0, 200).map(r => {
    const res   = results.filter(x => x.runId === r.runId);
    const withR = res.find(x => x.configuration.startsWith("with_"))?.passRate ?? null;
    const baseR = res.find(x =>
      x.configuration.startsWith("without_") || x.configuration.endsWith("_only"),
    )?.passRate ?? null;
    const delta = withR != null && baseR != null ? withR - baseR : null;
    return {
      date:       r.createdAt.slice(0, 16).replace("T", " "),
      kind:       r.kind,
      subject:    r.subject,
      withPct:    fmtPct(withR),
      basePct:    fmtPct(baseR),
      delta,
      deltaFmt:   fmtDelta(delta),
      turns:      r.turnsUsedMean != null ? r.turnsUsedMean.toFixed(1) : "—",
      maxReached: r.maxTurnsReachedRate != null
        ? (r.maxTurnsReachedRate * 100).toFixed(0) + "%" : "—",
    };
  });
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class HtmlReportBuilder {

  async build(data: TrendReportData): Promise<string> {
    const chartJs   = await chartJsSource();
    const summaries = buildSubjectSummaries(data.runs, data.results);
    const rows      = buildRunRows(data.runs, data.results);

    // ── Aggregate stats ──────────────────────────────────────────────────────
    const totalRuns  = data.runs.length;
    const improving  = summaries.filter(s => (s.delta ?? 0) > 0).length;
    const regressing = summaries.filter(s => (s.delta ?? 0) < 0).length;
    const deltaSamples = summaries.filter(s => s.delta != null);
    const avgDelta   = deltaSamples.reduce((a, s) => a + s.delta!, 0)
                       / Math.max(1, deltaSamples.length);
    const fmt        = (d: number) => (d >= 0 ? "+" : "") + (d * 100).toFixed(1) + "%";
    const avgFmt     = isNaN(avgDelta) ? "—" : fmt(avgDelta);

    // ── Serialise chart data ─────────────────────────────────────────────────
    const barDataJson = JSON.stringify(
      summaries.slice(0, 20).map(s => ({
        label: s.subject,
        value: s.delta != null ? +(s.delta * 100).toFixed(1) : 0,
        color: (s.delta ?? 0) >= 0 ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.8)",
      })),
    );

    const sorted30    = [...data.runs]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-30);
    const pick = (row: HistoryRow, prefix: "with_" | "without_") => {
      const res = data.results.filter(x => x.runId === row.runId);
      const v = prefix === "with_"
        ? res.find(x => x.configuration.startsWith("with_"))?.passRate ?? null
        : res.find(x =>
            x.configuration.startsWith("without_") || x.configuration.endsWith("_only"),
          )?.passRate ?? null;
      return v != null ? +(v * 100).toFixed(1) : null;
    };
    const trendDataJson = JSON.stringify({
      labels: sorted30.map(r => r.createdAt.slice(0, 10)),
      with:   sorted30.map(r => pick(r, "with_")),
      base:   sorted30.map(r => pick(r, "without_")),
    });

    const allWith = data.results.filter(r => r.configuration.startsWith("with_") && r.passRate != null);
    const allBase = data.results.filter(r =>
      (r.configuration.startsWith("without_") || r.configuration.endsWith("_only"))
      && r.passRate != null,
    );
    const avg = (xs: ResultRow[]) =>
      xs.length ? xs.reduce((a, r) => a + r.passRate!, 0) / xs.length : 0;
    const donutDataJson = JSON.stringify({
      with: +(avg(allWith) * 100).toFixed(1),
      base: +(avg(allBase) * 100).toFixed(1),
    });

    // ── Delegate to page component ───────────────────────────────────────────
    const pageData: EvalReportPageData = {
      generatedAt:   data.generatedAt,
      totalRuns,
      subjectCount:  summaries.length,
      avgDelta,
      avgFmt,
      improving,
      regressing,
      subjectCards:  buildSubjectCards(summaries),
      barDataJson,
      trendDataJson,
      donutDataJson,
      rowsJson:      JSON.stringify(rows),
    };

    return EvalReportPage(pageData, chartJs);
  }
}
