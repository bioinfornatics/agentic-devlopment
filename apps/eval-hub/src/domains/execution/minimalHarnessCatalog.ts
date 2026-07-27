import fs from "node:fs/promises";
import path from "node:path";
import { EVALS_DIR } from "../../shared/paths.js";

export const MINIMAL_HARNESS_SUBJECTS = {
  agents: ["change-builder", "error-analyzer", "independent-verifier", "repository-researcher"],
  skills: ["evidence-verification", "interface-quality", "loop-control", "task-framing", "ui-design", "ux-principles", "wcag-accessibility-audit"],
  recipes: ["implement", "loop-engineering", "research", "verify"],
} as const;

export interface ArchitectureProtocol {
  readonly name: string;
  readonly objective: string;
  readonly configurations: readonly string[];
  readonly controlled_variables: readonly string[];
  readonly success_criteria: readonly string[];
  readonly efficiency_winner: string;
}

export interface MinimalHarnessCatalog {
  readonly subjects: {
    readonly agents: readonly string[];
    readonly skills: readonly string[];
    readonly recipes: readonly string[];
  };
  readonly architecture: readonly ArchitectureProtocol[];
  readonly counts: {
    readonly agents: number;
    readonly skills: number;
    readonly recipes: number;
    readonly architecture: number;
    readonly total: number;
  };
}

async function scenarioCount(kind: keyof typeof MINIMAL_HARNESS_SUBJECTS, subject: string): Promise<number> {
  const file = path.join(EVALS_DIR, kind, subject + ".json");
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(file + ": root must be an array");
  return parsed.length;
}

function assertExactSubjects(kind: keyof typeof MINIMAL_HARNESS_SUBJECTS, actual: readonly string[]): void {
  const expected = MINIMAL_HARNESS_SUBJECTS[kind];
  const missing = expected.filter(subject => !actual.includes(subject));
  const extra = actual.filter(subject => !expected.includes(subject as never));
  if (missing.length || extra.length) {
    throw new Error(kind + " catalog mismatch; missing=" + missing.join(",") + " extra=" + extra.join(","));
  }
}

async function filesFor(kind: keyof typeof MINIMAL_HARNESS_SUBJECTS): Promise<string[]> {
  const entries = await fs.readdir(path.join(EVALS_DIR, kind), { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => entry.name.slice(0, -5)).sort();
}

export async function loadMinimalHarnessCatalog(): Promise<MinimalHarnessCatalog> {
  for (const kind of ["agents", "skills", "recipes"] as const) {
    assertExactSubjects(kind, await filesFor(kind));
  }
  const [agents, skills, recipes] = await Promise.all([
    Promise.all(MINIMAL_HARNESS_SUBJECTS.agents.map(subject => scenarioCount("agents", subject))),
    Promise.all(MINIMAL_HARNESS_SUBJECTS.skills.map(subject => scenarioCount("skills", subject))),
    Promise.all(MINIMAL_HARNESS_SUBJECTS.recipes.map(subject => scenarioCount("recipes", subject))),
  ]);
  const architecturePath = path.join(EVALS_DIR, "benchmarks", "architecture-ablation.json");
  const architectureUnknown: unknown = JSON.parse(await fs.readFile(architecturePath, "utf8"));
  if (!Array.isArray(architectureUnknown)) throw new Error("architecture benchmark root must be an array");
  const architecture = architectureUnknown as ArchitectureProtocol[];
  for (const item of architecture) {
    if (!item.name || !item.objective || !Array.isArray(item.configurations) || item.configurations.length < 2
      || !Array.isArray(item.controlled_variables) || item.controlled_variables.length === 0
      || !Array.isArray(item.success_criteria) || item.success_criteria.length === 0 || !item.efficiency_winner) {
      throw new Error("invalid architecture protocol: " + (item.name || "unnamed"));
    }
  }
  const counts = {
    agents: agents.reduce((sum, count) => sum + count, 0),
    skills: skills.reduce((sum, count) => sum + count, 0),
    recipes: recipes.reduce((sum, count) => sum + count, 0),
    architecture: architecture.length,
    total: 0,
  };
  counts.total = counts.agents + counts.skills + counts.recipes + counts.architecture;
  if (counts.agents !== 12 || counts.skills !== 21 || counts.recipes !== 14 || counts.architecture !== 6 || counts.total !== 53) {
    throw new Error("expected 53 protocols; got " + JSON.stringify(counts));
  }
  return { subjects: MINIMAL_HARNESS_SUBJECTS, architecture, counts };
}
