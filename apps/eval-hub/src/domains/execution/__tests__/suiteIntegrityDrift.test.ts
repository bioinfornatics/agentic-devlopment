/**
 * RED tests: manifest-frozen treatment definitions and fixture hashes cannot drift
 * during execution.
 *
 * EVAL-INT-04/05/11/19 — SuiteRunner must execute ONLY manifest-frozen values:
 *  - Treatment definitions (incl. bootstrap bytes) must match what was planned
 *    for every scenario / evalId, not be rebuilt from per-scenario skill arrays.
 *  - Fixture hashes in runCfg must equal the manifest-frozen hashes even after
 *    the source file is mutated between planning and later execution calls.
 *
 * These tests are RED with the current code (buildTreatmentPair rebuilt per-scenario
 * in run(); materializeFixtures() recomputes hashes from disk) and GREEN once
 * execution uses manifest-frozen values exclusively.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SuiteRunner } from "../suiteRunner.js";
import type { IEvalRunner, IEventSink, ScenarioRunConfig } from "../ports.js";
import type { EvalEvent } from "../../../shared/events.js";
import { treatmentContentHash } from "../executionIntegrity.js";
import { ContentHasher } from "../../persistence/contentHash.js";
import { PROJECT_ROOT } from "../../../shared/paths.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

class CapturingEvalRunner implements IEvalRunner {
  readonly calls: ScenarioRunConfig[] = [];
  async *run(config: ScenarioRunConfig, _sink?: IEventSink): AsyncGenerator<EvalEvent> {
    this.calls.push(config);
  }
}

/**
 * Mutates a fixture file after the very first IEvalRunner call so later calls
 * see a different file on disk — used to prove recomputed hashes would drift.
 */
class MutatingEvalRunner implements IEvalRunner {
  readonly calls: ScenarioRunConfig[] = [];
  private mutated = false;
  constructor(private readonly fixturePath: string) {}
  async *run(config: ScenarioRunConfig, _sink?: IEventSink): AsyncGenerator<EvalEvent> {
    this.calls.push(config);
    if (!this.mutated) {
      this.mutated = true;
      // Mutate after capturing call[0] so subsequent calls see changed content on disk
      await fs.writeFile(this.fixturePath, `mutated-after-first-call-${Date.now()}`);
    }
  }
}

const roots: string[] = [];
const tempFiles: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(r => fs.rm(r, { recursive: true, force: true })));
  await Promise.all(tempFiles.splice(0).map(f => fs.rm(f, { force: true })));
});

// Minimal test runtime that avoids a real Goose process
const testRuntime = {
  identity: async () => ({ version: "test-1.0.0", provider: "test-provider", model: "test-model" }),
};

// ── Treatment drift tests ─────────────────────────────────────────────────────

describe("EVAL-INT-04/05/19 — treatment drift: manifest-frozen treatment used for all evalIds", () => {
  it("multi-scenario agent subject with different per-scenario skills: all calls carry manifest-frozen treatment hash", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-drift-agent-"));
    roots.push(workspace);

    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      runtime: testRuntime,
      evalHubRuntimeVersion: () => "eval-hub-test-1.0.0",
      runProvenanceId: () => "drift-agent-provenance",
      // scenario[0].skills = ["ux-quality"]
      // scenario[1].skills = ["ux-quality", "code-review"]  ← extra skill → different hash if rebuilt
      scenariosOverride: new Map([
        ["ux-researcher", [
          { query: "task A", skills: ["ux-quality"],              agents: [], expected_behavior: ["b1"] },
          { query: "task B", skills: ["ux-quality", "code-review"], agents: [], expected_behavior: ["b2"] },
        ]],
      ]),
    });

    for await (const _ of suite.run({
      kind: "agents", subjects: ["ux-researcher"], workspace,
      gooseCli: "goose", workers: 1, mode: "layer-delta",
      maxTurns: 8, timeoutMs: 5_000, ambient: false,
      continueOnFail: false, repetitions: 1,
    })) {}

    const manifestBytes = await fs.readFile(
      path.join(workspace, "_integrity-v2", "agents", "manifest.json"), "utf8",
    );
    const manifest = JSON.parse(manifestBytes) as {
      treatments: Array<{ id: string; subject: string; definitionHash: string }>;
    };

    // We expect 2 scenarios × 1 rep × 2 treatments = 4 calls
    expect(fake.calls.length).toBe(4);

    // EVAL-INT-04/05/19: every call's treatment must match the manifest-frozen definitionHash.
    // RED: evalId=1 calls are built with scenario.skills=["ux-quality","code-review"]
    //      → treatmentContentHash differs from the manifest's planned hash (firstScenario skills).
    for (const call of fake.calls) {
      const frozen = manifest.treatments.find(
        t => t.id === call.config && t.subject === call.subject,
      );
      expect(frozen, `manifest missing treatment entry for config=${call.config} subject=${call.subject}`).toBeDefined();
      expect(
        treatmentContentHash(call.treatment),
        `evalId=${call.evalId} config=${call.config}: treatment drifted from manifest-frozen definitionHash`,
      ).toBe(frozen!.definitionHash);
    }
  });

  it("multi-scenario recipe subject with different per-scenario declared skills: all calls carry manifest-frozen treatment hash", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-drift-recipe-"));
    roots.push(workspace);

    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      runtime: testRuntime,
      evalHubRuntimeVersion: () => "eval-hub-test-1.0.0",
      runProvenanceId: () => "drift-recipe-provenance",
      // recipe_l2 baseline uses declared skills — if rebuilt per-scenario, the definition drifts
      scenariosOverride: new Map([
        ["dev", [
          { query: "task A", skills: ["beads"],        agents: [], expected_behavior: ["b1"], recipe_source_type: "top_level" },
          { query: "task B", skills: ["beads", "sdd"], agents: [], expected_behavior: ["b2"], recipe_source_type: "top_level" },
        ]],
      ]),
    });

    for await (const _ of suite.run({
      kind: "recipes", subjects: ["dev"], workspace,
      gooseCli: "goose", workers: 1, mode: "layer-delta",
      maxTurns: 8, timeoutMs: 5_000, ambient: false,
      continueOnFail: false, repetitions: 1,
    })) {}

    const manifestBytes = await fs.readFile(
      path.join(workspace, "_integrity-v2", "recipes", "manifest.json"), "utf8",
    );
    const manifest = JSON.parse(manifestBytes) as {
      treatments: Array<{ id: string; subject: string; definitionHash: string }>;
    };

    expect(fake.calls.length).toBe(4);

    // EVAL-INT-04/05/19: recipe_l2 baseline definition embeds declared skills — drift if rebuilt
    for (const call of fake.calls) {
      const frozen = manifest.treatments.find(
        t => t.id === call.config && t.subject === call.subject,
      );
      expect(frozen, `manifest missing treatment entry for config=${call.config}`).toBeDefined();
      expect(
        treatmentContentHash(call.treatment),
        `evalId=${call.evalId} config=${call.config}: recipe treatment drifted from manifest-frozen definitionHash`,
      ).toBe(frozen!.definitionHash);
    }
  });
});

// ── Fixture drift test ────────────────────────────────────────────────────────

describe("EVAL-INT-01/05/11 — fixture drift: runCfg fixtureHashes equal manifest plan after file mutation", () => {
  it("fixture hash in every runCfg call equals the manifest-frozen hash even after the source file is mutated", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-drift-fixture-"));
    roots.push(workspace);

    // Create a fixture file within PROJECT_ROOT (required by path-escape check).
    // ContentHasher hashes path+content, so we use it for comparison rather
    // than a raw SHA256 of content alone.
    const relFixturePath = path.join(
      "apps", "eval-hub", "src", "domains", "execution", "__tests__",
      `drift-fixture-${Date.now()}.txt`,
    );
    const absFixturePath = path.join(PROJECT_ROOT, relFixturePath);
    await fs.writeFile(absFixturePath, "original-fixture-content");
    tempFiles.push(absFixturePath);

    // Compute the planned hash using the same ContentHasher the runner uses.
    const plannedHash = await new ContentHasher().hash([absFixturePath]);

    // MutatingEvalRunner: on call[0] it mutates the source file;
    // calls[1..] see different disk content if fixtureHashes are recomputed.
    const mutatingRunner = new MutatingEvalRunner(absFixturePath);
    const suite = new SuiteRunner(mutatingRunner, {
      runtime: testRuntime,
      evalHubRuntimeVersion: () => "eval-hub-test-1.0.0",
      runProvenanceId: () => "drift-fixture-provenance",
      // Two scenarios both referencing the same fixture — gives ≥2 calls per treatment
      scenariosOverride: new Map([
        ["ux-researcher", [
          { query: "task A", skills: ["ux-quality"], agents: [], expected_behavior: ["b1"], files: [relFixturePath] },
          { query: "task B", skills: ["ux-quality"], agents: [], expected_behavior: ["b2"], files: [relFixturePath] },
        ]],
      ]),
    });

    for await (const _ of suite.run({
      kind: "agents", subjects: ["ux-researcher"], workspace,
      gooseCli: "goose", workers: 1, mode: "layer-delta",
      maxTurns: 8, timeoutMs: 5_000, ambient: false,
      continueOnFail: false, repetitions: 1,
    })) {}

    // Sanity: mutation actually happened
    const mutatedContent = await fs.readFile(absFixturePath, "utf8");
    expect(mutatedContent).toMatch(/^mutated-after-first-call-/);

    // Sanity: mutated file now hashes differently → proves recomputing would drift
    const mutatedHash = await new ContentHasher().hash([absFixturePath]);
    expect(mutatedHash).not.toBe(plannedHash);

    // Manifest must record the planned (original) hash
    const manifestBytes = await fs.readFile(
      path.join(workspace, "_integrity-v2", "agents", "manifest.json"), "utf8",
    );
    const manifest = JSON.parse(manifestBytes) as { fixtureHashes: Record<string, string> };
    expect(manifest.fixtureHashes[relFixturePath]).toBe(plannedHash);

    // At least call[0] (pre-mutation) and calls[1..] (post-mutation on disk) must exist
    expect(mutatingRunner.calls.length).toBeGreaterThan(1);

    // EVAL-INT-01/05/11: ALL calls must carry the manifest-frozen hash, not recomputed.
    // RED: after mutation, materializeFixtures() recomputes from disk → call[1+] drift.
    for (const call of mutatingRunner.calls) {
      expect(
        call.fixtureHashes[relFixturePath],
        `call[${mutatingRunner.calls.indexOf(call)}]: fixtureHashes drifted after mutation — expected manifest-frozen ${plannedHash}, got ${call.fixtureHashes[relFixturePath]}`,
      ).toBe(plannedHash);
    }
  });
});
