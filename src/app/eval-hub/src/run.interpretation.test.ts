import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EvalIntegrityV2Store, INTEGRITY_SCHEMA_V2, integrityValueHash, type IntegrityManifestV2, type NormalizedIntegrityReportStateV2 } from "./domains/persistence/integrityV2Store.js";
import { interpretLayerReport, loadPersistedDiagnosticEvidence, projectFailureDiagnostics, type PersistedSlotEvidence } from "./interpretation.js";

function report(overrides: Partial<NormalizedIntegrityReportStateV2> = {}): NormalizedIntegrityReportStateV2 {
  const base: NormalizedIntegrityReportStateV2 = {
    schema: "eval-integrity-v2", manifestHash: "a".repeat(64),
    pairMicro: { meanDeltaPp: 10, candidateMean: .6, baselineMean: .5, n: 4, interval: { method: "paired_t_95pct_pp_v1", lower: 2, upper: 18, reason: null } },
    subjectMacro: { meanDeltaPp: 10, candidateMean: .6, baselineMean: .5, n: 2, interval: { method: "paired_t_95pct_pp_v1", lower: 2, upper: 18, reason: null } },
    validPairCount: 4, includedSubjectCount: 2, excludedPairCounts: {}, subjectFailureCounts: {},
  };
  return { ...base, ...overrides };
}

describe("persisted layered-result interpretation", () => {
  it("explains a complete positive result and cautious conclusion", () => {
    const text = interpretLayerReport("L1 skills", report()).join(" ");
    expect(text).toContain("Candidate 60.00% vs baseline 50.00%: +10.00 pp");
    expect(text).toContain("4/4 valid/expected pairs");
    expect(text).toContain("[2.00, 18.00] pp");
    expect(text).toContain("supports an improvement, but does not establish broader causality");
  });
  it("calls a positive interval crossing zero uncertain", () => {
    const r = report({ subjectMacro: { ...report().subjectMacro, interval: { method: "paired_t_95pct_pp_v1", lower: -3, upper: 15, reason: null } } });
    expect(interpretLayerReport("L1 skills", r).join(" ")).toContain("crosses zero");
  });
  it("reports exclusions, reasons, and reduced pair coverage", () => {
    const r = report({ excludedPairCounts: { execution_failed: 2 }, subjectFailureCounts: { source_missing: 1 } });
    const text = interpretLayerReport("L2 agents", r).join(" ");
    expect(text).toContain("4/6 expected pairs had exclusions");
    expect(text).toContain("execution_failed=2");
    expect(text).toContain("source_missing=1");
  });
  it("handles absent reports and reports with no measurable data", () => {
    expect(interpretLayerReport("L1 skills", null).join(" ")).toContain("no persisted integrity report");
    const empty = report({ validPairCount: 0, includedSubjectCount: 0, pairMicro: { ...report().pairMicro, meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0 }, subjectMacro: { ...report().subjectMacro, meanDeltaPp: null, candidateMean: null, baselineMean: null, n: 0, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } } });
    expect(interpretLayerReport("L1 skills", empty).join(" ")).toContain("insufficient persisted data");
  });
  it("handles negative deltas with and without a wholly negative CI", () => {
    const macro = { ...report().subjectMacro, meanDeltaPp: -8, candidateMean: .42, baselineMean: .5 };
    const negative = report({ subjectMacro: { ...macro, interval: { method: "paired_t_95pct_pp_v1", lower: -14, upper: -2, reason: null } } });
    expect(interpretLayerReport("L3 recipes", negative).join(" ")).toContain("indicates a regression");
    expect(interpretLayerReport("L3 recipes", negative).join(" ")).toContain("candidate 42.00% scored below baseline 50.00%");
    const noCi = report({ subjectMacro: { ...macro, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } } });
    expect(interpretLayerReport("L3 recipes", noCi).join(" ")).toContain("possible regression");
    expect(interpretLayerReport("L3 recipes", noCi).join(" ")).toContain("candidate 42.00% scored below baseline 50.00%");
  });
  it("groups representative persisted root causes by subject/eval/side and recommends budget right-sizing", () => {
    const terminal = (reason: any): any => ({ status: "failed", exclusion: { level: "pair", reason }, grading: null });
    const slots: PersistedSlotEvidence[] = [
      { subject: "alpha", evalId: 3, repetition: 0, side: "candidate", terminal: terminal("execution_failed"), paths: { timing: "alpha/eval-3/candidate/timing.json" }, timing: { turnsUsed: 8, maxTurns: 8, maxTurnsReached: true }, execution: { status: "failed" } },
      { subject: "alpha", evalId: 3, repetition: 0, side: "baseline", terminal: terminal("execution_failed"), paths: { execution: "alpha/eval-3/baseline/execution-result.json" }, timing: {}, execution: { status: "failed", signal: "SIGKILL" } },
      { subject: "beta", evalId: 1, repetition: 0, side: "candidate", terminal: terminal("execution_failed"), paths: { log: "beta/eval-1/candidate/goose-log-analysis.json" }, timing: {}, execution: { status: "failed" }, log: { fatalDiagnostics: [{ code: "provider_authentication_failed" }] } },
      { subject: "beta", evalId: 1, repetition: 0, side: "baseline", terminal: terminal("runtime_dependency_failed"), paths: { execution: "beta/eval-1/baseline/execution-result.json" }, timing: {}, execution: { failureReason: "runtime_dependency_failed" } },
      { subject: "gamma", evalId: 2, repetition: 0, side: "candidate", terminal: terminal("grader_invalid"), paths: { grader: "gamma/eval-2/candidate/grader-attempt-1.json" }, timing: {}, execution: {}, grader: { classification: "malformed_grader_json", parseOutcome: "invalid" } },
      { subject: "gamma", evalId: 2, repetition: 0, side: "baseline", terminal: terminal("treatment_bootstrap_failed"), paths: { execution: "gamma/eval-2/baseline/execution-result.json" }, timing: {}, execution: { failureReason: "treatment_bootstrap_failed" } },
      { subject: "delta", evalId: 0, repetition: 0, side: "candidate", terminal: null, paths: {} },
      { subject: "delta", evalId: 0, repetition: 0, side: "baseline", terminal: terminal("execution_failed"), paths: { execution: "delta/eval-0/baseline/execution-result.json", timing: "delta/eval-0/baseline/timing.json" }, timing: {}, execution: { status: "failed" } },
    ];
    const diagnostics = projectFailureDiagnostics(report({ excludedPairCounts: { execution_failed: 8 } }), slots);
    expect(diagnostics.groups.map(group => group.reason)).toEqual(["max_turns_reached", "timeout", "runtime_dependency", "provider_network", "grader_invalid", "bootstrap", "missing_artifacts", "unknown"]);
    expect(diagnostics.groups[0]?.slots).toEqual(["alpha/eval-3/rep-0/candidate"]);
    expect(diagnostics.groups[3]?.evidence.join(" ")).toContain("provider_authentication_failed");
    expect(diagnostics.recommendation).toContain("Right-size scenario complexity");
    const text = interpretLayerReport("L1 skills", report({ excludedPairCounts: { execution_failed: 8 } }), undefined, diagnostics).join(" ");
    expect(text.indexOf("Failures first")).toBeLessThan(text.indexOf("Candidate 60.00%"));
    expect(text).toContain("4/12 valid/expected pairs");
    expect(text).toContain("alpha/eval-3/rep-0/candidate");
  });

  it("does not let max-turn timing mask an explicit runtime dependency failure", () => {
    const terminal: any = { status: "failed", exclusion: { level: "pair", reason: "runtime_dependency_failed" }, grading: null };
    const slots: PersistedSlotEvidence[] = [{
      subject: "independent-verifier", evalId: 3, repetition: 0, side: "candidate", terminal,
      paths: { execution: "independent-verifier/eval-3/candidate/execution-result.json", timing: "independent-verifier/eval-3/candidate/timing.json" },
      timing: { turnsUsed: 464, maxTurns: 40, maxTurnsReached: true },
      execution: { status: "failed", failureReason: "runtime_dependency_failed" },
    }];
    const diagnostics = projectFailureDiagnostics(report({ validPairCount: 0, excludedPairCounts: { runtime_dependency_failed: 1 } }), slots);
    expect(diagnostics.groups[0]?.reason).toBe("runtime_dependency");
    expect(diagnostics.groups[0]?.slots).toEqual(["independent-verifier/eval-3/rep-0/candidate"]);
    expect(diagnostics.recommendation).toContain("runtime");
  });

  it("isolates max-turn evidence to each current layered run snapshot and declared slot", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "eval-diagnostics-"));
    try {
      const layerWorkspace = path.join(temp, "layered", "run-1", "skills");
      const integrityRoot = path.join(layerWorkspace, "_integrity-v2", "skills");
      const store = new EvalIntegrityV2Store(integrityRoot);
      const envelope = { provider: "test", model: "test", decoding: { temperature: null, seed: null }, timeBudgetMs: null, tokenBudget: null, gooseRuntimeVersion: "test", evalHubRuntimeVersion: "test" };
      const manifest: IntegrityManifestV2 = {
        schema: INTEGRITY_SCHEMA_V2, runProvenanceId: "round-trip", cliArguments: [],
        subjects: [{ kind: "skills", subject: "alpha", sourceHash: "hash-alpha", evalIds: [3] }], repetitions: 2,
        treatments: [
          { id: "with_alpha", kind: "skills", subject: "alpha", side: "candidate", definitionHash: "candidate-hash", bootstrapHash: "candidate-bootstrap" },
          { id: "without_alpha", kind: "skills", subject: "alpha", side: "baseline", definitionHash: "baseline-hash", bootstrapHash: "baseline-bootstrap" },
        ],
        taskPayloadHashes: { "skills/alpha/3": "task-hash" }, maxTurnsByTask: { "skills/alpha/3": 8 }, fixtureHashes: {},
        executionEnvelope: envelope, grader: { id: "grader", version: "1" }, rubric: { id: "rubric", version: "1" },
      };
      const stored = await store.createManifest(manifest);
      await store.recordTerminal({
        schema: INTEGRITY_SCHEMA_V2, manifestHash: stored.hash, kind: "skills", subject: "alpha", evalId: 3, repetition: 0,
        side: "candidate", treatmentId: "with_alpha", status: "failed", grading: null, exclusion: { level: "pair", reason: "execution_failed" },
        pairKey: { taskPayloadHash: "task-hash", maxTurns: 8, fixtureHashes: {}, executionEnvelopeHash: integrityValueHash(envelope), candidateTreatmentId: "with_alpha", baselineTreatmentId: "without_alpha", candidateTreatmentHash: "candidate-hash", baselineTreatmentHash: "baseline-hash", runProvenanceId: "round-trip", graderId: "grader", graderVersion: "1", rubricId: "rubric", rubricVersion: "1" },
      });
      // Reproduce SuiteRunner’s production snapshot: FsWorkspaceWriter writes
      // <canonical>/<hash>/eval-N/<treatmentId>/run-N, then fs.cp merges that
      // canonical subject/hash tree into the layered subject/hash workspace.
      const canonical = path.join(temp, "canonical", "alpha", "hash-alpha");
      const productionRun = path.join(canonical, "eval-3", "with_alpha", "run-1");
      const secondProductionRun = path.join(canonical, "eval-3", "with_alpha", "run-2");
      const undeclaredEvalRun = path.join(canonical, "eval-0", "with_alpha", "run-1");
      const staleTreatmentRun = path.join(canonical, "eval-3", "stale_treatment", "run-1");
      await Promise.all([productionRun, secondProductionRun, undeclaredEvalRun, staleTreatmentRun].map(dir => fs.mkdir(dir, { recursive: true })));
      await fs.writeFile(path.join(productionRun, "timing.json"), JSON.stringify({ startedAt: "2026-08-05T00:00:00Z", completedAt: "2026-08-05T00:01:00Z", durationMs: 60_000, turnsUsed: 8, maxTurns: 8, maxTurnsReached: true }));
      await fs.writeFile(path.join(productionRun, "execution-result.json"), JSON.stringify({ status: "failed" }));
      await fs.writeFile(path.join(productionRun, "goose-log-analysis.json"), JSON.stringify({ fatalDiagnostics: [] }));
      await fs.writeFile(path.join(productionRun, "grading-diagnostic.json"), JSON.stringify({ classification: "ok" }));
      await fs.writeFile(path.join(secondProductionRun, "timing.json"), JSON.stringify({ turnsUsed: 7, maxTurns: 8, maxTurnsReached: false }));
      await fs.writeFile(path.join(undeclaredEvalRun, "timing.json"), JSON.stringify({ turnsUsed: 99, maxTurns: 99, maxTurnsReached: true }));
      await fs.writeFile(path.join(staleTreatmentRun, "timing.json"), JSON.stringify({ turnsUsed: 77, maxTurns: 77, maxTurnsReached: true }));
      await fs.mkdir(path.join(layerWorkspace, "alpha", "hash-alpha"), { recursive: true });
      await fs.cp(canonical, path.join(layerWorkspace, "alpha", "hash-alpha"), { recursive: true, force: true });

      const otherLayerWorkspace = path.join(temp, "layered", "run-2", "skills");
      const otherIntegrityRoot = path.join(otherLayerWorkspace, "_integrity-v2", "skills");
      const otherStore = new EvalIntegrityV2Store(otherIntegrityRoot);
      const otherStored = await otherStore.createManifest({ ...manifest, runProvenanceId: "other-run", subjects: [{ ...manifest.subjects[0]!, sourceHash: "stale-hash" }] });
      await otherStore.recordTerminal({
        schema: INTEGRITY_SCHEMA_V2, manifestHash: otherStored.hash, kind: "skills", subject: "alpha", evalId: 3, repetition: 0,
        side: "candidate", treatmentId: "with_alpha", status: "failed", grading: null, exclusion: { level: "pair", reason: "execution_failed" },
        pairKey: { taskPayloadHash: "task-hash", maxTurns: 8, fixtureHashes: {}, executionEnvelopeHash: integrityValueHash(envelope), candidateTreatmentId: "with_alpha", baselineTreatmentId: "without_alpha", candidateTreatmentHash: "candidate-hash", baselineTreatmentHash: "baseline-hash", runProvenanceId: "other-run", graderId: "grader", graderVersion: "1", rubricId: "rubric", rubricVersion: "1" },
      });
      const otherTiming = path.join(otherLayerWorkspace, "alpha", "stale-hash", "eval-3", "with_alpha", "run-1", "timing.json");
      await fs.mkdir(path.dirname(otherTiming), { recursive: true });
      await fs.writeFile(otherTiming, JSON.stringify({ turnsUsed: 6, maxTurns: 8, maxTurnsReached: false }));

      const slots = await loadPersistedDiagnosticEvidence(layerWorkspace, integrityRoot);
      const otherSlots = await loadPersistedDiagnosticEvidence(otherLayerWorkspace, otherIntegrityRoot);
      const diagnostics = projectFailureDiagnostics(report({ excludedPairCounts: { execution_failed: 1 } }), slots);
      expect(diagnostics.groups.find(group => group.reason === "max_turns_reached")?.slots).toEqual(["alpha/eval-3/rep-0/candidate"]);
      expect(slots).toHaveLength(4);
      expect(slots.every(slot => slot.evalId === 3)).toBe(true);
      expect(slots.find(slot => slot.repetition === 0 && slot.side === "candidate")?.timing?.turnsUsed).toBe(8);
      expect(slots.find(slot => slot.repetition === 1 && slot.side === "candidate")?.timing?.turnsUsed).toBe(7);
      expect(otherSlots.find(slot => slot.side === "candidate")?.timing?.turnsUsed).toBe(6);
      expect(projectFailureDiagnostics(report({ excludedPairCounts: { execution_failed: 1 } }), otherSlots).groups.some(group => group.reason === "max_turns_reached")).toBe(false);
      expect(slots.find(slot => slot.repetition === 0 && slot.side === "candidate")?.paths.timing).toBe("alpha/hash-alpha/eval-3/with_alpha/run-1/timing.json");
      expect(slots.find(slot => slot.repetition === 1 && slot.side === "candidate")?.paths.timing).toBe("alpha/hash-alpha/eval-3/with_alpha/run-2/timing.json");
      expect(slots.find(slot => slot.side === "candidate")?.paths.execution).toBe("alpha/hash-alpha/eval-3/with_alpha/run-1/execution-result.json");
      expect(slots.find(slot => slot.side === "candidate")?.paths.grader).toBe("alpha/hash-alpha/eval-3/with_alpha/run-1/grading-diagnostic.json");

      const ambiguousRoot = path.join(layerWorkspace, "_integrity-v2", "ambiguous");
      const ambiguousStore = new EvalIntegrityV2Store(ambiguousRoot);
      await ambiguousStore.createManifest({ ...manifest, runProvenanceId: "ambiguous", treatments: [...manifest.treatments, { ...manifest.treatments[0]!, id: "also_with_alpha" }] });
      await expect(loadPersistedDiagnosticEvidence(layerWorkspace, ambiguousRoot)).rejects.toThrow(/ambiguous diagnostic treatment/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("preserves skipped layers as uninterpreted", () => {
    expect(interpretLayerReport("L2 agents", null, "early stop")).toEqual(["L2 agents: skipped (early stop); no result is interpreted."]);
  });

  it("renders a concrete negative delta without exclusions using candidate-vs-baseline language", () => {
    const macro: { meanDeltaPp: number; candidateMean: number; baselineMean: number; n: number; interval: { method: "paired_t_95pct_pp_v1"; lower: null; upper: null; reason: "insufficient_pairs" } } = { meanDeltaPp: -50, candidateMean: .5, baselineMean: 1, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } };
    const r = report({ validPairCount: 1, includedSubjectCount: 1, pairMicro: { ...macro, n: 1 }, subjectMacro: macro, excludedPairCounts: {}, subjectFailureCounts: {} });
    const text = interpretLayerReport("L2 agents", r).join("\n");
    expect(text).toContain("All 1/1 expected pairs completed; no exclusions");
    expect(text).toContain("Candidate 50.00% vs baseline 100.00%: -50.00 pp");
    expect(text).toContain("95% paired-t CI: insufficient_pairs (n=1 < 2 subjects");
    expect(text).toContain("candidate 50.00% scored below baseline 100.00%");
    expect(text).toContain("possible regression");
  });

  it("includes graded pair analysis with criterion breakdown when grading details are provided", () => {
    const macro = { meanDeltaPp: -50, candidateMean: .5, baselineMean: 1, n: 1, interval: { method: "paired_t_95pct_pp_v1" as const, lower: null, upper: null, reason: "insufficient_pairs" as const } };
    const r = report({ validPairCount: 1, includedSubjectCount: 1, pairMicro: { ...macro, n: 1 }, subjectMacro: macro, excludedPairCounts: {}, subjectFailureCounts: {} });
    const candidateGrading = {
      summary: { total: 4, passed: 2, failed: 2, pass_rate: .5 },
      expectations: [
        { text: "Triggers semantic review.", passed: true, evidence: "Found factory, external ID, provider triggers." },
        { text: "Simplified constructor not sufficient.", passed: true, evidence: "Recognized unit tests don't prove production path." },
        { text: "Exercises production factory.", passed: false, evidence: "No production factory found or exercised." },
        { text: "Returns REWORK verdict.", passed: false, evidence: "Returned ACCEPTED instead of REWORK." },
      ],
    };
    const baselineGrading = {
      summary: { total: 4, passed: 4, failed: 0, pass_rate: 1 },
      expectations: [
        { text: "Triggers semantic review.", passed: true, evidence: "Explicitly identified semantic review triggers." },
        { text: "Simplified constructor not sufficient.", passed: true, evidence: "Correctly treated unit tests as insufficient." },
        { text: "Exercises production factory.", passed: true, evidence: "Inspected SuiteRunner, LayeredRunner, consumers." },
        { text: "Returns REWORK verdict.", passed: true, evidence: "Returned REWORK because production path not proven." },
      ],
    };
    const candidateKpi = { totalTokens: 84029, messageCount: 62, toolCalls: 46, toolFailures: 0, durationMs: 218971, turnsUsed: 538, maxTurns: 40, maxTurnsReached: true, retries: 0, errors: 0 };
    const baselineKpi = { totalTokens: 56818, messageCount: 52, toolCalls: 38, toolFailures: 0, durationMs: 207275, turnsUsed: 362, maxTurns: 40, maxTurnsReached: true, retries: 0, errors: 0 };
    const slots: PersistedSlotEvidence[] = [
      {
        subject: "independent-verifier", evalId: 3, repetition: 0, side: "candidate",
        terminal: { status: "succeeded", exclusion: null } as any,
        paths: { grading: "independent-verifier/hash/eval-3/agent_l2/run-1/grading.json" },
        gradingDetail: candidateGrading as any, kpi: candidateKpi,
        timing: { turnsUsed: 538, maxTurns: 40, maxTurnsReached: true },
        execution: { status: "succeeded" },
        log: { fatalDiagnostics: [] },
      },
      {
        subject: "independent-verifier", evalId: 3, repetition: 0, side: "baseline",
        terminal: { status: "succeeded", exclusion: null } as any,
        paths: { grading: "independent-verifier/hash/eval-3/agent_l1/run-1/grading.json" },
        gradingDetail: baselineGrading as any, kpi: baselineKpi,
        timing: { turnsUsed: 362, maxTurns: 40, maxTurnsReached: true },
        execution: { status: "succeeded" },
        log: { fatalDiagnostics: [] },
      },
    ];
    const text = interpretLayerReport("L2 agents", r, undefined, undefined, slots).join("\n");
    // Score analysis header
    expect(text).toContain("Score analysis");
    expect(text).toContain("regressed by -50.00 pp");
    // Per-criterion diff
    expect(text).toContain("criterion[2]: candidate=FAIL baseline=pass");
    expect(text).toContain("criterion[3]: candidate=FAIL baseline=pass");
    // Evidence for failed criteria
    expect(text).toContain("No production factory found");
    expect(text).toContain("Returned ACCEPTED instead of REWORK");
    // KPI comparison
    expect(text).toContain("Token delta: +27211");
    expect(text).toContain("Tool calls delta: +8");
  });
});
