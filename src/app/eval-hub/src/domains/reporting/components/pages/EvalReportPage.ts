/**
 * EvalReportPage — Page
 *
 * Full eval trend report page. Assembles all organisms into the ReportLayout
 * template, injects serialised data and Chart.js, and returns a complete
 * standalone HTML document.
 *
 * This is the only component allowed to import from every atomic level.
 * Prop flow: data from HtmlReportBuilder → this page → organisms → molecules → atoms.
 *
 * @level Page
 * @composition ReportLayout (template), StatRow, ChartGrid, SubjectResultsGrid,
 *              RunsTable (organisms)
 * @scripts    chartBuildersScript, tableControllerScript
 */
import { ReportLayout }            from "../templates/ReportLayout.js";
import { StatRow }                 from "../organisms/StatRow.js";
import { ChartGrid }               from "../organisms/ChartGrid.js";
import { SubjectResultsGrid }      from "../organisms/SubjectResultsGrid.js";
import { RunsTable }               from "../organisms/RunsTable.js";
import { chartBuildersScript }     from "../scripts/chartBuilders.js";
import { tableControllerScript }   from "../scripts/tableController.js";
import { TOKENS_CSS }              from "../quarks/tokens.js";
import { ATOMS_CSS }               from "../atoms/css.js";
import { MOLECULES_CSS }           from "../molecules/css.js";
import { ORGANISMS_CSS }           from "../organisms/css.js";
import { TEMPLATE_CSS }            from "../templates/css.js";
import type { StatCardData }       from "../molecules/StatCard.js";
import type { EvalResultCardData } from "../molecules/EvalResultCard.js";

// ── Page data contract ────────────────────────────────────────────────────────

/**
 * All values the page component needs to render.
 * Computed by HtmlReportBuilder from raw HistoryRow / ResultRow data.
 */
export interface EvalReportPageData {
  /** ISO-8601 generation timestamp, e.g. "2026-07-18T08:00:00Z". */
  generatedAt:   string;
  totalRuns:     number;
  subjectCount:  number;
  /** Raw numeric average delta (used to pick text-green vs text-red). */
  avgDelta:      number;
  /** Pre-formatted average delta string, e.g. "+26.8%". */
  avgFmt:        string;
  improving:     number;
  regressing:    number;
  /**
   * Per-subject evaluation result cards, sorted by delta descending.
   * Rendered by SubjectResultsGrid; each entry is one EvalResultCard molecule.
   */
  subjectCards:  EvalResultCardData[];
  /** JSON-serialised BAR_DATA array for the chart script. */
  barDataJson:   string;
  /** JSON-serialised TREND_DATA object for the chart script. */
  trendDataJson: string;
  /** JSON-serialised DONUT_DATA object for the chart script. */
  donutDataJson: string;
  /** JSON-serialised ALL_ROWS array for the table script. */
  rowsJson:      string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Concatenate CSS from every atomic level in cascade order. */
function buildStyles(): string {
  return [TOKENS_CSS, TEMPLATE_CSS, ATOMS_CSS, MOLECULES_CSS, ORGANISMS_CSS].join("");
}

/** Build the four summary stat-card descriptors from page data. */
function buildStatCards(data: EvalReportPageData): StatCardData[] {
  return [
    {
      label:      "Total Runs",
      value:      String(data.totalRuns),
      valueClass: "text-blue",
      sub:        `${data.subjectCount} subjects evaluated`,
    },
    {
      label: "Avg Δ",
      value: data.avgFmt,
      // exactOptionalPropertyTypes: omit valueClass rather than setting it to undefined
      ...(isNaN(data.avgDelta) ? {} : { valueClass: data.avgDelta >= 0 ? "text-green" : "text-red" }),
      sub:   "pass-rate delta (with − without)",
    },
    {
      label:      "Improving",
      value:      String(data.improving),
      valueClass: "text-green",
      sub:        "skills with positive Δ",
    },
    {
      label:      "Regressing",
      value:      String(data.regressing),
      valueClass: "text-red",
      sub:        "skills with negative Δ",
    },
  ];
}

/** Build the data-injection block that precedes the chart and table scripts. */
function dataInjectionBlock(data: EvalReportPageData): string {
  return `\
/* ── Data injected by HtmlReportBuilder ─────────────── */
const GENERATED_AT = ${JSON.stringify(data.generatedAt)};
const BAR_DATA     = ${data.barDataJson};
const TREND_DATA   = ${data.trendDataJson};
const DONUT_DATA   = ${data.donutDataJson};
const ALL_ROWS     = ${data.rowsJson};
`;
}

// ── Page assembler ────────────────────────────────────────────────────────────

/**
 * Render the complete eval trend report page.
 *
 * @param data     - Pre-computed page data from HtmlReportBuilder.
 * @param chartJs  - The embedded Chart.js source (loaded once from node_modules).
 * @returns A complete standalone HTML document string.
 */
export function EvalReportPage(data: EvalReportPageData, chartJs: string): string {
  const metaText = `Generated: ${data.generatedAt.replace("T", " ").slice(0, 19)} UTC \
· ${data.totalRuns} runs · ${data.subjectCount} subjects`;

  // Arrange organisms into the body content area
  const body = [
    `<!-- Stat cards -->\n    ${StatRow(buildStatCards(data))}`,
    `<!-- Charts -->\n    ${ChartGrid()}`,
    `<!-- Subject results -->\n    ${SubjectResultsGrid(data.subjectCards)}`,
    `<!-- Runs table -->\n    ${RunsTable()}`,
  ].join("\n\n    ");

  // App script: outer IIFE → data injection → chart builders → table controller (closes IIFE)
  const appScript = [
    `(function () {`,
    `"use strict";`,
    ``,
    dataInjectionBlock(data),
    chartBuildersScript(),
    tableControllerScript(),
  ].join("\n");

  const scripts = [
    `<script>\n/* ── Embedded Chart.js ──────────────────────────────── */\n${chartJs}\n</script>`,
    `<script>\n${appScript}\n</script>`,
  ].join("\n");

  return ReportLayout({
    title:   "Eval Hub — Trend Report",
    meta:    metaText,
    styles:  buildStyles(),
    body,
    scripts,
  });
}
