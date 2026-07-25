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
function toolRequestLine(id: string, name: string, args: Record<string, string>): string {
  return JSON.stringify({ message: { role: "assistant", content: [
    { type: "toolRequest", id, toolCall: { value: { name, arguments: args } } },
  ] } });
}

function toolResponseLine(id: string, text: string, failed = false): string {
  return JSON.stringify({ message: { role: "user", content: [
    { type: "toolResponse", id, toolResult: {
      status: failed ? "error" : "success",
      value: { content: [{ type: "text", text }], isError: failed },
    } },
  ] } });
}


class CapturingGoose implements IGooseRunner {
  config?: GooseRunConfig;
  constructor(private readonly exitCode: number | null = 0) {}
  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    this.config = config;
    yield { type: "line", stream: "stdout", text: toolRequestLine("skill-1", "load_skill", { name: "task-framing" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("skill-1", "# Loaded Skill: task-framing (skill)") };
    yield { type: "line", stream: "stdout", text: toolRequestLine("agent-1", "load", { source: "change-builder" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("agent-1", "# Loaded: change-builder (agent)") };
    yield { type: "exit", code: this.exitCode, signal: this.exitCode === null ? "SIGKILL" : null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

class BootstrapFailureGoose implements IGooseRunner {
  async *run(_config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    yield { type: "line", stream: "stdout", text: toolRequestLine("skill-1", "load_skill", { name: "task-framing" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("skill-1", "Skill 'task-framing' not found.", true) };
    yield { type: "exit", code: 0, signal: null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

class EmptySuccessGoose implements IGooseRunner {
  async *run(_config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    yield { type: "exit", code: 0, signal: null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

class LogRuntimeFailureGoose implements IGooseRunner {
  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    const stateHome = config.env?.["XDG_STATE_HOME"];
    if (!stateHome) throw new Error("missing isolated Goose state");
    const logs = path.join(stateHome, "goose", "logs", "cli", "2026-07-23");
    await fs.mkdir(logs, { recursive: true });
    await fs.writeFile(path.join(logs, "run.log"), JSON.stringify({
      timestamp: "2026-07-23T05:00:00Z", level: "ERROR",
      fields: { message: "DeploymentNotFound: API deployment test-model does not exist" }, target: "provider",
    }));
    yield { type: "line", stream: "stdout", text: toolRequestLine("skill-1", "load_skill", { name: "task-framing" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("skill-1", "# Loaded Skill: task-framing (skill)") };
    yield { type: "line", stream: "stdout", text: toolRequestLine("agent-1", "load", { source: "change-builder" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("agent-1", "# Loaded: change-builder (agent)") };
    yield { type: "exit", code: 0, signal: null };
  }
  async version() { return "test"; }
  async identity() { return { version: "test", provider: "test-provider", model: "test-model" }; }
}

class StderrRuntimeFailureGoose implements IGooseRunner {
  async *run(_config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    yield { type: "line", stream: "stdout", text: toolRequestLine("skill-1", "load_skill", { name: "task-framing" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("skill-1", "# Loaded Skill: task-framing (skill)") };
    yield { type: "line", stream: "stdout", text: toolRequestLine("agent-1", "load", { source: "change-builder" }) };
    yield { type: "line", stream: "stdout", text: toolResponseLine("agent-1", "# Loaded: change-builder (agent)") };
    yield { type: "line", stream: "stderr", text: "DeploymentNotFound: requested API deployment does not exist" };
    yield { type: "exit", code: 0, signal: null };
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
const SUBJECT   = "implement";
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
  skills: ["task-framing"],
  agents: ["change-builder"],
};

/** Build the treatment pair once — same shape every time. */
function pair() {
  return buildTreatmentPair({
    kind: KIND, subject: SUBJECT,
    declaredSkills: ["task-framing"], declaredAgents: ["change-builder"],
    resolvedRecipePath: "/repo/.goose/recipes/implement.yaml",
  });
}

beforeEach(async () => {
  workspace      = await fs.mkdtemp(path.join(os.tmpdir(), "eval-recipe-execution-"));
  integrityRoot  = await fs.mkdtemp(path.join(os.tmpdir(), "eval-recipe-integrity-"));
  // AC-1: create minimal synthetic stubs so materialisation finds declared subjects
  await fs.mkdir(path.join(workspace, ".agents", "skills", "task-framing"), { recursive: true });
  await fs.writeFile(path.join(workspace, ".agents", "skills", "task-framing", "SKILL.md"), "# task-framing stub");
  await fs.mkdir(path.join(workspace, ".agents", "agents"), { recursive: true });
  await fs.writeFile(path.join(workspace, ".agents", "agents", "change-builder.md"), "# change-builder stub");

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
    maxTurnsByTask: { [`${KIND}/${SUBJECT}/${EVAL_ID}`]: 5 },
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
    expect(candidate.config?.args).toContain("/repo/.goose/recipes/implement.yaml");
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
    expect(baseline.config?.args).toContain("load skill: task-framing\nload agent: change-builder");
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
      expect(candidateEvidence.maxTurns).toBe(5);
      expect(candidateEvidence.treatmentActivation).toMatchObject({ status: "materialized", requestedSkills: ["task-framing"], requestedAgents: ["change-builder"], failedSkills: [], failedAgents: [] });
      await expect(fs.access(path.join(workspace, ".agents", "skills", "task-framing", "SKILL.md"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(workspace, ".agents", "agents", "change-builder.md"))).resolves.toBeUndefined();
      expect(candidateEvidence.gooseArgs.slice(candidateEvidence.gooseArgs.indexOf("--max-turns"), candidateEvidence.gooseArgs.indexOf("--max-turns") + 2)).toEqual(["--max-turns", "5"]);
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

  it("fails closed and skips grading when a requested treatment load fails despite exit zero", async () => {
    let gradeCalls = 0;
    const countingGrader: IGrader = { async grade() { gradeCalls++; return grader.grade({} as any, "", "", "", ""); } };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(new BootstrapFailureGoose(), undefined, countingGrader, new Writer()).run(cfg("baseline"))) {}
    }).rejects.toThrow(/treatment bootstrap failed/i);
    expect(gradeCalls).toBe(0);
    const result = JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"));
    expect(result).toMatchObject({ status: "failed", failureReason: "treatment_bootstrap_failed" });
    expect(result.treatmentActivation).toMatchObject({ status: "failed", failedSkills: ["task-framing"] });
    const terminals = await new EvalIntegrityV2Store(integrityRoot).listTerminals();
    expect(terminals[0]?.exclusion?.reason).toBe("treatment_bootstrap_failed");
  });

  it("fails closed when Goose exits zero without runtime activation evidence", async () => {
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(new EmptySuccessGoose(), undefined, grader, new Writer()).run(cfg("baseline"))) {}
    }).rejects.toThrow(/treatment bootstrap failed/i);
    const result = JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"));
    expect(result).toMatchObject({
      status: "failed", failureReason: "treatment_bootstrap_failed",
      treatmentActivation: { status: "failed", failedSkills: ["task-framing"], failedAgents: ["change-builder"] },
    });
  });

  it("fails closed on a fatal diagnostic found only in correlated Goose logs", async () => {
    let gradeCalls = 0;
    const countingGrader: IGrader = { async grade() { gradeCalls++; return grader.grade({} as any, "", "", "", ""); } };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(new LogRuntimeFailureGoose(), undefined, countingGrader, new Writer()).run(cfg("baseline"))) {}
    }).rejects.toThrow(/runtime dependency failed/i);
    expect(gradeCalls).toBe(0);
    const result = JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"));
    expect(result.gooseLogAnalysis.fatalDiagnostics).toMatchObject([{ code: "provider_deployment_missing" }]);
    await expect(fs.access(path.join(workspace, ".goose-state"))).rejects.toThrow();
  });

  it("fails closed on a fatal runtime diagnostic written to stderr", async () => {
    let gradeCalls = 0;
    const countingGrader: IGrader = { async grade() { gradeCalls++; return grader.grade({} as any, "", "", "", ""); } };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(new StderrRuntimeFailureGoose(), undefined, countingGrader, new Writer()).run(cfg("baseline"))) {}
    }).rejects.toThrow(/runtime dependency failed/i);
    expect(gradeCalls).toBe(0);
    const result = JSON.parse(await fs.readFile(path.join(workspace, "execution-result.json"), "utf8"));
    expect(result).toMatchObject({ status: "failed", failureReason: "runtime_dependency_failed" });
    expect(result.runtimeHealth.diagnostics).toContain("DeploymentNotFound: requested API deployment does not exist");
  });

});
