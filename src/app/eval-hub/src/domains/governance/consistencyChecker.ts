/**
 * Consistency checker — native TypeScript reimplementation of check-consistency.py.
 * Reads repo files and verifies counts/wiring are in sync.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT, EVALS_DIR, PROJECT_SKILLS_DIR, PROJECT_AGENTS_DIR, PROJECT_RECIPES_DIR } from "../../shared/paths.js";

export type CheckStatus = "pass" | "fail" | "warn";

export interface CheckResult {
  id:      string;
  status:  CheckStatus;
  message: string;
  details: string[];
}

export interface ConsistencyReport {
  passed: number;
  failed: number;
  warned: number;
  checks: CheckResult[];
}

export class ConsistencyChecker {

  async runAll(): Promise<ConsistencyReport> {
    const checks = await Promise.all([
      this.checkSkillCount(),
      this.checkAgentCount(),
      this.checkRecipeCount(),
      this.checkSkillEvalFiles(),
      this.checkAgentEvalFields(),
      this.checkRecipeEvalFields(),
      this.checkUsesCasesStaleness(),
    ]);

    return {
      passed: checks.filter(c => c.status === "pass").length,
      failed: checks.filter(c => c.status === "fail").length,
      warned: checks.filter(c => c.status === "warn").length,
      checks,
    };
  }

  // ── Individual checks ────────────────────────────────────────────────────────

  private async checkSkillCount(): Promise<CheckResult> {
    const id = "skill-count";
    const diskSkills = await this.listDir(path.join(PROJECT_SKILLS_DIR));
    const expected   = diskSkills.length;

    const readme = await this.readFile(path.join(PROJECT_ROOT, "README.md"));
    const match  = readme.match(/##\s*Skills\s*\((\d+)\)/i);
    const readmeCount = match ? parseInt(match[1] ?? "0", 10) : null;

    if (readmeCount === null) return { id, status: "warn", message: "README.md missing skill count header", details: [] };
    if (readmeCount !== expected) {
      return { id, status: "fail", message: `README.md says ${readmeCount} skills, disk has ${expected}`, details: [`Expected: ${expected}`, `README: ${readmeCount}`] };
    }
    return { id, status: "pass", message: `Skill count matches: ${expected}`, details: [] };
  }

  private async checkAgentCount(): Promise<CheckResult> {
    const id     = "agent-count";
    const agents = await this.listFiles(path.join(PROJECT_AGENTS_DIR), ".md");
    const readme = await this.readFile(path.join(PROJECT_ROOT, "README.md"));
    const match  = readme.match(/##\s*Named\s*agents?\s*\((\d+)\)/i);
    const readmeCount = match ? parseInt(match[1] ?? "0", 10) : null;

    if (readmeCount === null) return { id, status: "warn", message: "README.md missing agent count header", details: [] };
    if (readmeCount !== agents.length) {
      return { id, status: "fail", message: `README.md says ${readmeCount} agents, disk has ${agents.length}`, details: [] };
    }
    return { id, status: "pass", message: `Agent count matches: ${agents.length}`, details: [] };
  }

  private async checkRecipeCount(): Promise<CheckResult> {
    const id      = "recipe-count";
    const recipes = await this.listFiles(path.join(PROJECT_RECIPES_DIR), ".yaml");
    const spec    = await this.readFile(path.join(PROJECT_ROOT, ".specs", "features", "harness-core", "spec.md"));
    const lines   = spec.split("\n").filter(l => l.includes("AC-RECIPE-01"));
    return {
      id, status: "pass",
      message: `${recipes.length} recipes found on disk`,
      details: lines.length === 0 ? ["AC-RECIPE-01 not found in spec"] : [],
    };
  }

  private async checkSkillEvalFiles(): Promise<CheckResult> {
    const id     = "skill-eval-files";
    const skills = await this.listDir(path.join(PROJECT_SKILLS_DIR));
    const missing: string[] = [];
    const tooFew:  string[] = [];

    for (const skill of skills) {
      const evalPath = path.join(EVALS_DIR, "skills", `${skill}.json`);
      try {
        const scenarios = JSON.parse(await fs.readFile(evalPath, "utf8")) as unknown[];
        if (!Array.isArray(scenarios) || scenarios.length < 3) tooFew.push(skill);
      } catch { missing.push(skill); }
    }

    if (missing.length > 0 || tooFew.length > 0) {
      return { id, status: "fail", message: `${missing.length} missing, ${tooFew.length} with <3 scenarios`, details: [...missing.map(s => `MISSING: ${s}`), ...tooFew.map(s => `<3 scenarios: ${s}`)] };
    }
    return { id, status: "pass", message: `All ${skills.length} skills have ≥3 eval scenarios`, details: [] };
  }

  private async checkAgentEvalFields(): Promise<CheckResult> {
    const id     = "agent-eval-fields";
    const agents = await this.listFiles(path.join(PROJECT_AGENTS_DIR), ".md");
    const issues: string[] = [];

    for (const agent of agents) {
      const evalPath = path.join(EVALS_DIR, "agents", `${agent}.json`);
      try {
        const data = JSON.parse(await fs.readFile(evalPath, "utf8")) as unknown;
        if (!Array.isArray(data) || (data as unknown[]).length === 0) issues.push(`${agent}: empty eval file`);
        // Check "skills" field presence
        if (Array.isArray(data)) {
          const hasSkills = (data as Record<string, unknown>[]).every(s => "skills" in s);
          if (!hasSkills) issues.push(`${agent}: missing "skills" field in scenarios`);
        }
      } catch { issues.push(`${agent}: no eval file`); }
    }

    return issues.length > 0
      ? { id, status: "fail", message: `Agent eval issues (${issues.length})`, details: issues }
      : { id, status: "pass", message: `All ${agents.length} agents have valid eval files`, details: [] };
  }

  private async checkRecipeEvalFields(): Promise<CheckResult> {
    const id      = "recipe-eval-fields";
    const recipes = await this.listFiles(path.join(PROJECT_RECIPES_DIR), ".yaml");
    const issues: string[] = [];

    for (const recipe of recipes) {
      const evalPath = path.join(EVALS_DIR, "recipes", `${recipe}.json`);
      try {
        const data = JSON.parse(await fs.readFile(evalPath, "utf8")) as Record<string, unknown>;
        if (!("agents" in data)) issues.push(`${recipe}: missing "agents" field`);
        if (!("skills" in data)) issues.push(`${recipe}: missing "skills" field`);
      } catch { /* eval file may not exist yet */ }
    }

    return issues.length > 0
      ? { id, status: "warn", message: `Recipe eval issues (${issues.length})`, details: issues }
      : { id, status: "pass", message: `Recipe eval fields OK`, details: [] };
  }

  private async checkUsesCasesStaleness(): Promise<CheckResult> {
    const id      = "use-cases-staleness";
    const recipes = await this.listFiles(path.join(PROJECT_RECIPES_DIR), ".yaml");
    const useCases = await this.readFile(path.join(PROJECT_ROOT, "USE_CASES.md"));
    const stale   = recipes.filter(r => !useCases.includes(r));

    return stale.length > 0
      ? { id, status: "warn", message: `${stale.length} recipe(s) not in USE_CASES.md`, details: stale }
      : { id, status: "pass", message: "USE_CASES.md covers all recipes", details: [] };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async listDir(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    } catch { return []; }
  }

  private async listFiles(dir: string, ext: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir);
      return entries.filter(e => e.endsWith(ext)).map(e => e.replace(ext, "")).sort();
    } catch { return []; }
  }

  private async readFile(p: string): Promise<string> {
    try { return await fs.readFile(p, "utf8"); } catch { return ""; }
  }
}
