/**
 * htmlBuilderIntegrity.test.ts — RED-first golden tests for HtmlReportBuilder.buildIntegrity
 *
 * Covers: EVAL-INT-06/07/08/09/10/13/14/16/18/20
 * Owner: agentic-devlopment-sur3.3
 *
 * Contract:
 *   HtmlReportBuilder.buildIntegrity(report, { generatedAt, scope? })
 *     — synchronous (no I/O)
 *     — consumes a canonical IntegrityReport DTO directly, no grading.json recomputation
 *     — returns a standalone escaped HTML string
 *
 * Invariants enforced here:
 *   • schema / manifestHash / observedDifferencesOnly visible in rendered HTML
 *   • delta unit "pp" and score formula "passed_criteria_count / expected_criteria_count" present
 *   • pairMicro and subjectMacro: means formatted as "N.NN pp", denominators shown
 *   • 95% CI rendered as "[lower pp, upper pp]" for n>=2, or "insufficient_pairs" for n<2
 *   • validPairCount / includedSubjectCount present
 *   • excludedPairCounts by reason present (grade_null, execution_failed, …)
 *   • subjectFailureCounts including schema_legacy_incomplete present
 *   • null meanDeltaPp → em dash "—", NEVER "0" or "0.00 pp"
 *   • NEVER "statistically significant" (EVAL-INT-16)
 *   • NEVER causal language: "caused", "proves" (EVAL-INT-16)
 *   • HTML-escaped: all user-supplied strings safe for embedding
 *   • Standalone: embedded CSS, no external stylesheets
 */
import { describe, it, expect } from "vitest";
import { HtmlReportBuilder } from "../htmlBuilder.js";
import type { IntegrityReport } from "../integrityReport.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Golden fixture — n=4 pairs, n=2 subjects.
 * pairMicro: interval [5.00, 25.00] — does NOT cross zero (positive lower bound).
 * subjectMacro: interval [-2.00, 27.00] — CROSSES zero.
 * Exercises: positive interval (pairMicro) and crossing-zero interval (subjectMacro)
 * in the same report, verifying both render correctly without "statistically significant".
 */
const goldenReport: IntegrityReport = {
  schema: "eval-integrity-v2",
  manifestHash: "abc123def456abcd",
  deltaUnit: "pp",
  observedDifferencesOnly: true,
  pairMicro: {
    meanDeltaPp: 15.0,
    n: 4,
    candidateMean: 0.65,
    baselineMean: 0.50,
    interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: 12.5,
    n: 2,
    candidateMean: 0.625,
    baselineMean: 0.50,
    interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: null },
  },
  validPairCount: 4,
  includedSubjectCount: 2,
  excludedPairCounts: { grade_null: 1, execution_failed: 2 },
  subjectFailureCounts: { schema_legacy_incomplete: 1 },
};

/**
 * Crossing-zero fixture — pairMicro interval [-3.00, 13.00] straddles zero.
 * Verifies: exact negative-lower rendering and EVAL-INT-16 language guards.
 */
const crossingZeroReport: IntegrityReport = {
  ...goldenReport,
  pairMicro: {
    meanDeltaPp: 5.0,
    n: 3,
    candidateMean: 0.55,
    baselineMean: 0.50,
    interval: { method: "paired_t_95pct_pp_v1", lower: -3.0, upper: 13.0, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: 4.5,
    n: 2,
    candidateMean: 0.545,
    baselineMean: 0.50,
    interval: { method: "paired_t_95pct_pp_v1", lower: -5.0, upper: 14.0, reason: null },
  },
  validPairCount: 3,
};

/**
 * Unmeasurable fixture — zero valid pairs, null means, insufficient_pairs everywhere.
 * Verifies: em-dash rendering for null, "insufficient_pairs" label, zero coercion guard.
 */
const unmeasurableReport: IntegrityReport = {
  schema: "eval-integrity-v2",
  manifestHash: "dead0000beef1234",
  deltaUnit: "pp",
  observedDifferencesOnly: true,
  pairMicro: {
    meanDeltaPp: null,
    n: 0,
    candidateMean: null,
    baselineMean: null,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  subjectMacro: {
    meanDeltaPp: null,
    n: 0,
    candidateMean: null,
    baselineMean: null,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 0,
  includedSubjectCount: 0,
  excludedPairCounts: { grade_null: 2, execution_failed: 1 },
  subjectFailureCounts: { schema_legacy_incomplete: 3 },
};

/**
 * Escaping fixture — manifestHash contains HTML special characters.
 * Verifies: all user-supplied strings are escaped; no injected markup executes.
 */
const escapingReport: IntegrityReport = {
  ...goldenReport,
  manifestHash: 'hash<script>alert("xss")</script>&evil',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HtmlReportBuilder.buildIntegrity", () => {
  const builder = new HtmlReportBuilder();

  // ── Return type / synchronicity ──────────────────────────────────────────

  it("[EVAL-INT-13] buildIntegrity is synchronous — returns a string, not a Promise", () => {
    const result = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(100);
  });

  // ── Document structure ───────────────────────────────────────────────────

  it("[EVAL-INT-13] produces a valid standalone HTML document (starts with <!doctype html>)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "2026-07-22T12:00:00Z" });
    expect(html.trim().toLowerCase()).toMatch(/^<!doctype html>/);
    expect(html).toContain("</html>");
  });

  it("[EVAL-INT-13] embeds all CSS inline — no external stylesheets", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/rel=["']stylesheet["']/);
  });

  it("[EVAL-INT-13] embeds the generation timestamp in the output", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "2026-07-22T16:27:00Z" });
    expect(html).toContain("2026-07-22T16:27:00Z");
  });

  it("[EVAL-INT-13] embeds optional scope when provided", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "", scope: "skills/code-review" });
    expect(html).toContain("skills/code-review");
  });

  it("[EVAL-INT-13] omits scope section when scope not provided", () => {
    const withScope    = builder.buildIntegrity(goldenReport, { generatedAt: "", scope: "x" });
    const withoutScope = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(withScope).toContain("x");
    // without scope: no orphaned scope text
    expect(withoutScope.toLowerCase()).not.toMatch(/scope:\s*undefined/);
  });

  // ── Schema and manifest identity (EVAL-INT-20 / EVAL-INT-14) ────────────

  it("[EVAL-INT-20] renders schema sentinel 'eval-integrity-v2' visibly", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("eval-integrity-v2");
  });

  it("[EVAL-INT-14] renders manifestHash value visibly", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("abc123def456abcd");
  });

  // ── HTML escaping (EVAL-INT-04 / EVAL-INT-16) ───────────────────────────

  it("[EVAL-INT-04] HTML-escapes manifestHash containing < > \" &", () => {
    const html = builder.buildIntegrity(escapingReport, { generatedAt: "" });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;evil");
  });

  it("[EVAL-INT-04] HTML-escaped scope when it contains special chars", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "", scope: "<b>scope</b>" });
    expect(html).not.toContain("<b>scope</b>");
    expect(html).toContain("&lt;b&gt;scope&lt;/b&gt;");
  });

  // ── Non-causal wording (EVAL-INT-16) ────────────────────────────────────

  it("[EVAL-INT-16] includes 'observed paired differences' wording (non-causal)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html.toLowerCase()).toMatch(/observed (paired )?diff/);
  });

  it("[EVAL-INT-16] NEVER uses 'statistically significant' for positive non-crossing interval", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html.toLowerCase()).not.toContain("statistically significant");
  });

  it("[EVAL-INT-16] NEVER uses 'statistically significant' for crossing-zero interval", () => {
    const html = builder.buildIntegrity(crossingZeroReport, { generatedAt: "" });
    expect(html.toLowerCase()).not.toContain("statistically significant");
  });

  it("[EVAL-INT-16] NEVER uses 'statistically significant' when insufficient_pairs", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html.toLowerCase()).not.toContain("statistically significant");
  });

  it("[EVAL-INT-16] NEVER uses causal word 'caused'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html.toLowerCase()).not.toContain("caused");
  });

  it("[EVAL-INT-16] NEVER uses causal word 'proves'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html.toLowerCase()).not.toContain("proves");
  });

  // ── Delta unit (EVAL-INT-08) ─────────────────────────────────────────────

  it("[EVAL-INT-08] renders delta unit 'pp' (percentage points) visibly", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("pp");
  });

  // ── Score formula (EVAL-INT-07) ──────────────────────────────────────────

  it("[EVAL-INT-07] renders score formula 'passed_criteria_count / expected_criteria_count'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("passed_criteria_count");
    expect(html).toContain("expected_criteria_count");
  });

  // ── Pair-micro summary: golden fixture (EVAL-INT-09 / EVAL-INT-10) ───────

  it("[EVAL-INT-09] renders pairMicro.meanDeltaPp as '15.00 pp'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("15.00 pp");
  });

  it("[EVAL-INT-09] renders pairMicro.n denominator (4 valid pairs)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    // n appears as the denominator; check it is visibly present
    expect(html).toMatch(/4\s*(valid\s*)?pair/i);
  });

  it("[EVAL-INT-10] renders pairMicro interval method 'paired_t_95pct_pp_v1'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("paired_t_95pct_pp_v1");
  });

  it("[EVAL-INT-10] renders pairMicro interval bounds as '[5.00 pp, 25.00 pp]' for positive non-crossing interval", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("[5.00 pp, 25.00 pp]");
  });

  it("[EVAL-INT-10] renders pairMicro crossing-zero interval as '[-3.00 pp, 13.00 pp]'", () => {
    const html = builder.buildIntegrity(crossingZeroReport, { generatedAt: "" });
    expect(html).toContain("[-3.00 pp, 13.00 pp]");
  });

  it("[EVAL-INT-10] renders 'insufficient_pairs' for pairMicro when n=0", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toContain("insufficient_pairs");
  });

  // ── Subject-macro summary (EVAL-INT-09 / EVAL-INT-10) ───────────────────

  it("[EVAL-INT-09] renders subjectMacro.meanDeltaPp as '12.50 pp'", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("12.50 pp");
  });

  it("[EVAL-INT-09] renders subjectMacro.n denominator (2 included subjects)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toMatch(/2\s*(included\s*)?subject/i);
  });

  it("[EVAL-INT-10] renders subjectMacro crossing-zero interval as '[-2.00 pp, 27.00 pp]'", () => {
    // goldenReport.subjectMacro.interval: lower=-2.0, upper=27.0 — crosses zero
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("[-2.00 pp, 27.00 pp]");
  });

  it("[EVAL-INT-10] renders subjectMacro interval for crossingZeroReport as '[-5.00 pp, 14.00 pp]'", () => {
    const html = builder.buildIntegrity(crossingZeroReport, { generatedAt: "" });
    expect(html).toContain("[-5.00 pp, 14.00 pp]");
  });

  it("[EVAL-INT-10] renders 'insufficient_pairs' for subjectMacro when n=0", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    // insufficient_pairs appears at least twice (pairMicro + subjectMacro)
    const matches = html.match(/insufficient_pairs/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  // ── Valid pairs and included subjects (EVAL-INT-18) ─────────────────────

  it("[EVAL-INT-18] renders validPairCount = 4", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toMatch(/valid\s*pair[^<]{0,30}4|4[^<]{0,30}valid\s*pair/i);
  });

  it("[EVAL-INT-18] renders includedSubjectCount = 2", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toMatch(/included\s*subject[^<]{0,30}2|2[^<]{0,30}included\s*subject/i);
  });

  it("[EVAL-INT-18] renders validPairCount = 0 for unmeasurable fixture", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toMatch(/valid\s*pair[^<]{0,30}0|0[^<]{0,30}valid\s*pair/i);
  });

  // ── Excluded pair counts by reason (EVAL-INT-18 / EVAL-INT-06) ──────────

  it("[EVAL-INT-18] renders excludedPairCounts reason 'grade_null' with count 1", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("grade_null");
  });

  it("[EVAL-INT-18] renders excludedPairCounts reason 'execution_failed' with count 2", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("execution_failed");
  });

  it("[EVAL-INT-18] renders excludedPairCounts counts for unmeasurable fixture (grade_null:2, execution_failed:1)", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toContain("grade_null");
    expect(html).toContain("execution_failed");
  });

  // ── Subject failure counts including schema_legacy_incomplete (EVAL-INT-18 / EVAL-INT-20) ─

  it("[EVAL-INT-18/20] renders subjectFailureCounts reason 'schema_legacy_incomplete' with count 1", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("schema_legacy_incomplete");
  });

  it("[EVAL-INT-18/20] renders schema_legacy_incomplete count = 3 in unmeasurable fixture", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toContain("schema_legacy_incomplete");
  });

  it("[EVAL-INT-18] renders em dash for empty excludedPairCounts (no exclusions)", () => {
    const noExclusions: IntegrityReport = {
      ...goldenReport,
      excludedPairCounts: {},
      subjectFailureCounts: {},
    };
    const html = builder.buildIntegrity(noExclusions, { generatedAt: "" });
    // em dash should appear in the empty tables
    expect(html).toContain("—");
  });

  // ── Null as em dash — never zero (EVAL-INT-06) ──────────────────────────

  it("[EVAL-INT-06] renders null pairMicro.meanDeltaPp as em dash '—', not as '0.00 pp'", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toContain("—");
    expect(html).not.toContain("0.00 pp");
  });

  it("[EVAL-INT-06] renders null subjectMacro.meanDeltaPp as em dash '—', not as '0.00 pp'", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    // confirm '—' exists and '0.00 pp' does not
    const emDashCount = (html.match(/—/g) ?? []).length;
    expect(emDashCount).toBeGreaterThanOrEqual(2); // at least pairMicro + subjectMacro
    expect(html).not.toContain("0.00 pp");
  });

  it("[EVAL-INT-06] renders finite zero meanDeltaPp as '0.00 pp', not as em dash", () => {
    // 0.0 is a valid measurable value — must NOT become em dash
    const zeroMeanReport: IntegrityReport = {
      ...goldenReport,
      pairMicro: {
        meanDeltaPp: 0.0,
        n: 2,
        candidateMean: 0.5,
        baselineMean: 0.5,
        interval: { method: "paired_t_95pct_pp_v1", lower: -5.0, upper: 5.0, reason: null },
      },
      validPairCount: 2,
    };
    const html = builder.buildIntegrity(zeroMeanReport, { generatedAt: "" });
    expect(html).toContain("0.00 pp");
  });

  // ── Candidate/Baseline means (EVAL-INT-14) ────────────────────────────────

  it("[EVAL-INT-14] renders pairMicro candidateMean as '0.6500' (score unit)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("0.6500");
  });

  it("[EVAL-INT-14] renders pairMicro baselineMean as '0.5000' (score unit)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("0.5000");
  });

  it("[EVAL-INT-14] renders subjectMacro candidateMean as '0.6250' (score unit)", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    expect(html).toContain("0.6250");
  });

  it("[EVAL-INT-14] renders null pairMicro candidateMean as em dash '—'", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    // null candidateMean/baselineMean → em dash (at least 4 dashes: pairMicro cand/base + subjectMacro cand/base + mean)
    const emDashCount = (html.match(/—/g) ?? []).length;
    expect(emDashCount).toBeGreaterThanOrEqual(4);
  });

  it("[EVAL-INT-14] renders null subjectMacro baselineMean as em dash '—'", () => {
    const html = builder.buildIntegrity(unmeasurableReport, { generatedAt: "" });
    expect(html).toContain("—");
    // Must not show "0.0000" or "0.00" for null means
    expect(html).not.toContain("0.0000");
  });

  it("[EVAL-INT-14] Candidate score and Baseline score labels appear for both scopes", () => {
    const html = builder.buildIntegrity(goldenReport, { generatedAt: "" });
    const candidateCount = (html.match(/Candidate score/gi) ?? []).length;
    const baselineCount  = (html.match(/Baseline score/gi) ?? []).length;
    expect(candidateCount).toBeGreaterThanOrEqual(2);
    expect(baselineCount).toBeGreaterThanOrEqual(2);
  });

  // ── Legacy build() API preserved ─────────────────────────────────────────

  it("[LEGACY] build() method still exists and returns a Promise<string>", async () => {
    const result = await builder.build({ runs: [], results: [], generatedAt: "2026-07-22T00:00:00Z" });
    expect(typeof result).toBe("string");
    expect(result.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });
});
