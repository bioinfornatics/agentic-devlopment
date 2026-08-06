/**
 * Deterministic reverse-impact selector.
 *
 * Given a changed component (skill, agent, or recipe), returns the set of
 * evaluation protocols that need to be re-run — without calling any LLM.
 *
 * Closure rules:
 *   skill  S → direct eval (skills/S) + any agent/recipe evals that declare S in skills
 *   agent  A → direct eval (agents/A) + any recipe evals that declare A in agents
 *   recipe R → direct eval (recipes/R)
 *
 * AC5: deterministic reverse closure with unit tests (no LLM secrets required).
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { EvalKind } from "../../shared/types.js";

export interface ImpactedEval {
  readonly kind: EvalKind;
  readonly subject: string;
  readonly reason: "direct_eval" | "skill_dep" | "agent_dep";
}

export interface EvalCorpusEntry {
  readonly skills: readonly string[];
  /**
   * In-session agents only (loaded in this session's context).
   * For recipe evals, this is [] because recipes summon agents as delegates;
   * those are tracked in delegated_agents for dependency impact analysis.
   */
  readonly agents: readonly string[];
  /**
   * Summoned/delegated agents for recipe evals — the agents actually delegated
   * by this recipe during execution (via Summon, not in-session load).
   * Used by the reverse-impact selector to determine recipe eval re-run scope
   * when an agent changes. NOT used in treatment construction (L3 parity).
   */
  readonly delegated_agents?: readonly string[];
}

export interface EvalCorpus {
  readonly skills: Readonly<Record<string, readonly EvalCorpusEntry[]>>;
  readonly agents: Readonly<Record<string, readonly EvalCorpusEntry[]>>;
  readonly recipes: Readonly<Record<string, readonly EvalCorpusEntry[]>>;
}

/**
 * Compute the reverse-impact closure for a changed component.
 * Pure function — no I/O, no LLM, fully deterministic.
 */
export function computeReverseImpact(
  corpus: EvalCorpus,
  changedKind: EvalKind,
  changedName: string,
): readonly ImpactedEval[] {
  const impacts: ImpactedEval[] = [];

  // Direct: the component has its own eval file in the corpus
  if (Object.prototype.hasOwnProperty.call(corpus[changedKind], changedName)) {
    impacts.push({ kind: changedKind, subject: changedName, reason: "direct_eval" });
  }

  if (changedKind === "skills") {
    // Skills are referenced by agent evals (the skill is part of the agent treatment)
    for (const [subject, scenarios] of Object.entries(corpus.agents)) {
      if (scenarios.some(s => s.skills.includes(changedName))) {
        impacts.push({ kind: "agents", subject, reason: "skill_dep" });
      }
    }
    // Skills are referenced by recipe evals (the skill is part of the recipe baseline)
    for (const [subject, scenarios] of Object.entries(corpus.recipes)) {
      if (scenarios.some(s => s.skills.includes(changedName))) {
        impacts.push({ kind: "recipes", subject, reason: "skill_dep" });
      }
    }
  }

  if (changedKind === "agents") {
    // Agents are referenced by recipe evals via delegated_agents (summoned delegates, not in-session).
    // Recipe eval agents[] is always [] (in-session only); delegated_agents tracks summoned dependency.
    for (const [subject, scenarios] of Object.entries(corpus.recipes)) {
      if (scenarios.some(s => (s.delegated_agents ?? []).includes(changedName))) {
        impacts.push({ kind: "recipes", subject, reason: "agent_dep" });
      }
    }
  }

  return impacts;
}

/**
 * Load a minimal EvalCorpus from the evals directory.
 * Only reads the fields needed for impact analysis (skills, agents).
 */
export async function loadEvalCorpus(evalsDir: string): Promise<EvalCorpus> {
  async function loadKind(kind: EvalKind): Promise<Record<string, readonly EvalCorpusEntry[]>> {
    const dir = path.join(evalsDir, kind);
    const result: Record<string, readonly EvalCorpusEntry[]> = {};
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return result;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const subject = entry.name.slice(0, -5);
      let raw: unknown;
      try {
        raw = JSON.parse(await fs.readFile(path.join(dir, entry.name), "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(raw)) continue;
      result[subject] = (raw as Array<unknown>).map(s => {
        const scenario = s as Record<string, unknown>;
        const delegatedAgents = Array.isArray(scenario["delegated_agents"])
          ? (scenario["delegated_agents"] as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined;
        return {
          skills: Array.isArray(scenario["skills"]) ? (scenario["skills"] as unknown[]).filter((x): x is string => typeof x === "string") : [],
          agents: Array.isArray(scenario["agents"]) ? (scenario["agents"] as unknown[]).filter((x): x is string => typeof x === "string") : [],
          ...(delegatedAgents !== undefined ? { delegated_agents: delegatedAgents } : {}),
        };
      });
    }
    return result;
  }

  const [skills, agents, recipes] = await Promise.all([
    loadKind("skills"),
    loadKind("agents"),
    loadKind("recipes"),
  ]);
  return { skills, agents, recipes };
}
