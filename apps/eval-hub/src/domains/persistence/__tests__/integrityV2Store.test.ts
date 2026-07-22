import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EvalIntegrityV2Store,
  integrityValueHash,
  type IntegrityManifestV2,
  type IntegrityTerminalRecordV2,
  type NormalizedIntegrityReportStateV2,
} from "../integrityV2Store.js";

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "eval-integrity-v2-")); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

const manifest = (overrides: Partial<IntegrityManifestV2> = {}): IntegrityManifestV2 => ({
  schema: "eval-integrity-v2",
  runProvenanceId: "run-001",
  cliArguments: ["--layers", "skills", "--repetitions", "2"],
  subjects: [{ kind: "skills", subject: "sdd", sourceHash: "source-hash", evalIds: [0] }],
  repetitions: 2,
  treatments: [
    { id: "skill_l1", kind: "skills", subject: "sdd", side: "candidate", definitionHash: "candidate-hash", bootstrapHash: "candidate-bootstrap" },
    { id: "skill_l0", kind: "skills", subject: "sdd", side: "baseline", definitionHash: "baseline-hash", bootstrapHash: "baseline-bootstrap" },
  ],
  taskPayloadHashes: { "skills/sdd/0": "task-hash" },
  fixtureHashes: { "fixtures/auth.ts": "fixture-hash" },
  executionEnvelope: {
    provider: "azure_foundry", model: "gpt-test", decoding: { temperature: null, seed: null },
    timeBudgetMs: 60_000, tokenBudget: null, gooseRuntimeVersion: "1.37.0", evalHubRuntimeVersion: "0.1.0",
  },
  grader: { id: "llm-judge", version: "2" },
  rubric: { id: "expected-behavior", version: "3" },
  ...overrides,
});

const terminal = (overrides: Partial<IntegrityTerminalRecordV2> = {}): IntegrityTerminalRecordV2 => ({
  schema: "eval-integrity-v2",
  manifestHash: "",
  kind: "skills", subject: "sdd", evalId: 0, repetition: 0,
  side: "candidate", treatmentId: "skill_l1", status: "succeeded",
  pairKey: {
    taskPayloadHash: "task-hash", fixtureHashes: { "fixtures/auth.ts": "fixture-hash" },
    executionEnvelopeHash: integrityValueHash(manifest().executionEnvelope), candidateTreatmentId: "skill_l1", baselineTreatmentId: "skill_l0",
    candidateTreatmentHash: "candidate-hash", baselineTreatmentHash: "baseline-hash", runProvenanceId: "run-001",
    graderId: "llm-judge", graderVersion: "2", rubricId: "expected-behavior", rubricVersion: "3",
  },
  grading: {
    graderId: "llm-judge", graderVersion: "2", rubricId: "expected-behavior", rubricVersion: "3",
    expectedCriterionIds: ["criterion-1"], outcomes: [{ criterionId: "criterion-1", passed: true }],
    parseStatus: "parsed", validationStatus: "valid", score: 1,
  },
  exclusion: null,
  ...overrides,
});

const report = (manifestHash: string, validPairCount = 2, includedSubjectCount = 1): NormalizedIntegrityReportStateV2 => ({
  schema: "eval-integrity-v2", manifestHash,
  pairMicro: {
    meanDeltaPp: validPairCount === 0 ? null : 25,
    candidateMean: validPairCount === 0 ? null : 0.625,
    baselineMean: validPairCount === 0 ? null : 0.375,
    n: validPairCount,
    interval: validPairCount < 2
      ? { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" }
      : { method: "paired_t_95pct_pp_v1", lower: 20, upper: 30, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: includedSubjectCount === 0 ? null : 25,
    candidateMean: includedSubjectCount === 0 ? null : 0.625,
    baselineMean: includedSubjectCount === 0 ? null : 0.375,
    n: includedSubjectCount,
    interval: includedSubjectCount < 2
      ? { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" }
      : { method: "paired_t_95pct_pp_v1", lower: 20, upper: 30, reason: null },
  },
  validPairCount, includedSubjectCount,
  excludedPairCounts: { result_missing: 0 }, subjectFailureCounts: { schema_legacy_incomplete: 0 },
});

describe("EVAL-INT-11/20 immutable eval-integrity-v2 manifest", () => {
  it("writes deterministic manifest bytes/hash and rejects a conflicting rewrite", async () => {
    const store = new EvalIntegrityV2Store(root);
    const first = await store.createManifest(manifest());
    const repeated = await store.createManifest(manifest());
    expect(repeated).toEqual(first);
    expect(first.schema).toBe("eval-integrity-v2");
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(store.createManifest(manifest({ repetitions: 3 }))).rejects.toThrow(/manifest.*immutable/i);
  });

  it("rejects duplicate kind/subject manifest entries instead of ambiguously splitting eval IDs", async () => {
    const store = new EvalIntegrityV2Store(root);
    await expect(store.createManifest(manifest({
      subjects: [
        { kind: "skills", subject: "sdd", sourceHash: "source-hash", evalIds: [0] },
        { kind: "skills", subject: "sdd", sourceHash: "source-hash", evalIds: [1] },
      ],
      taskPayloadHashes: { "skills/sdd/0": "task-hash", "skills/sdd/1": "task-hash-1" },
    }))).rejects.toThrow(/manifest.*duplicate.*subject/i);
  });

  it("detects manifest byte tampering after the first terminal result", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    await store.recordTerminal(terminal({ manifestHash: stored.hash }));
    await fs.appendFile(path.join(root, "manifest.json"), " ");
    await expect(store.loadManifest()).rejects.toThrow(/manifest.*hash/i);
  });
});

describe("EVAL-INT-04/06/12/15/20 terminal records and resume", () => {
  it("persists a complete repetition-aware terminal and rejects duplicate keys", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    const record = terminal({ manifestHash: stored.hash });
    await store.recordTerminal(record);
    expect(await store.readTerminalKey(record)).toEqual(record);
    expect(await store.isTerminalComplete(record)).toBe(true);
    await expect(store.recordTerminal(record)).rejects.toThrow(/duplicate terminal key/i);
    await expect(store.recordTerminal({ ...record, grading: { ...record.grading!, score: 0 } })).rejects.toThrow(/duplicate terminal key/i);
  });

  it("recovers idempotently from a manifest-only crash and records null failure without numeric zero", async () => {
    const first = new EvalIntegrityV2Store(root);
    const stored = await first.createManifest(manifest());
    const resumed = new EvalIntegrityV2Store(root);
    const failed = terminal({ manifestHash: stored.hash, status: "failed", grading: null, exclusion: { level: "pair", reason: "execution_failed" } });
    expect(await resumed.isTerminalComplete(failed)).toBe(false);
    await resumed.recordTerminal(failed);
    expect((await resumed.readTerminalKey(failed))?.grading).toBeNull();
    expect((await resumed.readTerminalKey(failed))?.exclusion?.reason).toBe("execution_failed");
  });

  it("rejects terminal evidence whose manifest hash differs", async () => {
    const store = new EvalIntegrityV2Store(root);
    await store.createManifest(manifest());
    await expect(store.recordTerminal(terminal({ manifestHash: "wrong" }))).rejects.toThrow(/manifest hash mismatch/i);
  });

  it("rejects a conflicting pair key for the same immutable terminal slot", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    const record = terminal({ manifestHash: stored.hash });
    await store.recordTerminal(record);
    await expect(store.recordTerminal({
      ...record,
      pairKey: { ...record.pairKey, taskPayloadHash: "conflicting-task-hash" },
    })).rejects.toThrow(/duplicate terminal key/i);
  });

  it("rejects pair, grader, rubric, provenance, and treatment evidence not declared by the manifest", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    const record = terminal({ manifestHash: stored.hash });
    await expect(store.recordTerminal({ ...record, pairKey: { ...record.pairKey, runProvenanceId: "other-run" } })).rejects.toThrow(/run provenance/i);
    await expect(store.recordTerminal({ ...record, pairKey: { ...record.pairKey, graderVersion: "wrong" } })).rejects.toThrow(/grader/i);
    await expect(store.recordTerminal({ ...record, treatmentId: "skill_l0" })).rejects.toThrow(/treatment/i);
  });

  it("selects the declared treatment pair by kind and subject in a multi-kind manifest", async () => {
    const store = new EvalIntegrityV2Store(root);
    const multi = manifest({
      subjects: [
        { kind: "skills", subject: "sdd", sourceHash: "source-hash", evalIds: [0] },
        { kind: "agents", subject: "architect", sourceHash: "agent-source", evalIds: [0] },
      ],
      treatments: [
        ...manifest().treatments,
        { id: "agent_l2", kind: "agents", subject: "architect", side: "candidate", definitionHash: "agent-candidate", bootstrapHash: "agent-bootstrap" },
        { id: "agent_l1", kind: "agents", subject: "architect", side: "baseline", definitionHash: "agent-baseline", bootstrapHash: "skills-bootstrap" },
      ],
      taskPayloadHashes: { "skills/sdd/0": "task-hash", "agents/architect/0": "agent-task" },
    });
    const stored = await store.createManifest(multi);
    const base = terminal({ manifestHash: stored.hash });
    const agentRecord: IntegrityTerminalRecordV2 = {
      ...base, kind: "agents", subject: "architect", treatmentId: "agent_l2",
      pairKey: {
        ...base.pairKey, taskPayloadHash: "agent-task", candidateTreatmentId: "agent_l2", baselineTreatmentId: "agent_l1",
        candidateTreatmentHash: "agent-candidate", baselineTreatmentHash: "agent-baseline",
      },
    };
    await expect(store.recordTerminal(agentRecord)).resolves.toBeUndefined();
  });
});

describe("EVAL-INT-13/20 offline state and legacy compatibility", () => {
  it("round-trips normalized report state byte-for-byte without external access", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    const state = report(stored.hash);
    await store.writeReportState(state);
    expect(await store.readReportState()).toEqual(state);
    const before = await fs.readFile(path.join(root, "report-state.json"), "utf8");
    await store.writeReportState(state);
    expect(await fs.readFile(path.join(root, "report-state.json"), "utf8")).toBe(before);
  });

  it("reads legacy v1 as historical-only and classifies incomplete evidence", async () => {
    await fs.writeFile(path.join(root, "benchmark.json"), JSON.stringify({ runs: [{ runNumber: 1 }] }));
    const legacy = await new EvalIntegrityV2Store(root).inspectCompatibility();
    expect(legacy).toEqual({ schema: "legacy-v1", historicalOnly: true, integrityEligible: false, subjectFailureReason: "schema_legacy_incomplete" });
    expect(await fs.readFile(path.join(root, "benchmark.json"), "utf8")).toContain("runNumber");
  });

  it("keeps a partial v2 matrix ineligible", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    await store.recordTerminal(terminal({ manifestHash: stored.hash }));
    expect(await store.inspectCompatibility()).toEqual({
      schema: "eval-integrity-v2", historicalOnly: false, integrityEligible: false,
      subjectFailureReason: null, incompleteReason: "terminal_matrix_incomplete",
    });
  });

  it("recognizes complete v2 independently of current source control", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    for (const repetition of [0, 1]) {
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "candidate", treatmentId: "skill_l1" }));
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "baseline", treatmentId: "skill_l0" }));
    }
    expect(await store.inspectCompatibility()).toMatchObject({
      schema: "eval-integrity-v2", historicalOnly: false, integrityEligible: false,
      incompleteReason: "report_state_missing",
    });
    await store.writeReportState(report(stored.hash));
    expect(await store.inspectCompatibility()).toEqual({ schema: "eval-integrity-v2", historicalOnly: false, integrityEligible: true, subjectFailureReason: null });
  });

  it("does not accept report denominators that contradict the manifest matrix", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    for (const repetition of [0, 1]) {
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "candidate", treatmentId: "skill_l1" }));
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "baseline", treatmentId: "skill_l0" }));
    }
    await store.writeReportState(report(stored.hash, 1));
    expect(await store.inspectCompatibility()).toEqual({
      schema: "eval-integrity-v2", historicalOnly: false, integrityEligible: false,
      subjectFailureReason: null, incompleteReason: "report_state_inconsistent",
    });
  });

  it("does not accept exclusions that contradict an entirely valid terminal matrix", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    for (const repetition of [0, 1]) {
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "candidate", treatmentId: "skill_l1" }));
      await store.recordTerminal(terminal({ manifestHash: stored.hash, repetition, side: "baseline", treatmentId: "skill_l0" }));
    }
    await store.writeReportState({ ...report(stored.hash), excludedPairCounts: { result_missing: 1 } });
    expect(await store.inspectCompatibility()).toMatchObject({
      schema: "eval-integrity-v2", integrityEligible: false, incompleteReason: "report_state_inconsistent",
    });
  });

  it("does not mark criterion evidence eligible when its persisted score contradicts the formula", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest({ repetitions: 1 }));
    const inconsistentGrading = {
      ...terminal().grading!, outcomes: [{ criterionId: "criterion-1", passed: false }], score: 1,
    };
    await store.recordTerminal(terminal({ manifestHash: stored.hash, grading: inconsistentGrading }));
    await store.recordTerminal(terminal({ manifestHash: stored.hash, side: "baseline", treatmentId: "skill_l0" }));
    await store.writeReportState(report(stored.hash));
    expect(await store.inspectCompatibility()).toMatchObject({
      schema: "eval-integrity-v2", integrityEligible: false, incompleteReason: "terminal_matrix_incomplete",
    });
  });

  it("rejects an incomplete canonical report state read from disk and never marks it eligible", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest({ repetitions: 1 }));
    await store.recordTerminal(terminal({ manifestHash: stored.hash }));
    await store.recordTerminal(terminal({ manifestHash: stored.hash, side: "baseline", treatmentId: "skill_l0" }));
    await fs.writeFile(path.join(root, "report-state.json"), JSON.stringify({
      manifestHash: stored.hash, schema: "eval-integrity-v2",
    }));
    await expect(store.readReportState()).rejects.toThrow(/report state.*invalid/i);
    await expect(store.inspectCompatibility()).rejects.toThrow(/report state.*invalid/i);
  });

  it("validates the complete normalized report DTO and semantic denominators before writing", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    const valid = report(stored.hash);
    const invalidStates: unknown[] = [
      { schema: "eval-integrity-v2", manifestHash: stored.hash },
      { ...valid, validPairCount: -1 },
      { ...valid, pairMicro: { ...valid.pairMicro, n: valid.validPairCount + 1 } },
      { ...valid, pairMicro: { ...valid.pairMicro, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } } },
      { ...valid, pairMicro: { ...valid.pairMicro, interval: { method: "paired_t_95pct_pp_v1", lower: 30, upper: 20, reason: null } } },
      { ...valid, pairMicro: { ...valid.pairMicro, meanDeltaPp: 50, interval: { method: "paired_t_95pct_pp_v1", lower: 20, upper: 30, reason: null } } },
      { ...valid, excludedPairCounts: { not_a_reason: 1 } },
      { ...valid, subjectFailureCounts: { schema_legacy_incomplete: 0.5 } },
      { ...valid, includedSubjectCount: Number.NaN },
      { ...valid, pairMicro: { ...valid.pairMicro, candidateMean: null } },
      { ...valid, subjectMacro: { ...valid.subjectMacro, baselineMean: null } },
    ];
    for (const state of invalidStates) {
      await expect(store.writeReportState(state as NormalizedIntegrityReportStateV2)).rejects.toThrow(/report state.*invalid/i);
    }
    expect(await fs.stat(path.join(root, "report-state.json")).then(() => true, () => false)).toBe(false);
  });

  it("recovers a matching manifest after a crash before its hash sidecar", async () => {
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.createManifest(manifest());
    await fs.rm(path.join(root, "manifest.sha256"));
    expect(await store.createManifest(manifest())).toEqual(stored);
  });
});
