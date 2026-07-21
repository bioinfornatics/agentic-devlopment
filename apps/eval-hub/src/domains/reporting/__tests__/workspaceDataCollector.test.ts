import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDataCollector } from "../workspaceDataCollector.js";

let root = "";
afterEach(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });

describe("WorkspaceDataCollector feedback resilience", () => {
  it("[EVAL-FB-01,05] skips malformed grading while retaining valid sibling evidence", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "eval-feedback-"));
    const base = path.join(root, "skills", "code-review", "hash");
    const valid = path.join(base, "eval-0", "with_skill", "run-1");
    const malformed = path.join(base, "eval-1", "without_skill", "run-1");
    await fs.mkdir(valid, { recursive: true });
    await fs.mkdir(malformed, { recursive: true });
    await fs.writeFile(path.join(valid, "grading.json"), JSON.stringify({ summary: { pass_rate: 0.5 }, expectations: [{ text: "emit verdict", passed: false, evidence: "missing" }] }));
    await fs.writeFile(path.join(malformed, "grading.json"), "{not-json");

    const snapshot = await new WorkspaceDataCollector(root).collect(["skills"]);

    expect(snapshot.results).toHaveLength(1);
    expect(snapshot.feedback).toMatchObject([{ subject: "code-review", expectation: "emit verdict", evidence: "missing" }]);
  });
});
