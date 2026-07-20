import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FsWorkspaceReader } from "../workspaceReader.js";
import { DIST_EVALS } from "../../../shared/paths.js";

const subject = "__reader-pass-rate-fixture__";
const hash = "hash123";
const root = path.join(DIST_EVALS, "skills", subject);

describe("FsWorkspaceReader.readGradings", () => {
  beforeEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("reads nested grading summary.pass_rate and skips null grader results", async () => {
    const withDir = path.join(root, hash, "eval-0", "with_skill", "run-1");
    const withoutDir = path.join(root, hash, "eval-0", "without_skill", "run-1");
    const nullDir = path.join(root, hash, "eval-1", "with_skill", "run-1");
    await fs.mkdir(withDir, { recursive: true });
    await fs.mkdir(withoutDir, { recursive: true });
    await fs.mkdir(nullDir, { recursive: true });
    await fs.writeFile(path.join(withDir, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.75 }, expectations: [] }));
    await fs.writeFile(path.join(withoutDir, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.25 }, expectations: [] }));
    await fs.writeFile(path.join(nullDir, "grading.json"), JSON.stringify({ summary: { pass_rate: null }, expectations: [] }));

    const rows = await new FsWorkspaceReader().readGradings("skills", subject, hash);

    expect(rows).toHaveLength(2);
    expect(rows.map(r => [r.config, r.score])).toEqual([["with_skill", 0.75], ["without_skill", 0.25]]);
  });
});
