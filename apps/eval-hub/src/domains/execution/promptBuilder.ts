/**
 * IPromptBuilder implementation.
 *
 * with_*  configs: prefixes with "load skill/agent: <name>" so Goose discovers
 *                  and loads the skill from the project-space (.agents/skills/).
 * without_* configs: plain task only — isolation done via cwd + hidden dirs.
 *
 * File paths are relative as written in the eval JSON; Goose resolves from cwd.
 */
import type { IPromptBuilder } from "./ports.js";
import type { EvalScenario } from "../../shared/types.js";

export class SkillPromptBuilder implements IPromptBuilder {
  build(scenario: EvalScenario, config: string): string {
    const lines: string[] = [];

    const skills = scenario.skills ?? [];
    const agents = scenario.agents ?? [];
    // Layer-delta baselines retain lower-layer context: L1 skills for agents,
    // and L2 agents + skills for recipes.
    const loadSkills = config === "with_skill" || config === "with_agent" || config === "skills_only" || config === "agents_only";
    const loadAgents = config === "with_agent" || config === "agents_only";
    if (loadSkills && skills.length) lines.push(`load skill: ${skills.join(", ")}`);
    if (loadAgents && agents.length) lines.push(`load agent: ${agents.join(", ")}`);
    if ((loadSkills && skills.length) || (loadAgents && agents.length)) lines.push("");

    const files = scenario.files ?? [];
    if (files.length) {
      lines.push("Relevant files:");
      for (const f of files) lines.push(`  - ${f}`);
      lines.push("");
    }

    lines.push(scenario.query ?? "");
    return lines.join("\n").trim();
  }
}
