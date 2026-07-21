import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pairedSubjectDelta } from "../layeredRunner.js";
import { ContentHasher } from "../../persistence/contentHash.js";
import { FsWorkspaceReader } from "../../persistence/workspaceReader.js";
import type { GradingRecord } from "../../persistence/ports.js";

const row = (evalId: number, config: string, score: number): GradingRecord => ({ evalId, config, run: 1, score, passed: score === 1 });
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("EVAL-INT-02/03 layered provenance and pairing", () => {
  it("uses only eval IDs present on both candidate and baseline", () => {
    const rows = [row(0, "with_agent", 1), row(0, "skills_only", .25), row(1, "with_agent", 1), row(2, "skills_only", 0)];
    expect(pairedSubjectDelta(rows, "with_agent", "skills_only")).toBe(.75);
  });

  it("returns null when no numeric pair exists", () => {
    expect(pairedSubjectDelta([row(0, "with_agent", 1)], "with_agent", "skills_only")).toBeNull();
  });

  it("reads grading evidence from an explicit layered hash directory", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-layered-provenance-"));
    const runDir = path.join(tempDir, "eval-0", "with_recipe", "run-1");
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "grading.json"), JSON.stringify({ summary: { pass_rate: .75 } }));

    const rows = await new FsWorkspaceReader().readGradingsAt(tempDir);
    expect(rows).toEqual([row(0, "with_recipe", .75)]);
  });

  it("changes content identity when only the eval scenario changes", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-scenario-hash-"));
    const source = path.join(tempDir, "subject.yaml");
    const scenario = path.join(tempDir, "subject.json");
    await fs.writeFile(source, "version: 1\n");
    await fs.writeFile(scenario, '[{"query":"before"}]');
    const hasher = new ContentHasher();
    const before = await hasher.hash([source, scenario]);
    await fs.writeFile(scenario, '[{"query":"after"}]');
    expect(await hasher.hash([source, scenario])).not.toBe(before);
  });
});
