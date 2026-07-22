/**
 * Execution domain ports.
 * Fine-grained ISP interfaces — one concern per interface.
 */
import type { EvalKind, SubjectName, ContentHash, ComparisonMode, TreatmentId } from "../../shared/types.js";
import type { EvalEvent, SuiteEvent, LayeredEvent, DomainEvent } from "../../shared/events.js";
import type { EvalScenario } from "../../shared/types.js";
import type { ExecutionTreatment } from "./executionIntegrity.js";
import type { INTEGRITY_SCHEMA_V2, IntegrityManifestV2 } from "../persistence/integrityV2Store.js";

// ── Goose process ─────────────────────────────────────────────────────────────

export interface GooseRunConfig {
  readonly gooseCli:    string;
  readonly args:        readonly string[];
  readonly env?:        Record<string, string>;
  readonly cwd:         string;
  readonly timeoutMs?:  number;
}

export interface GooseRuntimeIdentity {
  readonly version: string;
  readonly provider: string | null;
  readonly model: string | null;
}

export type GooseRawEvent =
  | { type: "line";   stream: "stdout" | "stderr"; text: string }
  | { type: "exit";   code: number | null; signal: string | null };

/** Spawns the Goose binary and yields raw line events. */
export interface IGooseRunner {
  run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent>;
  version(cli: string): Promise<string>;
  identity(cli: string): Promise<GooseRuntimeIdentity>;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export interface IPromptBuilder {
  build(scenario: EvalScenario, config: string): string;
}

// ── Grader ────────────────────────────────────────────────────────────────────

export interface GradingResult {
  readonly summary: {
    readonly total:     number;
    readonly passed:    number;
    readonly failed:    number;
    /** null when the grader itself failed — excluded from delta computation. */
    readonly pass_rate: number | null;
  };
  readonly expectations: ReadonlyArray<{
    readonly text:     string;
    readonly passed:   boolean;
    readonly evidence: string;
  }>;
}

export interface IGrader {
  grade(
    scenario:    EvalScenario,
    config:      string,
    gooseOutput: string,
    runDir:      string,
    gooseCli:    string,
  ): Promise<GradingResult>;
}

// ── Event sink (pub/sub bridge) ───────────────────────────────────────────────

export interface IEventSink {
  emit(event: DomainEvent): void;
}

// ── Single scenario eval ──────────────────────────────────────────────────────

export interface ScenarioIntegrityPlan {
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  readonly root: string;
  readonly manifestHash: string;
  readonly runProvenanceId: string;
  readonly side: "candidate" | "baseline";
  readonly candidateTreatmentId: TreatmentId;
  readonly baselineTreatmentId: TreatmentId;
  readonly candidateTreatmentHash: string;
  readonly baselineTreatmentHash: string;
  readonly grader: IntegrityManifestV2["grader"];
  readonly rubric: IntegrityManifestV2["rubric"] & { readonly expectedCriterionIds: readonly string[] };
}

export interface ScenarioRunConfig {
  readonly kind:        EvalKind;
  readonly subject:     SubjectName;
  readonly hash:        ContentHash;
  readonly scenario:    EvalScenario;
  readonly evalId:      number;
  readonly config:      TreatmentId;
  readonly treatment:   ExecutionTreatment;
  readonly repetition:  number;
  readonly workspace:   string;
  readonly gooseCli:    string;
  readonly maxTurns:    number;
  readonly timeoutMs:   number;
  readonly ambient:     boolean;
  readonly fixtureHashes: Readonly<Record<string, string>>;
  readonly plannedTaskPayload: string;
  readonly plannedTaskPayloadHash: string;
  readonly provider:      string | null;
  readonly model:         string | null;
  readonly gooseRuntimeVersion: string;
  readonly decoding:      Readonly<{ temperature: number | null; seed: number | null }>;
  readonly evalHubRuntimeVersion: string;
  readonly integrity: ScenarioIntegrityPlan;
}

export interface IEvalRunner {
  run(config: ScenarioRunConfig, sink?: IEventSink): AsyncGenerator<EvalEvent>;
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export interface SuiteConfig {
  readonly kind:           EvalKind;
  readonly subjects:       readonly SubjectName[];
  readonly workspace:      string;
  readonly gooseCli:       string;
  readonly workers:        number;
  readonly mode:           ComparisonMode;
  readonly maxTurns:       number;
  readonly timeoutMs:      number;
  readonly ambient:        boolean;
  readonly continueOnFail: boolean;
  readonly repetitions:    number;
}

/** One leaf execution unit: subject × scenario × repetition × side. */
export interface SuiteExecutionRow {
  readonly subject:    SubjectName;
  readonly evalId:     number;
  readonly repetition: number;
  readonly side:       "candidate" | "baseline";
  /** Scenario object needed by runPlan() for fixture materialisation. */
  readonly scenario:   EvalScenario;
  /** Fully-resolved, manifest-frozen run configuration — immutable after plan(). */
  readonly runCfg:     ScenarioRunConfig;
}

/**
 * Immutable execution plan returned by SuiteRunner.plan().
 *
 * EVAL-INT-04/05/11/19 — all treatment/fixture/payload values are frozen at
 * planning time.  runPlan() must not re-derive any of these fields.
 */
export interface SuiteExecutionPlan {
  /** Original SuiteConfig used to build this plan (stored for runPlan). */
  readonly cfg:                SuiteConfig;
  /** All rows in execution order (subject × evalId × repetition × side). */
  readonly rows:               readonly SuiteExecutionRow[];
  /** SHA-256 hex of the written manifest.json (for drift assertions in tests). */
  readonly manifestHash:       string;
  /**
   * Planned fixture source hashes (relative-path → ContentHasher hash).
   * runPlan() re-hashes from disk and throws input_mismatch on any difference.
   */
  readonly fixtureSourceHashes: Readonly<Record<string, string>>;
  /** sourceHash per subject — used by runPlan() to construct workspace paths. */
  readonly subjectHashes:      Readonly<Record<string, string>>;
}

export interface ISuiteRunner {
  /**
   * Resolve all scenarios/subjects/treatments/payloads/fixture hashes/runtime
   * and create the immutable integrity manifest.  Makes zero IEvalRunner calls.
   */
  plan(config: SuiteConfig): Promise<SuiteExecutionPlan>;
  /**
   * Execute exactly the rows recorded in the plan.  Must not reload eval JSON,
   * rebuild treatments, recompute payloads, or mutate the manifest.
   * Throws input_mismatch (before any IEvalRunner call) if any fixture source
   * file has changed since planning.
   */
  runPlan(plan: SuiteExecutionPlan, sink?: IEventSink): AsyncGenerator<SuiteEvent>;
  /** Convenience wrapper: plan(config) then runPlan(plan, sink). */
  run(config: SuiteConfig, sink?: IEventSink): AsyncGenerator<SuiteEvent>;
}

// ── Layered orchestrator ──────────────────────────────────────────────────────

export interface LayeredConfig {
  readonly layers:             readonly EvalKind[];
  readonly workers:            number;
  readonly gooseCli:           string;
  readonly maxTurns:           number;
  readonly timeoutMs:          number;
  readonly ambient:            boolean;
  readonly continueOnFail:     boolean;
  readonly earlyStopThreshold: number;
  readonly noEarlyStop:        boolean;
  readonly repetitions?:       number;
  readonly layeredRunId?:      string;
  readonly subjectFilter?:     readonly string[];
}

export interface ILayeredRunner {
  run(config: LayeredConfig, sink?: IEventSink): AsyncGenerator<LayeredEvent>;
}
