import { describe, expect, it } from "vitest";
import {
  SCALAR_METRICS,
  analyzeEfficiency,
  efficiencyRecommendations,
  findInefficiencies,
  getEfficiencySummary,
} from "../efficiencyAnalyzer.js";

describe("getEfficiencySummary", () => {
  it("returns a stable zero summary for null and empty input", () => {
    const expected = { run_count: 0, ...Object.fromEntries(SCALAR_METRICS.map(metric => [metric, 0])) };
    expect(getEfficiencySummary(null)).toEqual(expected);
    expect(getEfficiencySummary([])).toEqual(expected);
  });

  it("averages each available numeric metric and ignores nulls", () => {
    const summary = getEfficiencySummary([
      { budget_used_pct: .25, tool_calls_total: 4, failed_tool_calls: 1, turns_to_first_write: null, explore_pct: .5 },
      { budget_used_pct: .75, tool_calls_total: 8, failed_tool_calls: 0, turns_to_first_write: 3, explore_pct: null },
      { tool_calls_total: 12, failed_tool_calls: null, turns_to_first_write: 5 },
    ]);
    expect(summary).toMatchObject({ run_count: 3, budget_used_pct: .5, tool_calls_total: 8, failed_tool_calls: .5, turns_to_first_write: 4, explore_pct: .5, validation_count: 0 });
  });

  it("uses an independent non-null denominator for every metric", () => {
    const first = Object.fromEntries(SCALAR_METRICS.map((metric, i) => [metric, i + 1]));
    const second = Object.fromEntries(SCALAR_METRICS.flatMap((metric, i) => i % 2 === 0 ? [[metric, i + 3]] : []));
    const third = Object.fromEntries(SCALAR_METRICS.map((metric, i) => [metric, i % 2 === 0 ? null : i + 5]));
    const summary = getEfficiencySummary([first, second, third]);
    SCALAR_METRICS.forEach((metric, i) => expect(summary[metric]).toBe(i % 2 === 0 ? i + 2 : i + 3));
  });

  it("includes zero and full percentage observations", () => {
    expect(getEfficiencySummary([{ budget_used_pct: 0, explore_pct: 0 }, { budget_used_pct: 1, explore_pct: 1 }])).toMatchObject({ run_count: 2, budget_used_pct: .5, explore_pct: .5 });
  });

  it.each([0, "runs", {}])("rejects invalid top-level input %#", invalid => {
    expect(() => getEfficiencySummary(invalid as never)).toThrow(TypeError);
  });

  it("rejects non-record runs", () => {
    expect(() => getEfficiencySummary([{ tool_calls_total: 1 }, null])).toThrow(TypeError);
  });

  it.each([true, "12", {}])("rejects boolean and nonnumeric values %#", invalid => {
    expect(() => getEfficiencySummary([{ tool_calls_total: invalid }] as never)).toThrow(TypeError);
  });
});

describe("analyzeEfficiency", () => {
  it("returns stable output for empty inputs", () => {
    expect(analyzeEfficiency([], {}, [], null, null)).toEqual({
      budget_used_pct: null, tool_calls_total: 0, failed_tool_calls: 0, recovery_attempts: 0,
      repeated_commands_count: 0, repeated_commands_top: [], files_changed_count: 0,
      validation_count: 0, tool_calls_per_file_changed: null, turns_to_first_write: null,
      explore_pct: 0, phase_breakdown: {},
    });
  });

  it("classifies requests and ignores non-requests", () => {
    const classifications = ["inspection", "beads_read", "beads_write", "file_write", "validation", "browser_action", "delegation", "handoff", "planning", "unrecognized"];
    const result = analyzeEfficiency([...classifications.map(classification => ({ type: "tool_request", classification })), { type: "assistant", classification: "inspection" }], {}, [], 5, 20);
    expect(result.tool_calls_total).toBe(10);
    expect(result.phase_breakdown).toEqual({ beads: 2, explore: 1, implement: 1, validate: 1, browser: 1, delegate: 1, handoff: 1, plan: 1, other: 1 });
    expect(result.turns_to_first_write).toBe(4);
    expect(result.budget_used_pct).toBe(.25);
    expect(result.explore_pct).toBe(.1);
  });

  it("detects failures and counts only the next request as recovery", () => {
    const events = [{ message: { content: [
      { type: "toolResponse", toolResult: { value: { structuredContent: { exit_code: 2 } } } },
      { type: "toolRequest" }, { type: "toolRequest" },
      { type: "toolResponse", toolResult: { value: { structuredContent: { exit_code: "0" } } } },
      { type: "toolResponse", toolResult: { value: { exit_code: 1 } } }, { type: "toolRequest" },
    ] } }];
    expect(analyzeEfficiency([], {}, events, null, null)).toMatchObject({ failed_tool_calls: 2, recovery_attempts: 2 });
  });

  it("ignores benign error text and malformed events", () => {
    const events = [null, { message: "error: documentation example" }, { message: { content: "not-a-list" } }, { message: { content: ["error", { type: "toolResponse", toolResult: null }, { type: "toolResponse", toolResult: { value: { structuredContent: { exit_code: 0 } } } }, { type: "toolResponse", toolResult: { value: { exit_code: "not-an-integer" } } }] } }];
    expect(analyzeEfficiency([], {}, events, null, 10).failed_tool_calls).toBe(0);
  });

  it("recognizes direct and nested explicit errors", () => {
    const responses = [
      { type: "toolResponse", isError: true, toolResult: { value: {} } },
      { type: "toolResponse", toolResult: { isError: true, value: {} } },
      { type: "toolResponse", toolResult: { value: { status: "failure" } } },
      { type: "toolResponse", toolResult: { value: { status: "ok" } } },
    ];
    expect(analyzeEfficiency([], {}, [{ message: { content: responses } }], null, null).failed_tool_calls).toBe(3);
  });

  it("uses request position for first write", () => {
    const timeline = [null, "malformed", { type: "assistant", classification: "file_write" }, { type: "tool_request", classification: "inspection" }, { type: "tool_request", classification: "file_write" }];
    expect(analyzeEfficiency(timeline, {}, [], null, null).turns_to_first_write).toBe(2);
  });

  it.each([["bad", 20], [2, "20"], [true, 20], [2, false], [2, 0]])("ignores malformed budget (%s, %s)", (used, max) => {
    expect(analyzeEfficiency([], {}, [], used, max).budget_used_pct).toBeNull();
  });

  it("normalizes commands and reports only counts of at least three", () => {
    const long = `python ${"x".repeat(140)}`;
    const audit = { commands: ["  pytest   -q ", "pytest -q", "pytest\t-q", "git status", "git status", long, long, long, long, 42], files_changed: ["a.py", "b.py"], validations: ["pytest"] };
    const result = analyzeEfficiency(Array(5).fill({ type: "tool_request", classification: "validation" }), audit, [], 0, 0);
    expect(result).toMatchObject({ repeated_commands_count: 2, files_changed_count: 2, validation_count: 1, tool_calls_per_file_changed: 2.5, budget_used_pct: null });
    expect(result.repeated_commands_top).toEqual([{ cmd: long.slice(0, 120), n: 4 }, { cmd: "pytest -q", n: 3 }]);
  });

  it("tolerates non-collection audit fields and malformed timeline items", () => {
    const result = analyzeEfficiency([null, "bad", { type: "tool_request" }], { commands: "pytest", files_changed: null, validations: 3 }, [], null, null);
    expect(result).toMatchObject({ tool_calls_total: 1, phase_breakdown: { other: 1 }, repeated_commands_top: [], files_changed_count: 0, validation_count: 0 });
  });
});

describe("findInefficiencies", () => {
  const recommendations = (overrides: Record<string, unknown> = {}) => findInefficiencies("sdd", 7, "with_skill", {
    tool_calls_total: 100, failed_tool_calls: 0, recovery_attempts: 0, repeated_commands_count: 0,
    tool_calls_per_file_changed: 0, files_changed_count: 0, explore_pct: 0,
    budget_used_pct: 0, turns_to_first_write: null, ...overrides,
  });
  const signals = (overrides: Record<string, unknown>) => recommendations(overrides).map(item => item.signal);

  it("exports efficiencyRecommendations as the same operation", () => expect(efficiencyRecommendations).toBe(findInefficiencies));
  it("uses inclusive error threshold", () => { expect(signals({ failed_tool_calls: 9 })).not.toContain("error_rate_high"); expect(signals({ failed_tool_calls: 10 })).toContain("error_rate_high"); });
  it("uses inclusive exploration threshold", () => { expect(signals({ explore_pct: .499 })).not.toContain("over_exploration"); expect(signals({ explore_pct: .5 })).toContain("over_exploration"); });
  it("starts command thrashing at three", () => { expect(signals({ repeated_commands_count: 2 })).not.toContain("command_thrashing"); expect(signals({ repeated_commands_count: 3 })).toContain("command_thrashing"); });
  it("requires 25 calls and a changed file for low yield", () => { expect(signals({ tool_calls_per_file_changed: 24.99, files_changed_count: 1 })).not.toContain("low_implementation_yield"); expect(signals({ tool_calls_per_file_changed: 25, files_changed_count: 1 })).toContain("low_implementation_yield"); expect(signals({ tool_calls_per_file_changed: 30, files_changed_count: 0 })).not.toContain("low_implementation_yield"); });
  it("requires both delayed-write thresholds", () => { expect(signals({ turns_to_first_write: 59, budget_used_pct: .5 })).not.toContain("delayed_first_write"); expect(signals({ turns_to_first_write: 60, budget_used_pct: .5 })).toContain("delayed_first_write"); expect(signals({ turns_to_first_write: 60, budget_used_pct: .499 })).not.toContain("delayed_first_write"); expect(signals({ turns_to_first_write: null, budget_used_pct: 1 })).not.toContain("delayed_first_write"); });

  it("preserves order, context, severity, and complete payloads", () => {
    const result = recommendations({ failed_tool_calls: 10, explore_pct: .5, repeated_commands_count: 3, tool_calls_per_file_changed: 26, files_changed_count: 1, turns_to_first_write: 60, budget_used_pct: .5 });
    expect(result).toEqual([
      { recommendation_type: "efficiency", subject: "sdd", eval_id: 7, configuration: "with_skill", severity: "high", signal: "error_rate_high", message: "Error rate 10% (10/100 tool calls failed).", evidence: "failed_tool_calls=10 tool_calls_total=100 recovery_attempts=0", action: "Inspect a failed command's error, try one alternative, then report the blocker." },
      { recommendation_type: "efficiency", subject: "sdd", eval_id: 7, configuration: "with_skill", severity: "medium", signal: "over_exploration", message: "Over-exploration: 50% of tool calls were file reads.", evidence: "explore_pct=50% phase_breakdown={}", action: "Constrain initial reads and state a scoped plan before exploring further." },
      { recommendation_type: "efficiency", subject: "sdd", eval_id: 7, configuration: "with_skill", severity: "medium", signal: "command_thrashing", message: "Command thrashing: 3 commands were repeated 3+ times.", evidence: "repeated_commands_count=3", action: "After two identical results, change approach or report the blocker." },
      { recommendation_type: "efficiency", subject: "sdd", eval_id: 7, configuration: "with_skill", severity: "medium", signal: "low_implementation_yield", message: "Low implementation yield: 26 tool calls per file changed.", evidence: "tool_calls_per_file_changed=26 files_changed=1", action: "Name the files to change, make the scoped edit, validate, and stop." },
      { recommendation_type: "efficiency", subject: "sdd", eval_id: 7, configuration: "with_skill", severity: "low", signal: "delayed_first_write", message: "Slow to act: first file write at tool call 60.", evidence: "turns_to_first_write=60 tool_calls_total=100 budget_used_pct=50%", action: "Limit pre-write reads and emit a scoped plan early." },
    ]);
  });
});
