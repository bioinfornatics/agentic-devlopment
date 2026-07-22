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
import { esc } from "./components/utils.js";
import type { IntegrityReport }    from "./integrityReport.js";

export interface FeedbackRecord {
  runId: string;
  kind: string;
  subject: string;
  evalId: number;
  configuration: string;
  expectation: string;
  passed: boolean;
  evidence: string;
  source: string;
}

export interface TrendReportData {
  runs:        HistoryRow[];
  results:     ResultRow[];
  feedback?:   FeedbackRecord[];
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

// ── Integrity report rendering helpers ───────────────────────────────────────

/**
 * Format a pp value for display.
 * null  → em dash "—"  (EVAL-INT-06: never coerce to zero)
 * 0.0   → "0.00 pp"    (0.0 is a valid measurable value)
 * 15.0  → "15.00 pp"
 */
function fmtPpValue(v: number | null): string {
  return v === null ? "—" : v.toFixed(2) + " pp";
}

/**
 * Format a 95% CI interval.
 * n >= 2 (finite bounds): "[lower pp, upper pp]"  e.g. "[-3.00 pp, 13.00 pp]"
 * n < 2  (null bounds):   the reason string         e.g. "insufficient_pairs"
 *
 * EVAL-INT-10
 */
function fmtCiInterval(
  interval: IntegrityReport["pairMicro"]["interval"],
): string {
  if (interval.lower === null || interval.upper === null) {
    return interval.reason ?? "—";
  }
  return `[${interval.lower.toFixed(2)} pp, ${interval.upper.toFixed(2)} pp]`;
}

/**
 * Render a standalone HTML integrity report from a canonical IntegrityReport DTO.
 *
 * Synchronous — no filesystem, no network, no provider access.
 * Consumes the DTO directly; does not recompute from grading.json.
 *
 * Mandatory visible fields (EVAL-INT-06/07/08/09/10/13/14/16/18/20):
 *   schema, manifestHash, observed-differences wording (non-causal),
 *   delta unit pp, score formula, pairMicro/subjectMacro means + denominators,
 *   95% CI bounds or insufficient_pairs, validPairCount, includedSubjectCount,
 *   excludedPairCounts by reason, subjectFailureCounts (incl. schema_legacy_incomplete),
 *   null → em dash "—" (never zero).
 *
 * Language invariants (EVAL-INT-16):
 *   NEVER "statistically significant", NEVER causal ("caused", "proves").
 */
function buildIntegrityHtml(
  report: IntegrityReport,
  meta: { generatedAt: string; scope?: string },
): string {
  const { generatedAt, scope } = meta;

  // ── Scope line (optional) ──────────────────────────────────────────────
  const scopeLine = scope
    ? `\n<p class="ir-scope"><span class="ir-label">Scope:</span> ${esc(scope)}</p>`
    : "";

  // ── Interval strings ───────────────────────────────────────────────────
  const pairIntervalFmt    = fmtCiInterval(report.pairMicro.interval);
  const subjectIntervalFmt = fmtCiInterval(report.subjectMacro.interval);

  // ── Mean delta cells (null → em dash) ─────────────────────────────────
  const pairMeanCell = report.pairMicro.meanDeltaPp === null
    ? `<span class="ir-null">—</span>`
    : fmtPpValue(report.pairMicro.meanDeltaPp);
  const subjectMeanCell = report.subjectMacro.meanDeltaPp === null
    ? `<span class="ir-null">—</span>`
    : fmtPpValue(report.subjectMacro.meanDeltaPp);

  // ── Candidate/Baseline score cells (null → em dash) ─────────────────────
  const fmtScore = (score: number | null): string =>
    score === null ? `<span class="ir-null">—</span>` : score.toFixed(4);

  const pairCandidateCell = fmtScore(report.pairMicro.candidateMean);
  const pairBaselineCell  = fmtScore(report.pairMicro.baselineMean);
  const subjectCandidateCell = fmtScore(report.subjectMacro.candidateMean);
  const subjectBaselineCell  = fmtScore(report.subjectMacro.baselineMean);

  // ── Excluded pair counts table rows ───────────────────────────────────
  const excludedEntries = Object.entries(report.excludedPairCounts);
  const excludedRows = excludedEntries.length > 0
    ? excludedEntries
        .map(([k, v]) => `      <tr><td>${esc(k)}</td><td>${v}</td></tr>`)
        .join("\n")
    : `      <tr><td colspan="2" class="ir-null">—</td></tr>`;

  // ── Subject failure counts table rows ─────────────────────────────────
  const failureEntries = Object.entries(report.subjectFailureCounts);
  const subjectFailureRows = failureEntries.length > 0
    ? failureEntries
        .map(([k, v]) => `      <tr><td>${esc(k)}</td><td>${v}</td></tr>`)
        .join("\n")
    : `      <tr><td colspan="2" class="ir-null">—</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Integrity Report — ${esc(report.manifestHash)}</title>
<style>
  :root{font-family:system-ui,sans-serif;line-height:1.5;color-scheme:light dark}
  body{max-width:860px;margin:2rem auto;padding:0 1.25rem}
  h1{font-size:1.55rem;margin-bottom:.2rem}
  h2{font-size:1.05rem;border-bottom:1px solid #d1d5db;padding-bottom:.3rem;margin-top:1.75rem}
  .ir-meta,.ir-scope{color:#6b7280;font-size:.83rem;margin:.2rem 0}
  .ir-label{font-weight:600}
  .ir-caution{border-left:4px solid #f59e0b;padding:.65rem 1rem;background:#fffbeb;color:#78350f;margin:1.1rem 0;border-radius:0 4px 4px 0}
  table{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}
  th,td{padding:.38rem .8rem;border:1px solid #e5e7eb;text-align:left;font-size:.88rem}
  th{background:#f9fafb;font-weight:600}
  code{font-family:ui-monospace,monospace;background:#f3f4f6;padding:.1rem .35rem;border-radius:3px;font-size:.86em}
  .ir-null{color:#9ca3af}
</style>
</head>
<body>
<h1>Integrity Report</h1>
<p class="ir-meta"><span class="ir-label">Generated:</span> ${esc(generatedAt || "—")} | <span class="ir-label">Schema:</span> ${esc(report.schema)} | <span class="ir-label">Manifest:</span> ${esc(report.manifestHash)}</p>${scopeLine}
<div class="ir-caution" role="note">
  Describes <strong>observed paired differences</strong> only — not a causal claim.
  These results apply only to the configured eval suite, subjects, repetitions, grader, and
  runtime recorded in the manifest; they do not generalise beyond this eval suite and do not
  establish that any layer produced, drove, or explains the observed difference in general.
</div>

<section>
<h2>Summary</h2>
<table>
<thead><tr><th>Field</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Valid Pairs</td><td>${report.validPairCount}</td></tr>
<tr><td>Included Subjects</td><td>${report.includedSubjectCount}</td></tr>
<tr><td>Delta Unit</td><td>pp (percentage points)</td></tr>
<tr><td>Score Formula</td><td><code>passed_criteria_count / expected_criteria_count</code></td></tr>
</tbody>
</table>
</section>

<section>
<h2>Pair-Micro Summary <small>(n = ${report.pairMicro.n} valid pairs)</small></h2>
<p>Arithmetic mean of all valid pair deltas across included subjects, eval IDs, and repetitions.</p>
<table>
<thead><tr><th>Metric</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Candidate score</td><td>${pairCandidateCell}</td></tr>
<tr><td>Baseline score</td><td>${pairBaselineCell}</td></tr>
<tr><td>Mean Delta (pp)</td><td>${pairMeanCell}</td></tr>
<tr><td>n (valid pairs)</td><td>${report.pairMicro.n}</td></tr>
<tr><td>95% CI — ${esc(report.pairMicro.interval.method)}</td><td>${esc(pairIntervalFmt)}</td></tr>
</tbody>
</table>
</section>

<section>
<h2>Subject-Macro Summary <small>(n = ${report.subjectMacro.n} included subjects)</small></h2>
<p>Arithmetic mean of per-subject mean paired deltas across included subjects.</p>
<table>
<thead><tr><th>Metric</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Candidate score</td><td>${subjectCandidateCell}</td></tr>
<tr><td>Baseline score</td><td>${subjectBaselineCell}</td></tr>
<tr><td>Mean Delta (pp)</td><td>${subjectMeanCell}</td></tr>
<tr><td>n (included subjects)</td><td>${report.subjectMacro.n}</td></tr>
<tr><td>95% CI — ${esc(report.subjectMacro.interval.method)}</td><td>${esc(subjectIntervalFmt)}</td></tr>
</tbody>
</table>
</section>

<section>
<h2>Excluded Pair Counts (by reason)</h2>
<table>
<thead><tr><th>Reason</th><th>Count</th></tr></thead>
<tbody>
${excludedRows}
</tbody>
</table>
</section>

<section>
<h2>Subject Failure Counts</h2>
<table>
<thead><tr><th>Reason</th><th>Count</th></tr></thead>
<tbody>
${subjectFailureRows}
</tbody>
</table>
</section>
</body>
</html>`;
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

    const feedback = data.feedback ?? [];
    const candidateFailures = feedback.filter(item => !item.passed && item.configuration.startsWith("with_"));
    const runDelta = new Map(summaries.map(item => [item.subject, item.delta]));
    const priority = (subject: string) => (runDelta.get(subject) ?? 0) < 0 ? "HIGH" : "MEDIUM";
    const evidenceHtml = feedback.length === 0
      ? `<p>No grader feedback is available. Run or re-grade evaluations to populate expectation evidence.</p>`
      : `<h3>Complete grader evidence</h3>${feedback.map(item => `<details class="feedback-evidence"><summary>${esc(item.subject)} · eval ${item.evalId} · ${esc(item.configuration)} · ${item.passed ? "PASS" : "FAIL"}</summary><p><strong>Expectation:</strong> ${esc(item.expectation)}</p><p><strong>Evidence:</strong> ${esc(item.evidence)}</p><p class="provenance"><strong>Provenance:</strong> ${esc(item.source)}</p></details>`).join("")}`;
    const recommendationsHtml = candidateFailures.length === 0
      ? `<p>No failed candidate expectations require remediation.</p>`
      : candidateFailures.map(item => {
          const delta = runDelta.get(item.subject);
          const signal = delta != null && delta < 0 ? "Regression" : delta === 0 ? "No improvement" : "Candidate failure";
          return `<article class="feedback-item"><h3>${esc(item.subject)} · ${signal} · <span class="severity">${priority(item.subject)}</span></h3><p><strong>Expectation:</strong> ${esc(item.expectation)}</p><p><strong>Evidence:</strong> ${esc(item.evidence)}</p><p><strong>Recommendation:</strong> Update the ${esc(item.kind)} contract or scenario fixture so the candidate emits the required artifact, then rerun this scenario.</p><p class="provenance"><strong>Provenance:</strong> eval ${item.evalId}, ${esc(item.configuration)} · ${esc(item.source)}</p></article>`;
        }).join("");
    const feedbackHtml = `<section class="feedback-panel"><h2>Feedback, Insights &amp; Recommendations</h2><p>Deterministic insights from failed candidate expectations. Regressions are prioritized first.</p>${recommendationsHtml}${evidenceHtml}</section>`;
    return EvalReportPage(pageData, chartJs).replace("<!-- Runs table -->", feedbackHtml + "\n    <!-- Runs table -->");
  }

  /**
   * Build a standalone integrity report HTML page from a canonical IntegrityReport DTO.
   *
   * Synchronous — no filesystem, no network, no grading.json recomputation.
   * Consumes the DTO directly so all values are taken from the pre-computed report.
   *
   * EVAL-INT-06/07/08/09/10/13/14/16/18/20
   *
   * @param report     Canonical IntegrityReport DTO (from integrityReport.ts or deserialized)
   * @param meta       Rendering metadata: generatedAt timestamp and optional scope label
   */
  buildIntegrity(
    report: IntegrityReport,
    meta: { generatedAt: string; scope?: string },
  ): string {
    return buildIntegrityHtml(report, meta);
  }
}
