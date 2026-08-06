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

  it("[AC-EVAL-11] collects correlated runtime insights from ungraded layered executions", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "eval-runtime-insights-"));
    const run = path.join(root, "layered", "run-42", "agents", "planner", "hash", "eval-2", "repetition-0", "candidate");
    await fs.mkdir(run, { recursive: true });
    await fs.writeFile(path.join(run, "execution-result.json"), JSON.stringify({
      kind: "agents", subject: "planner", evalId: 2, treatmentId: "agent_l2", status: "failed",
    }));
    await fs.writeFile(path.join(run, "goose-log-analysis.json"), JSON.stringify({
      fatalDiagnostics: [{ code: "runtime_model_mismatch", message: "expected gpt-5.6-sol", source: "correlated-model-provenance" }],
      warnings: [], insights: ["Provider retries were observed."],
    }));

    const snapshot = await new WorkspaceDataCollector(root).collect(["agents"]);
    expect(snapshot.results).toEqual([]);
    expect(snapshot.runtimeInsights).toMatchObject([
      { runId: "run-42", subject: "planner", severity: "fatal", code: "runtime_model_mismatch", configuration: "agent_l2" },
      { runId: "run-42", subject: "planner", severity: "info", code: "runtime_observation" },
    ]);
    expect(snapshot.runtimeInsights[0]?.recommendation).toMatch(/frozen evaluation envelope/i);
  });
});
