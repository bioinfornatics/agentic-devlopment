import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const REPO = new URL("../../..", import.meta.url).pathname;

describe("pipeline CLI", () => {
  it("runs through a temporary audit snapshot without modifying repository knowledge", async () => {
    const memoryPath = join(REPO, ".knowledge", "memory.jsonl");
    const derivedPath = join(REPO, ".knowledge", "derived.jsonl");
    const before = await Promise.all([readFile(memoryPath), readFile(derivedPath)]);

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [join(REPO, "apps", "kg", "dist", "cli.js"), "pipeline"],
      { cwd: REPO },
    );

    const after = await Promise.all([readFile(memoryPath), readFile(derivedPath)]);
    expect(stderr).toBe("");
    expect(stdout).toMatch(/Bootstrap output: .*kg-pipeline-/);
    expect(after[0].equals(before[0])).toBe(true);
    expect(after[1].equals(before[1])).toBe(true);
  });
});
