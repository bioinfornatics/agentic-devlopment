import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeGooseLogs, gooseLogCaptureForWorkspace } from "../gooseLogAnalyzer.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<{ workspace: string; logsRoot: string }> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "eval-goose-logs-"));
  roots.push(workspace);
  const capture = gooseLogCaptureForWorkspace(workspace);
  await fs.mkdir(path.join(capture.logsRoot, "cli", "2026-07-23"), { recursive: true });
  return { workspace, logsRoot: capture.logsRoot };
}

describe("AC-EVAL-11 correlated Goose log analysis", () => {
  it("isolates every execution below its workspace instead of reading concurrent global logs", async () => {
    const left = await fixture();
    const right = await fixture();
    expect(left.logsRoot).not.toBe(right.logsRoot);
    expect(gooseLogCaptureForWorkspace(left.workspace).stateHome).toBe(path.join(left.workspace, ".goose-state"));

    await fs.writeFile(path.join(left.logsRoot, "llm_request.0.jsonl"), [
      JSON.stringify({ model_config: { model_name: "gpt-5.6-sol" }, input: { input: [{ content: "PRIVATE_PROMPT_LEFT" }] } }),
      JSON.stringify({ data: { id: "event-1" }, usage: { input_tokens: 90, output_tokens: 10, total_tokens: 100 } }),
      JSON.stringify({ data: { usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } } }),
    ].join("\n"));
    await fs.writeFile(path.join(right.logsRoot, "llm_request.0.jsonl"), [
      JSON.stringify({ model_config: { model_name: "other-model" }, input: { input: [{ content: "PRIVATE_PROMPT_RIGHT" }] } }),
      JSON.stringify({ usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 } }),
    ].join("\n"));

    const [leftAnalysis, rightAnalysis] = await Promise.all([
      analyzeGooseLogs(left.logsRoot), analyzeGooseLogs(right.logsRoot),
    ]);
    expect(leftAnalysis.observed.models).toEqual(["gpt-5.6-sol"]);
    expect(leftAnalysis.observed.totalTokens).toBe(120);
    expect(rightAnalysis.observed.models).toEqual(["other-model"]);
    expect(JSON.stringify(leftAnalysis)).not.toContain("PRIVATE_PROMPT_LEFT");
    expect(JSON.stringify(leftAnalysis)).not.toContain("PRIVATE_PROMPT_RIGHT");
  });

  it("fails provenance when Goose used a model other than the frozen envelope", async () => {
    const { logsRoot } = await fixture();
    await fs.writeFile(path.join(logsRoot, "llm_request.0.jsonl"), JSON.stringify({
      model_config: { model_name: "unexpected-model" }, input: { model: "unexpected-model" },
    }));
    const analysis = await analyzeGooseLogs(logsRoot, "gpt-5.6-sol");
    expect(analysis.fatalDiagnostics).toMatchObject([{
      code: "runtime_model_mismatch", severity: "fatal", source: "correlated-model-provenance",
    }]);
  });

  it("extracts bounded operational diagnostics, retries, tools, and token insights", async () => {
    const { logsRoot } = await fixture();
    const cli = path.join(logsRoot, "cli", "2026-07-23", "run.log");
    await fs.writeFile(cli, [
      { timestamp: "2026-07-23T05:00:00Z", level: "INFO", fields: { message: "Using model: gpt-5.6-sol" }, target: "goose_cli" },
      { timestamp: "2026-07-23T05:00:01Z", level: "INFO", fields: { message: "Backing off for 936ms before retry" }, target: "goose_providers::retry" },
      { timestamp: "2026-07-23T05:00:02Z", level: "INFO", fields: { message: "Tool call completed", tool_name: "load", result: "success" }, target: "goose_cli" },
      { timestamp: "2026-07-23T05:00:03Z", level: "ERROR", fields: { message: "DeploymentNotFound: API deployment gpt-5.6-sol does not exist" }, target: "provider" },
      { timestamp: "2026-07-23T05:00:04Z", level: "INFO", fields: { message: "Session completed", duration_ms: 42, total_tokens: 120, message_count: 2 }, target: "goose_cli" },
    ].map(value => JSON.stringify(value)).join("\n"));

    const analysis = await analyzeGooseLogs(logsRoot);
    expect(analysis.status).toBe("complete");
    expect(analysis.observed).toMatchObject({ retries: 1, toolCalls: 1, toolFailures: 0, durationMs: 42 });
    expect(analysis.fatalDiagnostics).toHaveLength(1);
    expect(analysis.fatalDiagnostics[0]).toMatchObject({ code: "provider_deployment_missing", severity: "fatal" });
    expect(analysis.insights.join(" ")).toMatch(/retries/i);
    expect(analysis.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("degrades gracefully when the Goose log directory is missing", async () => {
    const root = path.join(os.tmpdir(), "missing-goose-logs-" + Date.now());
    const analysis = await analyzeGooseLogs(root);
    expect(analysis).toMatchObject({ status: "unavailable", files: [], fatalDiagnostics: [] });
    expect(analysis.insights.join(" ")).toMatch(/not available/i);
  });
});
