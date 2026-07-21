/** Core value types shared across all bounded contexts. */

export type EvalKind = "skills" | "agents" | "recipes";
export const EVAL_KINDS: readonly EvalKind[] = ["skills", "agents", "recipes"];

export const LAYER_META: Record<EvalKind, {
  level: string; comparison: string; baseline: string;
  configs: readonly string[];
}> = {
  skills:  { level: "L1", comparison: "with_skill vs without_skill",               baseline: "L0 — plain Goose",        configs: ["with_skill", "without_skill"] },
  agents:  { level: "L2", comparison: "with_agent+skills vs skills_only",          baseline: "L1 — skills",             configs: ["with_agent", "skills_only"] },
  recipes: { level: "L3", comparison: "with_recipe+agents+skills vs agents+skills", baseline: "L2 — agents + skills",    configs: ["with_recipe", "agents_only"] },
};

export type IsoTimestamp = string;   // "2026-07-18T00:00:00Z"
export type ContentHash  = string;   // 16-char hex SHA-256 prefix
export type RunId        = string;   // "20260717T205446Z"
export type SubjectName  = string;
export type AbsPath      = string;
export type Delta        = number;   // -1.0 to +1.0

export type ExecStatus   = "pending" | "running" | "done" | "failed" | "cancelled";
export type GateStatus   = "pass" | "fail" | "warn" | "skip";
export type ComparisonMode = "with-without" | "layer-delta" | "with-without-available";
export type Difficulty   = "normal" | "difficult" | "very_difficult";

/**
 * Eval scenario as stored on disk in evals/<kind>/<name>.json.
 * Field names are snake_case to match the JSON files directly.
 */
export interface EvalScenario {
  /** User task / prompt sent to goose. */
  readonly query:                          string;
  readonly difficulty?:                    Difficulty;
  /** Expected behaviors graded by the LLM grader. */
  readonly expected_behavior:              readonly string[];
  readonly baseline_gaps?:                 readonly string[];
  readonly skills:                         readonly string[];
  readonly agents?:                        readonly string[];
  readonly files?:                         readonly string[];
  readonly fixture_patch?:                 string;
  readonly fixture_description?:           string;
  readonly fixture_intent?:                string;
  /** Typed parameters passed to a recipe candidate. */
  readonly recipe_params?:                  Readonly<Record<string, string>>;
  /** Per-scenario turn cap (overrides global --max-turns when set). */
  readonly max_turns?:                     number;
  readonly expected_skill_contribution?:   string;
}

/** Pass-rate statistics for one configuration. */
export interface PassRateStats {
  readonly mean:    number;
  readonly samples: readonly number[];
  readonly n:       number;
}

/** Delta between two configurations. */
export interface DeltaStats {
  readonly passRate:        number;
  readonly turnsUsed:       number | null;
  readonly maxTurnsReached: number | null;
}

/** Per-run benchmark result written to benchmark.json. */
export interface BenchmarkResult {
  readonly subject:     SubjectName;
  readonly kind:        EvalKind;
  readonly runId:       ContentHash;
  readonly runSummary:  Record<string, PassRateStats & { turnsUsed: PassRateStats; maxTurnsReached: PassRateStats }> & { delta: DeltaStats };
  readonly runs:        readonly BenchmarkRun[];
}

export interface BenchmarkRun {
  readonly evalId:       number;
  readonly evalName:     string;
  readonly configuration: string;
  readonly runNumber:    number;
  readonly result: {
    passed:           boolean;
    score:            number;
    turnsUsed:        number;
    maxTurns:         number;
    maxTurnsReached:  boolean;
    totalTokens?:     number;
  };
}
