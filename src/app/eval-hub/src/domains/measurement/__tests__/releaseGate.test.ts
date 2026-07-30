import { describe, expect, it } from "vitest";
import type { ILayeredRunner } from "../../execution/ports.js";
import { integrityValueHash, type NormalizedIntegrityReportStateV2 } from "../../persistence/integrityV2Store.js";
import { buildReleaseProtocolConfig, evaluateReleaseGate, runReleaseProtocol, type ReleaseGateInput, type ReleaseProtocolProfile } from "../releaseGate.js";

type Layer = "skills" | "agents" | "recipes";
const profile: ReleaseProtocolProfile = { profileVersion: "2.0.0", release: { providerBacked: true,
  layers: ["skills", "agents", "recipes"], conceptualBaseline: "L0", noEarlyStop: true, repetitions: 5,
  provider: "provider", model: "model", maxTurns: 20, timeoutMs: 120000,
  decoding: { temperature: null, seedPolicy: "fixed-or-provider-null", seed: null },
  gooseBinary: "/sandbox/runtime/bin/goose", sandboxRootsRequired: true },
  thresholds: { minimumValidPairRate: .9, maximumExclusionRate: .1, minimumTreatmentDelta: .05,
    minimumConfidenceIntervalLowerBoundExclusive: 0 } };
const bindings = { runProvenanceId: "run", profile: "p", runtime: "rt", release: "rel", corpus: "corp",
  goose: "g", provider: "provider", model: "model" };
const summary = { meanDeltaPp: 8, candidateMean: .8, baselineMean: .72, n: 10,
  interval: { method: "paired_t_95pct_pp_v1" as const, lower: 2, upper: 14, reason: null } };
const report: NormalizedIntegrityReportStateV2 = { schema: "eval-integrity-v2", manifestHash: "h",
  pairMicro: summary, subjectMacro: summary, validPairCount: 10, includedSubjectCount: 2,
  excludedPairCounts: {}, subjectFailureCounts: {} };
const bindingArgs = Object.entries(bindings).filter(([key]) => key !== "runProvenanceId").map(([key, value]) => `binding.${key}=${value}`);
const manifest = (kind: Layer, provenance = "run") => ({ schema: "eval-integrity-v2" as const,
  runProvenanceId: provenance, cliArguments: bindingArgs,
  subjects: [{ kind, subject: "one", sourceHash: "src1", evalIds: [1] }, { kind, subject: "two", sourceHash: "src2", evalIds: [1] }],
  repetitions: 5, treatments: [], taskPayloadHashes: {}, maxTurnsByTask: { one: 20, two: 20 }, fixtureHashes: {},
  executionEnvelope: { provider: "provider", model: "model", decoding: { temperature: null, seed: null },
    timeBudgetMs: 120000, tokenBudget: null, gooseRuntimeVersion: "g", evalHubRuntimeVersion: "e" },
  grader: { id: "g", version: "1" }, rubric: { id: "r", version: "1" } });
const terminals = (kind: Layer) => ["one", "two"].flatMap(subject =>
  Array.from({ length: 5 }, (_, repetition) =>
    (["candidate", "baseline"] as const).map(side => ({ kind, subject, evalId: 1, repetition, side }))).flat());
const layerState = (kind: Layer) => { const m=manifest(kind); const h=integrityValueHash(m); return { executed: true, manifestHash: h, manifest: m, report: { ...report, manifestHash: h }, terminals: terminals(kind) }; };
const validInput = (): ReleaseGateInput => ({ profile, bindings,
  execution: { noEarlyStop: true, resumed: false, mixedProvenance: false, sandboxed: true },
  layers: { skills: layerState("skills"), agents: layerState("agents"), recipes: layerState("recipes") } });
const replaceReport = (input: ReleaseGateInput, bad: NormalizedIntegrityReportStateV2) => ({ ...input,
  layers: Object.fromEntries(Object.entries(input.layers).map(([kind, state]) => [kind, { ...state!, report: bad }])) });

describe("pure release gate", () => {
  it("passes exact L0-L3 evidence and extracts conceptual L0 from the skill baseline", () => {
    const result = evaluateReleaseGate(validInput());
    expect(result.passed).toBe(true);
    expect(result.l0).toEqual({ level: "L0", kind: "skills", executedAs: "skill_l0", executedSeparately: false, baselineMean: .72 });
    expect(result.layers.map(layer => [layer.level, layer.kind])).toEqual([["L1", "skills"], ["L2", "agents"], ["L3", "recipes"]]);
  });
  it.each(["skills", "agents", "recipes"] as const)("fails when %s state is missing", kind => {
    const input = validInput(); delete (input.layers as unknown as Record<string, unknown>)[kind];
    expect(evaluateReleaseGate(input).passed).toBe(false);
  });
  it("fails a present but unexecuted layer and a partial terminal matrix", () => {
    const baseA = validInput();
    expect(evaluateReleaseGate({ ...baseA, layers: { ...baseA.layers, agents: { ...baseA.layers.agents!, executed: false } } }).passed).toBe(false);
    const baseB = validInput();
    expect(evaluateReleaseGate({ ...baseB, layers: { ...baseB.layers, recipes: { ...baseB.layers.recipes!, terminals: baseB.layers.recipes!.terminals.slice(1) } } }).passed).toBe(false);
  });
  it("fails valid-pair and exclusion thresholds, including forbidden exclusions", () => {
    const threshold = { ...report, validPairCount: 8, pairMicro: { ...summary, n: 8 }, excludedPairCounts: { execution_failed: 2 } };
    expect(evaluateReleaseGate(replaceReport(validInput(), threshold)).passed).toBe(false);
    const forbidden = { ...report, validPairCount: 9, pairMicro: { ...summary, n: 9 }, excludedPairCounts: { grader_invalid: 1 } };
    expect(evaluateReleaseGate(replaceReport(validInput(), forbidden)).passed).toBe(false);
  });
  it("normalizes .05 to 5pp and requires finite pair/macro values with both CI lower bounds positive", () => {
    for (const bad of [
      { ...report, pairMicro: { ...summary, meanDeltaPp: 4.99 } },
      { ...report, subjectMacro: { ...summary, baselineMean: Number.NaN } },
      { ...report, pairMicro: { ...summary, interval: { ...summary.interval, lower: 0 } } },
      { ...report, subjectMacro: { ...summary, interval: { ...summary.interval, lower: 0 } } },
    ]) expect(evaluateReleaseGate(replaceReport(validInput(), bad)).passed).toBe(false);
  });
  it("rejects substituted unique terminal slots and forged matching manifest hashes", () => {
    const substituted = validInput(); const rows = substituted.layers.skills!.terminals.map((x,i) => i===0 ? {...x, subject:"fabricated"} : x);
    (substituted.layers as any).skills = {...substituted.layers.skills!, terminals:rows}; expect(evaluateReleaseGate(substituted).passed).toBe(false);
    const forged = validInput(); (forged.layers as any).skills = {...forged.layers.skills!, manifestHash:"forged", report:{...forged.layers.skills!.report!,manifestHash:"forged"}}; expect(evaluateReleaseGate(forged).passed).toBe(false);
  });
  it("fails missing reports, manifest mismatch, resume, mixed provenance, and early stop", () => {
    const missing = validInput(); (missing.layers as any).skills = { ...missing.layers.skills!, report: null };
    expect(evaluateReleaseGate(missing).passed).toBe(false);
    const hash = validInput(); (hash.layers as any).skills = { ...hash.layers.skills!, manifestHash: "other" };
    expect(evaluateReleaseGate(hash).passed).toBe(false);
    for (const execution of [
      { noEarlyStop: true, resumed: true, mixedProvenance: false, sandboxed: true },
      { noEarlyStop: true, resumed: false, mixedProvenance: true, sandboxed: true },
      { noEarlyStop: false, resumed: false, mixedProvenance: false, sandboxed: true },
    ]) expect(evaluateReleaseGate({ ...validInput(), execution }).passed).toBe(false);
    const provenance = validInput(); (provenance.layers as any).agents = { ...provenance.layers.agents!, manifest: manifest("agents", "other") };
    expect(evaluateReleaseGate(provenance).passed).toBe(false);
  });
});

describe("release protocol plan", () => {
  const sandbox = { projectRoot: "/s/project", runtimeRoot: "/s/runtime", evidenceRoot: "/s/evidence",
    env: { HOME: "/s/home", XDG_CONFIG_HOME: "/s/config", XDG_CACHE_HOME: "/s/cache", XDG_DATA_HOME: "/s/data", GOOSE_PATH_ROOT: "/s/goose",
      XDG_STATE_HOME: "/s/state", XDG_RUNTIME_DIR: "/s/run", PATH: "/bin" } };
  it("forces all three layers, no early stop, five repetitions, and sandbox", () => {
    expect(buildReleaseProtocolConfig({ profile, bindings, sandbox, workers: 2, layeredRunId: "run" })).toMatchObject({
      layers: ["skills", "agents", "recipes"], repetitions: 5, noEarlyStop: true, ambient: false, sandbox,
      releaseContext: { runProvenanceId: "run", bindings: { profile: "p", runtime: "rt", release: "rel", corpus: "corp", goose: "g", provider: "provider", model: "model" } } });
  });
  it("schedules the complete plan through an injected runner without a provider", async () => {
    let scheduled: unknown;
    const runner: ILayeredRunner = { async *run(config) { scheduled = config; } };
    await runReleaseProtocol(runner, { profile, bindings, sandbox, workers: 1, layeredRunId: "run" });
    expect(scheduled).toMatchObject({ layers: ["skills", "agents", "recipes"], repetitions: 5, noEarlyStop: true });
  });
  it("rejects an incomplete sandbox", () => {
    expect(() => buildReleaseProtocolConfig({ profile, bindings, sandbox: { ...sandbox, env: { ...sandbox.env, HOME: "" } }, workers: 1, layeredRunId: "run" })).toThrow(/sandbox roots/);
    expect(() => buildReleaseProtocolConfig({ profile, bindings, sandbox: { ...sandbox, env: { ...sandbox.env, GOOSE_PATH_ROOT: "" } }, workers: 1, layeredRunId: "run" })).toThrow(/sandbox roots/);
  });
});