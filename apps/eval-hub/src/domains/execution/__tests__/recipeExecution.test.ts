import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { SkillEvalRunner } from "../evalRunner.js";
import type { GooseRawEvent, GooseRunConfig, IGooseRunner, IGrader } from "../ports.js";
import type { IWorkspaceWriter } from "../../persistence/ports.js";

class CapturingGoose implements IGooseRunner {
  config?: GooseRunConfig;
  constructor(private readonly exitCode = 0) {}
  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    this.config = config;
    yield { type: "exit", code: this.exitCode, signal: null };
  }
  async version() { return "test"; }
}

const grader: IGrader = {
  async grade() {
    return { summary: { total: 1, passed: 1, failed: 0, pass_rate: 1 }, expectations: [] };
  },
};
const promptPath = "/tmp/eval-recipe-execution-test.txt";
class Writer implements IWorkspaceWriter {
  async writePrompt(_k: any, _s: any, _h: any, _e: any, _c: any, _r: any, text: string) {
    await fs.writeFile(promptPath, text);
    return promptPath;
  }
  async writeGrading() {}
  async writeTiming() {}
  async writeBenchmark() {}
  async appendEvent() {}
  async writeEvalMeta() {}
}

const cfg = (config: string) => ({
  kind: "recipes" as const,
  subject: "dev",
  hash: "hash",
  scenario: { query: "task", expected_behavior: ["works"], skills: ["sdd"], agents: ["orchestrator"] },
  evalId: 0,
  config,
  runNumber: 1,
  workspace: "/tmp",
  gooseCli: "goose",
  maxTurns: 5,
  timeoutMs: 100,
  ambient: false,
});

describe("EVAL-INT-01 recipe execution", () => {
  afterEach(() => fs.rm(promptPath, { force: true }));

  it("passes --recipe only to with_recipe", async () => {
    const candidate = new CapturingGoose();
    for await (const _ of new SkillEvalRunner(candidate, undefined, grader, new Writer()).run(cfg("with_recipe"))) {}
    expect(candidate.config?.args).toContain("--recipe");
    expect(candidate.config?.args.some(arg => arg.endsWith(".goose/recipes/dev.yaml"))).toBe(true);
    expect(candidate.config?.args).not.toContain("--instructions");
    expect(candidate.config?.args).toContain("task=task");

    const typedCandidate = new CapturingGoose();
    const typed = { ...cfg("with_recipe"), scenario: { ...cfg("with_recipe").scenario, recipe_params: { deviation: "HTTP 200", ac_id: "AUTH-03" } } };
    for await (const _ of new SkillEvalRunner(typedCandidate, undefined, grader, new Writer()).run(typed)) {}
    expect(typedCandidate.config?.args).toContain("deviation=HTTP 200");
    expect(typedCandidate.config?.args).toContain("ac_id=AUTH-03");
    expect(typedCandidate.config?.args).not.toContain("task=task");

    const baseline = new CapturingGoose();
    for await (const _ of new SkillEvalRunner(baseline, undefined, grader, new Writer()).run(cfg("agents_only"))) {}
    expect(baseline.config?.args).not.toContain("--recipe");
  });

  it("preserves provider configuration and rejects a non-zero Goose exit", async () => {
    const goose = new CapturingGoose(2);
    const runner = new SkillEvalRunner(goose, undefined, grader, new Writer());
    await expect(async () => {
      for await (const _ of runner.run(cfg("agents_only"))) {}
    }).rejects.toThrow("Goose run failed");
    expect(goose.config?.env).not.toHaveProperty("HOME");
    expect(goose.config?.env).not.toHaveProperty("XDG_CONFIG_HOME");
  });
});
