/**
 * Archive-isolation guardrails for eval-hub.
 *
 * Three directories are TEMPORARY ARCHIVES: .agents.old/, .goose.old/, evals.old/.
 * They must NEVER appear in active harness resolution, benchmark catalogs,
 * measurement, or packaging.
 *
 * This module is intentionally free of imports from paths.ts to avoid circular
 * top-level-await dependencies.  Callers supply projectRoot explicitly so the
 * guard is usable before the async PROJECT_ROOT resolution completes.
 *
 * Architecture decision 2026-07-25: archives are forbidden inputs.
 */
import path from "node:path";

/** Bare directory names that are classified as archives. */
export const ARCHIVE_DIR_NAMES: readonly string[] = [
  ".agents.old",
  ".goose.old",
  "evals.old",
];

/**
 * Active harness directory names: Goose discovers agents/skills/plugins from
 * .agents/, recipes from .goose/; eval data lives in src/app/eval-hub/evals/.
 */
export const ACTIVE_DIR_NAMES: readonly string[] = [
  ".agents",
  ".goose",
  path.join("src", "app", "eval-hub", "evals"),
];

/**
 * Compute the absolute archive roots for a given project root.
 * Returns the same list in the same order as ARCHIVE_DIR_NAMES.
 */
export function getArchiveRoots(projectRoot: string): readonly string[] {
  return ARCHIVE_DIR_NAMES.map(name => path.join(projectRoot, name));
}

/**
 * Compute the absolute active roots for a given project root.
 */
export function getActiveRoots(projectRoot: string): readonly string[] {
  return ACTIVE_DIR_NAMES.map(name => path.join(projectRoot, name));
}

/**
 * Returns true when `resolvedPath` is inside (or equal to) any archive root.
 *
 * Uses exact prefix matching after path.resolve() to avoid false positives
 * from names that share a prefix but are not archives (e.g. ".agents" vs
 * ".agents.old").
 */
export function isArchivePath(resolvedPath: string, projectRoot: string): boolean {
  const normalized = path.resolve(resolvedPath);
  for (const root of getArchiveRoots(projectRoot)) {
    if (normalized === root || normalized.startsWith(root + path.sep)) {
      return true;
    }
  }
  return false;
}

/**
 * Throws an `ArchiveBoundaryError` when `resolvedPath` falls inside any
 * archive root.  Call this before using any path for reading, measuring, or
 * packaging active harness content.
 */
export function assertNotArchive(resolvedPath: string, projectRoot: string): void {
  const normalized = path.resolve(resolvedPath);
  for (const root of getArchiveRoots(projectRoot)) {
    if (normalized === root || normalized.startsWith(root + path.sep)) {
      throw new ArchiveBoundaryError(resolvedPath, root);
    }
  }
}

/** Thrown when a resolution attempt targets an archive root. */
export class ArchiveBoundaryError extends Error {
  constructor(
    public readonly attemptedPath: string,
    public readonly archiveRoot: string,
  ) {
    super(
      `Archive boundary violation: "${attemptedPath}" resolves inside archive ` +
      `"${archiveRoot}". Archives (.agents.old/, .goose.old/, evals.old/) must ` +
      `not be read, measured, counted, or packaged by the active harness.`,
    );
    this.name = "ArchiveBoundaryError";
  }
}
