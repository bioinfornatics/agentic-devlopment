/**
 * HtmlReportBuilder — tests as living documentation.
 *
 * Documents the HTML contract:
 *   • every subject appears as a card
 *   • positive/negative deltas get distinct CSS classes
 *   • the output is a complete standalone HTML document
 *   • the generation timestamp is embedded
 */
import { describe, it, expect } from "vitest";
import { HtmlReportBuilder } from "../htmlBuilder.js";
import type { HistoryRow, ResultRow } from "../../persistence/ports.js";

// ── Fixture factories ────────────────────────────────────────────────────────

function historyRow(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    runId:               "run-001",
    kind:                "skills",
    subject:             "code-review",
    contentHash:         "abc123def456abcd",
    gitCommit:           null,
    gitDirty:            false,
    provider:            null,
    model:               null,
    turnsUsedMean:       4.5,
    maxTurnsMean:        8,
    maxTurnsReachedRate: 0,
    createdAt:           "2026-07-18T08:00:00Z",
    ...overrides,
  };
}

function resultRow(overrides: Partial<ResultRow> = {}): ResultRow {
  return {
    runId:           "run-001",
    evalId:          0,
    configuration:   "with_skill",
    passRate:        0.8,
    turnsUsed:       4,
    maxTurns:        8,
    maxTurnsReached: 0,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("HtmlReportBuilder", () => {
  const builder = new HtmlReportBuilder();

  it("produces a valid standalone HTML document (starts with <!doctype html>)", async () => {
    const html = await builder.build({ runs: [], results: [], generatedAt: "2026-07-18T08:00:00Z" });

    expect(html.trim().toLowerCase()).toMatch(/^<!doctype html>/);
    expect(html).toContain("</html>");
  });

  it("embeds the generation timestamp in the output", async () => {
    const ts   = "2026-07-18T12:34:56Z";
    const html = await builder.build({ runs: [], results: [], generatedAt: ts });

    expect(html).toContain(ts);
  });

  it("includes a card for each unique subject", async () => {
    const runs = [
      historyRow({ subject: "code-review", runId: "r1" }),
      historyRow({ subject: "sdd",         runId: "r2" }),
    ];
    const html = await builder.build({ runs, results: [], generatedAt: "" });

    expect(html).toContain("code-review");
    expect(html).toContain("sdd");
  });

  it("shows a positive delta with the green CSS class (delta-pos)", async () => {
    const runs    = [historyRow({ subject: "code-review" })];
    const results = [
      resultRow({ configuration: "with_skill",    passRate: 0.8 }),
      resultRow({ configuration: "without_skill", passRate: 0.4 }),
    ];
    const html = await builder.build({ runs, results, generatedAt: "" });

    // +40% improvement → green styling
    expect(html).toContain("delta-pos");
    expect(html).toContain("+40.0%");
  });

  it("shows a negative delta with the red CSS class (delta-neg)", async () => {
    const runs    = [historyRow({ subject: "code-review" })];
    const results = [
      resultRow({ configuration: "with_skill",    passRate: 0.3 }),
      resultRow({ configuration: "without_skill", passRate: 0.7 }),
    ];
    const html = await builder.build({ runs, results, generatedAt: "" });

    // Skill hurts performance → red
    expect(html).toContain("delta-neg");
    expect(html).toContain("-40.0%");
  });

  it("shows '—' as delta when there is no baseline result to compare against", async () => {
    const runs    = [historyRow()];
    const results = [resultRow({ configuration: "with_skill", passRate: 0.8 })];
    // No without_skill result → no baseline
    const html = await builder.build({ runs, results, generatedAt: "" });

    expect(html).toContain("—");
  });

  it("includes the run count in the summary metadata", async () => {
    const runs = [
      historyRow({ runId: "r1" }),
      historyRow({ runId: "r2" }),
    ];
    const html = await builder.build({ runs, results: [], generatedAt: "" });

    expect(html).toContain("2 runs");
  });

  it("produces self-contained HTML — contains embedded CSS (no external stylesheets)", async () => {
    const html = await builder.build({ runs: [], results: [], generatedAt: "" });

    expect(html).toContain("<style>");
    expect(html).not.toMatch(/rel=["']stylesheet["']/);
  });
});
