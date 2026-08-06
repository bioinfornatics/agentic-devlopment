import { describe, expect, it } from "vitest";
import { SkillPromptBuilder } from "../promptBuilder.js";
import { LlmGrader } from "../grader.js";
import type { EvalScenario } from "../../../shared/types.js";
import type { GooseRunConfig, IGooseRunner, GooseRawEvent } from "../ports.js";

const scenario: EvalScenario = { query: "task", expected_behavior: ["works"], skills: ["sdd"], agents: ["architect"] };

describe("EVAL-INT-01/19 invariant user-task boundary", () => {
  const builder = new SkillPromptBuilder();
  it.each(["skill_l1", "skill_l0", "agent_l2", "agent_l1", "recipe_l3", "recipe_l2"])(
    "keeps treatment %s out of task payload bytes", config => {
      const prompt = builder.build(scenario, config);
      expect(prompt).toBe("task");
      expect(prompt).not.toContain("load skill:");
      expect(prompt).not.toContain("load agent:");
    },
  );
});


describe("bounded grader attempts and diagnostics", () => {
  class ScriptedGoose implements IGooseRunner {
    calls = 0;
    constructor(private readonly attempts: ReadonlyArray<ReadonlyArray<GooseRawEvent>>) {}
    async *run(): AsyncGenerator<GooseRawEvent> {
      const events = this.attempts[this.calls++] ?? [];
      for (const event of events) yield event;
    }
    async version() { return "test"; }
    async identity() { return { version: "test", provider: "test", model: "test" }; }
  }
  const valid = JSON.stringify({ summary: { total: 1, passed: 1, failed: 0, pass_rate: 1 }, expectations: [{ text: "works", passed: true, evidence: "yes" }] });
  const exit: GooseRawEvent = { type: "exit", code: 0, signal: null };

  it("accepts a finite score without retry", async () => {
    const goose = new ScriptedGoose([[{ type: "line", stream: "stdout", text: valid }, exit]]);
    const dir = await (await import("node:fs/promises")).mkdtemp("/tmp/eval-grader-finite-");
    const result = await new LlmGrader(goose).grade(scenario, "skill_l1", "events", dir, "goose");
    expect(result.summary.pass_rate).toBe(1);
    expect(goose.calls).toBe(1);
  });

  it("retries once when the score is missing", async () => {
    const goose = new ScriptedGoose([
      [{ type: "line", stream: "stdout", text: JSON.stringify({ summary: {}, expectations: [] }) }, exit],
      [{ type: "line", stream: "stdout", text: valid }, exit],
    ]);
    const dir = await (await import("node:fs/promises")).mkdtemp("/tmp/eval-grader-retry-");
    const result = await new LlmGrader(goose).grade(scenario, "skill_l1", "events", dir, "goose");
    expect(result.summary.pass_rate).toBe(1);
    expect(goose.calls).toBe(2);
    const diagnostic = JSON.parse(await (await import("node:fs/promises")).readFile(`${dir}/grader-attempt-1.json`, "utf8"));
    expect(diagnostic.parseOutcome).toBe("invalid");
    expect(diagnostic.classification).toBe("malformed_grader_json");
  });

  it.each([null, "1", true])("rejects non-number pass_rate %j without biasing the score", async passRate => {
    const invalid = JSON.stringify({ summary: { total: 1, passed: 1, failed: 0, pass_rate: passRate }, expectations: [{ text: "works", passed: true, evidence: "yes" }] });
    const goose = new ScriptedGoose([
      [{ type: "line", stream: "stdout", text: invalid }, exit],
      [{ type: "line", stream: "stdout", text: invalid }, exit],
    ]);
    const dir = await (await import("node:fs/promises")).mkdtemp("/tmp/eval-grader-invalid-rate-");
    const result = await new LlmGrader(goose).grade(scenario, "skill_l1", "events", dir, "goose");
    expect(result.summary.pass_rate).toBeNull();
    expect(goose.calls).toBe(2);
    const diagnostic = JSON.parse(await (await import("node:fs/promises")).readFile(`${dir}/grader-attempt-1.json`, "utf8"));
    expect(diagnostic).toMatchObject({ parseOutcome: "invalid", classification: "malformed_grader_json" });
  });

  it("stops immediately on provider usage limit and redacts keyed, bearer, and bare secrets", async () => {
    const secrets = ["super-secret", "bearer-token-value", "sk-ULTRASECRET123"];
    const goose = new ScriptedGoose([[
      { type: "line", stream: "stderr", text: `HTTP 429 usage_limit_reached api_key=${secrets[0]} Authorization: Bearer ${secrets[1]} credential leaked ${secrets[2]}` },
      { type: "exit", code: 1, signal: null },
    ]]);
    const dir = await (await import("node:fs/promises")).mkdtemp("/tmp/eval-grader-rate-");
    const result = await new LlmGrader(goose).grade(scenario, "skill_l1", "events", dir, "goose");
    expect(result.summary.pass_rate).toBeNull();
    expect(result.expectations[0]?.evidence).toContain("grader_runtime_unavailable/provider_rate_limited");
    expect(goose.calls).toBe(1);
    const raw = await (await import("node:fs/promises")).readFile(`${dir}/grader-attempt-1.json`, "utf8");
    for (const secret of secrets) expect(raw).not.toContain(secret);
    expect(raw).toContain("HTTP 429 usage_limit_reached");
    expect(raw).toContain("[REDACTED]");
    const diagnostic = JSON.parse(raw);
    expect(diagnostic).toMatchObject({ attempt: 1, parseOutcome: "invalid", classification: "provider_rate_limited" });
    await expect((await import("node:fs/promises")).stat(`${dir}/grader-attempt-2.json`)).rejects.toThrow();
  });
});
class CapturingGoose implements IGooseRunner {
  prompt = "";
  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    this.prompt = await (await import("node:fs/promises")).readFile(config.args[2]!, "utf8");
    yield { type: "line", stream: "stdout", text: JSON.stringify({summary:{total:1,passed:1,failed:0,pass_rate:1},expectations:[{text:"works",passed:true,evidence:"early"}]}) };
    yield { type: "exit", code: 0, signal: null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

describe("AC-EVAL-03 complete event transcript grading", () => {
  it("preserves early events beyond the former 20k tail", async () => {
    const goose = new CapturingGoose(); const grader = new LlmGrader(goose);
    const early = "EARLY_TOOL_CALL"; const transcript = early + "x".repeat(25000);
    const dir = await (await import("node:fs/promises")).mkdtemp("/tmp/eval-grader-");
    await grader.grade(scenario, "with_agent", transcript, dir, "goose");
    expect(goose.prompt).toContain(early);
    expect(goose.prompt).toContain("events.jsonl transcript (complete");
  });

});
