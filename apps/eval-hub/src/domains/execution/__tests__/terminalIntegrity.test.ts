/**
 * Terminal integrity contract tests for SkillEvalRunner.
 *
 * Covers:
 *   1. Valid terminal — succeeded run with valid grading → isTerminalComplete=true
 *   2. Failed terminal before throw — failed exit records terminal before error
 *   3. Grader-invalid null — grader mismatch records grader_invalid, does not throw
 *   4. Valid resume — existing complete terminal skips provider/grader entirely
 *   5. Invalid immutable terminal — existing incomplete slot throws before provider
 *   6. Payload/treatment mismatch — throws before any provider call
 *   7. Duplicate never overwritten — second write attempt is rejected by store
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkillEvalRunner } from "../evalRunner.js";
import { buildTreatmentPair, hashUtf8, treatmentContentHash, type ExecutionTreatment } from "../executionIntegrity.js";
import { expectedCriterionIdsFor } from "../grader.js";
import type {
  GooseRawEvent, GooseRunConfig, IGooseRunner, IGrader, ScenarioRunConfig, ScenarioIntegrityPlan,
} from "../ports.js";
import type { IWorkspaceWriter } from "../../persistence/ports.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  integrityValueHash,
  type IntegrityManifestV2,
} from "../../persistence/integrityV2Store.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

class TrackingGoose implements IGooseRunner {
  calls = 0;
  constructor(private readonly exitCode: number | null = 0) {}
  async *run(_config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    this.calls++;
    yield { type: "exit", code: this.exitCode, signal: this.exitCode === null ? "SIGKILL" : null };
  }
  async version() { return "test-goose"; }
  async identity() { return { version: "test-goose", provider: "test-provider", model: "test-model" }; }
}

class StubWriter implements IWorkspaceWriter {
  gradingCalls = 0;
  async writePrompt() { return "/stub/prompt.txt"; }
  async writeGrading() { this.gradingCalls++; }
  async writeTiming() {}
  async writeBenchmark() {}
  async appendEvent() {}
  async writeEvalMeta() {}
}

// ── Scenario & criterion setup ────────────────────────────────────────────────

const BEHAVIORS = ["check the auth flow works", "check rate limiting is applied"];
const scenario = { query: "run auth tests", expected_behavior: BEHAVIORS, skills: ["sdd"] };
const CRITERION_IDS = expectedCriterionIdsFor(scenario); // ["expected_behavior[0]", "expected_behavior[1]"]

/** A grader that returns fully valid grading matching CRITERION_IDS */
const validGrader: IGrader = {
  async grade() {
    return {
      summary: { total: 2, passed: 2, failed: 0, pass_rate: 1 },
      expectations: [
        { text: BEHAVIORS[0]!, passed: true,  evidence: "found evidence" },
        { text: BEHAVIORS[1]!, passed: true,  evidence: "found evidence" },
      ],
    };
  },
};

/** A grader that throws */
const throwingGrader: IGrader = {
  async grade(): Promise<never> { throw new Error("grader internal error"); },
};

/** A grader that returns wrong expectation count (1 instead of 2) */
const mismatchGrader: IGrader = {
  async grade() {
    return {
      summary: { total: 1, passed: 1, failed: 0, pass_rate: 1 },
      expectations: [{ text: "only one", passed: true, evidence: "" }],
    };
  },
};

// ── Shared state ──────────────────────────────────────────────────────────────

let workspace: string;
let integrityRoot: string;
let store: EvalIntegrityV2Store;
let storedManifestHash: string;

const KIND       = "skills" as const;
const SUBJECT    = "sdd";
const EVAL_ID    = 0;
const TASK_TEXT  = "run auth tests";
const FIXTURE_H  = { "fixtures/auth.ts": "auth-fixture-hash" };
const PROVIDER   = "test-provider";
const MODEL      = "test-model";
const GOOSE_VER  = "test-goose";
const HUB_VER    = "test-eval-hub";

/** Stable treatment pair for skills/sdd */
function pair() {
  return buildTreatmentPair({
    kind: KIND, subject: SUBJECT,
    declaredSkills: [SUBJECT], declaredAgents: [],
  });
}

function buildManifest(): IntegrityManifestV2 {
  const { candidate, baseline } = pair();
  return {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "prov-001",
    cliArguments: [],
    subjects: [{ kind: KIND, subject: SUBJECT, sourceHash: "src-hash", evalIds: [EVAL_ID] }],
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
    fixtureHashes: FIXTURE_H,
    executionEnvelope: {
      provider: PROVIDER, model: MODEL,
      decoding: { temperature: null, seed: null },
      timeBudgetMs: 5_000, tokenBudget: null,
      gooseRuntimeVersion: GOOSE_VER,
      evalHubRuntimeVersion: HUB_VER,
    },
    grader: { id: "llm-judge", version: "2" },
    rubric: { id: "expected-behavior", version: "1" },
  };
}

beforeEach(async () => {
  workspace     = await fs.mkdtemp(path.join(os.tmpdir(), "eval-terminal-integrity-"));
  integrityRoot = await fs.mkdtemp(path.join(os.tmpdir(), "eval-terminal-store-"));
  store         = new EvalIntegrityV2Store(integrityRoot);
  const stored  = await store.createManifest(buildManifest());
  storedManifestHash = stored.hash;
});

afterEach(async () => {
  await Promise.all([
    fs.rm(workspace,     { recursive: true, force: true }),
    fs.rm(integrityRoot, { recursive: true, force: true }),
  ]);
});

function buildCfg(side: "candidate" | "baseline", overrides: Partial<ScenarioRunConfig> = {}): ScenarioRunConfig {
  const { candidate, baseline } = pair();
  const treatment = side === "candidate" ? candidate : baseline;
  const integrity: ScenarioIntegrityPlan = {
    schema:                 INTEGRITY_SCHEMA_V2,
    root:                   integrityRoot,
    manifestHash:           storedManifestHash,
    runProvenanceId:        "prov-001",
    side,
    candidateTreatmentId:   candidate.id,
    baselineTreatmentId:    baseline.id,
    candidateTreatmentHash: treatmentContentHash(candidate),
    baselineTreatmentHash:  treatmentContentHash(baseline),
    grader:  { id: "llm-judge", version: "2" },
    rubric:  { id: "expected-behavior", version: "1", expectedCriterionIds: CRITERION_IDS },
  };
  return {
    kind:                   KIND,
    subject:                SUBJECT,
    hash:                   "src-hash",
    scenario,
    evalId:                 EVAL_ID,
    config:                 treatment.id,
    treatment,
    repetition:             0,
    workspace,
    gooseCli:               "goose",
    maxTurns:               5,
    timeoutMs:              5_000,
    ambient:                false,
    fixtureHashes:          FIXTURE_H,
    plannedTaskPayload:     TASK_TEXT,
    plannedTaskPayloadHash: hashUtf8(TASK_TEXT),
    provider:               PROVIDER,
    model:                  MODEL,
    gooseRuntimeVersion:    GOOSE_VER,
    decoding:               { temperature: null, seed: null },
    evalHubRuntimeVersion:  HUB_VER,
    integrity,
    ...overrides,
  };
}

// ── 1. Valid terminal ─────────────────────────────────────────────────────────

describe("1. valid terminal — succeeded run with valid grading", () => {
  it("records a complete terminal and isTerminalComplete returns true", async () => {
    const goose  = new TrackingGoose(0);
    const writer = new StubWriter();
    const events: string[] = [];

    for await (const ev of new SkillEvalRunner(goose, undefined, validGrader, writer).run(buildCfg("candidate"))) {
      events.push(ev.type);
    }

    expect(events).toContain("subject.graded");
    expect(writer.gradingCalls).toBe(1);

    // Build the same key the runner used
    const { candidate, baseline } = pair();
    const keyTemplate = {
      schema: INTEGRITY_SCHEMA_V2, manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "candidate" as const, treatmentId: candidate.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(buildManifest().executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: null, exclusion: null,
    } as const;

    expect(await store.isTerminalComplete(keyTemplate)).toBe(true);

    const record = await store.readTerminalKey(keyTemplate);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("succeeded");
    expect(record!.exclusion).toBeNull();
    expect(record!.grading?.validationStatus).toBe("valid");
    expect(record!.grading?.parseStatus).toBe("parsed");
    expect(Number.isFinite(record!.grading?.score)).toBe(true);
    expect(record!.grading?.score).toBe(1);
    expect(record!.grading?.outcomes).toHaveLength(2);
    expect(record!.grading?.outcomes[0]?.criterionId).toBe(CRITERION_IDS[0]);
    expect(record!.grading?.outcomes[1]?.criterionId).toBe(CRITERION_IDS[1]);
  });
});

// ── 2. Failed terminal before throw ──────────────────────────────────────────

describe("2. failed terminal before throw — execution_failed recorded before rethrow", () => {
  it("records execution_failed terminal and then rethrows before grading", async () => {
    const goose  = new TrackingGoose(1); // non-zero exit
    const writer = new StubWriter();

    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, writer).run(buildCfg("baseline"))) {}
    }).rejects.toThrow(/Goose run failed/);

    // Grader must NOT have been called
    expect(writer.gradingCalls).toBe(0);

    // Terminal must be recorded in store before the throw
    const { candidate, baseline } = pair();
    const keyTemplate = {
      schema: INTEGRITY_SCHEMA_V2, manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "baseline" as const, treatmentId: baseline.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(buildManifest().executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: null, exclusion: null,
    } as const;

    const record = await store.readTerminalKey(keyTemplate);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("failed");
    expect(record!.grading).toBeNull();
    expect(record!.exclusion?.reason).toBe("execution_failed");

    // isTerminalComplete must return false for a failed terminal
    expect(await store.isTerminalComplete(keyTemplate)).toBe(false);
  });
});

// ── 3. Grader-invalid null ────────────────────────────────────────────────────

describe("3. grader-invalid null — grader throw / mismatch → grader_invalid, no rethrow", () => {
  it("records grader_invalid with score=null when grader throws", async () => {
    const goose  = new TrackingGoose(0);
    const writer = new StubWriter();
    const events: string[] = [];

    // Must NOT throw — grader_invalid is a valid outcome for the run
    for await (const ev of new SkillEvalRunner(goose, undefined, throwingGrader, writer).run(buildCfg("candidate"))) {
      events.push(ev.type);
    }

    expect(events).toContain("subject.graded");

    const { candidate, baseline } = pair();
    const keyTemplate = {
      schema: INTEGRITY_SCHEMA_V2, manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "candidate" as const, treatmentId: candidate.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(buildManifest().executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: null, exclusion: null,
    } as const;

    const record = await store.readTerminalKey(keyTemplate);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("succeeded");
    expect(record!.exclusion?.reason).toBe("grader_invalid");
    expect(record!.grading?.score).toBeNull();
    expect(record!.grading?.validationStatus).toBe("invalid");
    expect(record!.grading?.parseStatus).toBe("failed"); // grader threw
    // isTerminalComplete must be false — exclusion present
    expect(await store.isTerminalComplete(keyTemplate)).toBe(false);
  });

  it("records grader_invalid when expectation count mismatches", async () => {
    const goose = new TrackingGoose(0);
    for await (const _ of new SkillEvalRunner(goose, undefined, mismatchGrader, new StubWriter()).run(buildCfg("candidate"))) {}

    const { candidate, baseline } = pair();
    const keyTemplate = {
      schema: INTEGRITY_SCHEMA_V2, manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "candidate" as const, treatmentId: candidate.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(buildManifest().executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: null, exclusion: null,
    } as const;

    const record = await store.readTerminalKey(keyTemplate);
    expect(record!.exclusion?.reason).toBe("grader_invalid");
    expect(record!.grading?.score).toBeNull();
    expect(record!.grading?.parseStatus).toBe("parsed"); // grader returned, just wrong
    expect(record!.grading?.validationStatus).toBe("invalid");
  });
});

// ── 4. Valid resume skips provider/grader ─────────────────────────────────────

describe("4. valid resume — existing complete terminal skips provider and grader", () => {
  it("does not call goose or grader when terminal is already complete", async () => {
    // First run — records a complete terminal
    const goose1 = new TrackingGoose(0);
    for await (const _ of new SkillEvalRunner(goose1, undefined, validGrader, new StubWriter()).run(buildCfg("candidate"))) {}
    expect(goose1.calls).toBe(1);

    // Second run — terminal already complete, must skip
    const goose2    = new TrackingGoose(0);
    const grader2Calls = { n: 0 };
    const resumeGrader: IGrader = {
      async grade() { grader2Calls.n++; return { summary: { total: 0, passed: 0, failed: 0, pass_rate: null }, expectations: [] }; },
    };
    const events: string[] = [];
    for await (const ev of new SkillEvalRunner(goose2, undefined, resumeGrader, new StubWriter()).run(buildCfg("candidate"))) {
      events.push(ev.type);
    }

    expect(goose2.calls).toBe(0);        // provider never called
    expect(grader2Calls.n).toBe(0);      // grader never called
    expect(events).toContain("subject.started");
    expect(events).toContain("subject.completed");
  });
});

// ── 5. Invalid immutable terminal rejects ─────────────────────────────────────

describe("5. invalid immutable terminal — existing incomplete slot throws before provider", () => {
  it("throws 'immutable and incomplete' without calling goose when slot has a failed terminal", async () => {
    // First run fails — records a failed (incomplete) terminal
    const goose1 = new TrackingGoose(2);
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose1, undefined, validGrader, new StubWriter()).run(buildCfg("candidate"))) {}
    }).rejects.toThrow(/Goose run failed/);
    expect(goose1.calls).toBe(1);

    // Second run — slot occupied by incomplete terminal, must throw before provider
    const goose2 = new TrackingGoose(0);
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose2, undefined, validGrader, new StubWriter()).run(buildCfg("candidate"))) {}
    }).rejects.toThrow(/terminal slot is immutable and incomplete/);
    expect(goose2.calls).toBe(0); // provider never called
  });
});

// ── 6. Payload/treatment mismatch → zero provider calls ──────────────────────

describe("6. payload/treatment mismatch — throws before any provider call", () => {
  it("throws before goose when plannedTaskPayloadHash does not match manifest", async () => {
    const goose  = new TrackingGoose(0);
    const badCfg = buildCfg("candidate", { plannedTaskPayloadHash: "wrong-hash-aabbcc" });
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, new StubWriter()).run(badCfg)) {}
    }).rejects.toThrow(/payload hash mismatch/);
    expect(goose.calls).toBe(0);
  });

  it("throws before goose when treatment id does not match integrity plan side", async () => {
    const { candidate, baseline } = pair();
    const goose = new TrackingGoose(0);
    // Force candidate-side integrity but baseline treatment object
    const mismatchedCfg: ScenarioRunConfig = {
      ...buildCfg("candidate"),
      treatment: baseline, // wrong treatment for candidate side
      config: baseline.id,
    };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, new StubWriter()).run(mismatchedCfg)) {}
    }).rejects.toThrow(/treatment id mismatch/);
    expect(goose.calls).toBe(0);
  });
});

// ── 8. Wrong integrity treatment hash → zero provider calls ──────────────────

describe("8. wrong integrity treatment hash — throws before provider", () => {
  it("throws before goose when candidateTreatmentHash does not match manifest definitionHash", async () => {
    const goose  = new TrackingGoose(0);
    const base   = buildCfg("candidate");
    const badCfg: ScenarioRunConfig = {
      ...base,
      integrity: { ...base.integrity, candidateTreatmentHash: "wrong-candidate-hash-deadbeef00" },
    };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, new StubWriter()).run(badCfg)) {}
    }).rejects.toThrow(/candidateTreatmentHash mismatch/);
    expect(goose.calls).toBe(0);
  });

  it("throws before goose when baselineTreatmentHash does not match manifest definitionHash", async () => {
    const goose  = new TrackingGoose(0);
    const base   = buildCfg("baseline");
    const badCfg: ScenarioRunConfig = {
      ...base,
      integrity: { ...base.integrity, baselineTreatmentHash: "wrong-baseline-hash-cafebabe00" },
    };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, new StubWriter()).run(badCfg)) {}
    }).rejects.toThrow(/baselineTreatmentHash mismatch/);
    expect(goose.calls).toBe(0);
  });
});

// ── 9. Mutated treatment content → zero provider calls ────────────────────────

describe("9. mutated treatment content — throws before provider", () => {
  it("throws before goose when treatment content hash does not match manifest side definitionHash", async () => {
    const goose  = new TrackingGoose(0);
    const { candidate } = pair();
    // Keep same id so existing id-check passes; mutate content so hash diverges
    const mutated: ExecutionTreatment = {
      ...candidate,
      definition: { ...candidate.definition, skills: ["mutated-skill-xyz"] },
    };
    const badCfg: ScenarioRunConfig = { ...buildCfg("candidate"), treatment: mutated };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose, undefined, validGrader, new StubWriter()).run(badCfg)) {}
    }).rejects.toThrow(/treatment content hash mismatch/);
    expect(goose.calls).toBe(0);
  });
});

// ── 10. Zero expected criteria → succeeded + grader_invalid + score null ──────

describe("10. zero expected criteria — succeeded terminal with grader_invalid and score null", () => {
  it("records succeeded+grader_invalid with score null (not zero) when expected_behavior is empty", async () => {
    const goose  = new TrackingGoose(0);
    const writer = new StubWriter();
    const zeroScenario = { query: TASK_TEXT, expected_behavior: [] as string[], skills: [SUBJECT] };
    const base   = buildCfg("candidate");
    const zeroCfg: ScenarioRunConfig = {
      ...base,
      scenario: zeroScenario,
      integrity: { ...base.integrity, rubric: { id: "expected-behavior", version: "1", expectedCriterionIds: [] } },
    };
    const events: string[] = [];
    // Must NOT throw — grader_invalid is a valid terminal outcome
    for await (const ev of new SkillEvalRunner(goose, undefined, validGrader, writer).run(zeroCfg)) {
      events.push(ev.type);
    }
    expect(events).toContain("subject.graded");

    const { candidate, baseline } = pair();
    const key = {
      schema: INTEGRITY_SCHEMA_V2, manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "candidate" as const, treatmentId: candidate.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(buildManifest().executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: null, exclusion: null,
    } as const;

    const record = await store.readTerminalKey(key);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("succeeded");
    expect(record!.exclusion?.reason).toBe("grader_invalid");
    expect(record!.grading?.score).toBeNull();
    expect(record!.grading?.score).not.toBe(0); // never zero-coerced
    // Incomplete because exclusion is present
    expect(await store.isTerminalComplete(key)).toBe(false);
  });
});

// ── 11. Second-run grader_invalid immutable slot → skip provider and grader ───

describe("11. second-run grader_invalid immutable slot — provider and grader skipped", () => {
  it("throws immutable-incomplete before provider and grader when slot holds a grader_invalid terminal", async () => {
    // First run: Goose exits 0, grader throws → grader_invalid (incomplete terminal)
    const goose1 = new TrackingGoose(0);
    for await (const _ of new SkillEvalRunner(goose1, undefined, throwingGrader, new StubWriter()).run(buildCfg("candidate"))) {}
    expect(goose1.calls).toBe(1);

    // Second run: slot occupied by incomplete terminal → must throw before provider and grader
    const goose2 = new TrackingGoose(0);
    const graderCalls = { n: 0 };
    const countingGrader: IGrader = {
      async grade() { graderCalls.n++; return validGrader.grade({} as any, "", "", "", ""); },
    };
    await expect(async () => {
      for await (const _ of new SkillEvalRunner(goose2, undefined, countingGrader, new StubWriter()).run(buildCfg("candidate"))) {}
    }).rejects.toThrow(/terminal slot is immutable and incomplete/);
    expect(goose2.calls).toBe(0);  // provider never called
    expect(graderCalls.n).toBe(0); // grader never called
  });
});

// ── 7. Duplicate never overwritten ───────────────────────────────────────────

describe("7. duplicate never overwritten — second store write is rejected", () => {
  it("the runner never writes a second terminal for the same slot (store rejects it)", async () => {
    // A first successful run records the terminal
    const goose1 = new TrackingGoose(0);
    for await (const _ of new SkillEvalRunner(goose1, undefined, validGrader, new StubWriter()).run(buildCfg("candidate"))) {}

    // Direct attempt to record the same key again via the store must throw
    const { candidate, baseline } = pair();
    const mani = buildManifest();
    const duplicateRecord = {
      schema: INTEGRITY_SCHEMA_V2 as typeof INTEGRITY_SCHEMA_V2,
      manifestHash: storedManifestHash,
      kind: KIND, subject: SUBJECT, evalId: EVAL_ID, repetition: 0,
      side: "candidate" as const, treatmentId: candidate.id,
      status: "succeeded" as const,
      pairKey: {
        taskPayloadHash: hashUtf8(TASK_TEXT), fixtureHashes: FIXTURE_H,
        executionEnvelopeHash: integrityValueHash(mani.executionEnvelope),
        candidateTreatmentId: candidate.id, baselineTreatmentId: baseline.id,
        candidateTreatmentHash: treatmentContentHash(candidate), baselineTreatmentHash: treatmentContentHash(baseline),
        runProvenanceId: "prov-001", graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
      },
      grading: {
        graderId: "llm-judge", graderVersion: "2",
        rubricId: "expected-behavior", rubricVersion: "1",
        expectedCriterionIds: [...CRITERION_IDS],
        outcomes: CRITERION_IDS.map(criterionId => ({ criterionId, passed: true })),
        parseStatus: "parsed", validationStatus: "valid", score: 1,
      },
      exclusion: null,
    };
    await expect(store.recordTerminal(duplicateRecord)).rejects.toThrow(/duplicate terminal key/i);
  });
});
