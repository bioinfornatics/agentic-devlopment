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
