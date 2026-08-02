/**
 * AC5 — Deterministic reverse-impact selector tests.
 *
 * Given a changed component (skill, agent, or recipe), computeReverseImpact
 * returns the transitive closure of evaluation protocols that need re-running.
 * No LLM or network access is used.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeReverseImpact, loadEvalCorpus, type EvalCorpus } from "../impactSelector.js";
import { EVALS_DIR } from "../../../shared/paths.js";

// ── Minimal in-memory corpus for unit tests ────────────────────────────────────

const corpus: EvalCorpus = {
  skills: {
    "task-framing": [{ skills: ["task-framing"], agents: [] }],
    "loop-control":  [{ skills: ["loop-control"],  agents: [] }],
  },
  agents: {
    "change-builder":        [{ skills: ["task-framing"], agents: [] }],
    "independent-verifier":  [{ skills: ["loop-control"], agents: [] }],
    "repository-researcher": [{ skills: ["task-framing"], agents: [] }],
  },
  // Recipe eval agents[] contains only in-session agents (always [] for recipes that summon).
  // delegated_agents tracks the actually summoned agents for dependency-impact analysis.
  recipes: {
    "implement":       [{ skills: ["task-framing"], agents: [], delegated_agents: ["change-builder"] }],
    "verify":          [{ skills: ["loop-control"],  agents: [], delegated_agents: ["independent-verifier"] }],
    "loop-engineering": [
      { skills: ["task-framing", "loop-control"], agents: [], delegated_agents: ["repository-researcher", "change-builder", "independent-verifier"] },
    ],
  },
};

// ── Skill impact ───────────────────────────────────────────────────────────────

describe("AC5 reverse-impact: skill change", () => {
  it("includes direct eval when the skill has a corpus file", () => {
    const result = computeReverseImpact(corpus, "skills", "task-framing");
    expect(result).toContainEqual({ kind: "skills", subject: "task-framing", reason: "direct_eval" });
  });

  it("includes agent evals that declare the changed skill as a dependency", () => {
    const result = computeReverseImpact(corpus, "skills", "task-framing");
    expect(result).toContainEqual({ kind: "agents", subject: "change-builder", reason: "skill_dep" });
    expect(result).toContainEqual({ kind: "agents", subject: "repository-researcher", reason: "skill_dep" });
  });

  it("includes recipe evals that declare the changed skill as a dependency", () => {
    const result = computeReverseImpact(corpus, "skills", "task-framing");
    expect(result).toContainEqual({ kind: "recipes", subject: "implement", reason: "skill_dep" });
    expect(result).toContainEqual({ kind: "recipes", subject: "loop-engineering", reason: "skill_dep" });
  });

  it("does NOT include agents or recipes that do not reference the changed skill", () => {
    const result = computeReverseImpact(corpus, "skills", "task-framing");
    // verify recipe uses loop-control, not task-framing
    expect(result).not.toContainEqual(expect.objectContaining({ kind: "recipes", subject: "verify" }));
    // independent-verifier uses loop-control, not task-framing
    expect(result).not.toContainEqual(expect.objectContaining({ kind: "agents", subject: "independent-verifier" }));
  });

  it("returns no impacts for a skill with no corpus and no dependents", () => {
    const result = computeReverseImpact(corpus, "skills", "nonexistent-skill");
    expect(result).toHaveLength(0);
  });

  it("skill with no corpus still propagates to dependents", () => {
    // A skill referenced by agents but not having its own eval file
    const sparseCorpus: EvalCorpus = {
      skills: {},
      agents: { "change-builder": [{ skills: ["orphan-skill"], agents: [] }] },
      recipes: {},
    };
    const result = computeReverseImpact(sparseCorpus, "skills", "orphan-skill");
    expect(result).toContainEqual({ kind: "agents", subject: "change-builder", reason: "skill_dep" });
    // no direct_eval since skill has no corpus file
    expect(result).not.toContainEqual(expect.objectContaining({ reason: "direct_eval" }));
  });
});

// ── Agent impact ───────────────────────────────────────────────────────────────

describe("AC5 reverse-impact: agent change", () => {
  it("includes direct eval when the agent has a corpus file", () => {
    const result = computeReverseImpact(corpus, "agents", "change-builder");
    expect(result).toContainEqual({ kind: "agents", subject: "change-builder", reason: "direct_eval" });
  });

  it("includes recipe evals that declare the agent as a dependency", () => {
    const result = computeReverseImpact(corpus, "agents", "change-builder");
    expect(result).toContainEqual({ kind: "recipes", subject: "implement", reason: "agent_dep" });
    expect(result).toContainEqual({ kind: "recipes", subject: "loop-engineering", reason: "agent_dep" });
  });

  it("does NOT include recipe evals that do not reference the changed agent", () => {
    const result = computeReverseImpact(corpus, "agents", "change-builder");
    // verify recipe does not declare change-builder
    expect(result).not.toContainEqual(expect.objectContaining({ kind: "recipes", subject: "verify" }));
  });

  it("agent without corpus still propagates to recipe dependents via delegated_agents", () => {
    // delegated_agents tracks summoned agents; agents[] is [] (in-session only)
    const sparseCorpus: EvalCorpus = {
      skills: {},
      agents: {},
      recipes: { "implement": [{ skills: [], agents: [], delegated_agents: ["unknown-agent"] }] },
    };
    const result = computeReverseImpact(sparseCorpus, "agents", "unknown-agent");
    expect(result).toContainEqual({ kind: "recipes", subject: "implement", reason: "agent_dep" });
    expect(result).not.toContainEqual(expect.objectContaining({ reason: "direct_eval" }));
  });

  it("agent in recipe agents[] (in-session) does NOT trigger agent_dep impact (agents[] is in-session only)", () => {
    // Only delegated_agents drives agent→recipe impact; in-session agents[] does not
    const sparseCorpus: EvalCorpus = {
      skills: {},
      agents: {},
      recipes: { "implement": [{ skills: [], agents: ["in-session-agent"], delegated_agents: [] }] },
    };
    const result = computeReverseImpact(sparseCorpus, "agents", "in-session-agent");
    expect(result).toHaveLength(0);
  });
});

// ── Recipe impact ──────────────────────────────────────────────────────────────

describe("AC5 reverse-impact: recipe change", () => {
  it("includes only the direct eval for a recipe change (recipes do not compose further)", () => {
    const result = computeReverseImpact(corpus, "recipes", "implement");
    expect(result).toEqual([{ kind: "recipes", subject: "implement", reason: "direct_eval" }]);
  });

  it("returns empty for a recipe with no corpus", () => {
    const result = computeReverseImpact(corpus, "recipes", "unlisted-recipe");
    expect(result).toHaveLength(0);
  });
});

// ── Integration: loadEvalCorpus reads actual evals directory ──────────────────

describe("AC5 reverse-impact: integration with real evals corpus", () => {
  it("loadEvalCorpus loads all eval kinds without error", async () => {
    const c = await loadEvalCorpus(EVALS_DIR);
    expect(Object.keys(c.skills).length).toBeGreaterThan(0);
    expect(Object.keys(c.agents).length).toBeGreaterThan(0);
    expect(Object.keys(c.recipes).length).toBeGreaterThan(0);
  });

  it("task-framing change impacts implement and loop-engineering recipes in real corpus", async () => {
    const c = await loadEvalCorpus(EVALS_DIR);
    const result = computeReverseImpact(c, "skills", "task-framing");
    const recipeSubjects = result.filter(r => r.kind === "recipes").map(r => r.subject);
    expect(recipeSubjects).toContain("implement");
    expect(recipeSubjects).toContain("loop-engineering");
  });

  it("change-builder agent change impacts implement and loop-engineering recipes", async () => {
    const c = await loadEvalCorpus(EVALS_DIR);
    const result = computeReverseImpact(c, "agents", "change-builder");
    const recipeSubjects = result.filter(r => r.kind === "recipes").map(r => r.subject);
    expect(recipeSubjects).toContain("implement");
    expect(recipeSubjects).toContain("loop-engineering");
  });
});
