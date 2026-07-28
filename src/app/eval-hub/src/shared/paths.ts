/**
 * Canonical path helpers for eval-hub.
 *
 * Goose discovery order (lowest → highest priority):
 *
 *   1. Built-in  (builtin://skills/)
 *   2. User-space  — always available, all sessions
 *        ~/.agents/skills/           skills
 *        ~/.agents/agents/           agent specs
 *        ~/.config/goose/recipes/    recipes
 *   3. Project-space  — walked UP from cwd, overrides user-space when present
 *        .agents/skills/
 *        .agents/agents/
 *        .goose/recipes/
 *
 * Reference:
 *   https://goose-docs.ai/docs/guides/context-engineering/using-skills/
 *   https://goose-docs.ai/docs/guides/context-engineering/custom-agents
 *   https://goose-docs.ai/docs/guides/recipes/recipe-reference/
 *
 * PROJECT_SOURCE_ROOT defaults to the nearest ancestor containing evals/ and src/.
 * HARNESS_RUNTIME_ROOT identifies the immutable projected .agents/.goose tree.
 */
import path from "node:path";
import os   from "node:os";
import fs   from "node:fs/promises";
import { assertNotArchive } from "./archiveBoundary.js";

// ── Project root ──────────────────────────────────────────────────────────────
export const PROJECT_ROOT: string = process.env["PROJECT_SOURCE_ROOT"] ?? process.env["PROJECT_ROOT"] ?? await findProjectRoot(process.cwd());
export const HARNESS_RUNTIME_ROOT: string = process.env["HARNESS_RUNTIME_ROOT"] ?? path.join(PROJECT_ROOT, "build", "harness", "runtime", "current");

async function findProjectRoot(start: string): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    try {
      await fs.access(path.join(current, "evals"));
      await fs.access(path.join(current, "src"));
      return current;
    } catch { /* walk upward */ }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

// ── Project-space paths  (Goose walks up from cwd — overrides user-space) ────
export const PROJECT_SKILLS_DIR  = path.join(HARNESS_RUNTIME_ROOT, ".agents", "skills");
export const PROJECT_AGENTS_DIR  = path.join(HARNESS_RUNTIME_ROOT, ".agents", "agents");
export const PROJECT_RECIPES_DIR = path.join(HARNESS_RUNTIME_ROOT, ".goose", "recipes");
export const SOURCE_SKILLS_DIR   = path.join(PROJECT_ROOT, "src", "skills");
export const SOURCE_AGENTS_DIR   = path.join(PROJECT_ROOT, "src", "agents");
export const SOURCE_RECIPES_DIR  = path.join(PROJECT_ROOT, "src", "recipes");

// ── User-space paths  (Goose standard, always present baseline) ───────────────
export const USER_SKILLS_DIR  = path.join(os.homedir(), ".agents",  "skills");
export const USER_AGENTS_DIR  = path.join(os.homedir(), ".agents",  "agents");
export const USER_RECIPES_DIR = path.join(os.homedir(), ".config",  "goose", "recipes");

// ── Eval data (always project-local) ─────────────────────────────────────────
export const EVALS_DIR    = path.join(PROJECT_ROOT, "evals");
export const DIST_DIR     = path.join(PROJECT_ROOT, "dist");
export const DIST_EVALS   = path.join(DIST_DIR,     "evals");
export const LAYERED_ROOT = path.join(DIST_EVALS,   "layered");
export const EVAL_DB      = path.join(DIST_EVALS,   "evaluation.db");

// ── Ambient-eval isolation ────────────────────────────────────────────────────
/**
 * Directories hidden during --ambient-goose eval runs so the "without_*"
 * baseline config cannot discover user-installed skills/recipes.
 *
 * Project-space dirs are NOT hidden here: in ambient mode the eval cwd is
 * /tmp, so Goose's upward walk cannot reach the project tree anyway.
 */
export const AMBIENT_HIDE_DIRS: readonly string[] = [
  USER_SKILLS_DIR,
  USER_RECIPES_DIR,
];

// ── Path resolution helpers ───────────────────────────────────────────────────

/**
 * Project-space source path for a subject (used for content-hashing and as the
 * primary lookup).  Always returns the project-space location regardless of
 * whether the file exists — callers that need the *effective* path should use
 * `resolveSubjectPath()` instead.
 */
export function subjectSourcePath(kind: string, subject: string): string {
  if (kind === "agents")  return path.join(SOURCE_AGENTS_DIR, `${subject}.md`);
  if (kind === "recipes") return path.join(SOURCE_RECIPES_DIR, `${subject}.yaml`);
  const internal = path.join(SOURCE_SKILLS_DIR, subject);
  return internal;
}

/**
 * Resolve the *effective* path for a subject following Goose's precedence:
 *   project-space  >  user-space
 *
 * Returns the project-space path when it exists; falls back to user-space.
 * Useful for content loading (SKILL.md injection) where the skill might only
 * be installed globally.
 */
export async function resolveSubjectPath(kind: string, subject: string): Promise<string> {
  const projectPath = subjectSourcePath(kind, subject);
  // AC-2: fail fast if the project-space path would resolve into an archive.
  assertNotArchive(projectPath, PROJECT_ROOT);
  try {
    await fs.access(projectPath);
    return projectPath;
  } catch {
    if (kind === "recipes") {
      const candidates = [
        path.join(PROJECT_RECIPES_DIR, "subrecipes", `${subject}.yaml`),
        path.join(USER_RECIPES_DIR, `${subject}.yaml`),
        path.join(USER_RECIPES_DIR, "subrecipes", `${subject}.yaml`),
      ];
      for (const candidate of candidates) {
        try { await fs.access(candidate); return candidate; } catch { /* continue */ }
      }
      throw new Error(`Recipe subject not found: ${subject}`);
    }
    if (kind === "agents") {
      const runtimeAgent = path.join(PROJECT_AGENTS_DIR, `${subject}.md`);
      try { await fs.access(runtimeAgent); return runtimeAgent; } catch { return path.join(USER_AGENTS_DIR, `${subject}.md`); }
    }
    const runtimeSkill = path.join(PROJECT_SKILLS_DIR, subject);
    try { await fs.access(runtimeSkill); return runtimeSkill; } catch { return path.join(USER_SKILLS_DIR, subject); }
  }
}

/**
 * Resolve the SKILL.md path for a named skill following Goose's precedence.
 * Project-space (.agents/skills/<name>/SKILL.md) overrides
 * user-space   (~/.agents/skills/<name>/SKILL.md).
 */
export async function resolveSkillMd(skillName: string): Promise<string> {
  const sourceMd = path.join(SOURCE_SKILLS_DIR, skillName, "SKILL.md");
  try { await fs.access(sourceMd); return sourceMd; } catch { /* external/runtime */ }
  const projectMd = path.join(PROJECT_SKILLS_DIR, skillName, "SKILL.md");
  try {
    await fs.access(projectMd);
    return projectMd;
  } catch {
    return path.join(USER_SKILLS_DIR, skillName, "SKILL.md");
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function evalJsonPath(kind: string, subject: string): string {
  return path.join(EVALS_DIR, kind, `${subject}.json`);
}

export function subjectWorkspacePath(kind: string, subject: string, hash: string): string {
  return path.join(DIST_EVALS, kind, subject, hash);
}