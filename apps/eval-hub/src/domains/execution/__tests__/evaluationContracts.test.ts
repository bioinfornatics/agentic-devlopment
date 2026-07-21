import { describe, expect, it } from "vitest";
import { SkillPromptBuilder } from "../promptBuilder.js";
import { LlmGrader } from "../grader.js";
import type { EvalScenario } from "../../../shared/types.js";
import type { GooseRunConfig, IGooseRunner, GooseRawEvent } from "../ports.js";

const scenario: EvalScenario = { query: "task", expected_behavior: ["works"], skills: ["sdd"], agents: ["architect"] };

describe("AC-EVAL-04/05 layer-delta baselines", () => {
  const builder = new SkillPromptBuilder();
  it("AC-EVAL-04 skills_only injects skills but not agent", () => {
    const prompt = builder.build(scenario, "skills_only");
    expect(prompt).toContain("load skill: sdd"); expect(prompt).not.toContain("load agent:");
  });
  it("AC-EVAL-05 agents_only injects agents and skills", () => {
    const prompt = builder.build(scenario, "agents_only");
    expect(prompt).toContain("load skill: sdd"); expect(prompt).toContain("load agent: architect");
  });
  it("EVAL-INT-01 with_recipe leaves layer loading to the recipe", () => {
    expect(builder.build(scenario, "with_recipe")).toBe("task");
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
