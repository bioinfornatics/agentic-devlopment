import type { LayeredConfig, ILayeredRunner } from "../execution/ports.js";
import type { LayeredEvent } from "../../shared/events.js";
import {
  integrityValueHash,
  type IntegrityManifestV2,
  type NormalizedIntegrityReportStateV2,
  type PairExclusionReason,
} from "../persistence/integrityV2Store.js";

export const RELEASE_LAYERS = ["skills", "agents", "recipes"] as const;
export type ReleaseLayer = typeof RELEASE_LAYERS[number];
export type ReleaseLevel = "L0" | "L1" | "L2" | "L3";

export interface ReleaseGateThresholds {
  readonly minimumValidPairRate: number;
  readonly maximumExclusionRate: number;
  /** Fractional score units: 0.05 is five percentage points. */
  readonly minimumTreatmentDelta: number;
  readonly minimumConfidenceIntervalLowerBoundExclusive: number;
}

export interface ReleaseProtocolProfile {
  readonly profileVersion: string;
  readonly release: {
    readonly providerBacked: true;
    readonly layers: readonly ["skills", "agents", "recipes"];
    readonly conceptualBaseline: "L0";
    readonly noEarlyStop: true;
    readonly repetitions: number;
    readonly provider: string;
    readonly model: string;
    readonly maxTurns: number;
    readonly timeoutMs: number;
    readonly decoding: {
      readonly temperature: number | null;
      readonly seedPolicy: string;
      readonly seed: number | null;
    };
    readonly gooseBinary: string;
    readonly sandboxRootsRequired: true;
  };
  readonly thresholds: ReleaseGateThresholds;
}

/** Immutable identities that must be exact in every persisted layer manifest. */
export interface ReleaseGateBindings {
  readonly runProvenanceId: string;
  readonly profile: string;
  readonly runtime: string;
  readonly release: string;
  readonly corpus: string;
  readonly goose: string;
  readonly provider: string;
  readonly model: string;
}

export interface ReleaseExecutionMetadata {
  readonly noEarlyStop: boolean;
  readonly resumed: boolean;
  readonly mixedProvenance: boolean;
  readonly sandboxed: boolean;
}

export interface ReleaseGatePersistedLayer {
  readonly executed: boolean;
  readonly manifestHash: string;
  readonly manifest: IntegrityManifestV2;
  readonly report: NormalizedIntegrityReportStateV2 | null;
  readonly terminals: readonly {
    readonly kind: string;
    readonly subject: string;
    readonly evalId: number;
    readonly repetition: number;
    readonly side: "candidate" | "baseline";
  }[];
}

export interface ReleaseGateInput {
  readonly profile: ReleaseProtocolProfile;
  readonly bindings: ReleaseGateBindings;
  readonly execution: ReleaseExecutionMetadata;
  readonly layers: Partial<Readonly<Record<ReleaseLayer, ReleaseGatePersistedLayer>>>;
}

export interface ConceptualL0Evidence {
  readonly level: "L0";
  readonly kind: "skills";
  readonly executedAs: "skill_l0";
  readonly executedSeparately: false;
  readonly baselineMean: number | null;
}

export interface LayerGateEvidence {
  readonly level: "L1" | "L2" | "L3";
  readonly kind: ReleaseLayer;
  readonly executed: boolean;
  readonly passed: boolean;
  readonly validPairRate: number | null;
  readonly exclusionRate: number | null;
  readonly pairMicro: NormalizedIntegrityReportStateV2["pairMicro"] | null;
  readonly subjectMacro: NormalizedIntegrityReportStateV2["subjectMacro"] | null;
  readonly reasons: readonly string[];
}

export interface ReleaseGateResult {
  readonly passed: boolean;
  readonly l0: ConceptualL0Evidence;
  readonly layers: readonly LayerGateEvidence[];
  readonly reasons: readonly string[];
}

const LEVELS: Readonly<Record<ReleaseLayer, "L1" | "L2" | "L3">> = {
  skills: "L1", agents: "L2", recipes: "L3",
};
const FORBIDDEN_EXCLUSIONS: ReadonlySet<PairExclusionReason> = new Set([
  "result_missing", "grader_invalid", "treatment_bootstrap_failed", "input_mismatch",
  "provenance_mismatch", "grader_mismatch", "rubric_mismatch", "runtime_binary_changed",
  "runtime_binary_unavailable",
]);
const BINDING_KEYS = ["profile", "runtime", "release", "corpus", "goose", "provider", "model"] as const;

function expectedPairs(manifest: IntegrityManifestV2): number {
  return manifest.subjects.reduce((sum, subject) => sum + new Set(subject.evalIds).size * manifest.repetitions, 0);
}
function count(values: Readonly<Record<string, number | undefined>>): number {
  return Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
function finiteSummary(summary: NormalizedIntegrityReportStateV2["pairMicro"]): boolean {
  return summary.n > 0
    && Number.isFinite(summary.meanDeltaPp)
    && Number.isFinite(summary.candidateMean)
    && Number.isFinite(summary.baselineMean)
    && Number.isFinite(summary.interval.lower)
    && Number.isFinite(summary.interval.upper);
}
function missingLayer(kind: ReleaseLayer, reason: string): LayerGateEvidence {
  return { level: LEVELS[kind], kind, executed: false, passed: false, validPairRate: null,
    exclusionRate: null, pairMicro: null, subjectMacro: null, reasons: [reason] };
}
function manifestEnvelopeReasons(
  manifest: IntegrityManifestV2,
  profile: ReleaseProtocolProfile,
  bindings: ReleaseGateBindings,
): string[] {
  const reasons: string[] = [];
  const expected = profile.release;
  if (manifest.runProvenanceId !== bindings.runProvenanceId) reasons.push("mixed_run_provenance");
  if (manifest.repetitions !== expected.repetitions || manifest.repetitions < 5) reasons.push("invalid_repetitions");
  if (manifest.executionEnvelope.provider !== bindings.provider || bindings.provider !== expected.provider) reasons.push("provider_mismatch");
  if (manifest.executionEnvelope.model !== bindings.model || bindings.model !== expected.model) reasons.push("model_mismatch");
  if (manifest.executionEnvelope.gooseRuntimeVersion !== bindings.goose) reasons.push("goose_mismatch");
  if (manifest.executionEnvelope.timeBudgetMs !== expected.timeoutMs) reasons.push("timeout_mismatch");
  if (manifest.executionEnvelope.decoding.temperature !== expected.decoding.temperature
      || manifest.executionEnvelope.decoding.seed !== expected.decoding.seed) reasons.push("decoding_or_seed_mismatch");
  if (!expected.decoding.seedPolicy) reasons.push("seed_policy_missing");
  if (!Object.values(manifest.maxTurnsByTask).length
      || !Object.values(manifest.maxTurnsByTask).every(turns => turns === expected.maxTurns)) reasons.push("max_turns_mismatch");
  for (const key of BINDING_KEYS) {
    const token = `binding.${key}=${bindings[key]}`;
    if (!manifest.cliArguments.includes(token)) reasons.push(`missing_${key}_binding`);
  }
  return reasons;
}

/** Pure, fail-closed statistical decision over already-persisted Integrity V2 state. */
export function evaluateReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  const reasons: string[] = [];
  const p = input.profile.release;
  if (!input.execution.noEarlyStop) reasons.push("early_stopped");
  if (input.execution.resumed) reasons.push("resumed_run");
  if (input.execution.mixedProvenance) reasons.push("mixed_run_provenance");
  if (!input.execution.sandboxed) reasons.push("sandbox_required");
  if (p.noEarlyStop !== true || p.repetitions < 5 || p.layers.join(",") !== RELEASE_LAYERS.join(",")
      || p.conceptualBaseline !== "L0" || p.sandboxRootsRequired !== true || !p.gooseBinary) reasons.push("invalid_release_profile");
  if (input.profile.thresholds.minimumValidPairRate < 0.9
      || input.profile.thresholds.maximumExclusionRate > 0.1
      || input.profile.thresholds.minimumTreatmentDelta < 0.05) reasons.push("unsafe_threshold_profile");

  const layers: LayerGateEvidence[] = RELEASE_LAYERS.map(kind => {
    const persisted = input.layers[kind];
    if (!persisted) return missingLayer(kind, "layer_state_missing");
    if (!persisted.executed) return missingLayer(kind, "layer_not_executed");
    if (!persisted.report) return missingLayer(kind, "report_state_missing");
    const { manifest, report, terminals } = persisted;
    const layerReasons = manifestEnvelopeReasons(manifest, input.profile, input.bindings);
    const canonicalManifestHash = integrityValueHash(manifest);
    if (persisted.manifestHash !== canonicalManifestHash || report.manifestHash !== canonicalManifestHash) layerReasons.push("manifest_hash_not_canonical");
    if (!manifest.subjects.length || manifest.subjects.some(subject => subject.kind !== kind)) layerReasons.push("layer_manifest_mismatch");
    const total = expectedPairs(manifest);
    const exclusions = count(report.excludedPairCounts);
    const expectedSlots = new Set<string>();
    for (const subject of manifest.subjects) for (const evalId of new Set(subject.evalIds)) for (let repetition=0; repetition<manifest.repetitions; repetition++) for (const side of ["candidate","baseline"] as const) expectedSlots.add(`${subject.kind}:${subject.subject}:${evalId}:${repetition}:${side}`);
    const terminalSlots = new Set(terminals.map(t => `${t.kind}:${t.subject}:${t.evalId}:${t.repetition}:${t.side}`));
    if (terminals.length !== expectedSlots.size || terminalSlots.size !== expectedSlots.size || [...terminalSlots].some(slot => !expectedSlots.has(slot))) layerReasons.push("terminal_matrix_incomplete_or_substituted");
    if (report.validPairCount + exclusions !== total || report.pairMicro.n !== report.validPairCount) layerReasons.push("report_state_partial");
    if (count(report.subjectFailureCounts) !== 0) layerReasons.push("subject_failures_present");
    if (Object.entries(report.excludedPairCounts).some(([reason, amount]) =>
      FORBIDDEN_EXCLUSIONS.has(reason as PairExclusionReason) && (amount ?? 0) > 0)) layerReasons.push("forbidden_integrity_exclusion");
    const validPairRate = total > 0 ? report.validPairCount / total : null;
    const exclusionRate = total > 0 ? exclusions / total : null;
    if (validPairRate === null || validPairRate < input.profile.thresholds.minimumValidPairRate) layerReasons.push("valid_pair_rate_below_threshold");
    if (exclusionRate === null || exclusionRate > input.profile.thresholds.maximumExclusionRate) layerReasons.push("exclusion_rate_above_threshold");
    const minimumDeltaPp = input.profile.thresholds.minimumTreatmentDelta * 100;
    const minimumCiPp = Math.max(0, input.profile.thresholds.minimumConfidenceIntervalLowerBoundExclusive * 100);
    for (const [name, summary] of [["pair_micro", report.pairMicro], ["subject_macro", report.subjectMacro]] as const) {
      if (!finiteSummary(summary)) layerReasons.push(`${name}_not_finite`);
      else {
        if (summary.meanDeltaPp! < minimumDeltaPp) layerReasons.push(`${name}_delta_below_threshold`);
        if (summary.interval.lower! <= minimumCiPp) layerReasons.push(`${name}_ci_lower_not_positive`);
      }
    }
    return { level: LEVELS[kind], kind, executed: true, passed: layerReasons.length === 0,
      validPairRate, exclusionRate, pairMicro: report.pairMicro, subjectMacro: report.subjectMacro,
      reasons: layerReasons };
  });
  const skillBaseline = input.layers.skills?.report?.subjectMacro.baselineMean ?? null;
  return {
    passed: reasons.length === 0 && layers.every(layer => layer.passed),
    l0: { level: "L0", kind: "skills", executedAs: "skill_l0", executedSeparately: false, baselineMean: skillBaseline },
    layers,
    reasons,
  };
}

export interface ReleaseProtocolPlanInput {
  readonly profile: ReleaseProtocolProfile;
  readonly bindings: ReleaseGateBindings;
  readonly sandbox: NonNullable<LayeredConfig["sandbox"]>;
  readonly workers: number;
  readonly layeredRunId: string;
}

export function buildReleaseProtocolConfig(input: ReleaseProtocolPlanInput): LayeredConfig {
  const p = input.profile.release;
  const sandbox = input.sandbox;
  if (!sandbox.projectRoot || !sandbox.runtimeRoot || !sandbox.evidenceRoot || !sandbox.env.HOME
      || !sandbox.env.XDG_CONFIG_HOME || !sandbox.env.XDG_CACHE_HOME || !sandbox.env.XDG_DATA_HOME
      || !sandbox.env.XDG_STATE_HOME || !sandbox.env.XDG_RUNTIME_DIR || !sandbox.env.GOOSE_PATH_ROOT) throw new Error("all sandbox roots are required");
  if (p.repetitions < 5 || p.noEarlyStop !== true || p.layers.join(",") !== RELEASE_LAYERS.join(","))
    throw new Error("invalid release protocol profile");
  const { runProvenanceId, profile, runtime, release, corpus, goose, provider, model } = input.bindings;
  return { layers: RELEASE_LAYERS, workers: input.workers, gooseCli: p.gooseBinary,
    provider: p.provider, model: p.model, maxTurns: p.maxTurns,
    timeoutMs: p.timeoutMs, ambient: false, sandbox, continueOnFail: true,
    earlyStopThreshold: Number.NEGATIVE_INFINITY, noEarlyStop: true, repetitions: Math.max(5, p.repetitions),
    layeredRunId: input.layeredRunId,
    releaseContext: { runProvenanceId, bindings: { profile, runtime, release, corpus, goose, provider, model } } };
}

/** Injectable execution seam: tests can prove the complete schedule without a provider. */
export async function runReleaseProtocol(
  runner: ILayeredRunner,
  input: ReleaseProtocolPlanInput,
): Promise<readonly LayeredEvent[]> {
  const events: LayeredEvent[] = [];
  for await (const event of runner.run(buildReleaseProtocolConfig(input))) events.push(event);
  return events;
}