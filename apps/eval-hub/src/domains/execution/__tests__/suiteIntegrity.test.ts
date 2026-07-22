import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SuiteRunner } from "../suiteRunner.js";
import type { IEvalRunner, ScenarioRunConfig } from "../ports.js";
import type { EvalEvent, SuiteEvent } from "../../../shared/events.js";
import { PROJECT_ROOT } from "../../../shared/paths.js";

class CapturingEvalRunner implements IEvalRunner {
  readonly calls: ScenarioRunConfig[] = [];
  async *run(config: ScenarioRunConfig): AsyncGenerator<EvalEvent> {
    this.calls.push(config);
  }
}

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))));

async function capture(kind: "skills" | "agents" | "recipes", subject: string) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `suite-integrity-${kind}-`)); roots.push(workspace);
  const fake = new CapturingEvalRunner();
  const suite = new SuiteRunner(fake);
  for await (const _ of suite.run({
    kind, subjects: [subject], workspace, gooseCli: "goose", workers: 1,
    mode: kind === "skills" ? "with-without" : "layer-delta", maxTurns: 8,
    timeoutMs: 1000, ambient: false, continueOnFail: false, repetitions: 2,
  })) {}
  return fake.calls;
}

describe("EVAL-INT-01/02/03/17/19 production SuiteRunner schedule", () => {
  it.each([
    ["skills", "atomic-design", ["skill_l1", "skill_l0"]],
    ["agents", "ux-researcher", ["agent_l2", "agent_l1"]],
    ["recipes", "dev", ["recipe_l3", "recipe_l2"]],
  ] as const)("schedules typed %s treatments for every repetition", async (kind, subject, expectedIds) => {
    const calls = await capture(kind, subject);
    const evalIds = [...new Set(calls.map(call => call.evalId))];
    expect(calls).toHaveLength(evalIds.length * 2 * 2);
    expect([...new Set(calls.map(call => call.config))].sort()).toEqual([...expectedIds].sort());
    expect([...new Set(calls.map(call => call.repetition))]).toEqual([0, 1]);
    for (const evalId of evalIds) for (const repetition of [0, 1]) {
      const pair = calls.filter(call => call.evalId === evalId && call.repetition === repetition);
      expect(pair.map(call => call.config)).toEqual(repetition === 0 ? [...expectedIds] : [...expectedIds].reverse());
      expect(new Set(pair.map(call => call.workspace)).size).toBe(2);
      expect(pair[0]?.fixtureHashes).toEqual(pair[1]?.fixtureHashes);
      expect(pair[0]?.provider).toBe(pair[1]?.provider);
      expect(pair[0]?.model).toBe(pair[1]?.model);
      expect(pair[0]?.timeoutMs).toBe(pair[1]?.timeoutMs);
      expect(pair[0]?.maxTurns).toBe(pair[1]?.maxTurns);
    }
  });

  it("rejects an untyped recipe subject before scheduling either side", async () => {
    const evalPath = path.join(process.cwd(), "../../evals/recipes/dev.json");
    const original = await fs.readFile(evalPath, "utf8");
    try {
      const scenarios = JSON.parse(original).map(({ recipe_source_type: _, ...scenario }: Record<string, unknown>) => scenario);
      await fs.writeFile(evalPath, JSON.stringify(scenarios));
      await expect(capture("recipes", "dev")).rejects.toThrow(/source_missing.*explicit source type/i);
    } finally { await fs.writeFile(evalPath, original); }
  });
});

describe("EVAL-INT-PLAN SuiteRunner.plan()/runPlan() split", () => {
  it("plan() resolves all rows without calling evalRunner", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-plan-split-"));
    roots.push(workspace);
    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake);
    const plan = await suite.plan({
      kind: "skills", subjects: ["atomic-design"], workspace, gooseCli: "goose",
      workers: 1, mode: "with-without", maxTurns: 8, timeoutMs: 1_000,
      ambient: false, continueOnFail: false, repetitions: 2,
    });
    // plan() must NOT invoke evalRunner
    expect(fake.calls).toHaveLength(0);
    // atomic-design has 3 scenarios × 2 reps × 2 sides = 12 rows
    expect(plan.rows).toHaveLength(3 * 2 * 2);
    expect(new Set(plan.rows.map(r => r.side))).toEqual(new Set(["candidate", "baseline"]));
    expect(new Set(plan.rows.map(r => r.repetition))).toEqual(new Set([0, 1]));
  });

  it("runPlan() executes all planned rows and emits suite.completed", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-runplan-split-"));
    roots.push(workspace);
    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake);
    const cfg = {
      kind: "skills" as const, subjects: ["atomic-design"], workspace, gooseCli: "goose",
      workers: 1, mode: "with-without" as const, maxTurns: 8, timeoutMs: 1_000,
      ambient: false, continueOnFail: false, repetitions: 2,
    };
    const plan = await suite.plan(cfg);
    const events: SuiteEvent[] = [];
    for await (const ev of suite.runPlan(plan)) events.push(ev);
    expect(fake.calls).toHaveLength(plan.rows.length);
    expect(events.at(-1)?.type).toBe("suite.completed");
  });

  it("runPlan() throws input_mismatch before any evalRunner call when fixture mutated after plan()", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-drift-runplan-"));
    roots.push(workspace);
    const fixtureName = `runplan-drift-${Date.now()}.txt`;
    const relFixturePath = `apps/eval-hub/src/domains/execution/__tests__/${fixtureName}`;
    const absFixturePath = path.join(PROJECT_ROOT, relFixturePath);
    await fs.writeFile(absFixturePath, "original-content");
    roots.push(absFixturePath);
    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      scenariosOverride: new Map([["atomic-design", [
        { query: "q", skills: [], agents: [], expected_behavior: ["b"], files: [relFixturePath] },
      ]]]),
    });
    const plan = await suite.plan({
      kind: "skills", subjects: ["atomic-design"], workspace, gooseCli: "goose",
      workers: 1, mode: "with-without", maxTurns: 8, timeoutMs: 1_000,
      ambient: false, continueOnFail: false, repetitions: 1,
    });
    // Mutate fixture AFTER planning — runPlan must detect drift before any evalRunner call
    await fs.writeFile(absFixturePath, "mutated-content");
    await expect(async () => { for await (const _ of suite.runPlan(plan)) {} })
      .rejects.toThrow(/input_mismatch/i);
    expect(fake.calls).toHaveLength(0);
  });
});
