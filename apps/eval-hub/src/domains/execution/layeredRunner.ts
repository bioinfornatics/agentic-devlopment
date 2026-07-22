/**
 * ILayeredRunner — L1 → L2 → L3 with early stop and resume.
 *
 * v2 production path: uses ISuiteRunner.plan() / runPlan() exclusively.
 * Never reads grading.json (legacy path). avgDelta is nullable — null when
 * no valid evidence pairs are available for a layer.
 *
 * Resume: always plan/runPlan. SkillEvalRunner skips only complete terminals.
 * state.json is not consulted to skip layers; it is written for observability.
 */
import path from "node:path";
import fs   from "node:fs/promises";
import type { ILayeredRunner, ISuiteRunner, LayeredConfig, IEventSink, SuiteConfig } from "./ports.js";
import type { LayeredEvent } from "../../shared/events.js";
import type { EvalKind } from "../../shared/types.js";
import { SuiteRunner }         from "./suiteRunner.js";
import { LAYERED_ROOT, EVALS_DIR } from "../../shared/paths.js";
import { NULL_SINK } from "../../shared/eventBus.js";
import { validateRepetitionCount } from "./executionIntegrity.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  type IntegrityTerminalRecordV2,
  type NormalizedIntegrityReportStateV2,
} from "../persistence/integrityV2Store.js";
import {
  evaluatePair,
  summarizeIntegrityPairs,
  type IntegrityEvidence,
  type TerminalEvidenceStatus,
  type ValidPair,
  type PairExclusion,
} from "../measurement/integrityMeasurement.js";

const LAYER_ORDER: EvalKind[] = ["skills", "agents", "recipes"];

/** State written to state.json for observability — does not control skipping. */
interface LayerState {
  status: "done";
  avgDelta: number | null;
  n: number;
  elapsedMs: number;
  report: NormalizedIntegrityReportStateV2;
}
interface RunState { layers: Partial<Record<EvalKind, LayerState>>; }

/**
 * @deprecated Pure helper for legacy grading.json pairing.
 * No production references — use integrityMeasurement.evaluatePair /
 * summarizeIntegrityPairs instead.
 */
export function pairedSubjectDelta(
  gradings: readonly import("../persistence/ports.js").GradingRecord[],
  candidateConfig: string,
  baselineConfig: string,
): number | null {
  const key = (g: import("../persistence/ports.js").GradingRecord) => `${g.evalId}:${g.run}`;
  const candidate = new Map(gradings.filter(g => g.config === candidateConfig).map(g => [key(g), g.score]));
  const baseline  = new Map(gradings.filter(g => g.config === baselineConfig).map(g => [key(g), g.score]));
  const deltas = [...candidate.entries()]
    .filter(([pairKey, score]) => Number.isFinite(score) && Number.isFinite(baseline.get(pairKey)))
    .map(([pairKey, score]) => score - baseline.get(pairKey)!);
  return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
}

export class LayeredRunner implements ILayeredRunner {
  constructor(
    private readonly suite:       ISuiteRunner = new SuiteRunner(),
    private readonly layeredRoot: string       = LAYERED_ROOT,
  ) {}

  async *run(cfg: LayeredConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<LayeredEvent> {
    const repetitions = validateRepetitionCount(cfg.repetitions ?? 1);
    const runId  = cfg.layeredRunId ?? new Date().toISOString().replace(/[:\-.]/g, "").slice(0, 15) + "Z";
    const baseWs = path.join(this.layeredRoot, runId);
    await fs.mkdir(baseWs, { recursive: true });

    const statePath = path.join(baseWs, "state.json");
    const state: RunState = await this.loadState(statePath);
    const layers = LAYER_ORDER.filter(k => cfg.layers.includes(k));

    for (const kind of layers) {
      const subjects = await this.discoverSubjects(kind, cfg.subjectFilter);

      yield { type: "layer.started", level: this.level(kind), kind, total: subjects.length, workers: cfg.workers };
      const layerStart = Date.now();
      const layerWs    = path.join(baseWs, kind);
      await fs.mkdir(layerWs, { recursive: true });

      // ── Plan: resolve all subjects/treatments/payloads and write manifest ──

      const suiteConfig: SuiteConfig = {
        kind, subjects, workspace: layerWs,
        gooseCli:       cfg.gooseCli,
        workers:        cfg.workers,
        mode:           kind === "skills" ? "with-without" : "layer-delta",
        maxTurns:       cfg.maxTurns,
        timeoutMs:      cfg.timeoutMs,
        ambient:        cfg.ambient,
        continueOnFail: cfg.continueOnFail,
        repetitions,
      };

      const plan = await this.suite.plan(suiteConfig);

      // ── Run: execute the planned rows (SkillEvalRunner skips complete slots) ──

      for await (const ev of this.suite.runPlan(plan, sink)) {
        yield ev as LayeredEvent;
      }

      // ── Compute integrity report from terminal records ──────────────────────

      // Derive the integrity root: prefer plan rows (they carry the exact root
      // written by SuiteRunner), fall back to the canonical location for zero rows.
      const integrityRoot = plan.rows.length > 0
        ? plan.rows[0]!.runCfg.integrity.root
        : path.join(layerWs, "_integrity-v2", kind);

      const { avgDelta, n, report: reloadedReport } = await this.computeReportFromTerminals(integrityRoot);

      const elapsedMs = Date.now() - layerStart;
      state.layers[kind] = { status: "done", avgDelta, n, elapsedMs, report: reloadedReport };
      await this.saveState(statePath, state);

      yield { type: "layer.completed", level: this.level(kind), kind, avgDelta, n, durationMs: elapsedMs };

      // Early stop only when avgDelta is a real measurement (not null).
      if (avgDelta !== null && !cfg.noEarlyStop && avgDelta <= cfg.earlyStopThreshold) {
        const remaining = layers.slice(layers.indexOf(kind) + 1);
        if (remaining.length > 0) {
          yield { type: "early_stop", level: this.level(kind), kind, avgDelta, threshold: cfg.earlyStopThreshold, skipping: remaining };
          for (const k of remaining) {
            yield { type: "layer.skipped", level: this.level(k), kind: k, reason: "early_stop" };
          }
          return;
        }
      }
    }
  }

  // ── Report computation ────────────────────────────────────────────────────

  private async computeReportFromTerminals(
    integrityRoot: string,
  ): Promise<{ avgDelta: number | null; n: number; report: NormalizedIntegrityReportStateV2 }> {
    const store  = new EvalIntegrityV2Store(integrityRoot);
    const stored = await store.loadManifest();
    const manifest = stored.manifest;

    // Index all valid terminals by slot key.
    const terminals = await store.listTerminals();
    const bySlot = new Map<string, IntegrityTerminalRecordV2>();
    for (const t of terminals) {
      bySlot.set(`${t.kind}:${t.subject}:${t.evalId}:${t.repetition}:${t.side}`, t);
    }

    // Build expected pair loop from manifest declaration.
    const validPairs: ValidPair[]   = [];
    const exclusions: PairExclusion[] = [];

    for (const subjectEntry of manifest.subjects) {
      for (const evalId of subjectEntry.evalIds) {
        for (let repetition = 0; repetition < manifest.repetitions; repetition++) {
          const candidateRec = bySlot.get(`${subjectEntry.kind}:${subjectEntry.subject}:${evalId}:${repetition}:candidate`) ?? null;
          const baselineRec  = bySlot.get(`${subjectEntry.kind}:${subjectEntry.subject}:${evalId}:${repetition}:baseline`) ?? null;

          const candidateEvidence = candidateRec !== null ? this.toEvidence(candidateRec) : null;
          const baselineEvidence  = baselineRec  !== null ? this.toEvidence(baselineRec)  : null;

          const result = evaluatePair(candidateEvidence, baselineEvidence);
          if (result.valid) validPairs.push(result);
          else exclusions.push(result as PairExclusion);
        }
      }
    }

    const summary = summarizeIntegrityPairs(validPairs, exclusions);

    // Convert PairedInterval → IntegrityIntervalV2 (strip n, normalise absent reason to null).
    const toInterval = (iv: typeof summary.pairMicro.interval): NormalizedIntegrityReportStateV2["pairMicro"]["interval"] => ({
      method: iv.method,
      lower:  iv.lower,
      upper:  iv.upper,
      reason: iv.reason ?? null,
    });

    const report: NormalizedIntegrityReportStateV2 = {
      schema:               INTEGRITY_SCHEMA_V2,
      manifestHash:         stored.hash,
      pairMicro: {
        meanDeltaPp:   summary.pairMicro.meanDeltaPp,
        candidateMean: summary.pairMicro.candidateMean,
        baselineMean:  summary.pairMicro.baselineMean,
        n:             summary.pairMicro.n,
        interval:      toInterval(summary.pairMicro.interval),
      },
      subjectMacro: {
        meanDeltaPp:   summary.subjectMacro.meanDeltaPp,
        candidateMean: summary.subjectMacro.candidateMean,
        baselineMean:  summary.subjectMacro.baselineMean,
        n:             summary.subjectMacro.n,
        interval:      toInterval(summary.subjectMacro.interval),
      },
      validPairCount:       summary.pairMicro.n,
      includedSubjectCount: summary.subjectMacro.n,
      excludedPairCounts:   summary.exclusions,
      subjectFailureCounts: summary.subjectFailures,
    };

    await store.writeReportState(report);

    // Read back the persisted state immediately to validate write fidelity and
    // to ensure avgDelta/n are projected from the canonical persisted record —
    // not from the in-memory summary.  Throws if the store fails to surface the
    // record (which would indicate a filesystem inconsistency).
    const reloaded = await store.readReportState();
    if (reloaded === null) {
      throw new Error(
        "integrity store: readReportState returned null immediately after writeReportState — " +
        "filesystem inconsistency detected; cannot project layer result",
      );
    }

    return { avgDelta: reloaded.subjectMacro.meanDeltaPp, n: reloaded.subjectMacro.n, report: reloaded };
  }

  /** Convert a stored terminal record to IntegrityEvidence for evaluatePair. */
  private toEvidence(record: IntegrityTerminalRecordV2): IntegrityEvidence {
    let terminalStatus: TerminalEvidenceStatus;
    if (record.status === "failed" || record.exclusion?.reason === "execution_failed") {
      terminalStatus = "execution_failed";
    } else if (
      record.exclusion?.reason === "grader_invalid"
      || record.grading === null
      || record.grading.score === null
    ) {
      terminalStatus = "grader_invalid";
    } else {
      terminalStatus = "graded";
    }
    return {
      kind:                   record.kind,
      subject:                record.subject,
      evalId:                 record.evalId,
      repetition:             record.repetition,
      side:                   record.side,
      taskPayloadHash:        record.pairKey.taskPayloadHash,
      fixtureHashes:          record.pairKey.fixtureHashes,
      executionEnvelopeHash:  record.pairKey.executionEnvelopeHash,
      candidateTreatmentId:   record.pairKey.candidateTreatmentId,
      baselineTreatmentId:    record.pairKey.baselineTreatmentId,
      candidateTreatmentHash: record.pairKey.candidateTreatmentHash,
      baselineTreatmentHash:  record.pairKey.baselineTreatmentHash,
      runProvenanceId:        record.pairKey.runProvenanceId,
      graderId:               record.pairKey.graderId,
      graderVersion:          record.pairKey.graderVersion,
      rubricId:               record.pairKey.rubricId,
      rubricVersion:          record.pairKey.rubricVersion,
      terminalStatus,
      score: record.grading?.score ?? null,
    };
  }

  // ── Subject discovery ─────────────────────────────────────────────────────

  private async discoverSubjects(kind: EvalKind, filter?: readonly string[]): Promise<string[]> {
    try {
      const entries = await fs.readdir(path.join(EVALS_DIR, kind), { encoding: "utf8" });
      const all = entries.filter(e => e.endsWith(".json")).map(e => e.replace(".json", "")).sort();
      return filter?.length ? all.filter(s => filter.includes(s)) : all;
    } catch { return []; }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private level(kind: EvalKind): string {
    return { skills: "L1", agents: "L2", recipes: "L3" }[kind];
  }

  private async loadState(p: string): Promise<RunState> {
    try { return JSON.parse(await fs.readFile(p, "utf8")) as RunState; }
    catch { return { layers: {} }; }
  }

  private async saveState(p: string, state: RunState): Promise<void> {
    await fs.writeFile(p, JSON.stringify(state, null, 2));
  }
}
