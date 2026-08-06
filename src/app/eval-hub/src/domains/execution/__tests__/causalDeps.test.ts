/**
 * AC1 / AC2 / AC3 / AC4 — Causal dependency contracts for layered treatments.
 *
 * AC1: skill_l1 = subject + deps, skill_l0 = same deps without subject.
 * AC2: agent_l2 and agent_l1 carry exactly the same skills (only agent membership differs).
 * AC3: recipe_l3 and recipe_l2 carry exactly the same skills and agents.
 * AC4: every active component has corpus coverage or an explicit tested exemption.
 */
import { describe, expect, it } from "vitest";
import { buildTreatmentPair } from "../executionIntegrity.js";
import { MINIMAL_HARNESS_SUBJECTS, RECIPE_DEPENDENCY_CLOSURE, validateHarnessCoverage, validateRecipeScenarioClosure, validateSkillScenarioDependencies } from "../minimalHarnessCatalog.js";

// ── AC1 L1 causal baseline dependencies ───────────────────────────────────────

describe("AC1 L1 causal baseline: skill_l1 = subject+deps, skill_l0 = deps only", () => {
  it("skill_l1 includes the subject skill", () => {
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing", "loop-control"],
      declaredAgents: [],
    });
    expect(pair.candidate.id).toBe("skill_l1");
    expect(pair.candidate.definition.skills).toContain("task-framing");
  });

  it("skill_l1 also includes all other declared skills (deps) alongside subject", () => {
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing", "loop-control", "evidence-verification"],
      declaredAgents: [],
    });
    expect(pair.candidate.definition.skills).toContain("loop-control");
    expect(pair.candidate.definition.skills).toContain("evidence-verification");
  });

  it("skill_l0 includes deps but NOT the subject — enabling causal attribution", () => {
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing", "loop-control"],
      declaredAgents: [],
    });
    expect(pair.baseline.id).toBe("skill_l0");
    expect(pair.baseline.definition.skills).not.toContain("task-framing");
    expect(pair.baseline.definition.skills).toContain("loop-control");
  });

  it("skill_l1 and skill_l0 skills differ by exactly the subject and nothing else", () => {
    const deps = ["loop-control", "evidence-verification"];
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing", ...deps],
      declaredAgents: [],
    });
    const l1 = [...pair.candidate.definition.skills];
    const l0 = [...pair.baseline.definition.skills];
    // l1 minus l0 is exactly [subject]
    expect(l1.filter(s => !l0.includes(s))).toEqual(["task-framing"]);
    // l0 is a subset of l1
    expect(l0.every(s => l1.includes(s))).toBe(true);
  });

  it("original single-skill behavior preserved when no other skills declared", () => {
    const pair = buildTreatmentPair({
      kind: "skills", subject: "sdd",
      declaredSkills: ["sdd"],
      declaredAgents: [],
    });
    expect(pair.candidate.definition.skills).toEqual(["sdd"]);
    expect(pair.baseline.definition.skills).toEqual([]);
  });

  it("l1 bootstrap includes subject + deps, l0 bootstrap includes only deps", () => {
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing", "loop-control"],
      declaredAgents: [],
    });
    expect(pair.candidate.bootstrap.bytes).toContain("task-framing");
    expect(pair.candidate.bootstrap.bytes).toContain("loop-control");
    expect(pair.baseline.bootstrap.bytes).not.toContain("task-framing");
    expect(pair.baseline.bootstrap.bytes).toContain("loop-control");
  });

  it("duplicate subject in declaredSkills does not produce duplicate in l0 deps", () => {
    // declaredSkills may list the subject once; filter should not add it to l0
    const pair = buildTreatmentPair({
      kind: "skills", subject: "task-framing",
      declaredSkills: ["task-framing"],
      declaredAgents: [],
    });
    expect(pair.baseline.definition.skills).toEqual([]);
  });
});

it("requires locked transitive skills in every external skill scenario", () => {
  const scenarios = [{ skills: ["grill-me", "grilling"] }, { skills: ["grill-me"] }];
  expect(() => validateSkillScenarioDependencies("grill-me", ["grilling"], scenarios.slice(0, 1))).not.toThrow();
  expect(() => validateSkillScenarioDependencies("grill-me", ["grilling"], scenarios)).toThrow("omits locked dependency grilling");
});

// ── AC2 L2 agent treatment parity ─────────────────────────────────────────────

describe("AC2 L2 parity: agent_l2 and agent_l1 carry identical skills", () => {
  it("agent_l2 and agent_l1 have exactly the same declared skills", () => {
    const pair = buildTreatmentPair({
      kind: "agents", subject: "change-builder",
      declaredSkills: ["task-framing", "loop-control"],
      declaredAgents: [],
    });
    expect(pair.candidate.definition.skills).toEqual(pair.baseline.definition.skills);
  });

  it("only agent membership differs: candidate has subject agent, baseline does not", () => {
    const pair = buildTreatmentPair({
      kind: "agents", subject: "change-builder",
      declaredSkills: ["task-framing"],
      declaredAgents: [],
    });
    expect(pair.candidate.definition.agents).toContain("change-builder");
    expect(pair.baseline.definition.agents).not.toContain("change-builder");
    // skills are identical
    expect(pair.candidate.definition.skills).toEqual(pair.baseline.definition.skills);
  });

  it("agent parity holds across all minimal-harness agent subjects", () => {
    for (const subject of MINIMAL_HARNESS_SUBJECTS.agents) {
      const pair = buildTreatmentPair({
        kind: "agents", subject,
        declaredSkills: ["task-framing"],
        declaredAgents: [],
      });
      expect(pair.candidate.definition.skills).toEqual(pair.baseline.definition.skills);
    }
  });
});

// ── AC3 L3 recipe treatment parity ────────────────────────────────────────────

describe("AC3 L3 parity: recipe_l3 and recipe_l2 carry identical skills and agents", () => {
  it("recipe_l3 and recipe_l2 have exactly the same declared skills and agents", () => {
    const pair = buildTreatmentPair({
      kind: "recipes", subject: "implement",
      declaredSkills: ["task-framing"],
      declaredAgents: ["change-builder"],
      resolvedRecipePath: "/repo/.goose/recipes/implement.yaml",
    });
    expect(pair.candidate.definition.skills).toEqual(pair.baseline.definition.skills);
    expect(pair.candidate.definition.agents).toEqual(pair.baseline.definition.agents);
  });

  it("validates every recipe corpus scenario against the exact central dependency closure", async () => {
    await expect(validateHarnessCoverage(new Date("2026-07-29T00:00:00Z"))).resolves.toBeUndefined();
  });

  it("rejects missing/extra delegated agents, skills, and in-session agent misuse", () => {
    const base = RECIPE_DEPENDENCY_CLOSURE.implement;
    const mutations = [
      { ...base, delegated_agents: [] },
      { ...base, delegated_agents: [...base.delegated_agents, "repository-researcher"] },
      { ...base, skills: [] },
      { ...base, skills: [...base.skills, "loop-control"] },
      { ...base, agents: ["change-builder"] },
    ];
    for (const scenario of mutations) {
      expect(() => validateRecipeScenarioClosure("implement", [scenario])).toThrow(/mismatch/);
    }
  });
});

// ── AC4 Active-component corpus coverage and exemptions ───────────────────────

describe("AC4 inventory-derived corpus coverage and typed exemptions", () => {
  it("covers every active component from manifests/disk or the typed exemptions file", async () => {
    await expect(validateHarnessCoverage(new Date("2026-07-29T00:00:00Z"))).resolves.toBeUndefined();
    expect(MINIMAL_HARNESS_SUBJECTS.skills).toContain("output-discipline");
  });
});
