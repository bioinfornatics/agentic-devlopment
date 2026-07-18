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
 * PROJECT_ROOT defaults to cwd — always run eval-hub from the repo root,
 * or set the PROJECT_ROOT env var explicitly.
 */
import path from "node:path";
import os   from "node:os";
import fs   from "node:fs/promises";

// ── Project root ──────────────────────────────────────────────────────────────
export const PROJECT_ROOT: string = process.env["PROJECT_ROOT"] ?? process.cwd();

// ── Project-space paths  (Goose walks up from cwd — overrides user-space) ────
export const PROJECT_SKILLS_DIR  = path.join(PROJECT_ROOT, ".agents",  "skills");
export const PROJECT_AGENTS_DIR  = path.join(PROJECT_ROOT, ".agents",  "agents");
export const PROJECT_RECIPES_DIR = path.join(PROJECT_ROOT, ".goose",   "recipes");

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
  if (kind === "agents")  return path.join(PROJECT_AGENTS_DIR,  `${subject}.md`);
  if (kind === "recipes") return path.join(PROJECT_RECIPES_DIR, `${subject}.yaml`);
  return path.join(PROJECT_SKILLS_DIR, subject);
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
  try {
    await fs.access(projectPath);
    return projectPath;          // project-space wins
  } catch {
    // fall back to user-space
    if (kind === "agents")  return path.join(USER_AGENTS_DIR,  `${subject}.md`);
    if (kind === "recipes") return path.join(USER_RECIPES_DIR, `${subject}.yaml`);
    return path.join(USER_SKILLS_DIR, subject);
  }
}

/**
 * Resolve the SKILL.md path for a named skill following Goose's precedence.
 * Project-space (.agents/skills/<name>/SKILL.md) overrides
 * user-space   (~/.agents/skills/<name>/SKILL.md).
 */
export async function resolveSkillMd(skillName: string): Promise<string> {
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
