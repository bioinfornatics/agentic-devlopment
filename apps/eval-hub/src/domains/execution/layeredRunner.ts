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
import { LAYER_META } from "../../shared/types.js";
import { SuiteRunner }         from "./suiteRunner.js";
import { FsWorkspaceReader }   from "../persistence/workspaceReader.js";
import type { IWorkspaceReader } from "../persistence/ports.js";
import { DeltaService }        from "../measurement/deltaService.js";
import type { IDeltaService }  from "../measurement/ports.js";
import { LAYERED_ROOT, EVALS_DIR, DIST_EVALS } from "../../shared/paths.js";
import { NULL_SINK } from "../../shared/eventBus.js";

const LAYER_ORDER: EvalKind[] = ["skills", "agents", "recipes"];

interface LayerState { status: "done"; avgDelta: number; n: number; elapsedMs: number; }
interface RunState   { layers: Partial<Record<EvalKind, LayerState>>; }

export function pairedSubjectDelta(
  gradings: readonly import("../persistence/ports.js").GradingRecord[],
  candidateConfig: string,
  baselineConfig: string,
): number | null {
  const candidate = new Map(gradings.filter(g => g.config === candidateConfig).map(g => [g.evalId, g.score]));
  const baseline = new Map(gradings.filter(g => g.config === baselineConfig).map(g => [g.evalId, g.score]));
  const deltas = [...candidate.entries()]
    .filter(([evalId, score]) => Number.isFinite(score) && Number.isFinite(baseline.get(evalId)))
    .map(([evalId, score]) => score - baseline.get(evalId)!);
  return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
}

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

      state.layers[kind] = { status: "done", avgDelta, n: gradingN, elapsedMs };
      await this.saveState(statePath, state);

      yield { type: "layer.completed", level: this.level(kind), kind, avgDelta, n: gradingN, durationMs: elapsedMs };

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
    const gradingDeltas: number[] = [];
    const [withConfig, baseConfig] = LAYER_META[kind].configs;
    for (const subject of subjects) {
      try {
        const hashDir = await this.layeredHashDir(kind, layerWs, subject);
        if (!hashDir) continue;
        const gradings = await this.workspace.readGradingsAt(hashDir);
        const paired = pairedSubjectDelta(gradings, withConfig!, baseConfig!);
        if (paired !== null) gradingDeltas.push(paired);
      } catch { /* invalid or incomplete subject: exclude */ }
    }
    return { avg: this.delta.layerAvgDelta(gradingDeltas), n: gradingDeltas.length };
  }

  private async layeredHashDir(kind: EvalKind, layerWs: string, subject: string): Promise<string | null> {
    const subjectDir = path.join(layerWs, subject);
    try {
      const entries = await fs.readdir(subjectDir, { withFileTypes: true });
      const hashes = entries.filter(e => e.isDirectory()).map(e => e.name);
      if (hashes.length !== 1) return null;

      const runHashDir = path.join(subjectDir, hashes[0]!);
      if ((await this.workspace.readGradingsAt(runHashDir)).length > 0) return runHashDir;

      try {
        const recorded = (await fs.readFile(path.join(runHashDir, "artifact_path.txt"), "utf8")).trim();
        if (recorded) return recorded;
      } catch { /* legacy run: hash is the only provenance marker */ }

      // Older layered runs stored only a hash marker. Resolve that exact hash
      // without selecting a newer artifact by mtime or directory order.
      return path.join(DIST_EVALS, kind, subject, hashes[0]!);
    } catch { return null; }
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
          const scenarios = JSON.parse(await fs.readFile(path.join(EVALS_DIR, kind, `${s.name}.json`), "utf8")) as unknown[];
          const hashDir = await this.layeredHashDir(kind, path.join(baseWs, kind), s.name);
          if (!hashDir) continue;
          const gradings = await this.workspace.readGradingsAt(hashDir);
          const configs = LAYER_META[kind].configs;
          const complete = scenarios.every((_, evalId) => configs.every(config =>
            gradings.some(g => g.evalId === evalId && g.config === config),
          ));
          if (complete && gradings.length === scenarios.length * configs.length) done.add(s.name);
        } catch { /* skip */ }
      }
    } catch { /* layer not started */ }
    return done;
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
