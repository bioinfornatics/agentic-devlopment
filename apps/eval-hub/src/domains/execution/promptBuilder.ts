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

    if (config.startsWith("with_")) {
      const skills = scenario.skills  ?? [];
      const agents = scenario.agents  ?? [];
      if (skills.length) lines.push(`load skill: ${skills.join(", ")}`);
      if (agents.length) lines.push(`load agent: ${agents.join(", ")}`);
      if (skills.length || agents.length) lines.push("");
    }

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
