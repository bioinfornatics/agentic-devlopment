/**
 * EVAL-LYR-V2 — LayeredRunner v2 production path.
 *
 * Tests the new plan/runPlan flow, integrity-v2 report computation,
 * nullable avgDelta, resume behaviour, and EvalIntegrityV2Store.listTerminals().
 *
 * FakeSuiteRunner creates real integrity manifests so that LayeredRunner can
 * call computeReportFromTerminals through the store.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LayeredRunner, pairedSubjectDelta } from "../layeredRunner.js";
import {
  EvalIntegrityV2Store,
  integrityValueHash,
  INTEGRITY_SCHEMA_V2,
  type IntegrityManifestV2,
  type IntegrityTerminalRecordV2,
  type IntegrityPairKeyV2,
} from "../../persistence/integrityV2Store.js";
import type { ISuiteRunner, SuiteConfig, SuiteExecutionPlan, IEventSink } from "../ports.js";
import type { SuiteEvent, LayeredEvent } from "../../../shared/events.js";
import type { LayeredConfig } from "../ports.js";
import { NULL_SINK } from "../../../shared/eventBus.js";

// ── Shared temp dir management ─────────────────────────────────────────────

let tempRoot: string;
beforeEach(async () => { tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "eval-lyr-v2-")); });
afterEach(async () => { await fs.rm(tempRoot, { recursive: true, force: true }); });

// ── Manifest / terminal helpers ────────────────────────────────────────────

const TEST_ENVELOPE = {
  provider: "test", model: "test-model",
  decoding: { temperature: null as null, seed: null as null },
  timeBudgetMs: null as null, tokenBudget: null as null,
  gooseRuntimeVersion: "0.0.0", evalHubRuntimeVersion: "0.0.0",
} as const;

function buildManifest(
  kind: "skills" | "agents" | "recipes",
  subjects: string[],
  evalIds: number[],
  repetitions: number,
): IntegrityManifestV2 {
  const taskPayloadHashes: Record<string, string> = {};
  for (const s of subjects) {
    for (const id of evalIds) taskPayloadHashes[`${kind}/${s}/${id}`] = `task-${s}-${id}`;
  }
  return {
    schema: INTEGRITY_SCHEMA_V2,
    runProvenanceId: "test-provenance",
    cliArguments: [],
    subjects: subjects.map(s => ({ kind, subject: s, sourceHash: `src-${s}`, evalIds })),
    repetitions,
    treatments: subjects.flatMap(s => [
      { id: `cand-${s}`, kind, subject: s, side: "candidate" as const, definitionHash: `def-cand-${s}`, bootstrapHash: `boot-cand-${s}` },
      { id: `base-${s}`, kind, subject: s, side: "baseline" as const, definitionHash: `def-base-${s}`, bootstrapHash: `boot-base-${s}` },
    ]),
    taskPayloadHashes,
    fixtureHashes: {},
    executionEnvelope: TEST_ENVELOPE,
    grader: { id: "test-grader", version: "1" },
    rubric: { id: "test-rubric", version: "1" },
  };
}

function buildPairKey(manifest: IntegrityManifestV2, subject: string, evalId: number): IntegrityPairKeyV2 {
  const kind = manifest.subjects[0]!.kind;
  return {
    taskPayloadHash:        manifest.taskPayloadHashes[`${kind}/${subject}/${evalId}`]!,
    fixtureHashes:          { ...manifest.fixtureHashes } as Record<string, string>,
    executionEnvelopeHash:  integrityValueHash(manifest.executionEnvelope),
    candidateTreatmentId:   `cand-${subject}`,
    baselineTreatmentId:    `base-${subject}`,
    candidateTreatmentHash: `def-cand-${subject}`,
    baselineTreatmentHash:  `def-base-${subject}`,
    runProvenanceId:        manifest.runProvenanceId,
    graderId:               manifest.grader.id,
    graderVersion:          manifest.grader.version,
    rubricId:               manifest.rubric.id,
    rubricVersion:          manifest.rubric.version,
  };
}

/**
 * Build a terminal for the given slot.
 * score: 0 or 1 only (one criterion so computedScore = passed ? 1 : 0).
 * Pass score=null for a grader_invalid (null grading) terminal.
 * Pass status="failed" for execution_failed.
 */
function buildTerminal(
  manifest: IntegrityManifestV2,
  manifestHash: string,
  subject: string,
  evalId: number,
  repetition: number,
  side: "candidate" | "baseline",
  score: 0 | 1 | null = 1,
  status: "succeeded" | "failed" = "succeeded",
): IntegrityTerminalRecordV2 {
  const kind = manifest.subjects[0]!.kind;
  const pairKey = buildPairKey(manifest, subject, evalId);
  const grading: IntegrityTerminalRecordV2["grading"] = score !== null
    ? {
      graderId: manifest.grader.id, graderVersion: manifest.grader.version,
      rubricId: manifest.rubric.id, rubricVersion: manifest.rubric.version,
      expectedCriterionIds: ["c1"],
      outcomes: [{ criterionId: "c1", passed: score === 1 }],
      parseStatus: "parsed", validationStatus: "valid", score,
    }
    : null;
  return {
    schema: INTEGRITY_SCHEMA_V2,
    manifestHash,
    kind,
    subject,
    evalId,
    repetition,
    side,
    treatmentId: side === "candidate" ? `cand-${subject}` : `base-${subject}`,
    status,
    pairKey,
    grading,
    exclusion: status === "failed"
      ? { level: "pair" as const, reason: "execution_failed" as const }
      : null,
  };
}

// ── Fake ISuiteRunner ──────────────────────────────────────────────────────

type TerminalFactory = (hash: string, mft: IntegrityManifestV2) => IntegrityTerminalRecordV2[];

class FakeSuiteRunner implements ISuiteRunner {
  readonly planCalls: SuiteConfig[] = [];
  readonly runPlanCalls: SuiteExecutionPlan[] = [];
  runCallCount = 0;

  constructor(
    private readonly subjects: string[] = ["sdd"],
    private readonly evalIds: number[]  = [0],
    private readonly terminalFactory: TerminalFactory = () => [],
  ) {}

  async plan(cfg: SuiteConfig): Promise<SuiteExecutionPlan> {
    this.planCalls.push(cfg);
    const root = path.join(cfg.workspace, "_integrity-v2", cfg.kind);
    const store = new EvalIntegrityV2Store(root);
    const mft   = buildManifest(cfg.kind as "skills", this.subjects, this.evalIds, cfg.repetitions);
    const stored = await store.createManifest(mft);
    return {
      cfg,
      rows:               [],   // zero rows → LayeredRunner derives root from workspace
      manifestHash:       stored.hash,
      fixtureSourceHashes: {},
      subjectHashes:      Object.fromEntries(this.subjects.map(s => [s, `src-${s}`])),
    };
  }

  async *runPlan(plan: SuiteExecutionPlan, _sink?: IEventSink): AsyncGenerator<SuiteEvent> {
    this.runPlanCalls.push(plan);
    // Simulate SkillEvalRunner: write terminals via factory, skip already-complete ones.
    const root  = path.join(plan.cfg.workspace, "_integrity-v2", plan.cfg.kind);
    const store = new EvalIntegrityV2Store(root);
    const stored = await store.loadManifest();
    for (const t of this.terminalFactory(stored.hash, stored.manifest)) {
      if (!(await store.isTerminalComplete(t))) {
        await store.recordTerminal(t);
      }
    }
    // No SuiteEvents needed for these unit tests.
    yield* ([] as SuiteEvent[]);
  }

  async *run(cfg: SuiteConfig, sink?: IEventSink): AsyncGenerator<SuiteEvent> {
    this.runCallCount++;
    const plan = await this.plan(cfg);
    yield* this.runPlan(plan, sink);
  }
}

// ── Default layered config ─────────────────────────────────────────────────

function layeredCfg(layeredRunId: string, extra: Partial<LayeredConfig> = {}): LayeredConfig {
  return {
    layers:             ["skills"],
    workers:            1,
    gooseCli:           "goose",
    maxTurns:           8,
    timeoutMs:          60_000,
    ambient:            false,
    continueOnFail:     false,
    earlyStopThreshold: 0,
    noEarlyStop:        true,
    repetitions:        1,
    layeredRunId,
    ...extra,
  };
}

/** Drain an async generator, collecting events. */
async function collect(gen: AsyncGenerator<LayeredEvent>): Promise<LayeredEvent[]> {
  const events: LayeredEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

// ── Test suites ────────────────────────────────────────────────────────────

describe("EVAL-LYR-V2 plan/runPlan flow", () => {
  it("calls plan() then runPlan() — never legacy run()", async () => {
    const fake   = new FakeSuiteRunner(["sdd"]);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("run-plan-flow"), NULL_SINK));

    expect(fake.planCalls.length).toBe(1);
    expect(fake.runPlanCalls.length).toBe(1);
    expect(fake.runCallCount).toBe(0);

    const started   = events.find(e => e.type === "layer.started");
    const completed = events.find(e => e.type === "layer.completed");
    expect(started).toBeTruthy();
    expect(completed).toBeTruthy();
  });

  it("passes the correct kind, workspace, and repetitions to plan()", async () => {
    const fake   = new FakeSuiteRunner(["sdd"]);
    const runner = new LayeredRunner(fake, tempRoot);
    await collect(runner.run(layeredCfg("run-cfg-check", { repetitions: 3 }), NULL_SINK));

    const cfg = fake.planCalls[0]!;
    expect(cfg.kind).toBe("skills");
    expect(cfg.repetitions).toBe(3);
    expect(cfg.workspace).toContain("skills");
  });
});

describe("EVAL-LYR-V2 report from integrity-v2 terminals", () => {
  it("emits layer.completed with avgDelta=null and n=0 when no terminals exist", async () => {
    const fake   = new FakeSuiteRunner(["sdd"], [0], () => []);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("no-terminals"), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done).toBeTruthy();
    expect(done!.avgDelta).toBeNull();
    expect(done!.n).toBe(0);
  });

  it("computes exact pp macro/micro report and persists report-state.json", async () => {
    // candidate=1, baseline=0 → deltaPp = 100 pp
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("exact-report"), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done!.avgDelta).toBe(100);  // subjectMacro.meanDeltaPp in pp
    expect(done!.n).toBe(1);           // 1 included subject

    // Verify report-state.json was persisted
    const layerWs     = path.join(tempRoot, "exact-report", "skills");
    const storeRoot   = path.join(layerWs, "_integrity-v2", "skills");
    const store       = new EvalIntegrityV2Store(storeRoot);
    const report      = await store.readReportState();
    expect(report).not.toBeNull();
    expect(report!.pairMicro.meanDeltaPp).toBe(100);
    expect(report!.pairMicro.n).toBe(1);
    expect(report!.subjectMacro.meanDeltaPp).toBe(100);
    expect(report!.subjectMacro.n).toBe(1);
    expect(report!.validPairCount).toBe(1);
    expect(report!.includedSubjectCount).toBe(1);
  });

  it("records execution_failed exclusion and keeps avgDelta null when candidate fails", async () => {
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1, "failed"),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  1),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("failed-cand"), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done!.avgDelta).toBeNull();
    expect(done!.n).toBe(0);

    const layerWs   = path.join(tempRoot, "failed-cand", "skills");
    const storeRoot = path.join(layerWs, "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report!.excludedPairCounts["execution_failed"]).toBeGreaterThan(0);
  });

  it("records grader_invalid exclusion when grading is null", async () => {
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", null),  // grader_invalid
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  1),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("grader-null"), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done!.avgDelta).toBeNull();

    const layerWs   = path.join(tempRoot, "grader-null", "skills");
    const storeRoot = path.join(layerWs, "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report!.excludedPairCounts["grader_invalid"]).toBeGreaterThan(0);
  });

  it("handles multiple repetitions and groups them by subject in subjectMacro", async () => {
    // rep0: cand=1, base=0 → delta=100pp; rep1: cand=1, base=1 → delta=0pp
    // subjectMacro avg = (100+0)/2 = 50pp, pairMicro avg = 50pp, n=2
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
      buildTerminal(mft, hash, "sdd", 0, 1, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 1, "baseline",  1),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(
      layeredCfg("multi-rep", { repetitions: 2 }), NULL_SINK,
    ));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done!.avgDelta).toBe(50);   // subjectMacro.meanDeltaPp
    expect(done!.n).toBe(1);           // 1 subject included

    const layerWs   = path.join(tempRoot, "multi-rep", "skills");
    const storeRoot = path.join(layerWs, "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report!.pairMicro.n).toBe(2);
    expect(report!.pairMicro.meanDeltaPp).toBe(50);
    expect(report!.subjectMacro.n).toBe(1);
  });

  it("two subjects each contribute one subject-macro observation", async () => {
    // sdd: cand=1, base=0 → 100pp; code-review: cand=1, base=1 → 0pp
    // subjectMacro.meanDeltaPp = (100+0)/2 = 50pp, n=2
    const factory: TerminalFactory = (hash, mft) => {
      const subj = mft.subjects.map(s => s.subject);
      return [
        buildTerminal(mft, hash, subj[0]!, 0, 0, "candidate", 1),
        buildTerminal(mft, hash, subj[0]!, 0, 0, "baseline",  0),
        buildTerminal(mft, hash, subj[1]!, 0, 0, "candidate", 1),
        buildTerminal(mft, hash, subj[1]!, 0, 0, "baseline",  1),
      ];
    };
    const fake   = new FakeSuiteRunner(["sdd", "code-review"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(layeredCfg("two-subjects"), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done!.n).toBe(2);
    expect(done!.avgDelta).toBe(50);
  });
});

describe("EVAL-LYR-V2 resume behaviour", () => {
  it("second run calls plan/runPlan again; writeReportState is idempotent", async () => {
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
    ];
    const makeRunner = () => new FakeSuiteRunner(["sdd"], [0], factory);
    const runId      = "resume-idempotent";

    // First run
    const fake1   = makeRunner();
    const runner1 = new LayeredRunner(fake1, tempRoot);
    const events1 = await collect(runner1.run(layeredCfg(runId), NULL_SINK));
    const done1   = events1.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done1!.avgDelta).toBe(100);

    // Second run — same runId, same workspace
    const fake2   = makeRunner();
    const runner2 = new LayeredRunner(fake2, tempRoot);
    const events2 = await collect(runner2.run(layeredCfg(runId), NULL_SINK));
    const done2   = events2.find(e => e.type === "layer.completed") as Extract<LayeredEvent, { type: "layer.completed" }> | undefined;

    expect(fake2.planCalls.length).toBe(1);     // plan always called
    expect(fake2.runPlanCalls.length).toBe(1);   // runPlan always called
    expect(done2!.avgDelta).toBe(100);           // same result
  });

  it("does NOT skip a layer based on state.json; always runs plan/runPlan", async () => {
    const fake   = new FakeSuiteRunner(["sdd"], [0], () => []);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "no-state-skip";

    await collect(runner.run(layeredCfg(runId), NULL_SINK));
    // Second run: same runner instance (same fake)
    const fake2   = new FakeSuiteRunner(["sdd"], [0], () => []);
    const runner2 = new LayeredRunner(fake2, tempRoot);
    await collect(runner2.run(layeredCfg(runId), NULL_SINK));

    // Both runs should call plan/runPlan (not skip based on state.json)
    expect(fake2.planCalls.length).toBe(1);
    expect(fake2.runPlanCalls.length).toBe(1);
  });
});

describe("EVAL-LYR-V2 early stop with nullable avgDelta", () => {
  it("does not early-stop when avgDelta is null (no valid pairs)", async () => {
    const fake   = new FakeSuiteRunner(["sdd"], [0], () => []);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(
      layeredCfg("early-stop-null", {
        layers: ["skills", "agents"],
        noEarlyStop: false,
        earlyStopThreshold: 0,
      }),
      NULL_SINK,
    ));
    const earlyStop = events.find(e => e.type === "early_stop");
    expect(earlyStop).toBeUndefined();  // null avgDelta should never trigger early stop
  });

  it("triggers early stop when avgDelta is a real number <= threshold", async () => {
    // candidate=0, baseline=1 → deltaPp = -100pp (negative, ≤ threshold=0)
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 0),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  1),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const events = await collect(runner.run(
      layeredCfg("early-stop-real", {
        layers: ["skills", "agents"],
        noEarlyStop: false,
        earlyStopThreshold: 0,
      }),
      NULL_SINK,
    ));
    const earlyStop = events.find(e => e.type === "early_stop") as Extract<LayeredEvent, { type: "early_stop" }> | undefined;
    expect(earlyStop).toBeTruthy();
    expect(earlyStop!.avgDelta).toBe(-100);
  });
});

describe("EVAL-LYR-V2 EvalIntegrityV2Store.listTerminals", () => {
  it("returns empty array when terminals directory does not exist", async () => {
    const root  = path.join(tempRoot, "no-terminals");
    const store = new EvalIntegrityV2Store(root);
    // Create manifest so loadManifest succeeds
    const mft    = buildManifest("skills", ["sdd"], [0], 1);
    await store.createManifest(mft);
    expect(await store.listTerminals()).toEqual([]);
  });

  it("returns all valid terminal records from the terminals directory", async () => {
    const root   = path.join(tempRoot, "list-ok");
    const store  = new EvalIntegrityV2Store(root);
    const mft    = buildManifest("skills", ["sdd"], [0], 1);
    const stored = await store.createManifest(mft);

    const candT = buildTerminal(mft, stored.hash, "sdd", 0, 0, "candidate");
    const baseT = buildTerminal(mft, stored.hash, "sdd", 0, 0, "baseline");
    await store.recordTerminal(candT);
    await store.recordTerminal(baseT);

    const list = await store.listTerminals();
    expect(list).toHaveLength(2);
    expect(list.map(t => t.side).sort()).toEqual(["baseline", "candidate"]);
  });

  it("rejects corrupt (invalid JSON) terminal file", async () => {
    const root   = path.join(tempRoot, "corrupt-json");
    const store  = new EvalIntegrityV2Store(root);
    const mft    = buildManifest("skills", ["sdd"], [0], 1);
    await store.createManifest(mft);
    await fs.mkdir(path.join(root, "terminals"), { recursive: true });
    await fs.writeFile(path.join(root, "terminals", "corrupt.json"), "not json { bad }");
    await expect(store.listTerminals()).rejects.toThrow(/corrupt/i);
  });

  it("rejects a terminal file whose bytes are not canonical (non-sorted keys)", async () => {
    const root   = path.join(tempRoot, "non-canonical");
    const store  = new EvalIntegrityV2Store(root);
    const mft    = buildManifest("skills", ["sdd"], [0], 1);
    const stored = await store.createManifest(mft);
    const t      = buildTerminal(mft, stored.hash, "sdd", 0, 0, "candidate");
    // Write via JSON.stringify (non-canonical key order) rather than via store
    await fs.mkdir(path.join(root, "terminals"), { recursive: true });
    await fs.writeFile(path.join(root, "terminals", "noncanon.json"), JSON.stringify(t));
    await expect(store.listTerminals()).rejects.toThrow(/corrupt/i);
  });

  it("rejects duplicate slot identity (same kind/subject/evalId/repetition/side)", async () => {
    const root   = path.join(tempRoot, "dup-slot");
    const store  = new EvalIntegrityV2Store(root);
    const mft    = buildManifest("skills", ["sdd"], [0], 1);
    const stored = await store.createManifest(mft);
    const t = buildTerminal(mft, stored.hash, "sdd", 0, 0, "candidate");
    await store.recordTerminal(t);

    // Inject a second file with the same slot identity but different treatmentId
    // (different filename hash so the file is written, but same logical slot).
    // We do this by directly writing a canonical record to a different filename.
    // We need canonicalize to produce it — we'll import it indirectly via the store.
    // Simplest: write a second terminal with a different content forcing a new filename.
    // BUT: the store's terminalPath includes treatmentId, so a different treatmentId →
    // different file. We manufacture one by copying the file under a new name.
    const terminalsDir = path.join(root, "terminals");
    const [existing]   = await fs.readdir(terminalsDir);
    const src          = path.join(terminalsDir, existing!);
    await fs.copyFile(src, path.join(terminalsDir, "duplicate-slot.json"));

    await expect(store.listTerminals()).rejects.toThrow(/duplicate.*slot/i);
  });
});

describe("EVAL-LYR-V2 persisted report fidelity (readReportState guard)", () => {
  /**
   * These tests verify that computeReportFromTerminals:
   *   1. Calls store.readReportState() after store.writeReportState()
   *   2. Returns avgDelta/n from the reloaded report (not the in-memory summary)
   *   3. state.json and layer.completed both reflect the persisted values
   *
   * Consequence: if the write did not persist (null reloaded), the runner throws
   * and no layer.completed event is emitted.
   */

  it("state.json and layer.completed avgDelta/n match persisted report-state.json fields", async () => {
    // candidate=1, baseline=0 → 100 pp, subjectMacro.n=1
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "fidelity-match";
    const events = await collect(runner.run(layeredCfg(runId), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as
      Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done).toBeTruthy();

    // Read the persisted report-state.json
    const layerWs   = path.join(tempRoot, runId, "skills");
    const storeRoot = path.join(layerWs, "_integrity-v2", "skills");
    const store     = new EvalIntegrityV2Store(storeRoot);
    const report    = await store.readReportState();
    expect(report).not.toBeNull();

    // layer.completed fields must reflect the persisted report (projected from subjectMacro)
    expect(done!.avgDelta).toBe(report!.subjectMacro.meanDeltaPp);
    expect(done!.n).toBe(report!.subjectMacro.n);
    expect(done!.avgDelta).toBe(100);
    expect(done!.n).toBe(1);

    // state.json must also carry the persisted values
    const stateBytes = await fs.readFile(path.join(tempRoot, runId, "state.json"), "utf8");
    const state = JSON.parse(stateBytes) as {
      layers: Record<string, { avgDelta: number | null; n: number }>;
    };
    expect(state.layers["skills"]!.avgDelta).toBe(report!.subjectMacro.meanDeltaPp);
    expect(state.layers["skills"]!.n).toBe(report!.subjectMacro.n);
  });

  it("report-state.json exists before layer.completed is observed (readReportState guard enforced)", async () => {
    // This test verifies the invariant: if readReportState() returned null after
    // writeReportState(), the runner would throw and no layer.completed would be emitted.
    // Getting a layer.completed event proves the read-back succeeded.
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "fidelity-guard";

    const events = await collect(runner.run(layeredCfg(runId), NULL_SINK));
    const done   = events.find(e => e.type === "layer.completed");
    expect(done).toBeTruthy(); // if throw had occurred, done would be undefined

    // Confirm report-state.json is present with expected values
    const storeRoot = path.join(tempRoot, runId, "skills", "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report).not.toBeNull();
    expect(report!.subjectMacro.meanDeltaPp).toBe(100);
    expect(report!.subjectMacro.n).toBe(1);
  });

  it("null avgDelta case: state.json, layer.completed, and persisted report all reflect null/0", async () => {
    // No terminals → all pairs excluded → meanDeltaPp=null, n=0
    const fake   = new FakeSuiteRunner(["sdd"], [0], () => []);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "fidelity-null";
    const events = await collect(runner.run(layeredCfg(runId), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as
      Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done).toBeTruthy();

    const storeRoot = path.join(tempRoot, runId, "skills", "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report).not.toBeNull();

    // All three surfaces agree: null avgDelta, n=0
    expect(done!.avgDelta).toBeNull();
    expect(done!.avgDelta).toBe(report!.subjectMacro.meanDeltaPp);
    expect(done!.n).toBe(0);
    expect(done!.n).toBe(report!.subjectMacro.n);

    const state = JSON.parse(
      await fs.readFile(path.join(tempRoot, runId, "state.json"), "utf8"),
    ) as { layers: Record<string, { avgDelta: number | null; n: number }> };
    expect(state.layers["skills"]!.avgDelta).toBeNull();
    expect(state.layers["skills"]!.n).toBe(0);
    expect(state.layers["skills"]!.avgDelta).toBe(report!.subjectMacro.meanDeltaPp);
    expect(state.layers["skills"]!.n).toBe(report!.subjectMacro.n);
  });

  it("execution_failed exclusion: null avgDelta in all three surfaces", async () => {
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1, "failed"),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  1),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "fidelity-excl";
    const events = await collect(runner.run(layeredCfg(runId), NULL_SINK));

    const done = events.find(e => e.type === "layer.completed") as
      Extract<LayeredEvent, { type: "layer.completed" }> | undefined;
    expect(done).toBeTruthy();

    const storeRoot = path.join(tempRoot, runId, "skills", "_integrity-v2", "skills");
    const report    = await new EvalIntegrityV2Store(storeRoot).readReportState();
    expect(report).not.toBeNull();
    expect(done!.avgDelta).toBeNull();
    expect(done!.avgDelta).toBe(report!.subjectMacro.meanDeltaPp);
    expect(report!.excludedPairCounts["execution_failed"]).toBeGreaterThan(0);
  });

  it("state.json.report deep-equals store.readReportState() (candidateMean/baselineMean observable)", async () => {
    // candidate=1, baseline=0 → candidateMean=1.0, baselineMean=0.0, meanDeltaPp=100pp
    const factory: TerminalFactory = (hash, mft) => [
      buildTerminal(mft, hash, "sdd", 0, 0, "candidate", 1),
      buildTerminal(mft, hash, "sdd", 0, 0, "baseline",  0),
    ];
    const fake   = new FakeSuiteRunner(["sdd"], [0], factory);
    const runner = new LayeredRunner(fake, tempRoot);
    const runId  = "report-embed-deep-eq";
    await collect(runner.run(layeredCfg(runId), NULL_SINK));

    const storeRoot = path.join(tempRoot, runId, "skills", "_integrity-v2", "skills");
    const store     = new EvalIntegrityV2Store(storeRoot);
    const persisted = await store.readReportState();
    expect(persisted).not.toBeNull();

    const stateBytes = await fs.readFile(path.join(tempRoot, runId, "state.json"), "utf8");
    const state = JSON.parse(stateBytes) as {
      layers: Record<string, { avgDelta: number | null; n: number; elapsedMs: number; report: typeof persisted }>;
    };

    // state.json must embed the full reloaded normalized report
    expect(state.layers["skills"]).toBeDefined();
    expect(state.layers["skills"]!.report).toEqual(persisted);
    // candidateMean and baselineMean must be observable from state.json
    expect(state.layers["skills"]!.report!.pairMicro.candidateMean).toBe(persisted!.pairMicro.candidateMean);
    expect(state.layers["skills"]!.report!.pairMicro.baselineMean).toBe(persisted!.pairMicro.baselineMean);
    expect(state.layers["skills"]!.report!.subjectMacro.candidateMean).toBe(persisted!.subjectMacro.candidateMean);
    expect(state.layers["skills"]!.report!.subjectMacro.baselineMean).toBe(persisted!.subjectMacro.baselineMean);
  });
});

describe("EVAL-LYR-V2 pairedSubjectDelta retained as deprecated helper", () => {
  it("still computes correct paired delta (backward-compat)", () => {
    const rows = [
      { evalId: 0, config: "skill_l1", run: 1, score: 1,    passed: true  },
      { evalId: 0, config: "skill_l0", run: 1, score: 0.25, passed: false },
    ];
    expect(pairedSubjectDelta(rows, "skill_l1", "skill_l0")).toBe(0.75);
  });

  it("returns null when no numeric pair exists", () => {
    const rows = [{ evalId: 0, config: "skill_l1", run: 1, score: 1, passed: true }];
    expect(pairedSubjectDelta(rows, "skill_l1", "skill_l0")).toBeNull();
  });
});
