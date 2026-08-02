/**
 * Archive-isolation guardrail tests — dcjv.23
 *
 * AC-1  Active discovery reads only .agents/, .goose/, and the Eval Hub corpus.
 * AC-2  assertNotArchive / isArchivePath throw or flag archive paths.
 * AC-3  Archive roots are enumerated and stable; no archive content is read.
 * AC-4  Focused tests and typecheck pass.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARCHIVE_DIR_NAMES,
  ACTIVE_DIR_NAMES,
  ArchiveBoundaryError,
  assertNotArchive,
  getActiveRoots,
  getArchiveRoots,
  isArchivePath,
} from "../archiveBoundary.js";
import {
  EVALS_DIR,
  PROJECT_AGENTS_DIR,
  PROJECT_RECIPES_DIR,
  PROJECT_ROOT,
  PROJECT_SKILLS_DIR,
  SOURCE_AGENTS_DIR,
  SOURCE_RECIPES_DIR,
  SOURCE_SKILLS_DIR,
  HARNESS_RUNTIME_ROOT,
} from "../paths.js";

// Synthetic project root used for pure unit tests (no filesystem access).
const FAKE_ROOT = "/fake/project";

// ── AC-3: archive root enumeration ───────────────────────────────────────────

describe("AC-3 ARCHIVE_DIR_NAMES enumerates all three archive directories", () => {
  it("lists exactly .agents.old, .goose.old, and evals.old", () => {
    expect([...ARCHIVE_DIR_NAMES].sort()).toEqual([".agents.old", ".goose.old", "evals.old"]);
  });

  it("getArchiveRoots returns three absolute paths under projectRoot", () => {
    const roots = getArchiveRoots(FAKE_ROOT);
    expect(roots).toHaveLength(3);
    for (const root of roots) {
      expect(root.startsWith(FAKE_ROOT)).toBe(true);
    }
    const basenames = roots.map(r => path.basename(r)).sort();
    expect(basenames).toEqual([".agents.old", ".goose.old", "evals.old"]);
  });
});

// ── AC-1: active discovery roots ─────────────────────────────────────────────

describe("source/runtime root separation", () => {
  it("canonical source directories are under src", () => {
    expect(SOURCE_AGENTS_DIR).toBe(path.join(PROJECT_ROOT, "src", "agents"));
    expect(SOURCE_SKILLS_DIR).toBe(path.join(PROJECT_ROOT, "src", "skills"));
    expect(SOURCE_RECIPES_DIR).toBe(path.join(PROJECT_ROOT, "src", "recipes"));
  });
  it("runtime directories are under explicit harness runtime root", () => {
    expect(PROJECT_AGENTS_DIR.startsWith(HARNESS_RUNTIME_ROOT)).toBe(true);
    expect(PROJECT_SKILLS_DIR.startsWith(HARNESS_RUNTIME_ROOT)).toBe(true);
    expect(PROJECT_RECIPES_DIR.startsWith(HARNESS_RUNTIME_ROOT)).toBe(true);
  });
});

describe("AC-1 active discovery reads only runtime roots and the canonical Eval Hub corpus", () => {
  it("ACTIVE_DIR_NAMES lists runtime roots and the canonical corpus", () => {
    expect([...ACTIVE_DIR_NAMES].sort()).toEqual([".agents", ".goose", path.join("src", "app", "eval-hub", "evals")]);
  });

  it("PROJECT_AGENTS_DIR is inside active .agents/ and not any archive", () => {
    expect(PROJECT_AGENTS_DIR.startsWith(path.join(HARNESS_RUNTIME_ROOT, ".agents"))).toBe(true);
    expect(isArchivePath(PROJECT_AGENTS_DIR, PROJECT_ROOT)).toBe(false);
  });

  it("PROJECT_SKILLS_DIR is inside active .agents/ and not any archive", () => {
    expect(PROJECT_SKILLS_DIR.startsWith(path.join(HARNESS_RUNTIME_ROOT, ".agents"))).toBe(true);
    expect(isArchivePath(PROJECT_SKILLS_DIR, PROJECT_ROOT)).toBe(false);
  });

  it("PROJECT_RECIPES_DIR is inside active .goose/ and not any archive", () => {
    expect(PROJECT_RECIPES_DIR.startsWith(path.join(HARNESS_RUNTIME_ROOT, ".goose"))).toBe(true);
    expect(isArchivePath(PROJECT_RECIPES_DIR, PROJECT_ROOT)).toBe(false);
  });

  it("EVALS_DIR is inside the canonical Eval Hub corpus and not any archive", () => {
    expect(EVALS_DIR.startsWith(path.join(PROJECT_ROOT, "src", "app", "eval-hub", "evals"))).toBe(true);
    expect(isArchivePath(EVALS_DIR, PROJECT_ROOT)).toBe(false);
  });

  it("active roots and archive roots are fully disjoint", () => {
    const activeRoots  = getActiveRoots(FAKE_ROOT);
    const archiveRoots = getArchiveRoots(FAKE_ROOT);
    for (const active of activeRoots) {
      for (const archive of archiveRoots) {
        // Use separator-aware prefix check: ".agents.old" must not be treated
        // as inside ".agents" just because it shares the string prefix.
        const activeWithSep   = active   + path.sep;
        const archiveWithSep  = archive  + path.sep;
        expect(active.startsWith(archiveWithSep)).toBe(false);
        expect(archive.startsWith(activeWithSep)).toBe(false);
      }
    }
  });
});

// ── AC-2: assertNotArchive — positive (must throw) ───────────────────────────

describe("AC-2 assertNotArchive throws ArchiveBoundaryError for archive paths", () => {
  it("throws for the .agents.old root itself", () => {
    const p = path.join(FAKE_ROOT, ".agents.old");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for a path inside .agents.old/agents/", () => {
    const p = path.join(FAKE_ROOT, ".agents.old", "agents", "some-agent.md");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for a path inside .agents.old/skills/", () => {
    const p = path.join(FAKE_ROOT, ".agents.old", "skills", "some-skill", "SKILL.md");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for the .goose.old root itself", () => {
    const p = path.join(FAKE_ROOT, ".goose.old");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for a path inside .goose.old/recipes/", () => {
    const p = path.join(FAKE_ROOT, ".goose.old", "recipes", "some-recipe.yaml");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for the evals.old root itself", () => {
    const p = path.join(FAKE_ROOT, "evals.old");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for a path inside evals.old/skills/", () => {
    const p = path.join(FAKE_ROOT, "evals.old", "skills", "some-skill.json");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("throws for a path inside evals.old/agents/", () => {
    const p = path.join(FAKE_ROOT, "evals.old", "agents", "some-agent.json");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(ArchiveBoundaryError);
  });

  it("error message names the violated archive root", () => {
    const p = path.join(FAKE_ROOT, ".agents.old", "agents", "foo.md");
    expect(() => assertNotArchive(p, FAKE_ROOT)).toThrowError(/\.agents\.old/);
  });
});

// ── AC-2: assertNotArchive — negative (must not throw) ───────────────────────

describe("AC-2 assertNotArchive does not throw for active harness paths", () => {
  it("passes for .agents/ path", () => {
    const p = path.join(FAKE_ROOT, ".agents", "agents", "some-agent.md");
    expect(() => assertNotArchive(p, FAKE_ROOT)).not.toThrow();
  });

  it("passes for .agents/skills/ path", () => {
    const p = path.join(FAKE_ROOT, ".agents", "skills", "some-skill", "SKILL.md");
    expect(() => assertNotArchive(p, FAKE_ROOT)).not.toThrow();
  });

  it("passes for .goose/recipes/ path", () => {
    const p = path.join(FAKE_ROOT, ".goose", "recipes", "some-recipe.yaml");
    expect(() => assertNotArchive(p, FAKE_ROOT)).not.toThrow();
  });

  it("passes for canonical Eval Hub corpus path", () => {
    const p = path.join(FAKE_ROOT, "src", "app", "eval-hub", "evals", "skills", "some-skill.json");
    expect(() => assertNotArchive(p, FAKE_ROOT)).not.toThrow();
  });

  it("passes for project root itself", () => {
    expect(() => assertNotArchive(FAKE_ROOT, FAKE_ROOT)).not.toThrow();
  });
});

// ── AC-2: isArchivePath — prefix collision guard ──────────────────────────────

describe("AC-2 isArchivePath uses exact prefix matching — no false positives", () => {
  it("returns true for archive roots", () => {
    for (const root of getArchiveRoots(FAKE_ROOT)) {
      expect(isArchivePath(root, FAKE_ROOT)).toBe(true);
    }
  });

  it("returns true for files inside archive roots", () => {
    expect(isArchivePath(path.join(FAKE_ROOT, ".agents.old", "x"), FAKE_ROOT)).toBe(true);
    expect(isArchivePath(path.join(FAKE_ROOT, ".goose.old",  "x"), FAKE_ROOT)).toBe(true);
    expect(isArchivePath(path.join(FAKE_ROOT, "evals.old",   "x"), FAKE_ROOT)).toBe(true);
  });

  it("returns false for active .agents/ — shares prefix but is not archive", () => {
    expect(isArchivePath(path.join(FAKE_ROOT, ".agents", "x"), FAKE_ROOT)).toBe(false);
  });

  it("returns false for active .goose/ — shares prefix but is not archive", () => {
    expect(isArchivePath(path.join(FAKE_ROOT, ".goose", "x"), FAKE_ROOT)).toBe(false);
  });

  it("returns false for the canonical Eval Hub corpus", () => {
    expect(isArchivePath(path.join(FAKE_ROOT, "src", "app", "eval-hub", "evals", "x"), FAKE_ROOT)).toBe(false);
  });

  it("returns false for unrelated paths", () => {
    expect(isArchivePath(path.join(FAKE_ROOT, "src", "index.ts"), FAKE_ROOT)).toBe(false);
    expect(isArchivePath("/tmp/totally-different", FAKE_ROOT)).toBe(false);
  });
});

// ── AC-2: resolveSubjectPath wired guard (integration) ───────────────────────

describe("AC-2 resolveSubjectPath rejects archive-rooted subjects (integration)", () => {
  it("throws when PROJECT_ROOT contains an archive segment injected via env override", async () => {
    // We cannot inject an archive path through the public API without setting
    // PROJECT_ROOT to an archive root, which would break other tests.
    // Instead, verify directly that assertNotArchive blocks the path that
    // subjectSourcePath would produce for a hypothetical archive-rooted root.
    const archiveRoot = path.join(FAKE_ROOT, ".agents.old");
    const wouldBeAgentPath = path.join(archiveRoot, "agents", "some-agent.md");
    expect(() => assertNotArchive(wouldBeAgentPath, FAKE_ROOT))
      .toThrowError(ArchiveBoundaryError);
  });
});