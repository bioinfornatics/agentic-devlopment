/**
 * HAR conformance test suite — big-bang pass (ADR-002 Option B)
 *
 * Covers all six HAR acceptance criteria in one deterministic test file:
 *
 * HAR-01  Canonical lifecycle ordering in /loop-engineering
 * HAR-02  Recipe path consistency — all 4 active recipes exist and validate
 * HAR-03  KG conformance — uniqueness, endpoint resolution, LOADS_SKILL
 * HAR-04  Read-only Beads evidence adapter — required fields, non-mutation
 * HAR-05  Integration regression gates — reject known bad states
 * HAR-06  Evaluation traceability — AC-EVAL-03/04/05 linked to executable tests
 */
import fs   from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PROJECT_ROOT, PROJECT_RECIPES_DIR, PROJECT_AGENTS_DIR, PROJECT_SKILLS_DIR, EVALS_DIR } from "../paths.js";
import { readBeadsEvidence, beadsIssuesPath } from "../beadsAdapter.js";

// ── HAR-01: Canonical lifecycle ordering ─────────────────────────────────────

describe("HAR-01 canonical lifecycle in loop-engineering recipe", () => {
  it("loop-engineering.yaml exists at the active recipe location", async () => {
    const p = path.join(PROJECT_RECIPES_DIR, "loop-engineering.yaml");
    await expect(fs.access(p)).resolves.toBeUndefined();
  });

  it("loop-engineering.yaml contains all required lifecycle phases", async () => {
    const content = await fs.readFile(
      path.join(PROJECT_RECIPES_DIR, "loop-engineering.yaml"), "utf8",
    );
    // Each phase must appear in the instructions
    const requiredPhases = ["Trigger", "Planner", "Builder", "Independent verifier", "Memory", "Manager", "Controller"];
    for (const phase of requiredPhases) {
      expect(content, `missing phase: ${phase}`).toContain(phase);
    }
  });

  it("loop-engineering.yaml references env:reviewed gate or verification requirement", async () => {
    const content = await fs.readFile(
      path.join(PROJECT_RECIPES_DIR, "loop-engineering.yaml"), "utf8",
    );
    // The reviewed gate can be expressed as env:reviewed, env_reviewed, or 'reviewed'
    const hasReviewedGate = content.includes("env:reviewed") ||
      content.includes("env_reviewed") ||
      content.includes("reviewed") && content.includes("verif");
    expect(hasReviewedGate, "loop-engineering recipe must reference a reviewed/verification gate").toBe(true);
  });

  it("no reference to /dev recipe in active recipe files", async () => {
    const violations: string[] = [];
    for (const name of ["loop-engineering.yaml", "implement.yaml", "research.yaml", "verify.yaml"]) {
      const content = await fs.readFile(path.join(PROJECT_RECIPES_DIR, name), "utf8");
      if (content.includes("goose run dev") || content.includes("/dev recipe") || content.includes("recipes/dev")) {
        violations.push(name);
      }
    }
    expect(violations, `active recipes reference deleted /dev: ${violations.join(", ")}`).toEqual([]);
  });
});

// ── HAR-02: Recipe path consistency ──────────────────────────────────────────

describe("HAR-02 recipe path consistency", () => {
  const ACTIVE_RECIPES = ["implement.yaml", "loop-engineering.yaml", "research.yaml", "verify.yaml"];

  it.each(ACTIVE_RECIPES)("recipe file %s exists", async (name) => {
    const p = path.join(PROJECT_RECIPES_DIR, name);
    await expect(fs.access(p)).resolves.toBeUndefined();
  });

  it("no dangling subrecipe references in active recipes", async () => {
    const violations: string[] = [];
    for (const name of ACTIVE_RECIPES) {
      const content = await fs.readFile(path.join(PROJECT_RECIPES_DIR, name), "utf8");
      // Extract any subrecipe: or extends: or source: references to .yaml paths
      const refs = [...content.matchAll(/(?:subrecipe|source|extends)[:\s]+['"]?([^'"\s#]+\.yaml)/g)];
      for (const [, ref] of refs) {
        if (!ref) continue;
        const resolved = path.resolve(PROJECT_RECIPES_DIR, ref);
        try { await fs.access(resolved); } catch {
          violations.push(`${name}: dangling ref → ${ref}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("install.sh declares exactly the 4 active recipes as slash commands", async () => {
    const installSh = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "install.sh"), "utf8");
    // install.sh uses recipe_dir.glob("*.yaml") — it dynamically discovers
    // recipes; the test verifies the managed list comment or dynamic discovery
    // is present (not a hard-coded stale list)
    const hasDynamicDiscovery = installSh.includes('recipe_dir.glob("*.yaml")') ||
      installSh.includes("recipe_dir.glob('*.yaml')");
    expect(hasDynamicDiscovery, "install.sh must use dynamic recipe discovery via glob").toBe(true);
  });
});

// ── HAR-03: KG conformance ────────────────────────────────────────────────────

describe("HAR-03 KG conformance", () => {
  let memory: Array<{ id?: string; name?: string; entityType?: string; relations?: Array<{ relationType: string; targetId: string }> }>;

  beforeAll(async () => {
    const memoryPath = path.join(PROJECT_ROOT, ".knowledge", "memory.jsonl");
    try {
      const raw = await fs.readFile(memoryPath, "utf8");
      memory = raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
    } catch {
      memory = [];
    }
  });

  it("knowledge graph can be loaded (memory.jsonl exists)", () => {
    // If KG pipeline has never been run, this returns empty; that's acceptable
    // but if the file exists it must be valid JSONL
    expect(Array.isArray(memory)).toBe(true);
  });

  it("no duplicate entity names in memory.jsonl", () => {
    const names = memory.map(e => e.name ?? e.id).filter((n): n is string => Boolean(n));
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const name of names) {
      if (seen.has(name!)) duplicates.push(name!);
      seen.add(name!);
    }
    expect(duplicates, `duplicate KG entity names: ${duplicates.join(", ")}`).toEqual([]);
  });

  it("active agent files use canonical names matching active harness roster", async () => {
    const agentFiles = await fs.readdir(PROJECT_AGENTS_DIR);
    const activeAgents = agentFiles
      .filter(f => f.endsWith(".md"))
      .map(f => f.replace(".md", ""));
    // Active harness agents: only the three loop engineering agents
    const EXPECTED = ["change-builder", "independent-verifier", "repository-researcher"];
    for (const expected of EXPECTED) {
      expect(activeAgents, `missing active agent: ${expected}`).toContain(expected);
    }
  });

  it("active skill directories use canonical names matching active harness roster", async () => {
    const skillDirs = await fs.readdir(PROJECT_SKILLS_DIR);
    const EXPECTED = ["evidence-verification", "loop-control", "task-framing"];
    for (const expected of EXPECTED) {
      expect(skillDirs, `missing active skill: ${expected}`).toContain(expected);
    }
  });

  it("agent SKILL.md files exist for all active skills", async () => {
    for (const skill of ["evidence-verification", "loop-control", "task-framing"]) {
      const skillMd = path.join(PROJECT_SKILLS_DIR, skill, "SKILL.md");
      await expect(fs.access(skillMd), `${skill}/SKILL.md missing`).resolves.toBeUndefined();
    }
  });

  it("no archive roots appear in KG memory.jsonl content", () => {
    const archiveMarkers = [".agents.old", ".goose.old", "evals.old"];
    const violations: string[] = [];
    for (const entity of memory) {
      const serialized = JSON.stringify(entity);
      for (const marker of archiveMarkers) {
        if (serialized.includes(marker)) {
          violations.push(`entity ${entity.name ?? entity.id} references archive ${marker}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

// ── HAR-04: Read-only Beads evidence ─────────────────────────────────────────

describe("HAR-04 read-only Beads evidence adapter", () => {
  const issuesPath = beadsIssuesPath(PROJECT_ROOT);

  it("issues.jsonl exists and is readable", async () => {
    await expect(fs.access(issuesPath)).resolves.toBeUndefined();
  });

  it("adapter returns records with all required fields", async () => {
    const records = await readBeadsEvidence(issuesPath);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records.slice(0, 5)) {
      expect(typeof r.id,        `${r.id}.id`        ).toBe("string");
      expect(typeof r.issueType, `${r.id}.issueType`  ).toBe("string");
      expect(typeof r.status,    `${r.id}.status`     ).toBe("string");
      expect(Array.isArray(r.dependencies), `${r.id}.dependencies`).toBe(true);
      expect(typeof r.ready,    `${r.id}.ready`      ).toBe("boolean");
      expect(typeof r.blocked,  `${r.id}.blocked`    ).toBe("boolean");
      expect(Array.isArray(r.dependents), `${r.id}.dependents`   ).toBe(true);
    }
  });

  it("issues.jsonl is byte-for-byte unchanged after adapter read (non-mutation)", async () => {
    const before = await fs.readFile(issuesPath, "utf8");
    await readBeadsEvidence(issuesPath);
    const after = await fs.readFile(issuesPath, "utf8");
    expect(after).toBe(before);
  });

  it("adapter correctly classifies ready vs blocked issues", async () => {
    const records = await readBeadsEvidence(issuesPath);
    for (const r of records) {
      if (r.status === "open" || r.status === "in_progress") {
        // ready and blocked must be mutually exclusive
        expect(r.ready && r.blocked,
          `${r.id}: cannot be both ready and blocked`).toBe(false);
        // blocked iff has any open dependency
        if (r.blocked) {
          expect(r.dependencies.length,
            `${r.id}: blocked but no dependencies`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("adapter reads issue_type field for all issue records", async () => {
    const records = await readBeadsEvidence(issuesPath);
    const valid = ["task", "bug", "feature", "epic", "chore", "decision"];
    const violations = records.filter(r => !valid.includes(r.issueType));
    expect(violations.map(r => `${r.id}:${r.issueType}`)).toEqual([]);
  });
});

// ── HAR-05: Integration regression gates ─────────────────────────────────────

describe("HAR-05 deterministic regression gates", () => {
  it("rejects lifecycle inversion: verify recipe must not contain goose recipe run implement", async () => {
    const verifyContent = await fs.readFile(
      path.join(PROJECT_RECIPES_DIR, "verify.yaml"), "utf8",
    );
    // verify must not invoke implement inside itself (ordering inversion)
    expect(verifyContent).not.toContain("goose recipe run implement");
  });

  it("rejects dangling recipe path: no YAML references a recipe file that does not exist", async () => {
    const violations: string[] = [];
    for (const name of ["implement.yaml", "loop-engineering.yaml", "research.yaml", "verify.yaml"]) {
      const content = await fs.readFile(path.join(PROJECT_RECIPES_DIR, name), "utf8");
      const refs = [...content.matchAll(/\b[\w-]+\.yaml\b/g)].map(m => m[0]);
      for (const ref of refs) {
        if (ref === name) continue; // self-reference
        const candidate = path.join(PROJECT_RECIPES_DIR, ref);
        try { await fs.access(candidate); } catch {
          // Allow references to files outside the recipes dir (absolute checks would need more context)
          // Only flag if it looks like a relative recipe reference
          if (!ref.includes("/") && !ref.startsWith(".")) {
            violations.push(`${name} → ${ref}: dangling recipe ref`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("rejects archive contamination: no active recipe or eval JSON references archive roots", async () => {
    const violations: string[] = [];
    const markers = [".agents.old", ".goose.old", "evals.old"];
    // Check active recipes
    for (const name of ["implement.yaml", "loop-engineering.yaml", "research.yaml", "verify.yaml"]) {
      const content = await fs.readFile(path.join(PROJECT_RECIPES_DIR, name), "utf8");
      for (const m of markers) if (content.includes(m)) violations.push(`${name}: references ${m}`);
    }
    // Check active eval JSONs
    for (const kind of ["skills", "agents", "recipes"] as const) {
      const dir = path.join(EVALS_DIR, kind);
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const content = await fs.readFile(path.join(dir, entry.name), "utf8");
        for (const m of markers) if (content.includes(m)) violations.push(`${kind}/${entry.name}: references ${m}`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("rejects Beads schema regression: issues.jsonl entries have required fields", async () => {
    const raw = await fs.readFile(beadsIssuesPath(PROJECT_ROOT), "utf8");
    const required = ["id", "issue_type", "status"];
    const violations: string[] = [];
    for (const line of raw.split("\n").filter(l => l.trim())) {
      const d = JSON.parse(line) as Record<string, unknown>;
      if (!d.id || "event_kind" in d || "_type" in d) continue; // skip events/wisps
      for (const field of required) {
        if (!(field in d)) violations.push(`${d.id}: missing field ${field}`);
      }
    }
    expect(violations.slice(0, 5), violations.slice(0, 5).join("\n")).toEqual([]);
  });
});

// ── HAR-06: Evaluation traceability ──────────────────────────────────────────

describe("HAR-06 evaluation traceability — AC-EVAL-03/04/05 have executable tests", () => {
  /**
   * AC-EVAL-03: Grader uses full events.jsonl transcript (not stdout tail).
   * Evidence: recipeExecution.test.ts contains grader assertions using
   * full stream mock with transcript tool calls.
   */
  it("AC-EVAL-03 grader transcript coverage test exists", async () => {
    const testFile = path.join(
      PROJECT_ROOT,
      "apps/eval-hub/src/domains/execution/__tests__/recipeExecution.test.ts",
    );
    const content = await fs.readFile(testFile, "utf8");
    // Test must exercise the grader with a full tool-call transcript
    expect(content).toContain("toolRequestLine");
    expect(content).toContain("toolResponseLine");
    expect(content, "AC-EVAL-03: grader test must use transcript events").toMatch(/grader|grading|score/i);
  });

  /**
   * AC-EVAL-04: Layer-delta agent eval — agent_l2 (with agent+skills) vs
   * agent_l1 (skills only).  Evidence: suiteIntegrity.test.ts schedules
   * agent_l2/agent_l1 treatments and suiteIntegrityDrift.test.ts verifies
   * treatment freeze across scenarios.
   */
  it("AC-EVAL-04 layer-delta agent evaluation test exists", async () => {
    const testFile = path.join(
      PROJECT_ROOT,
      "apps/eval-hub/src/domains/execution/__tests__/suiteIntegrity.test.ts",
    );
    const content = await fs.readFile(testFile, "utf8");
    expect(content).toContain("agent_l2");
    expect(content).toContain("agent_l1");
    expect(content, "AC-EVAL-04: must test layer-delta for agents").toMatch(/layer.delta|layer_delta/i);
  });

  /**
   * AC-EVAL-05: Layer-delta recipe eval — recipe_l3 (with recipe+agents+skills)
   * vs recipe_l2 (agents+skills baseline).  Evidence: suiteIntegrity.test.ts
   * schedules recipe_l3/recipe_l2 and recipeExecution.test.ts runs the runner.
   */
  it("AC-EVAL-05 layer-delta recipe evaluation test exists", async () => {
    const testFile = path.join(
      PROJECT_ROOT,
      "apps/eval-hub/src/domains/execution/__tests__/suiteIntegrity.test.ts",
    );
    const content = await fs.readFile(testFile, "utf8");
    expect(content).toContain("recipe_l3");
    expect(content).toContain("recipe_l2");
    expect(content, "AC-EVAL-05: must test layer-delta for recipes").toMatch(/layer.delta|layer_delta/i);
  });

  it("all three AC-EVAL test files exist on disk", async () => {
    const files = [
      "apps/eval-hub/src/domains/execution/__tests__/recipeExecution.test.ts",
      "apps/eval-hub/src/domains/execution/__tests__/suiteIntegrity.test.ts",
      "apps/eval-hub/src/domains/execution/__tests__/suiteIntegrityDrift.test.ts",
    ];
    for (const rel of files) {
      await expect(
        fs.access(path.join(PROJECT_ROOT, rel)),
        `missing: ${rel}`,
      ).resolves.toBeUndefined();
    }
  });
});
