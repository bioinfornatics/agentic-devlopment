import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FsWorkspaceReader } from "../workspaceReader.js";
import { DIST_EVALS } from "../../../shared/paths.js";
import {
  EvalIntegrityV2Store,
  integrityValueHash,
  type IntegrityManifestV2,
  type IntegrityTerminalRecordV2,
  type NormalizedIntegrityReportStateV2,
} from "../integrityV2Store.js";

const subject = "__reader-pass-rate-fixture__";
const hash = "hash123";
const root = path.join(DIST_EVALS, "skills", subject);

describe("FsWorkspaceReader.readGradings", () => {
  beforeEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("reads nested grading summary.pass_rate and skips null grader results", async () => {
    const withDir = path.join(root, hash, "eval-0", "with_skill", "run-1");
    const withoutDir = path.join(root, hash, "eval-0", "without_skill", "run-1");
    const repeatedDir = path.join(root, hash, "eval-0", "with_skill", "run-2");
    const nullDir = path.join(root, hash, "eval-1", "with_skill", "run-1");
    await fs.mkdir(withDir, { recursive: true });
    await fs.mkdir(withoutDir, { recursive: true });
    await fs.mkdir(repeatedDir, { recursive: true });
    await fs.mkdir(nullDir, { recursive: true });
    await fs.writeFile(path.join(withDir, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.75 }, expectations: [] }));
    await fs.writeFile(path.join(withoutDir, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.25 }, expectations: [] }));
    await fs.writeFile(path.join(repeatedDir, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.5 }, expectations: [] }));
    await fs.writeFile(path.join(nullDir, "grading.json"), JSON.stringify({ summary: { pass_rate: null }, expectations: [] }));

    const rows = await new FsWorkspaceReader().readGradings("skills", subject, hash);

    expect(rows).toHaveLength(3);
    expect(rows.map(r => [r.config, r.run, r.score])).toEqual([["with_skill", 1, 0.75], ["with_skill", 2, 0.5], ["without_skill", 1, 0.25]]);
  });
});

// ── EVAL-INT-05/06/12/13/20 legacy/partial-v2 classification helpers ──────────

const classifyManifest = (overrides: Partial<IntegrityManifestV2> = {}): IntegrityManifestV2 => ({
  schema: "eval-integrity-v2",
  runProvenanceId: "run-classify-001",
  cliArguments: ["--layers", "skills", "--repetitions", "2"],
  subjects: [{ kind: "skills", subject: "sdd", sourceHash: "source-hash", evalIds: [0] }],
  repetitions: 2,
  treatments: [
    { id: "skill_l1", kind: "skills", subject: "sdd", side: "candidate", definitionHash: "cand-hash", bootstrapHash: "cand-boot" },
    { id: "skill_l0", kind: "skills", subject: "sdd", side: "baseline", definitionHash: "base-hash", bootstrapHash: "base-boot" },
  ],
  taskPayloadHashes: { "skills/sdd/0": "task-payload-hash" },
  fixtureHashes: { "fixtures/auth.ts": "fixture-hash-1" },
  executionEnvelope: {
    provider: "azure_foundry", model: "gpt-test",
    decoding: { temperature: null, seed: null },
    timeBudgetMs: 60_000, tokenBudget: null,
    gooseRuntimeVersion: "1.37.0", evalHubRuntimeVersion: "0.1.0",
  },
  grader: { id: "llm-judge", version: "2" },
  rubric: { id: "expected-behavior", version: "3" },
  ...overrides,
});

const classifyTerminal = (overrides: Partial<IntegrityTerminalRecordV2> = {}): IntegrityTerminalRecordV2 => ({
  schema: "eval-integrity-v2",
  manifestHash: "",
  kind: "skills", subject: "sdd", evalId: 0, repetition: 0,
  side: "candidate", treatmentId: "skill_l1", status: "succeeded",
  pairKey: {
    taskPayloadHash: "task-payload-hash",
    fixtureHashes: { "fixtures/auth.ts": "fixture-hash-1" },
    executionEnvelopeHash: integrityValueHash(classifyManifest().executionEnvelope),
    candidateTreatmentId: "skill_l1", baselineTreatmentId: "skill_l0",
    candidateTreatmentHash: "cand-hash", baselineTreatmentHash: "base-hash",
    runProvenanceId: "run-classify-001",
    graderId: "llm-judge", graderVersion: "2",
    rubricId: "expected-behavior", rubricVersion: "3",
  },
  grading: {
    graderId: "llm-judge", graderVersion: "2",
    rubricId: "expected-behavior", rubricVersion: "3",
    expectedCriterionIds: ["criterion-1"],
    outcomes: [{ criterionId: "criterion-1", passed: true }],
    parseStatus: "parsed", validationStatus: "valid", score: 1,
  },
  exclusion: null,
  ...overrides,
});

const classifyReport = (manifestHash: string): NormalizedIntegrityReportStateV2 => ({
  schema: "eval-integrity-v2",
  manifestHash,
  pairMicro: {
    meanDeltaPp: 25,
    candidateMean: 0.625,
    baselineMean: 0.375,
    n: 2,
    interval: { method: "paired_t_95pct_pp_v1", lower: 20, upper: 30, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: 25,
    candidateMean: 0.625,
    baselineMean: 0.375,
    n: 1,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 2,
  includedSubjectCount: 1,
  excludedPairCounts: { result_missing: 0 },
  subjectFailureCounts: { schema_legacy_incomplete: 0 },
});

// ── Helper: record the full 2-repetition × 2-side terminal matrix ─────────────

async function recordFullMatrix(store: EvalIntegrityV2Store, manifestHash: string): Promise<void> {
  for (const repetition of [0, 1]) {
    await store.recordTerminal(classifyTerminal({
      manifestHash, repetition, side: "candidate", treatmentId: "skill_l1",
    }));
    await store.recordTerminal(classifyTerminal({
      manifestHash, repetition, side: "baseline", treatmentId: "skill_l0",
    }));
  }
}

// ── Helper: snapshot dir entry names so we can verify nothing was mutated ─────

async function dirEntries(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { recursive: true });
    return [...entries].sort();
  } catch { return []; }
}

// ── EVAL-INT-05/06/12/13/20 classifyHashDir tests ─────────────────────────────

describe("FsWorkspaceReader.classifyHashDir [EVAL-INT-05/06/12/13/20]", () => {
  let tmpDir: string;
  let hashDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-classify-"));
    hashDir = path.join(tmpDir, "hash-abc123");
    await fs.mkdir(hashDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("EVAL-INT-20 classifies a legacy-only workspace as schema_legacy_incomplete without mutating files", async () => {
    // fixture: only legacy grading.json, no v2 manifest
    const evalDir = path.join(hashDir, "eval-0", "with_skill", "run-1");
    await fs.mkdir(evalDir, { recursive: true });
    await fs.writeFile(
      path.join(evalDir, "grading.json"),
      JSON.stringify({ summary: { pass_rate: 0.8 }, expectations: [] }),
    );

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toEqual({
      schema: "legacy-v1",
      historicalOnly: true,
      integrityEligible: false,
      subjectFailureReason: "schema_legacy_incomplete",
    });
    // EVAL-INT-05/13: files are unchanged (no destructive migration)
    expect(after).toEqual(before);
  });

  it("EVAL-INT-12/20 classifies a partial-v2 workspace (manifest but missing terminals) as terminal_matrix_incomplete without mutating files", async () => {
    // fixture: manifest created but only 1 of 4 required terminals recorded
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    // record only 1 of 4 expected terminals (2 repetitions × 2 sides)
    await store.recordTerminal(classifyTerminal({ manifestHash: stored.hash }));

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toMatchObject({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "terminal_matrix_incomplete",
    });
    // EVAL-INT-05/13: files are unchanged
    expect(after).toEqual(before);
  });

  it("EVAL-INT-05/20 classifies a manifest-mismatch workspace as incomplete without mutating files", async () => {
    // fixture: manifest.json present but manifest.sha256 has a wrong hash
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    // record one terminal so manifest is not pristine
    await store.recordTerminal(classifyTerminal({ manifestHash: stored.hash }));
    // now corrupt the hash file
    await fs.writeFile(path.join(hashDir, "manifest.sha256"), "deadbeefdeadbeef\n");

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    // EVAL-INT-05: hash-mismatch manifest is manifest_invalid, NOT terminal_matrix_incomplete
    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "manifest_invalid",
    });
    // EVAL-INT-05/13: files are unchanged
    expect(after).toEqual(before);
  });

  it("EVAL-INT-05/20 classifies a corrupt-JSON manifest (sha256-valid bytes, unparseable JSON) as manifest_invalid without mutating files", async () => {
    // fixture: manifest.json contains syntactically invalid JSON; manifest.sha256 matches those bytes
    // (sha256 check passes, JSON.parse fails → must be manifest_invalid, not terminal_matrix_incomplete)
    const corruptBytes = '{ "schema": "eval-integrity-v2", this: is not valid json }';
    const hash = createHash("sha256").update(corruptBytes, "utf8").digest("hex");
    await fs.writeFile(path.join(hashDir, "manifest.json"), corruptBytes);
    await fs.writeFile(path.join(hashDir, "manifest.sha256"), hash + "\n");

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    // EVAL-INT-05: corrupt-JSON manifest is manifest_invalid, NOT terminal_matrix_incomplete
    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "manifest_invalid",
    });
    // EVAL-INT-05/13: files are unchanged
    expect(after).toEqual(before);
  });

  it("EVAL-INT-12/13/20 classifies a missing-report workspace (complete terminal matrix, no report state) as report_state_missing without mutating files", async () => {
    // fixture: complete manifest + full 2×2 terminal matrix, but no report-state.json
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    await recordFullMatrix(store, stored.hash);

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "report_state_missing",
    });
    // EVAL-INT-05/13: files are unchanged
    expect(after).toEqual(before);
  });

  it("EVAL-INT-20 classifies a complete v2 workspace as integrityEligible=true without any provider or source access", async () => {
    // fixture: manifest + full terminal matrix + report state — no network/git needed
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    await recordFullMatrix(store, stored.hash);
    await store.writeReportState(classifyReport(stored.hash));

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: true,
      subjectFailureReason: null,
    });
    // EVAL-INT-05/13: files are unchanged
    expect(after).toEqual(before);
  });

  it("EVAL-INT-05/13 classifies a corrupt report-state.json (complete terminal matrix, structurally invalid JSON object) as report_state_inconsistent — not manifest_invalid — without mutating files", async () => {
    // fixture: manifest + full 2×2 terminal matrix, then a report-state.json written
    // directly (bypassing writeReportState) so it is structurally invalid.
    // assertValidReportState throws inside readReportState → inspectCompatibility throws
    // AFTER loadManifest already succeeded → must be report_state_inconsistent, never manifest_invalid.
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    await recordFullMatrix(store, stored.hash);
    // structurally invalid: missing required keys → assertValidReportState throws
    await fs.writeFile(
      path.join(hashDir, "report-state.json"),
      JSON.stringify({ schema: "eval-integrity-v2", manifestHash: stored.hash, corrupt: true }),
    );

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "report_state_inconsistent",
    });
    // EVAL-INT-05/13: no files added, removed, or overwritten
    expect(after).toEqual(before);
  });

  it("EVAL-INT-12/13 classifies a structurally-valid but manifest-inconsistent report state (zero pair counts vs manifest's two pairs) as report_state_inconsistent without mutating files", async () => {
    // fixture: manifest + full 2×2 terminal matrix, then a report-state.json written via
    // writeReportState (which canonicalises bytes and validates internal consistency)
    // but with validPairCount=0 / includedSubjectCount=0 — inconsistent with the
    // manifest's 2 pairs and 1 subject. inspectCompatibility returns report_state_inconsistent
    // without throwing; classifyHashDir must pass that value through unchanged.
    const store = new EvalIntegrityV2Store(hashDir);
    const stored = await store.createManifest(classifyManifest());
    await recordFullMatrix(store, stored.hash);
    await store.writeReportState({
      schema: "eval-integrity-v2",
      manifestHash: stored.hash,
      pairMicro: {
        meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      },
      subjectMacro: {
        meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      },
      validPairCount: 0,
      includedSubjectCount: 0,
      excludedPairCounts: {},
      subjectFailureCounts: {},
    });

    const before = await dirEntries(hashDir);
    const result = await new FsWorkspaceReader().classifyHashDir(hashDir);
    const after = await dirEntries(hashDir);

    expect(result).toEqual({
      schema: "eval-integrity-v2",
      historicalOnly: false,
      integrityEligible: false,
      subjectFailureReason: null,
      incompleteReason: "report_state_inconsistent",
    });
    // EVAL-INT-05/13: no files added, removed, or overwritten
    expect(after).toEqual(before);
  });
});
