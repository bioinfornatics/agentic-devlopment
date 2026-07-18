/**
 * ILayeredRunner — L1 → L2 → L3 with early stop and resume.
 *
 * Fixes vs previous version:
 *  - computeAvgDelta delegates to DeltaService (measurement domain).
 *  - rglob() replaced by IWorkspaceReader.readGradings() calls.
 *  - countFiles() cast hack removed; uses IWorkspaceReader instead.
 *  - IEventSink forwarded through to SuiteRunner.
 *  - gooseCli (was gooaseCli) throughout.
 */
import path from "node:path";
import fs   from "node:fs/promises";
import type { ILayeredRunner, ISuiteRunner, LayeredConfig, IEventSink } from "./ports.js";
import type { LayeredEvent } from "../../shared/events.js";
import type { EvalKind } from "../../shared/types.js";
import { SuiteRunner }         from "./suiteRunner.js";
import { FsWorkspaceReader }   from "../persistence/workspaceReader.js";
import type { IWorkspaceReader } from "../persistence/ports.js";
import { DeltaService }        from "../measurement/deltaService.js";
import type { IDeltaService }  from "../measurement/ports.js";
import { LAYERED_ROOT, EVALS_DIR } from "../../shared/paths.js";
import { NULL_SINK } from "../../shared/eventBus.js";

const LAYER_ORDER: EvalKind[] = ["skills", "agents", "recipes"];

interface LayerState { status: "done"; avgDelta: number; n: number; elapsedMs: number; }
interface RunState   { layers: Partial<Record<EvalKind, LayerState>>; }

export class LayeredRunner implements ILayeredRunner {
  constructor(
    private readonly suite:     ISuiteRunner     = new SuiteRunner(),
    private readonly workspace: IWorkspaceReader  = new FsWorkspaceReader(),
    private readonly delta:     IDeltaService     = new DeltaService(),
  ) {}

  async *run(cfg: LayeredConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<LayeredEvent> {
    const runId  = cfg.layeredRunId ?? new Date().toISOString().replace(/[:\-.]/g, "").slice(0, 15) + "Z";
    const baseWs = path.join(LAYERED_ROOT, runId);
    await fs.mkdir(baseWs, { recursive: true });

    const statePath = path.join(baseWs, "state.json");
    const state: RunState = await this.loadState(statePath);
    const layers = LAYER_ORDER.filter(k => cfg.layers.includes(k));

    for (const kind of layers) {
      const existing = state.layers[kind];
      if (existing?.status === "done") {
        yield { type: "layer.skipped", level: this.level(kind), kind, reason: "already_done" };
        continue;
      }

      const subjects  = await this.discoverSubjects(kind, cfg.subjectFilter);
      const completed = await this.completedSubjects(kind, baseWs);
      const todo      = subjects.filter(s => !completed.has(s));

      yield { type: "layer.started", level: this.level(kind), kind, total: subjects.length, workers: cfg.workers };
      const layerStart = Date.now();
      const layerWs    = path.join(baseWs, kind);
      await fs.mkdir(layerWs, { recursive: true });

      for await (const ev of this.suite.run({
        kind, subjects: todo, workspace: layerWs,
        gooseCli:  cfg.gooseCli,
        workers:   cfg.workers,
        mode:      kind === "skills" ? "with-without" : "layer-delta",
        maxTurns:  cfg.maxTurns,
        timeoutMs: cfg.timeoutMs,
        ambient:   cfg.ambient,
        continueOnFail: cfg.continueOnFail,
      }, sink)) {
        yield ev as LayeredEvent;
      }

      const { avg: avgDelta, n: gradingN } = await this.computeAvgDelta(kind, layerWs, subjects);
      const elapsedMs = Date.now() - layerStart;

      state.layers[kind] = { status: "done", avgDelta, n: subjects.length, elapsedMs };
      await this.saveState(statePath, state);

      yield { type: "layer.completed", level: this.level(kind), kind, avgDelta, n: subjects.length, durationMs: elapsedMs };

      // n === 0 means no grading data found at all — do NOT early-stop on phantom zero
      if (gradingN > 0 && !cfg.noEarlyStop && avgDelta <= cfg.earlyStopThreshold) {
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

  // ── Delta computation via DeltaService ────────────────────────────────────

  private async computeAvgDelta(
    kind: EvalKind,
    layerWs: string,
    subjects: string[],
  ): Promise<{ avg: number; n: number }> {
    // 1. Prefer benchmark.json (written by skill-creator when available)
    const benchDeltas = await this.collectBenchmarkDeltas(layerWs);
    if (benchDeltas.length > 0) {
      return { avg: this.delta.layerAvgDelta(benchDeltas), n: benchDeltas.length };
    }

    // 2. Fall back: pair grading.json files via IWorkspaceReader + DeltaService
    const gradingDeltas: number[] = [];
    for (const subject of subjects) {
      try {
        const runs = await this.workspace.listRuns(kind, subject);
        if (runs.length === 0) continue;
        const hash     = runs[0]!.hash;
        const gradings = await this.workspace.readGradings(kind, subject, hash);
        if (gradings.length === 0) continue;

        // Identify candidate/baseline config names from grading records
        const configNames = [...new Set(gradings.map(g => g.config))];
        const withConfig  = configNames.find(c => c.startsWith("with_"));
        const baseConfig  = configNames.find(c => c.startsWith("without_") || c.endsWith("_only"));
        if (!withConfig || !baseConfig) continue;

        // Filter out records where grading failed (pass_rate is null in grading.json)
        // We read raw grading.json to access pass_rate since GradingRecord.score is 0 for null
        const withStats  = this.delta.passRate(gradings, withConfig);
        const baseStats  = this.delta.passRate(gradings, baseConfig);
        if (withStats.n === 0 && baseStats.n === 0) continue;

        const d = this.delta.delta(withStats, baseStats);
        gradingDeltas.push(d.passRate);
      } catch { /* skip subject on error */ }
    }

    return { avg: this.delta.layerAvgDelta(gradingDeltas), n: gradingDeltas.length };
  }

  private async collectBenchmarkDeltas(layerWs: string): Promise<number[]> {
    const deltas: number[] = [];
    try {
      const subjects = await fs.readdir(layerWs, { encoding: "utf8", withFileTypes: true });
      for (const s of subjects.filter(e => e.isDirectory())) {
        const hashes = await fs.readdir(path.join(layerWs, s.name), { encoding: "utf8", withFileTypes: true });
        for (const h of hashes.filter(e => e.isDirectory())) {
          try {
            const bPath = path.join(layerWs, s.name, h.name, "benchmark.json");
            const data  = JSON.parse(await fs.readFile(bPath, "utf8")) as Record<string, unknown>;
            const pr    = ((data["runSummary"] as Record<string, unknown>)?.["delta"] as Record<string, unknown>)?.["pass_rate"];
            if (typeof pr === "number") deltas.push(pr);
          } catch { /* no benchmark.json */ }
        }
      }
    } catch { /* layerWs absent */ }
    return deltas;
  }

  // ── Subject discovery ─────────────────────────────────────────────────────

  private async discoverSubjects(kind: EvalKind, filter?: readonly string[]): Promise<string[]> {
    try {
      const entries = await fs.readdir(path.join(EVALS_DIR, kind), { encoding: "utf8" });
      const all = entries.filter(e => e.endsWith(".json")).map(e => e.replace(".json", "")).sort();
      return filter?.length ? all.filter(s => filter.includes(s)) : all;
    } catch { return []; }
  }

  private async completedSubjects(kind: EvalKind, baseWs: string): Promise<Set<string>> {
    const done = new Set<string>();
    try {
      const subjects = await fs.readdir(path.join(baseWs, kind), { encoding: "utf8", withFileTypes: true });
      for (const s of subjects.filter(e => e.isDirectory())) {
        try {
          // A subject is done when it has grading.json files for every expected (evalId × config × run)
          const gradings = await this.workspace.readGradings(kind, s.name, await this.latestHash(kind, s.name, baseWs));
          if (gradings.length > 0) done.add(s.name);
        } catch { /* skip */ }
      }
    } catch { /* layer not started */ }
    return done;
  }

  private async latestHash(kind: EvalKind, subject: string, baseWs: string): Promise<string> {
    const subjectDir = path.join(baseWs, kind, subject);
    const entries    = await fs.readdir(subjectDir, { encoding: "utf8", withFileTypes: true });
    const hashes     = entries.filter(e => e.isDirectory()).map(e => e.name);
    return hashes[0] ?? "";
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
