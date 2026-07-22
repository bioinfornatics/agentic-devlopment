import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SuiteRunner } from "../suiteRunner.js";
import type { IEvalRunner, IEventSink, ScenarioRunConfig } from "../ports.js";
import type { EvalEvent } from "../../../shared/events.js";
import { INTEGRITY_SCHEMA_V2 } from "../../persistence/integrityV2Store.js";
import { hashUtf8, treatmentContentHash } from "../executionIntegrity.js";
import { PROJECT_ROOT } from "../../../shared/paths.js";

class CapturingEvalRunner implements IEvalRunner {
  readonly calls: ScenarioRunConfig[] = [];
  readonly manifestSnapshots: string[] = [];

  async *run(config: ScenarioRunConfig, _sink?: IEventSink): AsyncGenerator<EvalEvent> {
    this.calls.push(config);
    this.manifestSnapshots.push(await fs.readFile(path.join(config.integrity.root, "manifest.json"), "utf8"));
  }
}

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  throw new TypeError("unsupported JSON value");
}

const sha256 = (bytes: string): string => crypto.createHash("sha256").update(bytes, "utf8").digest("hex");

describe("EVAL-INT-01/03/04/05/11/15/19/20 SuiteRunner v2 planning boundary", () => {
  it("freezes a per-layer manifest with exact planned task bytes before the first eval runner call", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-integrity-v2-"));
    roots.push(workspace);
    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      runtime: { identity: async () => ({ version: "goose-test-1.2.3", provider: "test-provider", model: "test-model" }) },
      evalHubRuntimeVersion: () => "eval-hub-test-9.9.9",
      runProvenanceId: () => "run-provenance-test",
    });

    for await (const _event of suite.run({
      kind: "skills",
      subjects: ["atomic-design"],
      workspace,
      gooseCli: "goose-test",
      workers: 1,
      mode: "with-without",
      maxTurns: 8,
      timeoutMs: 12_000,
      ambient: false,
      continueOnFail: false,
      repetitions: 2,
    })) {}

    // EVAL-INT-11/20: the immutable v2 manifest exists before any IEvalRunner call.
    expect(fake.calls.length).toBeGreaterThan(0);
    expect(fake.manifestSnapshots.length).toBe(fake.calls.length);
    expect(new Set(fake.manifestSnapshots).size).toBe(1);

    const manifestPath = path.join(workspace, "_integrity-v2", "skills", "manifest.json");
    const manifestBytes = await fs.readFile(manifestPath, "utf8");
    expect(fake.manifestSnapshots[0]).toBe(manifestBytes);
    const manifestHash = sha256(manifestBytes);
    await expect(fs.readFile(path.join(workspace, "_integrity-v2", "skills", "manifest.sha256"), "utf8"))
      .resolves.toBe(`${manifestHash}\n`);

    const manifest = JSON.parse(manifestBytes) as {
      schema: string;
      runProvenanceId: string;
      cliArguments: readonly string[];
      subjects: ReadonlyArray<{ kind: string; subject: string; sourceHash: string; evalIds: readonly number[] }>;
      repetitions: number;
      treatments: ReadonlyArray<{ id: string; kind: string; subject: string; side: string; definitionHash: string; bootstrapHash: string }>;
      taskPayloadHashes: Record<string, string>;
      fixtureHashes: Record<string, string>;
      executionEnvelope: { provider: string; model: string; gooseRuntimeVersion: string; evalHubRuntimeVersion: string; timeBudgetMs: number | null; tokenBudget: number | null; decoding: { temperature: number | null; seed: number | null } };
      grader: { id: string; version: string };
      rubric: { id: string; version: string };
    };
    expect(canonicalize(manifest)).toBe(manifestBytes);
    expect(manifest.schema).toBe(INTEGRITY_SCHEMA_V2);
    expect(manifest.runProvenanceId).toBe("run-provenance-test");
    expect(manifest.cliArguments).toEqual(["kind=skills", "subjects=atomic-design", "mode=with-without", "repetitions=2", "maxTurns=8", "timeoutMs=12000", "ambient=false"]);

    // EVAL-INT-05: source/eval identity is recorded from the planned subject under this run.
    expect(manifest.subjects).toEqual([{ kind: "skills", subject: "atomic-design", sourceHash: expect.any(String), evalIds: [0, 1, 2] }]);
    expect(manifest.subjects[0]?.sourceHash).toHaveLength(16);
    expect(manifest.repetitions).toBe(2);

    // EVAL-INT-19: treatment IDs/sides and bootstrap hashes are deterministic and layer-typed.
    expect(manifest.treatments.map(treatment => [treatment.id, treatment.side])).toEqual([
      ["skill_l1", "candidate"],
      ["skill_l0", "baseline"],
    ]);
    expect(manifest.treatments.map(treatment => treatment.definitionHash)).toEqual([expect.any(String), expect.any(String)]);
    expect(manifest.treatments.map(treatment => treatment.bootstrapHash)).toEqual([
      hashUtf8("load skill: atomic-design"),
      hashUtf8(""),
    ]);

    // EVAL-INT-01/11: runtime identity and budgets are probed during planning.
    expect(manifest.executionEnvelope).toEqual({
      provider: "test-provider",
      model: "test-model",
      decoding: { temperature: null, seed: null },
      timeBudgetMs: 12_000,
      tokenBudget: null,
      gooseRuntimeVersion: "goose-test-1.2.3",
      evalHubRuntimeVersion: "eval-hub-test-9.9.9",
    });

    // EVAL-INT-15: grader/rubric descriptors and expected criterion IDs are deterministic.
    expect(manifest.grader).toEqual({ id: "llm-grader", version: "v1" });
    expect(manifest.rubric).toEqual({ id: "expected_behavior_index", version: "v1" });

    const firstCall = fake.calls[0]!;
    expect(firstCall.plannedTaskPayload).toContain("Classify the UI elements described in the KG visualizer README");
    expect(firstCall.plannedTaskPayloadHash).toBe(hashUtf8(firstCall.plannedTaskPayload));
    expect(manifest.taskPayloadHashes["skills/atomic-design/0"]).toBe(firstCall.plannedTaskPayloadHash);
    expect(firstCall.integrity).toEqual({
      schema: INTEGRITY_SCHEMA_V2,
      root: path.join(workspace, "_integrity-v2", "skills"),
      manifestHash,
      runProvenanceId: "run-provenance-test",
      side: "candidate",
      candidateTreatmentId: "skill_l1",
      baselineTreatmentId: "skill_l0",
      candidateTreatmentHash: manifest.treatments[0]!.definitionHash,
      baselineTreatmentHash: manifest.treatments[1]!.definitionHash,
      grader: { id: "llm-grader", version: "v1" },
      rubric: { id: "expected_behavior_index", version: "v1", expectedCriterionIds: ["expected_behavior[0]", "expected_behavior[1]", "expected_behavior[2]", "expected_behavior[3]"] },
    });

    const evalZeroCalls = fake.calls.filter(call => call.evalId === 0);
    expect(evalZeroCalls).toHaveLength(4);
    expect(evalZeroCalls.map(call => [call.repetition, call.integrity.side, call.config])).toEqual([
      [0, "candidate", "skill_l1"],
      [0, "baseline", "skill_l0"],
      [1, "baseline", "skill_l0"],
      [1, "candidate", "skill_l1"],
    ]);
    expect(new Set(evalZeroCalls.map(call => call.plannedTaskPayloadHash))).toEqual(new Set([manifest.taskPayloadHashes["skills/atomic-design/0"]]));
  });
});

describe("EVAL-INT-PLAN plan() row contract — exact treatment and fixture hashes", () => {
  it("every plan row carries the manifest-frozen treatment definitionHash and fixtureHash", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-plan-contract-"));
    roots.push(workspace);

    const fixtureName = `plan-contract-${Date.now()}.txt`;
    const relFixturePath = `apps/eval-hub/src/domains/execution/__tests__/${fixtureName}`;
    const absFixturePath = path.join(PROJECT_ROOT, relFixturePath);
    await fs.writeFile(absFixturePath, "fixture-bytes");
    roots.push(absFixturePath);

    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      runtime: { identity: async () => ({ version: "test-1", provider: "p", model: "m" }) },
      scenariosOverride: new Map([
        ["atomic-design", [
          { query: "q", skills: [], agents: [], expected_behavior: ["b"], files: [relFixturePath] },
        ]],
      ]),
    });
    const plan = await suite.plan({
      kind: "skills", subjects: ["atomic-design"], workspace, gooseCli: "goose",
      workers: 1, mode: "with-without", maxTurns: 8, timeoutMs: 1_000,
      ambient: false, continueOnFail: false, repetitions: 1,
    });

    // plan() must not call evalRunner
    expect(fake.calls).toHaveLength(0);
    expect(plan.rows.length).toBeGreaterThan(0);

    const manifestBytes = await fs.readFile(
      path.join(workspace, "_integrity-v2", "skills", "manifest.json"), "utf8",
    );
    const manifestHash = sha256(manifestBytes);
    expect(plan.manifestHash).toBe(manifestHash);

    const manifest = JSON.parse(manifestBytes) as {
      treatments: Array<{ id: string; definitionHash: string }>;
      fixtureHashes: Record<string, string>;
    };

    for (const row of plan.rows) {
      const frozen = manifest.treatments.find(t => t.id === row.runCfg.config);
      expect(frozen, `manifest missing treatment for config=${row.runCfg.config}`).toBeDefined();
      // EVAL-INT-04/05/19: exact manifest-frozen treatment hash in every row
      expect(
        treatmentContentHash(row.runCfg.treatment),
        `evalId=${row.evalId} config=${row.runCfg.config}: treatment hash drifted from manifest`,
      ).toBe(frozen!.definitionHash);
      // EVAL-INT-01/05/11: exact manifest-frozen fixture hash in every row
      expect(
        row.runCfg.fixtureHashes[relFixturePath],
        `evalId=${row.evalId}: fixture hash missing or drifted`,
      ).toBe(manifest.fixtureHashes[relFixturePath]);
    }
  });

  it("runPlan() throws input_mismatch with zero evalRunner calls when fixture mutated after plan()", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "suite-plan-drift-v2-"));
    roots.push(workspace);

    const fixtureName = `plan-drift-v2-${Date.now()}.txt`;
    const relFixturePath = `apps/eval-hub/src/domains/execution/__tests__/${fixtureName}`;
    const absFixturePath = path.join(PROJECT_ROOT, relFixturePath);
    await fs.writeFile(absFixturePath, "original-v2");
    roots.push(absFixturePath);

    const fake = new CapturingEvalRunner();
    const suite = new SuiteRunner(fake, {
      runtime: { identity: async () => ({ version: "test-1", provider: "p", model: "m" }) },
      scenariosOverride: new Map([
        ["atomic-design", [
          { query: "q", skills: [], agents: [], expected_behavior: ["b"], files: [relFixturePath] },
        ]],
      ]),
    });
    const plan = await suite.plan({
      kind: "skills", subjects: ["atomic-design"], workspace, gooseCli: "goose",
      workers: 1, mode: "with-without", maxTurns: 8, timeoutMs: 1_000,
      ambient: false, continueOnFail: false, repetitions: 1,
    });

    // Mutate fixture after planning — runPlan must reject before provider/evalRunner
    await fs.writeFile(absFixturePath, "mutated-v2-content");
    await expect(async () => {
      for await (const _ of suite.runPlan(plan)) {}
    }).rejects.toThrow(/input_mismatch/i);
    expect(fake.calls).toHaveLength(0);
  });
});
