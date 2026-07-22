import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkillEvalRunner } from "../evalRunner.js";
import { buildTreatmentPair, hashUtf8, treatmentContentHash } from "../executionIntegrity.js";
import { expectedCriterionIdsFor } from "../grader.js";
import type { GooseRawEvent, GooseRunConfig, IGooseRunner, IGrader, ScenarioIntegrityPlan } from "../ports.js";
import type { IWorkspaceWriter } from "../../persistence/ports.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  integrityValueHash,
  type IntegrityManifestV2,
} from "../../persistence/integrityV2Store.js";

class CapturingGoose implements IGooseRunner {
  config?: GooseRunConfig;
  constructor(private readonly exitCode: number | null = 0) {}
  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    this.config = config;
    yield { type: "exit", code: this.exitCode, signal: this.exitCode === null ? "SIGKILL" : null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

const grader: IGrader = {
  async grade() { return { summary: { total: 1, passed: 1, failed: 0, pass_rate: 1 }, expectations: [] }; },
};
class Writer implements IWorkspaceWriter {
  readonly gradingRuns: number[] = [];
  async writePrompt(_k: any, _s: any, _h: any, _e: any, _c: any, _r: any, text: string) {
    const p = path.join(workspace, "prompt.txt"); await fs.mkdir(workspace, { recursive: true }); await fs.writeFile(p, text); return p;
  }
  async writeGrading(_k: any, _s: any, _h: any, _e: any, _c: any, run: number) { this.gradingRuns.push(run); }
  async writeTiming() {} async writeBenchmark() {}
  async appendEvent() {} async writeEvalMeta() {}
}

// ── Shared state (initialised in beforeEach) ──────────────────────────────────

let workspace: string;
let integrityRoot: string;
let storedManifestHash: string;

// Constants kept stable across all tests in this suite
const SUBJECT   = "dev";
const KIND      = "recipes" as const;
const EVAL_ID   = 0;
const TASK_TEXT = "task";
const FIXTURE_HASHES = { "fixture.ts": "fixture-hash" };
const PROVIDER  = "test-provider";
const MODEL     = "test-model";
const GOOSE_VER = "test";
const HUB_VER   = "test-eval-hub";

const scenario = {
  query: TASK_TEXT,
  expected_behavior: ["works"],
  skills: ["sdd"],
  agents: ["orchestrator"],
};

/** Build the treatment pair once — same shape every time. */
function pair() {
  return buildTreatmentPair({
    kind: KIND, subject: SUBJECT,
    declaredSkills: ["sdd"], declaredAgents: ["orchestrator"],
    resolvedRecipePath: "/repo/.goose/recipes/dev.yaml",
  });
}

beforeEach(async () => {
  workspace      = await fs.mkdtemp(path.join(os.tmpdir(), "eval-recipe-execution-"));
  integrityRoot  = await fs.mkdtemp(path.join(os.tmpdir(), "eval-recipe-integrity-"));

  // Build a canonical manifest that matches the treatment pair, task, fixtures
  // and execution envelope used by cfg() below.
  const { candidate, baseline } = pair();
  const executionEnvelope: IntegrityManifestV2["executionEnvelope"] = {
    provider: PROVIDER, model: MODEL,
    decoding: { temperature: null, seed: null },
    timeBudgetMs: 100, tokenBudget: null,
    gooseRuntimeVersion: GOOSE_VER,
    evalHubRuntimeVersion: HUB_VER,
  };
  const mani: IntegrityManifestV2 = {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "test-run-001",
    cliArguments: [],
    subjects: [{ kind: KIND, subject: SUBJECT, sourceHash: "source-hash", evalIds: [EVAL_ID] }],
    repetitions: 1,
    treatments: [
      {
        id: candidate.id, kind: KIND, subject: SUBJECT, side: "candidate",
        definitionHash: treatmentContentHash(candidate),
        bootstrapHash:  hashUtf8(candidate.bootstrap.bytes),
      },
      {
        id: baseline.id, kind: KIND, subject: SUBJECT, side: "baseline",
        definitionHash: treatmentContentHash(baseline),
        bootstrapHash:  hashUtf8(baseline.bootstrap.bytes),
      },
    ],
    taskPayloadHashes: { [`${KIND}/${SUBJECT}/${EVAL_ID}`]: hashUtf8(TASK_TEXT) },
    fixtureHashes: FIXTURE_HASHES,
    executionEnvelope,
    grader: { id: "llm-judge", version: "1" },
    rubric: { id: "expected-behavior", version: "1" },
  };
  const stored = await new EvalIntegrityV2Store(integrityRoot).createManifest(mani);
  storedManifestHash = stored.hash;
});

afterEach(async () => {
  await Promise.all([
    fs.rm(workspace,     { recursive: true, force: true }),
    fs.rm(integrityRoot, { recursive: true, force: true }),
  ]);
});

/** Build a full ScenarioRunConfig for either side. */
function cfg(side: "candidate" | "baseline", workspaceOverride?: string) {
  const { candidate, baseline } = pair();
  const treatment = side === "candidate" ? candidate : baseline;
  const integrity: ScenarioIntegrityPlan = {
    schema:                 INTEGRITY_SCHEMA_V2,
    root:                   integrityRoot,
    manifestHash:           storedManifestHash,
    runProvenanceId:        "test-run-001",
    side,
    candidateTreatmentId:   candidate.id,
    baselineTreatmentId:    baseline.id,
    candidateTreatmentHash: treatmentContentHash(candidate),
    baselineTreatmentHash:  treatmentContentHash(baseline),
    grader: { id: "llm-judge", version: "1" },
    rubric: {
      id: "expected-behavior", version: "1",
      expectedCriterionIds: expectedCriterionIdsFor(scenario),
    },
  };
  return {
    kind:                  KIND,
    subject:               SUBJECT,
    hash:                  "hash",
    scenario,
    evalId:                EVAL_ID,
    config:                treatment.id,
    treatment,
    repetition:            0,
    workspace:             workspaceOverride ?? workspace,
    gooseCli:              "goose",
    maxTurns:              5,
    timeoutMs:             100,
    ambient:               false,
    fixtureHashes:         FIXTURE_HASHES,
    plannedTaskPayload:    TASK_TEXT,
    plannedTaskPayloadHash: hashUtf8(TASK_TEXT),
    provider:              PROVIDER,
    model:                 MODEL,
    gooseRuntimeVersion:   GOOSE_VER,
    decoding:              { temperature: null, seed: null },
    evalHubRuntimeVersion: HUB_VER,
    integrity,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EVAL-INT-01/02/19 recipe execution", () => {
  it("passes --recipe only to recipe_l3 and keeps exact task payload", async () => {
    const candidate = new CapturingGoose();
    const writer = new Writer();
    for await (const _ of new SkillEvalRunner(candidate, undefined, grader, writer).run(cfg("candidate"))) {}
    expect(writer.gradingRuns).toEqual([1]);
    expect(candidate.config?.args).toContain("--recipe");
    expect(candidate.config?.args).toContain("/repo/.goose/recipes/dev.yaml");
    expect(candidate.config?.args).toContain("task=task");
    expect(candidate.config?.args).not.toContain("--system");
    expect(candidate.config?.args).toContain("--provider");
    expect(candidate.config?.args).toContain("test-provider");
    expect(candidate.config?.args).toContain("--model");
    expect(candidate.config?.args).toContain("test-model");

    const baseline = new CapturingGoose();
    for await (const _ of new SkillEvalRunner(baseline, undefined, grader, new Writer()).run(cfg("baseline"))) {}
    expect(baseline.config?.args).not.toContain("--recipe");
    expect(baseline.config?.args).toContain("--system");
    expect(baseline.config?.args).toContain("load skill: sdd\nload agent: orchestrator");
    expect(baseline.config?.args).toContain("task");
    expect(baseline.config?.args).toContain("test-provider");
    expect(baseline.config?.args).toContain("test-model");
  });

  it("persists candidate and baseline with identical exact task hashes and distinct bootstrap hashes", async () => {
    const candidate = new CapturingGoose();
    for await (const _ of new SkillEvalRunner(candidate, undefined, grader, new Writer()).run(cfg("candidate"))) {}
    const candidateEvidence = JSON.parse(await fs.readFile(path.join(workspace, "execution-evidence.json"), "utf8"));

    const baselineWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), "eval-recipe-baseline-"));
    const baseline = new CapturingGoose();
    try {
      for await (const _ of new SkillEvalRunner(baseline, undefined, grader, new Writer()).run(cfg("baseline", baselineWorkspace))) {}
      const baselineEvidence = JSON.parse(await fs.readFile(path.join(baselineWorkspace, "execution-evidence.json"), "utf8"));
      expect(candidateEvidence.taskPayloadHash).toBe(baselineEvidence.taskPayloadHash);
      expect(candidateEvidence.treatmentBootstrapHash).not.toBe(baselineEvidence.treatmentBootstrapHash);
      expect(candidateEvidence.fixtureHashes).toEqual(baselineEvidence.fixtureHashes);
    } finally { await fs.rm(baselineWorkspace, { recursive: true, force: true }); }
  });

  it("passes declared recipe params plus invariant task", async () => {
    const goose = new CapturingGoose();
    const typed = { ...cfg("candidate"), scenario: { ...scenario, recipe_params: { deviation: "HTTP 200", ac_id: "AUTH-03" } } };
    for await (const _ of new SkillEvalRunner(goose, undefined, grader, new Writer()).run(typed)) {}
    expect(goose.config?.args).toContain("deviation=HTTP 200");
    expect(goose.config?.args).toContain("ac_id=AUTH-03");
    expect(goose.config?.args).toContain("task=task");
  });

  it("preserves a terminal timeout signal without synthesizing a score", async () => {
    const goose = new CapturingGoose(null);
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, grader, new Writer()).run(cfg("baseline"))) {}
    }).rejects.toThrow(/signal SIGKILL/);
    expect(JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"))).toMatchObject({
      status: "failed", exitCode: null, signal: "SIGKILL", score: null,
    });
  });

  it("persists a terminal failed status and never grades nonzero exit", async () => {
    const goose = new CapturingGoose(2);
    let gradeCalls = 0;
    const countingGrader: IGrader = { async grade() { gradeCalls++; return grader.grade({} as any, "", "", "", ""); } };
    const runner = new SkillEvalRunner(goose, undefined, countingGrader, new Writer());
    await expect(async () => { for await (const _ of runner.run(cfg("baseline"))) {} }).rejects.toThrow("Goose run failed");
    expect(gradeCalls).toBe(0);
    expect(JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"))).toMatchObject({ status: "failed", score: null, treatmentId: "recipe_l2", repetition: 0 });
    expect(JSON.parse(await fs.readFile(path.join(workspace, "execution-evidence.json"), "utf8"))).toMatchObject({
      schema: "eval-integrity-execution-v1", treatmentId: "recipe_l2", taskPayloadHash: expect.any(String),
      treatmentBootstrap: { kind: "system_instruction" }, treatmentBootstrapHash: expect.any(String),
      fixtureHashes: { "fixture.ts": "fixture-hash" }, provider: "test-provider", model: "test-model",
      gooseRuntimeVersion: "test", evalHubRuntimeVersion: "test-eval-hub",
    });
    expect(goose.config?.env).not.toHaveProperty("HOME");
    expect(goose.config?.env).not.toHaveProperty("XDG_CONFIG_HOME");
  });
});
