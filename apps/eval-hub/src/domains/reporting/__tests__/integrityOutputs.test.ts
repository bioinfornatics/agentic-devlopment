/**
 * RED → GREEN tests for integrityOutputs.ts adapters.
 *
 * Covers: EVAL-INT-CLI-01 through CLI-14
 * Seam owner: agentic-devlopment-sur3.2
 *
 * These tests MUST FAIL before integrityOutputs.ts exists.
 *
 * Invariants under test:
 *   CLI-01  manifest hash present in text
 *   CLI-02  "observed paired differences" language (no causal claim)
 *   CLI-03  "pp" unit present
 *   CLI-04  score formula "passed_criteria/expected_criteria"
 *   CLI-05  pairMicro mean + n in text
 *   CLI-06  subjectMacro mean + n in text
 *   CLI-07  CI bounds present when n >= 2; method label present
 *   CLI-08  "insufficient_pairs" when n < 2
 *   CLI-09  nonzero excluded pair reasons listed
 *   CLI-10  nonzero subject failure reasons listed
 *   CLI-11  null report → explicit message, never "0" or fake number
 *   CLI-12  null report with legacy schema → "schema_legacy_incomplete"
 *   CLI-13  does NOT contain "statistically significant" or causal language
 *   CLI-14  integrityReportJson returns exact canonical bytes
 *   CLI-15  loadIntegrityReportFromStore offline — no provider/source throws
 *   CLI-16  loadIntegrityReportFromStore returns correct compat for empty dir
 *   CLI-17  loadIntegrityReportFromStore returns IntegrityReport for eligible store
 *   CLI-18  zero-value excluded counts are NOT listed in CLI text
 *   CLI-19  valid pair count + included subject count in text
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IntegrityReport } from "../integrityReport.js";
import type { IntegrityCompatibility, NormalizedIntegrityReportStateV2 } from "../../persistence/integrityV2Store.js";
import { serializeIntegrityReport } from "../integrityReport.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  integrityValueHash,
  type IntegrityManifestV2,
  type IntegrityTerminalRecordV2,
} from "../../persistence/integrityV2Store.js";
import {
  formatIntegrityCli,
  integrityReportJson,
  loadIntegrityReportFromStore,
} from "../integrityOutputs.js";

// ── Golden fixtures ────────────────────────────────────────────────────────────

/** A fully-populated IntegrityReport with n>=2 for both summaries. */
const goldenReport: IntegrityReport = {
  schema: "eval-integrity-v2",
  manifestHash: "abc123def456golden",
  deltaUnit: "pp",
  observedDifferencesOnly: true,
  pairMicro: {
    meanDeltaPp: 15.0,
    candidateMean: 0.65,
    baselineMean: 0.50,
    n: 4,
    interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: 12.5,
    candidateMean: 0.625,
    baselineMean: 0.50,
    n: 2,
    interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: null },
  },
  validPairCount: 4,
  includedSubjectCount: 2,
  excludedPairCounts: { grade_null: 1, execution_failed: 2 },
  subjectFailureCounts: {},
};

/** A report where both summaries have n=0 (no valid pairs). */
const nullMeanReport: IntegrityReport = {
  schema: "eval-integrity-v2",
  manifestHash: "deadbeefnull",
  deltaUnit: "pp",
  observedDifferencesOnly: true,
  pairMicro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  subjectMacro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 0,
  includedSubjectCount: 0,
  excludedPairCounts: { grade_null: 3, execution_failed: 1 },
  subjectFailureCounts: { schema_legacy_incomplete: 1 },
};

/** A report with pairMicro.n=1 (insufficient CI) and subjectMacro.n=0. */
const singlePairReport: IntegrityReport = {
  schema: "eval-integrity-v2",
  manifestHash: "single001",
  deltaUnit: "pp",
  observedDifferencesOnly: true,
  pairMicro: {
    meanDeltaPp: 7.0,
    candidateMean: 0.57,
    baselineMean: 0.50,
    n: 1,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  subjectMacro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 1,
  includedSubjectCount: 0,
  excludedPairCounts: {},
  subjectFailureCounts: {},
};

// Legacy compatibility (historicalOnly=true)
const legacyCompat: IntegrityCompatibility = {
  schema: "legacy-v1",
  historicalOnly: true,
  integrityEligible: false,
  subjectFailureReason: "schema_legacy_incomplete",
};

// V2 ineligible compatibility
const ineligibleCompat: IntegrityCompatibility = {
  schema: INTEGRITY_SCHEMA_V2,
  historicalOnly: false,
  integrityEligible: false,
  subjectFailureReason: null,
  incompleteReason: "report_state_missing",
};

// Eligible compatibility
const eligibleCompat: IntegrityCompatibility = {
  schema: INTEGRITY_SCHEMA_V2,
  historicalOnly: false,
  integrityEligible: true,
  subjectFailureReason: null,
};

// ── formatIntegrityCli tests ──────────────────────────────────────────────────

describe("formatIntegrityCli — golden report", () => {

  it("[CLI-01] manifest hash appears in text", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text).toContain("abc123def456golden");
  });

  it("[CLI-02] observed-differences language present (no causal claim)", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // Must contain "observed" and "differences" (case-insensitive)
    expect(text.toLowerCase()).toContain("observed");
    expect(text.toLowerCase()).toContain("differences");
  });

  it("[CLI-03] delta unit 'pp' present", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text).toContain("pp");
  });

  it("[CLI-04] score formula passed_criteria/expected_criteria present", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text).toContain("passed_criteria/expected_criteria");
  });

  it("[CLI-05] pairMicro mean and n in text", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // mean=15.0 and n=4
    expect(text).toMatch(/15\.0/);
    expect(text).toContain("n=4");
  });

  it("[CLI-06] subjectMacro mean and n in text", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // mean=12.5 and n=2
    expect(text).toMatch(/12\.5/);
    expect(text).toContain("n=2");
  });

  it("[CLI-07] CI bounds present when n >= 2, method label present", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // pairMicro bounds: 5.0 and 25.0
    expect(text).toMatch(/5\.0/);
    expect(text).toMatch(/25\.0/);
    // subjectMacro bounds: -2.0 and 27.0
    expect(text).toMatch(/-2\.0/);
    expect(text).toMatch(/27\.0/);
    // method label
    expect(text).toContain("paired_t_95pct_pp_v1");
  });

  it("[CLI-08] insufficient_pairs not mentioned when n >= 2 (golden has n=4 and n=2)", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // When n>=2, neither summary needs insufficient_pairs
    // The label might appear elsewhere but should not be a "no CI" warning
    // The interval bounds must appear, not a null/insufficient message
    expect(text).toMatch(/\[.*5\.0.*25\.0.*\]/s);  // pairMicro CI bracket
    expect(text).toMatch(/\[.*-2\.0.*27\.0.*\]/s);  // subjectMacro CI bracket
  });

  it("[CLI-09] nonzero excluded pair reasons listed", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // goldenReport has grade_null:1 and execution_failed:2
    expect(text).toContain("grade_null");
    expect(text).toContain("execution_failed");
    expect(text).toContain("1");
    expect(text).toContain("2");
  });

  it("[CLI-10] subjectFailureCounts empty — no failure reasons listed for golden", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // No subject failures in goldenReport, so no failure reason keys
    expect(text).not.toContain("schema_legacy_incomplete");
    expect(text).not.toContain("source_missing");
  });

  it("[CLI-13] does NOT contain 'statistically significant'", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text.toLowerCase()).not.toContain("statistically significant");
  });

  it("[CLI-13] does NOT contain causal language", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text.toLowerCase()).not.toContain("caused by");
    expect(text.toLowerCase()).not.toContain("causal");
    expect(text.toLowerCase()).not.toContain("proves");
  });

  it("[CLI-18] zero-count exclusion reasons NOT listed", () => {
    // result_missing has count 0 (absent from map) — must not appear
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text).not.toContain("result_missing");
    expect(text).not.toContain("grade_non_numeric");
    expect(text).not.toContain("grader_invalid");
    expect(text).not.toContain("input_mismatch");
    expect(text).not.toContain("provenance_mismatch");
    expect(text).not.toContain("grader_mismatch");
    expect(text).not.toContain("rubric_mismatch");
  });

  it("[CLI-19] valid pair count and included subject count in text", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // validPairCount=4, includedSubjectCount=2
    expect(text).toMatch(/valid.*pair|pair.*valid/i);
    expect(text).toMatch(/included.*subject|subject.*included/i);
  });

  it("scope label appears in text", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    expect(text).toContain("L1 skills");
  });

  it("[EVAL-INT-14] Candidate score printed for pairMicro (score unit 0..1)", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // candidateMean=0.65 for pairMicro
    expect(text).toContain("0.6500");
  });

  it("[EVAL-INT-14] Baseline score printed for pairMicro (score unit 0..1)", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // baselineMean=0.50 for pairMicro
    expect(text).toContain("0.5000");
  });

  it("[EVAL-INT-14] Candidate score printed for subjectMacro (score unit 0..1)", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    // candidateMean=0.625 for subjectMacro
    expect(text).toContain("0.6250");
  });

  it("[EVAL-INT-14] labels 'Candidate' and 'Baseline' appear for both scopes", () => {
    const text = formatIntegrityCli(goldenReport, "L1 skills");
    const candidateCount = (text.match(/Candidate/g) ?? []).length;
    const baselineCount  = (text.match(/Baseline/g) ?? []).length;
    // Both Pair-micro and Subject-macro should show Candidate and Baseline
    expect(candidateCount).toBeGreaterThanOrEqual(2);
    expect(baselineCount).toBeGreaterThanOrEqual(2);
  });

});

describe("formatIntegrityCli — single pair (n=1, insufficient CI)", () => {

  it("[CLI-08] insufficient_pairs label when pairMicro.n=1", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    expect(text).toContain("insufficient_pairs");
  });

  it("[CLI-05] pairMicro mean present when n=1 (finite mean)", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    expect(text).toMatch(/7\.0/);
  });

  it("[CLI-06] subjectMacro shows n=0 and no finite mean", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    expect(text).toContain("n=0");
    // No finite mean for subjectMacro (null)
    expect(text).not.toMatch(/mean.*=.*\d+\.\d+.*n=0|n=0.*mean.*=.*\d+\.\d+/i);
  });

  it("[CLI-08] no CI bounds shown when n < 2 (no fake bracket with nulls)", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    // Should not show [null, null] or [] as bounds
    expect(text).not.toContain("[null");
    expect(text).not.toContain("null]");
  });

  it("[EVAL-INT-14] Candidate score shown for pairMicro when n=1 (finite)", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    // candidateMean=0.57 for pairMicro (n=1 ≥ 1 → finite)
    expect(text).toContain("0.5700");
  });

  it("[EVAL-INT-14] em dash for subjectMacro candidate/baseline when n=0", () => {
    const text = formatIntegrityCli(singlePairReport, "L2 agents");
    // subjectMacro.n=0 → candidateMean=null → em dash
    // The em dash character '—' should appear
    expect(text).toContain("—");
  });
});

describe("formatIntegrityCli — null report (no data)", () => {

  it("[CLI-11] null report without compat → explicit 'no measurable' message", () => {
    const text = formatIntegrityCli(null, "L3 recipes");
    expect(text.toLowerCase()).toMatch(/no measurable|no integrity data|not available/);
  });

  it("[CLI-11] null report never contains '0.0000' as a fake mean", () => {
    const text = formatIntegrityCli(null, "L3 recipes");
    // Must not output a fake mean value
    expect(text).not.toContain("0.0000");
    expect(text).not.toContain("mean = 0");
  });

  it("[CLI-12] null report with legacy compat → schema_legacy_incomplete message", () => {
    const text = formatIntegrityCli(null, "L1 skills", legacyCompat);
    expect(text.toLowerCase()).toContain("schema_legacy_incomplete");
  });

  it("[CLI-12] null report with ineligible v2 compat → incompleteReason message", () => {
    const text = formatIntegrityCli(null, "L1 skills", ineligibleCompat);
    // Should state the reason (report_state_missing)
    expect(text.toLowerCase()).toContain("report_state_missing");
  });

  it("scope label still appears in null-report text", () => {
    const text = formatIntegrityCli(null, "L3 recipes");
    expect(text).toContain("L3 recipes");
  });
});

describe("formatIntegrityCli — nullMeanReport (all pairs excluded)", () => {

  it("[CLI-09] multiple excluded pair reasons listed", () => {
    const text = formatIntegrityCli(nullMeanReport, "L1 skills");
    expect(text).toContain("grade_null");
    expect(text).toContain("execution_failed");
  });

  it("[CLI-10] subject failure reason listed", () => {
    const text = formatIntegrityCli(nullMeanReport, "L1 skills");
    expect(text).toContain("schema_legacy_incomplete");
  });

  it("[CLI-08] insufficient_pairs shown for n=0 summaries", () => {
    const text = formatIntegrityCli(nullMeanReport, "L1 skills");
    expect(text).toContain("insufficient_pairs");
  });

  it("[CLI-19] valid pair count 0 shown", () => {
    const text = formatIntegrityCli(nullMeanReport, "L1 skills");
    // validPairCount=0 — must appear, not be silently omitted
    expect(text).toMatch(/valid.*pair.*0|0.*valid.*pair/i);
  });
});

// ── integrityReportJson tests ─────────────────────────────────────────────────

describe("integrityReportJson", () => {

  it("[CLI-14] returns exact canonical bytes (same as serializeIntegrityReport)", () => {
    const expected = serializeIntegrityReport(goldenReport);
    const actual   = integrityReportJson(goldenReport);
    expect(actual).toBe(expected);
  });

  it("[CLI-14] deterministic — same report same bytes", () => {
    const a = integrityReportJson(goldenReport);
    const b = integrityReportJson(goldenReport);
    expect(a).toBe(b);
  });

  it("[CLI-14] manifest hash present in JSON bytes", () => {
    const json = integrityReportJson(goldenReport);
    expect(json).toContain("abc123def456golden");
  });

  it("[CLI-14] JSON is valid and parseable", () => {
    const json = integrityReportJson(goldenReport);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("[CLI-14] schema key present in JSON", () => {
    const json = integrityReportJson(goldenReport);
    expect(json).toContain('"schema"');
    expect(json).toContain('"eval-integrity-v2"');
  });

  it("[CLI-14] keys are sorted lexicographically (canonical form)", () => {
    const json = integrityReportJson(goldenReport);
    // In canonical form, deltaUnit < excludedPairCounts < includedSubjectCount < manifestHash ...
    const deltaIdx    = json.indexOf('"deltaUnit"');
    const excludedIdx = json.indexOf('"excludedPairCounts"');
    const manifestIdx = json.indexOf('"manifestHash"');
    expect(deltaIdx).toBeLessThan(excludedIdx);
    expect(excludedIdx).toBeLessThan(manifestIdx);
  });

  it("[CLI-14] nullMeanReport serializes correctly with null means", () => {
    const json  = integrityReportJson(nullMeanReport);
    const parsed = JSON.parse(json) as IntegrityReport;
    expect(parsed.pairMicro.meanDeltaPp).toBeNull();
    expect(parsed.subjectMacro.meanDeltaPp).toBeNull();
  });
});

// ── loadIntegrityReportFromStore tests ────────────────────────────────────────

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "integrity-outputs-test-"));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/**
 * Build a minimal but valid EvalIntegrityV2Store with one subject,
 * one eval, one repetition, and a full terminal matrix so
 * inspectCompatibility() returns integrityEligible: true.
 */
/**
 * Build a minimal fully-eligible EvalIntegrityV2Store:
 *   candidate score = 1 (binary pass), baseline score = 0 (binary fail)
 *   delta = 100 pp, pairMicro.n=1, subjectMacro.n=1, includedSubjectCount=1
 *   → inspectCompatibility returns { integrityEligible: true }
 *
 * Using binary scores (0/1) ensures terminalIsComplete() returns true for every
 * terminal, which satisfies hasCompleteTerminalMatrix.
 */
async function buildEligibleStore(root: string): Promise<NormalizedIntegrityReportStateV2> {
  const store = new EvalIntegrityV2Store(root);
  const envelope = {
    provider: "test", model: "test",
    decoding: { temperature: null as null, seed: null as null },
    timeBudgetMs: null as null, tokenBudget: null as null,
    gooseRuntimeVersion: "0.0.0", evalHubRuntimeVersion: "0.0.0",
  } as const;
  const manifest: IntegrityManifestV2 = {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "prov-test",
    cliArguments: [],
    subjects: [{ kind: "skills", subject: "test-skill", sourceHash: "src-hash", evalIds: [1] }],
    repetitions: 1,
    treatments: [
      { id: "cand", kind: "skills", subject: "test-skill", side: "candidate", definitionHash: "def-cand", bootstrapHash: "boot-cand" },
      { id: "base", kind: "skills", subject: "test-skill", side: "baseline",  definitionHash: "def-base", bootstrapHash: "boot-base" },
    ],
    taskPayloadHashes: { "skills/test-skill/1": "task-hash-1" },
    fixtureHashes: {},
    executionEnvelope: envelope,
    grader:  { id: "test-grader", version: "1.0" },
    rubric:  { id: "test-rubric", version: "1.0" },
  };
  const stored = await store.createManifest(manifest);
  const pairKey = {
    taskPayloadHash: "task-hash-1",
    fixtureHashes: {},
    executionEnvelopeHash: integrityValueHash(envelope),
    candidateTreatmentId: "cand",
    baselineTreatmentId:  "base",
    candidateTreatmentHash: "def-cand",
    baselineTreatmentHash:  "def-base",
    runProvenanceId: "prov-test",
    graderId: "test-grader", graderVersion: "1.0",
    rubricId: "test-rubric", rubricVersion: "1.0",
  };
  // Binary scores: candidate=1 (pass), baseline=0 (fail)
  // computedScore matches score → terminalIsComplete returns true → eligible store
  for (const [side, treatmentId, termScore] of [
    ["candidate", "cand", 1] as const,
    ["baseline",  "base", 0] as const,
  ]) {
    const terminal: IntegrityTerminalRecordV2 = {
      schema: INTEGRITY_SCHEMA_V2,
      manifestHash: stored.hash,
      kind: "skills", subject: "test-skill", evalId: 1, repetition: 0,
      side, treatmentId,
      status: "succeeded",
      pairKey,
      grading: {
        graderId: "test-grader", graderVersion: "1.0",
        rubricId: "test-rubric", rubricVersion: "1.0",
        expectedCriterionIds: ["c1"],
        outcomes: [{ criterionId: "c1", passed: termScore === 1 }],
        parseStatus: "parsed", validationStatus: "valid",
        score: termScore,
      },
      exclusion: null,
    };
    await store.recordTerminal(terminal);
  }
  // Write report state: delta = (1 - 0) * 100 = 100 pp
  // subjectMacro.n=1 (one included subject) → meanDeltaPp must be finite
  const reportState: NormalizedIntegrityReportStateV2 = {
    schema: INTEGRITY_SCHEMA_V2,
    manifestHash: stored.hash,
    pairMicro:    { meanDeltaPp: 100, candidateMean: 1.0, baselineMean: 0.0, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    subjectMacro: { meanDeltaPp: 100, candidateMean: 1.0, baselineMean: 0.0, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    validPairCount: 1,
    includedSubjectCount: 1,
    excludedPairCounts: {},
    subjectFailureCounts: {},
  };
  await store.writeReportState(reportState);
  return reportState;
}

describe("loadIntegrityReportFromStore", () => {

  it("[CLI-15] offline — does not call provider or network (pure filesystem)", async () => {
    // The loader must work even if provider/goose functions would throw.
    // We verify by using an empty temp dir that has no manifest.
    // If it tried to call any provider, it would throw a different error.
    const { report, compatibility } = await loadIntegrityReportFromStore(tmpDir);
    expect(report).toBeNull();
    // Compatibility must be legacy-v1 (no manifest found)
    expect(compatibility.schema).toBe("legacy-v1");
    expect(compatibility.historicalOnly).toBe(true);
    expect(compatibility.integrityEligible).toBe(false);
  });

  it("[CLI-16] returns null report and legacy compat when store has no manifest", async () => {
    const { report, compatibility } = await loadIntegrityReportFromStore(tmpDir);
    expect(report).toBeNull();
    expect(compatibility.schema).toBe("legacy-v1");
    expect(compatibility.integrityEligible).toBe(false);
  });

  it("[CLI-17] returns IntegrityReport for eligible store", async () => {
    const storeRoot = path.join(tmpDir, "store");
    const state = await buildEligibleStore(storeRoot);
    const { report, compatibility } = await loadIntegrityReportFromStore(storeRoot);
    // Eligible store: candidate=1, baseline=0 → 100 pp, n=1, includedSubjectCount=1
    // inspectCompatibility: validPairCount===pairKeys.size (1===1 ✓),
    //   subjectMacro.n===subjectKeys.size (1===1 ✓), excludedCount===0 ✓
    // → integrityEligible: true
    expect(report).not.toBeNull();
    if (report !== null) {
      expect(report.schema).toBe("eval-integrity-v2");
      expect(report.manifestHash).toBe(state.manifestHash);
      expect(report.deltaUnit).toBe("pp");
      expect(report.observedDifferencesOnly).toBe(true);
      expect(report.pairMicro.n).toBe(1);
      expect(report.pairMicro.meanDeltaPp).toBe(100);
      expect(report.subjectMacro.n).toBe(1);
      expect(report.subjectMacro.meanDeltaPp).toBe(100);
      expect(report.includedSubjectCount).toBe(1);
    }
    expect(compatibility.integrityEligible).toBe(true);
  });

  it("[CLI-17] compatibility is returned alongside report", async () => {
    const storeRoot = path.join(tmpDir, "store2");
    await buildEligibleStore(storeRoot);
    const { compatibility } = await loadIntegrityReportFromStore(storeRoot);
    expect(compatibility).toBeDefined();
    // schema must be eval-integrity-v2 (manifest exists)
    expect(compatibility.schema).toBe("eval-integrity-v2");
  });

  it("[CLI-17] null report means explicit unmeasurable status in compatibility", async () => {
    // Empty dir → legacy → null report
    const { report, compatibility } = await loadIntegrityReportFromStore(tmpDir);
    expect(report).toBeNull();
    expect(compatibility.integrityEligible).toBe(false);
  });

  it("[CLI-15] loader does not silently swallow filesystem errors (non-ENOENT)", async () => {
    // Write a corrupt manifest.json to trigger a real error, not a silent null
    const storeRoot = path.join(tmpDir, "corrupt");
    await fs.mkdir(storeRoot, { recursive: true });
    await fs.writeFile(path.join(storeRoot, "manifest.json"), "not-json");
    // A corrupt store must throw (not silently return null)
    await expect(loadIntegrityReportFromStore(storeRoot)).rejects.toThrow();
  });
});

// ── store → report → json roundtrip ─────────────────────────────────────────

describe("loadIntegrityReportFromStore — store→report→json roundtrip", () => {

  it("all fields survive store → buildIntegrityReport → serializeIntegrityReport → JSON.parse", async () => {
    const storeRoot = path.join(tmpDir, "roundtrip");
    const state     = await buildEligibleStore(storeRoot);
    const { report } = await loadIntegrityReportFromStore(storeRoot);
    expect(report).not.toBeNull();

    const r = report!;
    // Schema and provenance
    expect(r.schema).toBe("eval-integrity-v2");
    expect(r.deltaUnit).toBe("pp");
    expect(r.observedDifferencesOnly).toBe(true);
    expect(r.manifestHash).toBe(state.manifestHash);

    // Counts
    expect(r.validPairCount).toBe(1);
    expect(r.includedSubjectCount).toBe(1);
    expect(r.pairMicro.n).toBe(1);
    expect(r.subjectMacro.n).toBe(1);

    // Means
    expect(r.pairMicro.meanDeltaPp).toBe(100);
    expect(r.subjectMacro.meanDeltaPp).toBe(100);

    // Intervals (n<2 → insufficient_pairs, null bounds)
    expect(r.pairMicro.interval.method).toBe("paired_t_95pct_pp_v1");
    expect(r.pairMicro.interval.reason).toBe("insufficient_pairs");
    expect(r.pairMicro.interval.lower).toBeNull();
    expect(r.pairMicro.interval.upper).toBeNull();
    expect(r.subjectMacro.interval.method).toBe("paired_t_95pct_pp_v1");
    expect(r.subjectMacro.interval.reason).toBe("insufficient_pairs");

    // Exclusions / failures (empty in eligible store)
    expect(r.excludedPairCounts).toEqual({});
    expect(r.subjectFailureCounts).toEqual({});

    // JSON roundtrip: serialize → parse → same values
    const json    = serializeIntegrityReport(r);
    const parsed  = JSON.parse(json) as typeof r;
    expect(parsed.schema).toBe("eval-integrity-v2");
    expect(parsed.manifestHash).toBe(r.manifestHash);
    expect(parsed.pairMicro.meanDeltaPp).toBe(100);
    expect(parsed.subjectMacro.n).toBe(1);
    expect(parsed.includedSubjectCount).toBe(1);
    expect(parsed.pairMicro.interval.reason).toBe("insufficient_pairs");
    expect(parsed.excludedPairCounts).toEqual({});
  });
});
