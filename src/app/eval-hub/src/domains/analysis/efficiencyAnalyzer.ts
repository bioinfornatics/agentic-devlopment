/** Aggregate and interpret skill-evaluation efficiency metrics. */

export const SCALAR_METRICS = [
  "budget_used_pct",
  "tool_calls_total",
  "failed_tool_calls",
  "recovery_attempts",
  "repeated_commands_count",
  "files_changed_count",
  "validation_count",
  "tool_calls_per_file_changed",
  "turns_to_first_write",
  "explore_pct",
] as const;

export type ScalarMetric = (typeof SCALAR_METRICS)[number];
export type EfficiencyRun = Partial<Record<ScalarMetric, number | null>>;
export type EfficiencySummary = { run_count: number } & Record<ScalarMetric, number>;

export interface EfficiencyAnalysis {
  budget_used_pct: number | null;
  tool_calls_total: number;
  failed_tool_calls: number;
  recovery_attempts: number;
  repeated_commands_count: number;
  repeated_commands_top: Array<{ cmd: string; n: number }>;
  files_changed_count: number;
  validation_count: number;
  tool_calls_per_file_changed: number | null;
  turns_to_first_write: number | null;
  explore_pct: number;
  phase_breakdown: Record<string, number>;
}

export interface EfficiencyRecommendation {
  recommendation_type: "efficiency";
  subject: string;
  eval_id: number;
  configuration: string;
  severity: "high" | "medium" | "low";
  signal: string;
  message: string;
  evidence: string;
  action: string;
}

const EFF_ERROR_RATE_HIGH = 0.10;
const EFF_EXPLORE_HIGH = 0.50;
const EFF_REPEATED_HIGH = 3;
const EFF_RATIO_HIGH = 25.0;
const EFF_DELAYED_WRITE = 0.60;
const EFF_MIN_BUDGET_FOR_DELAY = 0.50;

const PHASE_MAP: Record<string, string> = {
  inspection: "explore",
  beads_read: "beads",
  beads_write: "beads",
  file_write: "implement",
  validation: "validate",
  browser_action: "browser",
  delegation: "delegate",
  handoff: "handoff",
  planning: "plan",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

/** Average each available scalar metric independently across runs. */
export function getEfficiencySummary(runs: readonly unknown[] | null): EfficiencySummary {
  if (runs === null) runs = [];
  if (!Array.isArray(runs)) throw new TypeError("runs must be a sequence of mappings or None");

  const totals = Object.fromEntries(SCALAR_METRICS.map(metric => [metric, 0])) as Record<ScalarMetric, number>;
  const counts = Object.fromEntries(SCALAR_METRICS.map(metric => [metric, 0])) as Record<ScalarMetric, number>;

  for (const run of runs) {
    if (!isRecord(run)) throw new TypeError("each run must be a mapping");
    for (const metric of SCALAR_METRICS) {
      const value = run[metric];
      if (value === null || value === undefined) continue;
      if (typeof value !== "number") throw new TypeError(`${metric} must be numeric or None`);
      totals[metric] += value;
      counts[metric] += 1;
    }
  }

  const summary = { run_count: runs.length } as EfficiencySummary;
  for (const metric of SCALAR_METRICS) {
    summary[metric] = counts[metric] === 0 ? 0 : totals[metric] / counts[metric];
  }
  return summary;
}

/** Summarize workflow phases, failures, recoveries, and repeated commands. */
export function analyzeEfficiency(
  timeline: unknown,
  audit: unknown,
  events: unknown,
  turnsUsed: unknown,
  maxTurns: unknown,
): EfficiencyAnalysis {
  const timelineItems = Array.isArray(timeline) ? timeline : [];
  const eventItems = Array.isArray(events) ? events : [];
  const auditData = isRecord(audit) ? audit : {};

  const phases: Record<string, number> = {};
  let toolCalls = 0;
  let turnsToFirstWrite: number | null = null;
  for (const item of timelineItems) {
    if (!isRecord(item) || item.type !== "tool_request") continue;
    toolCalls += 1;
    if (turnsToFirstWrite === null && item.classification === "file_write") turnsToFirstWrite = toolCalls;
    const classification = item.classification == null ? "" : String(item.classification);
    const phase = PHASE_MAP[classification] ?? "other";
    phases[phase] = (phases[phase] ?? 0) + 1;
  }

  let failedCalls = 0;
  let recoveryAttempts = 0;
  let awaitingRecovery = false;
  for (const event of eventItems) {
    if (!isRecord(event) || !isRecord(event.message) || !Array.isArray(event.message.content)) continue;
    for (const item of event.message.content) {
      if (!isRecord(item)) continue;
      if (item.type === "toolRequest") {
        if (awaitingRecovery) {
          recoveryAttempts += 1;
          awaitingRecovery = false;
        }
        continue;
      }
      if (item.type !== "toolResponse") continue;
      const toolResult = isRecord(item.toolResult) ? item.toolResult : {};
      const value = isRecord(toolResult.value) ? toolResult.value : {};
      const result = isRecord(value.structuredContent) ? value.structuredContent : value;
      const exitCode = result.exit_code;
      let exitFailure = false;
      if (typeof exitCode === "number") exitFailure = Math.trunc(exitCode) !== 0;
      else if (typeof exitCode === "string" && /^[+-]?\d+$/.test(exitCode.trim())) exitFailure = Number(exitCode) !== 0;
      const status = String(result.status ?? "").toLowerCase();
      const explicitError = item.isError === true || toolResult.isError === true || ["error", "failed", "failure"].includes(status);
      if (explicitError || exitFailure) {
        failedCalls += 1;
        awaitingRecovery = true;
      }
    }
  }

  const commands = Array.isArray(auditData.commands) ? auditData.commands : [];
  const commandCounts = new Map<string, { count: number; first: number }>();
  for (const command of commands) {
    if (typeof command !== "string") continue;
    const normalized = command.trim().split(/\s+/).filter(Boolean).join(" ");
    if (!normalized) continue;
    const found = commandCounts.get(normalized);
    if (found) found.count += 1;
    else commandCounts.set(normalized, { count: 1, first: commandCounts.size });
  }
  const repeated = [...commandCounts.entries()]
    .filter(([, data]) => data.count >= 3)
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);

  const filesChangedCount = Array.isArray(auditData.files_changed) ? auditData.files_changed.length : 0;
  const validationCount = Array.isArray(auditData.validations) ? auditData.validations.length : 0;
  const validBudget = typeof turnsUsed === "number" && typeof maxTurns === "number" && maxTurns > 0;
  const sortedPhases = Object.fromEntries(Object.entries(phases).sort((a, b) => b[1] - a[1]));

  return {
    budget_used_pct: validBudget ? round(turnsUsed / maxTurns, 3) : null,
    tool_calls_total: toolCalls,
    failed_tool_calls: failedCalls,
    recovery_attempts: recoveryAttempts,
    repeated_commands_count: repeated.length,
    repeated_commands_top: repeated.slice(0, 4).map(([cmd, data]) => ({ cmd: cmd.slice(0, 120), n: data.count })),
    files_changed_count: filesChangedCount,
    validation_count: validationCount,
    tool_calls_per_file_changed: filesChangedCount ? round(toolCalls / filesChangedCount, 1) : null,
    turns_to_first_write: turnsToFirstWrite,
    explore_pct: toolCalls ? round((phases.explore ?? 0) / toolCalls, 2) : 0,
    phase_breakdown: sortedPhases,
  };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pythonRecord(value: unknown): string {
  if (!isRecord(value)) return "{}";
  const entries = Object.entries(value);
  return `{${entries.map(([key, val]) => `'${key}': ${String(val)}`).join(", ")}}`;
}

/** Return an actionable recommendation for every breached efficiency threshold. */
export function findInefficiencies(
  subject: string,
  evalId: number,
  configuration: string,
  efficiency: Partial<EfficiencyAnalysis>,
): EfficiencyRecommendation[] {
  const recommendations: EfficiencyRecommendation[] = [];
  const total = Math.max(1, efficiency.tool_calls_total ?? 1);
  const failed = efficiency.failed_tool_calls ?? 0;
  const recovery = efficiency.recovery_attempts ?? 0;
  const repeated = efficiency.repeated_commands_count ?? 0;
  const ratio = efficiency.tool_calls_per_file_changed ?? 0;
  const explore = efficiency.explore_pct ?? 0;
  const budget = efficiency.budget_used_pct ?? 0;
  const firstWrite = efficiency.turns_to_first_write;
  const errorRate = failed / total;
  const writeDelay = firstWrite == null ? null : firstWrite / total;

  const add = (severity: EfficiencyRecommendation["severity"], signal: string, message: string, evidence: string, action: string): void => {
    recommendations.push({ recommendation_type: "efficiency", subject, eval_id: evalId, configuration, severity, signal, message, evidence, action });
  };
  if (errorRate >= EFF_ERROR_RATE_HIGH) add("high", "error_rate_high", `Error rate ${percent(errorRate)} (${failed}/${total} tool calls failed).`, `failed_tool_calls=${failed} tool_calls_total=${total} recovery_attempts=${recovery}`, "Inspect a failed command's error, try one alternative, then report the blocker.");
  if (explore >= EFF_EXPLORE_HIGH) add("medium", "over_exploration", `Over-exploration: ${percent(explore)} of tool calls were file reads.`, `explore_pct=${percent(explore)} phase_breakdown=${pythonRecord(efficiency.phase_breakdown ?? {})}`, "Constrain initial reads and state a scoped plan before exploring further.");
  if (repeated >= EFF_REPEATED_HIGH) add("medium", "command_thrashing", `Command thrashing: ${repeated} commands were repeated 3+ times.`, `repeated_commands_count=${repeated}`, "After two identical results, change approach or report the blocker.");
  if (ratio >= EFF_RATIO_HIGH && (efficiency.files_changed_count ?? 0) > 0) add("medium", "low_implementation_yield", `Low implementation yield: ${ratio.toFixed(0)} tool calls per file changed.`, `tool_calls_per_file_changed=${ratio.toFixed(0)} files_changed=${efficiency.files_changed_count}`, "Name the files to change, make the scoped edit, validate, and stop.");
  if (writeDelay !== null && budget >= EFF_MIN_BUDGET_FOR_DELAY && writeDelay >= EFF_DELAYED_WRITE) add("low", "delayed_first_write", `Slow to act: first file write at tool call ${firstWrite}.`, `turns_to_first_write=${firstWrite} tool_calls_total=${total} budget_used_pct=${percent(budget)}`, "Limit pre-write reads and emit a scoped plan early.");
  return recommendations;
}

/** Python-name-compatible semantic alias. */
export const efficiencyRecommendations = findInefficiencies;
