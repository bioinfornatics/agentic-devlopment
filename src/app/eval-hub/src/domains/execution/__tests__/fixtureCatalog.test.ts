import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVALS_DIR, PROJECT_AGENTS_DIR, PROJECT_SKILLS_DIR, PROJECT_ROOT } from "../../../shared/paths.js";

interface CatalogScenario {
  readonly files?: unknown;
  readonly skills?: unknown;
  readonly agents?: unknown;
}

async function evalCatalogFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const kind of ["skills", "agents", "recipes"] as const) {
    const directory = path.join(EVALS_DIR, kind);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(path.join(directory, entry.name));
      }
    }
  }
  return files.sort();
}

describe("EVAL-FIX production fixture catalog", () => {
  it("resolves every declared scenario fixture inside the project root", async () => {
    const rootPrefix = PROJECT_ROOT.endsWith(path.sep) ? PROJECT_ROOT : PROJECT_ROOT + path.sep;
    const violations: string[] = [];

    for (const evalPath of await evalCatalogFiles()) {
      const relativeEvalPath = path.relative(PROJECT_ROOT, evalPath);
      const parsed = JSON.parse(await fs.readFile(evalPath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) {
        violations.push(`${relativeEvalPath}: root must be an array`);
        continue;
      }

      for (const [scenarioIndex, value] of parsed.entries()) {
        const scenario = value as CatalogScenario;
        if (scenario.files === undefined) continue;
        if (!Array.isArray(scenario.files)) {
          violations.push(`${relativeEvalPath} scenario=${scenarioIndex}: files must be an array`);
          continue;
        }
        for (const declaredPath of scenario.files) {
          if (typeof declaredPath !== "string" || declaredPath.length === 0) {
            violations.push(`${relativeEvalPath} scenario=${scenarioIndex}: invalid fixture path ${JSON.stringify(declaredPath)}`);
            continue;
          }
          const resolved = path.resolve(PROJECT_ROOT, declaredPath);
          if (path.isAbsolute(declaredPath) || (resolved !== PROJECT_ROOT && !resolved.startsWith(rootPrefix))) {
            violations.push(`${relativeEvalPath} scenario=${scenarioIndex}: fixture escapes project root: ${declaredPath}`);
            continue;
          }
          try {
            await fs.access(resolved);
          } catch {
            violations.push(`${relativeEvalPath} scenario=${scenarioIndex}: fixture not found: ${declaredPath}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

/**
 * AC-EVAL-06 — Layer declarations in eval JSON
 *
 * WHEN an agent or recipe eval JSON is loaded
 * THEN every scenario has a "skills" array (agents)
 *   or "agents" + "skills" arrays (recipes)
 * AND each declared skill/agent exists under .agents/skills/ or .agents/agents/
 */
describe("AC-EVAL-06 layer declarations in eval JSON", () => {
  it("every agent scenario has a 'skills' array", async () => {
    const violations: string[] = [];
    const agentsDir = path.join(EVALS_DIR, "agents");
    for (const entry of await fs.readdir(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const parsed = JSON.parse(
        await fs.readFile(path.join(agentsDir, entry.name), "utf8"),
      ) as unknown[];
      for (const [i, scenario] of parsed.entries()) {
        const s = scenario as CatalogScenario;
        if (!Array.isArray(s.skills)) {
          violations.push(`agents/${entry.name} scenario=${i}: missing 'skills' array`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every recipe scenario has both 'agents' and 'skills' arrays", async () => {
    const violations: string[] = [];
    const recipesDir = path.join(EVALS_DIR, "recipes");
    for (const entry of await fs.readdir(recipesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const parsed = JSON.parse(
        await fs.readFile(path.join(recipesDir, entry.name), "utf8"),
      ) as unknown[];
      for (const [i, scenario] of parsed.entries()) {
        const s = scenario as CatalogScenario;
        if (!Array.isArray(s.skills)) {
          violations.push(`recipes/${entry.name} scenario=${i}: missing 'skills' array`);
        }
        if (!Array.isArray(s.agents)) {
          violations.push(`recipes/${entry.name} scenario=${i}: missing 'agents' array`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every declared skill resolves under .agents/skills/", async () => {
    const violations: string[] = [];
    for (const kind of ["agents", "recipes"] as const) {
      const dir = path.join(EVALS_DIR, kind);
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const parsed = JSON.parse(
          await fs.readFile(path.join(dir, entry.name), "utf8"),
        ) as CatalogScenario[];
        for (const [i, s] of parsed.entries()) {
          for (const skill of (Array.isArray(s.skills) ? s.skills : []) as string[]) {
            const skillPath = path.join(PROJECT_SKILLS_DIR, skill);
            try { await fs.access(skillPath); } catch {
              violations.push(`${kind}/${entry.name} scenario=${i}: skill '${skill}' not found at ${skillPath}`);
            }
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every declared agent resolves under .agents/agents/", async () => {
    const violations: string[] = [];
    const recipesDir = path.join(EVALS_DIR, "recipes");
    for (const entry of await fs.readdir(recipesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const parsed = JSON.parse(
        await fs.readFile(path.join(recipesDir, entry.name), "utf8"),
      ) as CatalogScenario[];
      for (const [i, s] of parsed.entries()) {
        for (const agent of (Array.isArray(s.agents) ? s.agents : []) as string[]) {
          const agentPath = path.join(PROJECT_AGENTS_DIR, `${agent}.md`);
          try { await fs.access(agentPath); } catch {
            violations.push(`recipes/${entry.name} scenario=${i}: agent '${agent}' not found at ${agentPath}`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
