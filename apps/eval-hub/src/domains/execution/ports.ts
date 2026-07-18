/**
 * Execution domain ports.
 * Fine-grained ISP interfaces — one concern per interface.
 */
import type { EvalKind, SubjectName, ContentHash, ComparisonMode } from "../../shared/types.js";
import type { EvalEvent, SuiteEvent, LayeredEvent, DomainEvent } from "../../shared/events.js";
import type { EvalScenario } from "../../shared/types.js";

// ── Goose process ─────────────────────────────────────────────────────────────

export interface GooseRunConfig {
  readonly gooseCli:    string;
  readonly args:        readonly string[];
  readonly env?:        Record<string, string>;
  readonly cwd:         string;
  readonly timeoutMs?:  number;
}

export type GooseRawEvent =
  | { type: "line";   stream: "stdout" | "stderr"; text: string }
  | { type: "exit";   code: number | null; signal: string | null };

/** Spawns the Goose binary and yields raw line events. */
export interface IGooseRunner {
  run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent>;
  version(cli: string): Promise<string>;
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

export interface ScenarioRunConfig {
  readonly kind:        EvalKind;
  readonly subject:     SubjectName;
  readonly hash:        ContentHash;
  readonly scenario:    EvalScenario;
  readonly evalId:      number;
  readonly config:      string;
  readonly runNumber:   number;
  readonly workspace:   string;
  readonly gooseCli:    string;
  readonly maxTurns:    number;
  readonly timeoutMs:   number;
  readonly ambient:     boolean;
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
}

export interface ISuiteRunner {
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
  readonly layeredRunId?:      string;
  readonly subjectFilter?:     readonly string[];
}

export interface ILayeredRunner {
  run(config: LayeredConfig, sink?: IEventSink): AsyncGenerator<LayeredEvent>;
}
