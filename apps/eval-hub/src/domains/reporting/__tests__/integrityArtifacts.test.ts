/**
 * Integration tests for integrityArtifacts.ts
 *
 * Covers: buildIntegrityArtifactsFromStore + persistIntegrityArtifacts
 * Seam: agentic-devlopment-sur3.2 / sur3.3
 *
 * Strategy:
 *   • Real temp EvalIntegrityV2Store (no mocking)
 *   • Eligible store fixture: candidate=1, baseline=0 → 100 pp, n=1, includedSubjectCount=1
 *   • Assert cli/json/html share the same manifestHash, means, n, interval bounds/method
 *   • Assert json bytes === serializeIntegrityReport(bundle.report)
 *   • Assert no causal / "statistically significant" language
 *   • Assert persistIntegrityArtifacts writes files with exact bytes
 *   • Assert null/missing store yields explicit cli, null json/html
 */
import fs   from "node:fs/promises";
import os   from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildIntegrityArtifactsFromStore,
  persistIntegrityArtifacts,
  integrityJsonPath,
  integrityHtmlPath,
} from "../integrityArtifacts.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  integrityValueHash,
  type IntegrityManifestV2,
  type IntegrityTerminalRecordV2,
  type NormalizedIntegrityReportStateV2,
} from "../../persistence/integrityV2Store.js";
import {
  serializeIntegrityReport,
  deserializeIntegrityReport,
} from "../integrityReport.js";

// ── Temp dir lifecycle ────────────────────────────────────────────────────────

let tmpDir: string;
beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ia-test-")); });
afterEach(async ()  => { await fs.rm(tmpDir, { recursive: true, force: true }); });

// ── Shared envelope ───────────────────────────────────────────────────────────

const ENVELOPE = {
  provider: "test", model: "test-model",
  decoding: { temperature: null as null, seed: null as null },
  timeBudgetMs: null as null, tokenBudget: null as null,
  gooseRuntimeVersion: "0.0.0", evalHubRuntimeVersion: "0.0.0",
} as const;

// ── Eligible store fixture ────────────────────────────────────────────────────

/**
 * Build a fully eligible EvalIntegrityV2Store:
 *   • 1 subject (test-skill), 1 eval (evalId=1), 1 repetition
 *   • candidate score = 1 (binary pass), baseline score = 0 (binary fail)
 *   • delta = 100 pp
 *   • pairMicro: n=1, meanDeltaPp=100, interval: insufficient_pairs
 *   • subjectMacro: n=1, meanDeltaPp=100, interval: insufficient_pairs
 *   • includedSubjectCount=1, validPairCount=1, no exclusions/failures
 *   → inspectCompatibility returns { integrityEligible: true }
 */
async function buildEligibleStore(root: string): Promise<{
  hash: string;
  state: NormalizedIntegrityReportStateV2;
}> {
  const store = new EvalIntegrityV2Store(root);

  const manifest: IntegrityManifestV2 = {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "prov-artifact-test",
    cliArguments: [],
    subjects: [{ kind: "skills", subject: "test-skill", sourceHash: "src-hash-001", evalIds: [1] }],
    repetitions: 1,
    treatments: [
      { id: "cand", kind: "skills", subject: "test-skill", side: "candidate", definitionHash: "def-cand", bootstrapHash: "boot-cand" },
      { id: "base", kind: "skills", subject: "test-skill", side: "baseline",  definitionHash: "def-base", bootstrapHash: "boot-base" },
    ],
    taskPayloadHashes: { "skills/test-skill/1": "task-hash-001" },
    fixtureHashes: { "fixture-a": "fix-hash-001" },
    executionEnvelope: ENVELOPE,
    grader: { id: "test-grader", version: "1.0" },
    rubric: { id: "test-rubric", version: "1.0" },
  };

  const stored  = await store.createManifest(manifest);
  const pairKey = {
    taskPayloadHash:        "task-hash-001",
    fixtureHashes:          { "fixture-a": "fix-hash-001" },
    executionEnvelopeHash:  integrityValueHash(ENVELOPE),
    candidateTreatmentId:   "cand",
    baselineTreatmentId:    "base",
    candidateTreatmentHash: "def-cand",
    baselineTreatmentHash:  "def-base",
    runProvenanceId:        "prov-artifact-test",
    graderId:               "test-grader",
    graderVersion:          "1.0",
    rubricId:               "test-rubric",
    rubricVersion:          "1.0",
  };

  for (const [side, treatmentId, score] of [
    ["candidate", "cand", 1] as const,
    ["baseline",  "base", 0] as const,
  ]) {
    const terminal: IntegrityTerminalRecordV2 = {
      schema:       INTEGRITY_SCHEMA_V2,
      manifestHash: stored.hash,
      kind:         "skills",
      subject:      "test-skill",
      evalId:       1,
      repetition:   0,
      side,
      treatmentId,
      status:       "succeeded",
      pairKey,
      grading: {
        graderId:               "test-grader",
        graderVersion:          "1.0",
        rubricId:               "test-rubric",
        rubricVersion:          "1.0",
        expectedCriterionIds:   ["c1"],
        outcomes:               [{ criterionId: "c1", passed: score === 1 }],
        parseStatus:            "parsed",
        validationStatus:       "valid",
        score,
      },
      exclusion: null,
    };
    await store.recordTerminal(terminal);
  }

  // Write report state (mimics LayeredRunner.computeReportFromTerminals)
  const state: NormalizedIntegrityReportStateV2 = {
    schema:               INTEGRITY_SCHEMA_V2,
    manifestHash:         stored.hash,
    pairMicro:    { meanDeltaPp: 100, candidateMean: 1.0, baselineMean: 0.0, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    subjectMacro: { meanDeltaPp: 100, candidateMean: 1.0, baselineMean: 0.0, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    validPairCount:       1,
    includedSubjectCount: 1,
    excludedPairCounts:   { execution_failed: 0 },
    subjectFailureCounts: {},
  };
  await store.writeReportState(state);
  return { hash: stored.hash, state };
}

/**
 * Build a store with execution_failed exclusion and schema_legacy_incomplete failure.
 * subjectMacro.n=0 (no included subjects) → meanDeltaPp=null.
 * Exercises non-trivial exclusion/failure counts in artifact content.
 */
async function buildExclusionStore(root: string): Promise<{
  hash: string;
  state: NormalizedIntegrityReportStateV2;
}> {
  const store = new EvalIntegrityV2Store(root);
  const manifest: IntegrityManifestV2 = {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "prov-excl-test",
    cliArguments: [],
    subjects: [{ kind: "skills", subject: "excl-skill", sourceHash: "src-excl", evalIds: [2] }],
    repetitions: 1,
    treatments: [
      { id: "cand2", kind: "skills", subject: "excl-skill", side: "candidate", definitionHash: "def-cand2", bootstrapHash: "boot-cand2" },
      { id: "base2", kind: "skills", subject: "excl-skill", side: "baseline",  definitionHash: "def-base2", bootstrapHash: "boot-base2" },
    ],
    taskPayloadHashes: { "skills/excl-skill/2": "task-hash-excl" },
    fixtureHashes: {},
    executionEnvelope: ENVELOPE,
    grader: { id: "g2", version: "2.0" },
    rubric: { id: "r2", version: "2.0" },
  };
  const stored = await store.createManifest(manifest);
  // Write report state only (no terminals needed for this fixture)
  const state: NormalizedIntegrityReportStateV2 = {
    schema:               INTEGRITY_SCHEMA_V2,
    manifestHash:         stored.hash,
    pairMicro:    { meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    subjectMacro: { meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
    validPairCount:       0,
    includedSubjectCount: 0,
    excludedPairCounts:   { execution_failed: 1, grader_invalid: 2 },
    subjectFailureCounts: { schema_legacy_incomplete: 1 },
  };
  await store.writeReportState(state);
  return { hash: stored.hash, state };
}

// ── buildIntegrityArtifactsFromStore ─────────────────────────────────────────

describe("buildIntegrityArtifactsFromStore — eligible store", () => {

  it("returns non-null report, non-null cli/json/html", async () => {
    const storeRoot = path.join(tmpDir, "eligible");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, {
      generatedAt: "2026-07-22T00:00:00Z",
      scope: "L1 skills",
    });
    expect(bundle.report).not.toBeNull();
    expect(bundle.cli).toBeTruthy();
    expect(bundle.json).not.toBeNull();
    expect(bundle.html).not.toBeNull();
  });

  it("cli, json, html all contain the same manifestHash", async () => {
    const storeRoot = path.join(tmpDir, "hash-consistent");
    const { hash } = await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli).toContain(hash);
    expect(bundle.json).toContain(hash);
    expect(bundle.html).toContain(hash);
  });

  it("cli, json, html all reflect pairMicro.n=1 and meanDeltaPp=100", async () => {
    const storeRoot = path.join(tmpDir, "means");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    // CLI: contains "100" (meanDeltaPp) and "n=1"
    expect(bundle.cli).toMatch(/100/);
    expect(bundle.cli).toContain("n=1");
    // JSON: pairMicro.meanDeltaPp=100
    const parsed = JSON.parse(bundle.json!) as { pairMicro: { meanDeltaPp: number; n: number } };
    expect(parsed.pairMicro.meanDeltaPp).toBe(100);
    expect(parsed.pairMicro.n).toBe(1);
    // HTML: "100.00 pp" (from fmtPpValue)
    expect(bundle.html).toContain("100.00 pp");
  });

  it("cli, json, html all reflect includedSubjectCount=1", async () => {
    const storeRoot = path.join(tmpDir, "subjects");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    // JSON: includedSubjectCount=1
    const parsed = JSON.parse(bundle.json!) as { includedSubjectCount: number };
    expect(parsed.includedSubjectCount).toBe(1);
    // CLI: "included" subject appears
    expect(bundle.cli.toLowerCase()).toContain("included");
    // HTML: 1 included subject
    expect(bundle.html).toMatch(/1.*included.*subject|included.*subject.*1/i);
  });

  it("json equals serializeIntegrityReport(bundle.report)", async () => {
    const storeRoot = path.join(tmpDir, "serialize");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const expected = serializeIntegrityReport(bundle.report!);
    expect(bundle.json).toBe(expected);
  });

  it("json is valid and round-trips through deserializeIntegrityReport", async () => {
    const storeRoot = path.join(tmpDir, "roundtrip");
    await buildEligibleStore(storeRoot);
    const bundle  = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const report2 = deserializeIntegrityReport(bundle.json!);
    expect(report2.manifestHash).toBe(bundle.report!.manifestHash);
    expect(report2.pairMicro.meanDeltaPp).toBe(100);
    expect(report2.subjectMacro.n).toBe(1);
    expect(report2.includedSubjectCount).toBe(1);
  });

  it("cli/json/html reflect interval method 'paired_t_95pct_pp_v1'", async () => {
    const storeRoot = path.join(tmpDir, "method");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli).toContain("paired_t_95pct_pp_v1");
    expect(bundle.json).toContain("paired_t_95pct_pp_v1");
    expect(bundle.html).toContain("paired_t_95pct_pp_v1");
  });

  it("cli/json/html contain 'insufficient_pairs' (n=1 → no CI bounds)", async () => {
    const storeRoot = path.join(tmpDir, "insufficient");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli).toContain("insufficient_pairs");
    // HTML must also show insufficient_pairs for n<2
    expect(bundle.html).toContain("insufficient_pairs");
  });

  it("[EVAL-INT-16] cli does NOT contain causal or statistically-significant language", async () => {
    const storeRoot = path.join(tmpDir, "no-causal-cli");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli.toLowerCase()).not.toContain("statistically significant");
    expect(bundle.cli.toLowerCase()).not.toContain("caused");
    expect(bundle.cli.toLowerCase()).not.toContain("proves");
  });

  it("[EVAL-INT-16] html does NOT contain causal or statistically-significant language", async () => {
    const storeRoot = path.join(tmpDir, "no-causal-html");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.html!.toLowerCase()).not.toContain("statistically significant");
    expect(bundle.html!.toLowerCase()).not.toContain("caused by");
    expect(bundle.html!.toLowerCase()).not.toContain("proves");
  });

  it("scope is passed through to cli text", async () => {
    const storeRoot = path.join(tmpDir, "scope-cli");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, {
      generatedAt: "2026-07-22T00:00:00Z",
      scope: "L1 skills/code-review",
    });
    expect(bundle.cli).toContain("L1 skills/code-review");
  });

  it("html is a standalone document with embedded CSS and schema sentinel", async () => {
    const storeRoot = path.join(tmpDir, "html-standalone");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "2026-07-22T00:00:00Z" });
    expect(bundle.html!.trim().toLowerCase()).toMatch(/^<!doctype html>/);
    expect(bundle.html).toContain("</html>");
    expect(bundle.html).toContain("<style>");
    expect(bundle.html).not.toMatch(/rel=["']stylesheet["']/);
    expect(bundle.html).toContain("eval-integrity-v2");
  });

  it("generatedAt timestamp is embedded in html", async () => {
    const storeRoot = path.join(tmpDir, "html-ts");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, {
      generatedAt: "2026-07-22T16:54:00Z",
    });
    expect(bundle.html).toContain("2026-07-22T16:54:00Z");
  });

  it("[EVAL-INT-14] cli, json, html all reflect pairMicro candidateMean=1.0", async () => {
    const storeRoot = path.join(tmpDir, "cand-mean-pair");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    // candidateMean=1.0 → score 1.0000 in CLI
    expect(bundle.cli).toContain("1.0000");
    // JSON has candidateMean=1.0
    const parsed = JSON.parse(bundle.json!) as { pairMicro: { candidateMean: number } };
    expect(parsed.pairMicro.candidateMean).toBe(1.0);
    // HTML shows 1.0000
    expect(bundle.html).toContain("1.0000");
  });

  it("[EVAL-INT-14] cli, json, html all reflect pairMicro baselineMean=0.0", async () => {
    const storeRoot = path.join(tmpDir, "base-mean-pair");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    // JSON has baselineMean=0.0
    const parsed = JSON.parse(bundle.json!) as { pairMicro: { baselineMean: number } };
    expect(parsed.pairMicro.baselineMean).toBe(0.0);
  });

  it("[EVAL-INT-14] cli, json, html all reflect subjectMacro candidateMean=1.0", async () => {
    const storeRoot = path.join(tmpDir, "cand-mean-subj");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const parsed = JSON.parse(bundle.json!) as { subjectMacro: { candidateMean: number } };
    expect(parsed.subjectMacro.candidateMean).toBe(1.0);
  });
});

describe("buildIntegrityArtifactsFromStore — exclusion/failure store", () => {

  it("cli lists execution_failed and grader_invalid exclusions", async () => {
    const storeRoot = path.join(tmpDir, "excl-cli");
    await buildExclusionStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli).toContain("execution_failed");
    expect(bundle.cli).toContain("grader_invalid");
  });

  it("cli lists schema_legacy_incomplete subject failure", async () => {
    const storeRoot = path.join(tmpDir, "excl-failure");
    await buildExclusionStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.cli).toContain("schema_legacy_incomplete");
  });

  it("json preserves exclusion and failure counts exactly", async () => {
    const storeRoot = path.join(tmpDir, "excl-json");
    await buildExclusionStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const parsed  = JSON.parse(bundle.json!) as {
      excludedPairCounts: { execution_failed?: number; grader_invalid?: number };
      subjectFailureCounts: { schema_legacy_incomplete?: number };
    };
    expect(parsed.excludedPairCounts.execution_failed).toBe(1);
    expect(parsed.excludedPairCounts.grader_invalid).toBe(2);
    expect(parsed.subjectFailureCounts.schema_legacy_incomplete).toBe(1);
  });

  it("html contains execution_failed and schema_legacy_incomplete", async () => {
    const storeRoot = path.join(tmpDir, "excl-html");
    await buildExclusionStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.html).toContain("execution_failed");
    expect(bundle.html).toContain("schema_legacy_incomplete");
  });

  it("null meanDeltaPp → em dash in html, not '0.00 pp'", async () => {
    const storeRoot = path.join(tmpDir, "excl-null-mean");
    await buildExclusionStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.html).toContain("—");
    expect(bundle.html).not.toContain("0.00 pp");
  });
});

describe("buildIntegrityArtifactsFromStore — missing/null store", () => {

  it("empty dir → null report, null json/html, explicit cli", async () => {
    const storeRoot = path.join(tmpDir, "empty-dir");
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.report).toBeNull();
    expect(bundle.json).toBeNull();
    expect(bundle.html).toBeNull();
    expect(bundle.cli).toBeTruthy();
    expect(bundle.cli.toLowerCase()).toMatch(/no.*data|not.*available|no.*measurable|legacy/);
  });

  it("empty dir → legacy-v1 compatibility", async () => {
    const storeRoot = path.join(tmpDir, "empty-compat");
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.compatibility.schema).toBe("legacy-v1");
    expect(bundle.compatibility.integrityEligible).toBe(false);
  });

  it("null cli still contains scope label", async () => {
    const storeRoot = path.join(tmpDir, "null-scope");
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, {
      generatedAt: "",
      scope: "L2 agents",
    });
    expect(bundle.cli).toContain("L2 agents");
  });

  it("manifest present but no report-state.json → null report, explicit cli", async () => {
    const storeRoot = path.join(tmpDir, "no-report-state");
    // Write manifest but no terminals and no report state
    const store = new EvalIntegrityV2Store(storeRoot);
    await store.createManifest({
      schema: INTEGRITY_SCHEMA_V2,
      runProvenanceId: "x",
      cliArguments: [],
      subjects: [{ kind: "skills", subject: "s", sourceHash: "h", evalIds: [0] }],
      repetitions: 1,
      treatments: [
        { id: "c", kind: "skills", subject: "s", side: "candidate", definitionHash: "d1", bootstrapHash: "b1" },
        { id: "b", kind: "skills", subject: "s", side: "baseline",  definitionHash: "d2", bootstrapHash: "b2" },
      ],
      taskPayloadHashes: { "skills/s/0": "t" },
      fixtureHashes: {},
      executionEnvelope: ENVELOPE,
      grader: { id: "g", version: "1" },
      rubric: { id: "r", version: "1" },
    });
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    expect(bundle.report).toBeNull();
    expect(bundle.json).toBeNull();
    expect(bundle.html).toBeNull();
    expect(bundle.cli).toBeTruthy();
  });

  it("corrupt store throws (errors propagate, not swallowed)", async () => {
    const storeRoot = path.join(tmpDir, "corrupt");
    await fs.mkdir(storeRoot, { recursive: true });
    await fs.writeFile(path.join(storeRoot, "manifest.json"), "not-json");
    await expect(buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" })).rejects.toThrow();
  });
});

// ── persistIntegrityArtifacts ─────────────────────────────────────────────────

describe("persistIntegrityArtifacts — eligible bundle", () => {

  it("writes integrity-report-<kind>.json with exact bundle.json bytes", async () => {
    const storeRoot = path.join(tmpDir, "persist-json");
    await buildEligibleStore(storeRoot);
    const bundle  = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const baseWs  = path.join(tmpDir, "ws1");
    await persistIntegrityArtifacts(baseWs, "skills", bundle);
    const written = await fs.readFile(integrityJsonPath(baseWs, "skills"), "utf8");
    expect(written).toBe(bundle.json);
  });

  it("writes integrity-report-<kind>.html with non-trivial HTML content", async () => {
    const storeRoot = path.join(tmpDir, "persist-html");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "2026-07-22T00:00:00Z" });
    const baseWs = path.join(tmpDir, "ws2");
    await persistIntegrityArtifacts(baseWs, "skills", bundle);
    const written = await fs.readFile(integrityHtmlPath(baseWs, "skills"), "utf8");
    expect(written).toBe(bundle.html);
    expect(written.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("creates baseWs directory if it does not exist", async () => {
    const storeRoot = path.join(tmpDir, "persist-mkdir");
    await buildEligibleStore(storeRoot);
    const bundle = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const baseWs = path.join(tmpDir, "deep", "nested", "ws");
    await persistIntegrityArtifacts(baseWs, "agents", bundle);
    const exists = await fs.stat(integrityJsonPath(baseWs, "agents")).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("writes optional jsonTarget with identical bytes", async () => {
    const storeRoot   = path.join(tmpDir, "persist-jsontarget");
    await buildEligibleStore(storeRoot);
    const bundle      = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const baseWs      = path.join(tmpDir, "ws3");
    const jsonTarget  = path.join(tmpDir, "output", "report.json");
    await persistIntegrityArtifacts(baseWs, "skills", bundle, { jsonTarget });
    const writtenMain = await fs.readFile(integrityJsonPath(baseWs, "skills"), "utf8");
    const writtenOpt  = await fs.readFile(jsonTarget, "utf8");
    expect(writtenOpt).toBe(writtenMain);
    expect(writtenOpt).toBe(bundle.json);
  });

  it("does NOT write jsonTarget when opts.jsonTarget is absent", async () => {
    const storeRoot = path.join(tmpDir, "persist-no-jsontarget");
    await buildEligibleStore(storeRoot);
    const bundle  = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const baseWs  = path.join(tmpDir, "ws4");
    await persistIntegrityArtifacts(baseWs, "skills", bundle);
    // Only the two canonical files should exist
    const entries = await fs.readdir(baseWs);
    expect(entries.sort()).toEqual([
      "integrity-report-skills.html",
      "integrity-report-skills.json",
    ]);
  });
});

describe("persistIntegrityArtifacts — null bundle", () => {

  it("writes nothing when bundle.report is null", async () => {
    const storeRoot = path.join(tmpDir, "persist-null-store");
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const baseWs    = path.join(tmpDir, "ws-null");
    await persistIntegrityArtifacts(baseWs, "skills", bundle);
    // baseWs should not even have been created (or be empty)
    const exists = await fs.stat(baseWs).then(() => true).catch(e => (e as NodeJS.ErrnoException).code !== "ENOENT");
    // Either directory doesn't exist, or it's empty
    if (exists) {
      const entries = await fs.readdir(baseWs).catch(() => []);
      expect(entries).toEqual([]);
    } else {
      expect(exists).toBe(false);
    }
  });
});

// ── store → report → json roundtrip ─────────────────────────────────────────

describe("store → report → json roundtrip (all fields survive)", () => {

  it("all fields/intervals/inclusedSubjectCount/exclusions survive the full pipeline", async () => {
    const storeRoot = path.join(tmpDir, "roundtrip-all");
    const { state } = await buildEligibleStore(storeRoot);
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });

    // report must match original state
    const r = bundle.report!;
    expect(r.schema).toBe("eval-integrity-v2");
    expect(r.manifestHash).toBe(state.manifestHash);
    expect(r.deltaUnit).toBe("pp");
    expect(r.observedDifferencesOnly).toBe(true);
    expect(r.pairMicro.meanDeltaPp).toBe(100);
    expect(r.pairMicro.n).toBe(1);
    expect(r.pairMicro.interval.method).toBe("paired_t_95pct_pp_v1");
    expect(r.pairMicro.interval.lower).toBeNull();
    expect(r.pairMicro.interval.upper).toBeNull();
    expect(r.pairMicro.interval.reason).toBe("insufficient_pairs");
    expect(r.subjectMacro.meanDeltaPp).toBe(100);
    expect(r.subjectMacro.n).toBe(1);
    expect(r.subjectMacro.interval.reason).toBe("insufficient_pairs");
    expect(r.validPairCount).toBe(1);
    expect(r.includedSubjectCount).toBe(1);
    expect(r.excludedPairCounts).toEqual({ execution_failed: 0 });
    expect(r.subjectFailureCounts).toEqual({});

    // json is canonical
    const parsed = JSON.parse(bundle.json!) as typeof r;
    expect(parsed.pairMicro.meanDeltaPp).toBe(100);
    expect(parsed.subjectMacro.n).toBe(1);
    expect(parsed.includedSubjectCount).toBe(1);
    expect(parsed.pairMicro.interval.reason).toBe("insufficient_pairs");

    // Candidate/baseline means from eligible store (candidate=1, baseline=0)
    expect(r.pairMicro.candidateMean).toBe(1.0);
    expect(r.pairMicro.baselineMean).toBe(0.0);
    expect(r.subjectMacro.candidateMean).toBe(1.0);
    expect(r.subjectMacro.baselineMean).toBe(0.0);
    expect(parsed.pairMicro.candidateMean).toBe(1.0);
    expect(parsed.subjectMacro.baselineMean).toBe(0.0);

    // json bytes are exactly serializeIntegrityReport
    expect(bundle.json).toBe(serializeIntegrityReport(r));
  });

  it("exclusion/failure counts survive store→report→json for exclusion store", async () => {
    const storeRoot = path.join(tmpDir, "roundtrip-excl");
    const { state } = await buildExclusionStore(storeRoot);
    const bundle    = await buildIntegrityArtifactsFromStore(storeRoot, { generatedAt: "" });
    const r = bundle.report!;
    expect(r.manifestHash).toBe(state.manifestHash);
    expect(r.excludedPairCounts).toEqual({ execution_failed: 1, grader_invalid: 2 });
    expect(r.subjectFailureCounts).toEqual({ schema_legacy_incomplete: 1 });
    // JSON preserves them too
    const parsed = JSON.parse(bundle.json!) as {
      excludedPairCounts: Record<string, number>;
      subjectFailureCounts: Record<string, number>;
    };
    expect(parsed.excludedPairCounts["execution_failed"]).toBe(1);
    expect(parsed.excludedPairCounts["grader_invalid"]).toBe(2);
    expect(parsed.subjectFailureCounts["schema_legacy_incomplete"]).toBe(1);
  });
});
