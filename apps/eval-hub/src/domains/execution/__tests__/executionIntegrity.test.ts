import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildExecutionMatrix,
  buildGooseInvocation,
  buildTreatmentPair,
  resolveTypedRecipeSource,
  terminalExecutionResult,
  validateRepetitionCount,
  type InvariantExecutionEnvelope,
} from "../executionIntegrity.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

const envelope: InvariantExecutionEnvelope = {
  taskPayload: "Implement AUTH-03 exactly.\nDo not change the exercise.",
  fixtureHashes: { "fixtures/auth.ts": "sha256:fixture" },
  timeBudgetMs: 60_000,
  tokenBudget: 8_000,
  provider: "anthropic",
  model: "claude-test",
  decoding: { temperature: null, seed: null },
  gooseRuntimeVersion: "goose-1",
  evalHubRuntimeVersion: "eval-hub-1",
};

function ids(kind: "skills" | "agents" | "recipes") {
  const pair = buildTreatmentPair({
    kind,
    subject: kind === "skills" ? "sdd" : kind === "agents" ? "architect" : "dev",
    declaredSkills: ["sdd", "code-review"],
    declaredAgents: ["orchestrator"],
    resolvedRecipePath: "/repo/.goose/recipes/dev.yaml",
  });
  return [pair.candidate.id, pair.baseline.id];
}

describe("EVAL-INT-02/19 typed effective treatments", () => {
  it("defines exactly the six layer treatment IDs", () => {
    expect(ids("skills")).toEqual(["skill_l1", "skill_l0"]);
    expect(ids("agents")).toEqual(["agent_l2", "agent_l1"]);
    expect(ids("recipes")).toEqual(["recipe_l3", "recipe_l2"]);
  });

  it("keeps lower layers identical and bootstrap separate from user task", () => {
    const skill = buildTreatmentPair({ kind: "skills", subject: "sdd", declaredSkills: [], declaredAgents: [] });
    expect(skill.candidate.bootstrap).toEqual({ kind: "system_instruction", bytes: "load skill: sdd" });
    expect(skill.baseline.bootstrap).toEqual({ kind: "none", bytes: "" });

    const agent = buildTreatmentPair({ kind: "agents", subject: "architect", declaredSkills: ["sdd"], declaredAgents: [] });
    expect(agent.candidate.bootstrap.bytes).toBe("load skill: sdd\nload agent: architect");
    expect(agent.baseline.bootstrap.bytes).toBe("load skill: sdd");

    const recipe = buildTreatmentPair({ kind: "recipes", subject: "dev", declaredSkills: ["sdd"], declaredAgents: ["orchestrator"], resolvedRecipePath: "/repo/dev.yaml" });
    expect(recipe.candidate.bootstrap).toEqual({ kind: "recipe", bytes: "/repo/dev.yaml" });
    expect(recipe.baseline.bootstrap.bytes).toBe("load skill: sdd\nload agent: orchestrator");
    for (const treatment of [skill.candidate, skill.baseline, agent.candidate, agent.baseline, recipe.candidate, recipe.baseline]) {
      expect(treatment.bootstrap.bytes).not.toContain(envelope.taskPayload);
      expect(treatment.bootstrap.bytes).not.toMatch(/pretend|imitate|role-?play/i);
    }
  });

  it("captures supported Goose arguments and invokes a real recipe", () => {
    const pair = buildTreatmentPair({ kind: "recipes", subject: "dev", declaredSkills: ["sdd"], declaredAgents: ["orchestrator"], resolvedRecipePath: "/repo/dev.yaml" });
    const candidate = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8, { ac_id: "AUTH-03" });
    expect(candidate).toEqual(["run", "--recipe", "/repo/dev.yaml", "--params", "ac_id=AUTH-03", "--params", `task=${envelope.taskPayload}`, "--no-session", "--max-turns", "8", "--output-format", "stream-json", "--quiet"]);
    const featureRecipe = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8, { feature: "stale" }, "feature");
    expect(featureRecipe).toContain(`feature=${envelope.taskPayload}`);
    expect(featureRecipe).not.toContain("feature=stale");
  });
});


  it("uses --system for bootstrap while preserving exact --text task bytes", () => {
    const pair = buildTreatmentPair({ kind: "agents", subject: "architect", declaredSkills: ["sdd"], declaredAgents: [] });
    const candidate = buildGooseInvocation(pair.candidate, envelope.taskPayload, 8);
    const baseline = buildGooseInvocation(pair.baseline, envelope.taskPayload, 8);
    expect(candidate.slice(0, 5)).toEqual(["run", "--system", "load skill: sdd\nload agent: architect", "--text", envelope.taskPayload]);
    expect(baseline.slice(0, 5)).toEqual(["run", "--system", "load skill: sdd", "--text", envelope.taskPayload]);
    expect(candidate[candidate.indexOf("--text") + 1]).toBe(baseline[baseline.indexOf("--text") + 1]);
  });

describe("EVAL-INT-01/03 invariant repeated schedule", () => {
  it.each([0, -1, 1.5, Number.NaN])("rejects invalid repetition count %s", value => {
    expect(() => validateRepetitionCount(value)).toThrow(/integer.*at least 1/i);
  });

  it("schedules both sides for every eval at indexes 0 through R-1", () => {
    const pair = buildTreatmentPair({ kind: "skills", subject: "sdd", declaredSkills: [], declaredAgents: [] });
    const rows = buildExecutionMatrix({ kind: "skills", subject: "sdd", evalIds: [0, 1], repetitions: 3, pair, envelope });
    expect(rows).toHaveLength(12);
    expect([...new Set(rows.map(row => row.repetition))]).toEqual([0, 1, 2]);
    expect(rows.filter(row => row.evalId === 0 && row.repetition === 0).map(row => row.side)).toEqual(["candidate", "baseline"]);
    expect(rows.filter(row => row.evalId === 0 && row.repetition === 1).map(row => row.side)).toEqual(["baseline", "candidate"]);
    for (const repetition of [0, 1, 2]) for (const evalId of [0, 1]) {
      const sides = rows.filter(row => row.repetition === repetition && row.evalId === evalId);
      expect(sides.map(row => row.side).sort()).toEqual(["baseline", "candidate"]);
      expect(new Set(sides.map(row => row.taskPayloadHash)).size).toBe(1);
      expect(sides[0]?.envelope).toEqual(sides[1]?.envelope);
      expect(sides[0]?.workspace).not.toBe(sides[1]?.workspace);
    }
  });
});

describe("EVAL-INT-17 typed recipe resolution", () => {
  it("resolves explicit top-level and subrecipe sources without basename guessing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "typed-recipes-")); roots.push(root);
    await fs.mkdir(path.join(root, "subrecipes"));
    await fs.writeFile(path.join(root, "dev.yaml"), "version: 1\n");
    await fs.writeFile(path.join(root, "subrecipes", "amend-spec.yaml"), "version: 1\n");
    expect(await resolveTypedRecipeSource(root, "dev", "top_level")).toBe(path.join(root, "dev.yaml"));
    expect(await resolveTypedRecipeSource(root, "amend-spec", "subrecipe")).toBe(path.join(root, "subrecipes", "amend-spec.yaml"));
    await expect(resolveTypedRecipeSource(root, "amend-spec", "top_level")).rejects.toThrow(/source_missing/);
    await expect(resolveTypedRecipeSource(root, "missing", "subrecipe")).rejects.toThrow(/source_missing/);
  });
});

describe("EVAL-INT-06 execution failure is terminal", () => {
  it("never turns a failed or timed-out execution into score zero", () => {
    expect(terminalExecutionResult(2, null)).toEqual({ status: "failed", exitCode: 2, signal: null, score: null });
    expect(terminalExecutionResult(null, "SIGKILL")).toEqual({ status: "failed", exitCode: null, signal: "SIGKILL", score: null });
    expect(terminalExecutionResult(0, null)).toEqual({ status: "succeeded", exitCode: 0, signal: null, score: null });
  });
});
