import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NormalizedIntegrityReportStateV2 } from "./domains/persistence/integrityV2Store.js";
import {
  BeadsCliValidationAdapter,
  buildGooseInterpretationPrompt,
  generateAndPersistInterpretation,
  GooseCliInterpretationRunner,
  persistHumanDecision,
  type BeadsValidationAdapter,
  type GooseInterpretationRunner,
} from "./gooseInterpretation.js";

const report: NormalizedIntegrityReportStateV2 = {
  schema: "eval-integrity-v2", manifestHash: "hash-1",
  pairMicro: { meanDeltaPp: 5, candidateMean: .55, baselineMean: .5, n: 2, interval: { method: "paired_t_95pct_pp_v1", lower: -1, upper: 11, reason: null } },
  subjectMacro: { meanDeltaPp: 5, candidateMean: .55, baselineMean: .5, n: 1, interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" } },
  validPairCount: 2, includedSubjectCount: 1, excludedPairCounts: {}, subjectFailureCounts: {},
};

class FakeGoose implements GooseInterpretationRunner {
  prompt = "";
  async generate(prompt: string): Promise<string> { this.prompt = prompt; return "A cautious explanation."; }
}
class FakeBeads implements BeadsValidationAdapter {
  calls: Parameters<BeadsValidationAdapter["persist"]>[0][] = [];
  async persist(input: Parameters<BeadsValidationAdapter["persist"]>[0]): Promise<void> { this.calls.push(input); }
}

describe("Goose report interpretation and human validation", () => {
  it("prompts only persisted report metrics and marks the proposal as non-authoritative", async () => {
    const runner = new FakeGoose();
    const beads = new FakeBeads();
    const output = await generateAndPersistInterpretation({ reports: [report], runId: "run-1", taskId: "task-1", gooseCli: "goose", provider: "provider-x", model: "model-y", runner, beads });
    expect(runner.prompt).toBe(buildGooseInterpretationPrompt([report]));
    expect(runner.prompt).not.toContain("task-1");
    expect(output).toContain("Généré par Goose (provider-x/model-y)");
    expect(output).toContain("Validation humaine obligatoire");
    expect(beads.calls[0]).toMatchObject({ state: "PENDING_HUMAN_VALIDATION", runId: "run-1", manifestHashes: ["hash-1"] });
  });

  it("gives Goose the complete evidence-bound diagnostic role and required ending", () => {
    const prompt = buildGooseInterpretationPrompt([report]);
    for (const required of [
      "Trust only the supplied persisted evidence", "failures and exclusions before successes",
      "observed facts separately from hypotheses", "exact evidence counts, artifact paths, and metrics",
      "max turns", "timeouts", "network/provider", "runtime dependencies", "grader invalidity", "bootstrap failures",
      "Do not invent", "do not rescore", "do not claim causality", "concise actionable conclusion",
      "Généré par Goose ... Validation humaine obligatoire.",
    ]) expect(prompt).toContain(required);
  });

  it("does not persist or alter the report when the provider fails", async () => {
    const beads = new FakeBeads();
    const runner: GooseInterpretationRunner = { generate: async () => { throw new Error("provider unavailable"); } };
    const snapshot = JSON.stringify(report);
    await expect(generateAndPersistInterpretation({ reports: [report], runId: "run-1", taskId: "task-1", gooseCli: "goose", provider: "p", model: "m", runner, beads })).rejects.toThrow("provider unavailable");
    expect(JSON.stringify(report)).toBe(snapshot);
    expect(beads.calls).toHaveLength(0);
  });

  it.each(["APPROVE", "BLOCK"] as const)("persists %s with run and manifest binding", async decision => {
    const beads = new FakeBeads();
    await persistHumanDecision({ decision, reports: [report], runId: "run-1", taskId: "task-1", beads });
    expect(beads.calls[0]).toMatchObject({ state: decision, runId: "run-1", manifestHashes: ["hash-1"] });
  });

  it.each(["APPROVE", "BLOCK"] as const)("binds multi-report PENDING and %s to the same ordered hash collection", async decision => {
    const second = { ...report, manifestHash: "hash-2" };
    const beads = new FakeBeads();
    await generateAndPersistInterpretation({ reports: [report, second], runId: "run-multi", taskId: "task-1", gooseCli: "goose", provider: "p", model: "m", runner: new FakeGoose(), beads });
    await persistHumanDecision({ decision, reports: [report, second], runId: "run-multi", taskId: "task-1", beads });
    expect(beads.calls).toEqual([
      expect.objectContaining({ state: "PENDING_HUMAN_VALIDATION", runId: "run-multi", manifestHashes: ["hash-1", "hash-2"] }),
      expect.objectContaining({ state: decision, runId: "run-multi", manifestHashes: ["hash-1", "hash-2"] }),
    ]);
  });

  it("persists multi-report bindings with an explicit collection schema and no singular hash", async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const adapter = new BeadsCliValidationAdapter({ run: async (command, args) => { calls.push({ command, args }); } });
    await adapter.persist({ taskId: "task-1", state: "PENDING_HUMAN_VALIDATION", runId: "run-multi", manifestHashes: ["hash-1", "hash-2"], comment: "pending" });
    expect(calls[0]?.args[2]).toContain('manifest_hashes=["hash-1","hash-2"]');
    expect(calls[1]?.args).toContain('run_id=run-multi manifest_hashes=["hash-1","hash-2"]');
    expect(calls[2]?.args).toEqual(expect.arrayContaining([
      "human_validation_manifest_binding_schema=ordered_hashes_v1",
      'human_validation_manifest_hashes=["hash-1","hash-2"]',
    ]));
    expect(calls[2]?.args.some(arg => arg.startsWith("human_validation_manifest_hash="))).toBe(false);
  });

  it("enforces the real child-process output cap", async () => {
    const script = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "eval-hub-test-")), "fake-goose.sh");
    await fs.writeFile(script, "#!/bin/sh\nprintf '%064d' 0\n", { mode: 0o700 });
    try {
      const output = await new GooseCliInterpretationRunner({ maxOutputChars: 32 }).generate("metrics", { gooseCli: script, provider: "p", model: "m" });
      expect(output.length).toBeLessThanOrEqual(32);
    } finally { await fs.rm(path.dirname(script), { recursive: true, force: true }); }
  });

  it("rejects the real child process when the configured timeout expires", async () => {
    const script = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "eval-hub-test-")), "fake-goose.sh");
    await fs.writeFile(script, "#!/bin/sh\nsleep 1\n", { mode: 0o700 });
    try {
      await expect(new GooseCliInterpretationRunner({ timeoutMs: 20 }).generate("metrics", { gooseCli: script, provider: "p", model: "m" })).rejects.toThrow(/timed out/i);
    } finally { await fs.rm(path.dirname(script), { recursive: true, force: true }); }
  });

  it("uses argument-safe Beads-compatible commands", async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const adapter = new BeadsCliValidationAdapter({ run: async (command, args) => { calls.push({ command, args }); } });
    await adapter.persist({ taskId: "task-1", state: "APPROVE", runId: "run-1", manifestHashes: ["hash-1"], comment: "approved" });
    expect(calls).toEqual([
      { command: "bd", args: ["comment", "task-1", "approved\nrun_id=run-1 manifest_hashes=[\"hash-1\"]"] },
      { command: "bd", args: ["set-state", "task-1", "human_validation=APPROVE", "--reason", `run_id=run-1 manifest_hashes=["hash-1"]`] },
      { command: "bd", args: ["update", "task-1", "--set-metadata", "human_validation_state=APPROVE", "--set-metadata", "human_validation_run_id=run-1", "--set-metadata", "human_validation_manifest_binding_schema=ordered_hashes_v1", "--set-metadata", `human_validation_manifest_hashes=["hash-1"]`, "--set-metadata", "human_validation_manifest_hash=hash-1"] },
    ]);
  });
});
