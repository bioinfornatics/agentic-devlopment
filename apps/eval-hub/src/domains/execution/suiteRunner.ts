/**
 * ISuiteRunner — runs subjects in parallel with a bounded worker pool.
 *
 * Fixes vs previous version:
 *  - Events from IEvalRunner are forwarded to the injected IEventSink.
 *  - continueOnFail NOW stops execution: uses a completion-notification queue
 *    so subjects are yielded as they finish (not after all complete).
 *  - CONFIGS_BY_MODE derived from LAYER_META — single source of truth.
 *  - Ambient isolation uses AMBIENT_HIDE_DIRS from paths.ts.
 */
import path from "node:path";
import fs   from "node:fs/promises";
import type { ISuiteRunner, IEvalRunner, SuiteConfig, IEventSink, GooseRuntimeIdentity, SuiteExecutionPlan, SuiteExecutionRow, ScenarioRunConfig } from "./ports.js";
import type { SuiteEvent } from "../../shared/events.js";
import type { EvalScenario } from "../../shared/types.js";
import { LAYER_META } from "../../shared/types.js";
import { SkillEvalRunner }  from "./evalRunner.js";
import { SkillPromptBuilder } from "./promptBuilder.js";
import { GooseProcessRunner } from "./gooseRunner.js";
import { defaultGraderDescriptor, defaultRubricDescriptor, expectedCriterionIdsFor } from "./grader.js";
import { EvalIntegrityV2Store, INTEGRITY_SCHEMA_V2, type IntegrityManifestV2 } from "../persistence/integrityV2Store.js";
import { ContentHasher }    from "../persistence/contentHash.js";
import { EVALS_DIR, DIST_EVALS, PROJECT_ROOT, PROJECT_RECIPES_DIR, resolveSubjectPath, AMBIENT_HIDE_DIRS, evalJsonPath } from "../../shared/paths.js";
import { NULL_SINK } from "../../shared/eventBus.js";
import { buildTreatmentPair, hashUtf8, resolveTypedRecipeSource, treatmentContentHash, validateRepetitionCount, type TreatmentPair } from "./executionIntegrity.js";

export interface SuitePlanningRuntime {
  identity(gooseCli: string): Promise<GooseRuntimeIdentity>;
}

export interface SuitePlanningOptions {
  readonly runtime?: SuitePlanningRuntime;
  readonly evalHubRuntimeVersion?: () => string;
  readonly runProvenanceId?: () => string;
  /** Test-only: inject scenarios directly without filesystem reads. */
  readonly scenariosOverride?: Map<string, EvalScenario[]>;
}

export class SuiteRunner implements ISuiteRunner {
  private readonly hasher = new ContentHasher();
  private readonly prompt = new SkillPromptBuilder();
  private readonly runtime: SuitePlanningRuntime;
  private readonly evalHubRuntimeVersion: () => string;
  private readonly runProvenanceId: () => string;
  private readonly scenariosOverride: Map<string, EvalScenario[]> | undefined;

  constructor(private readonly evalRunner: IEvalRunner = new SkillEvalRunner(), options: SuitePlanningOptions = {}) {
    this.runtime = options.runtime ?? new GooseProcessRunner();
    this.evalHubRuntimeVersion = options.evalHubRuntimeVersion ?? (() => process.env["EVAL_HUB_VERSION"] ?? "0.1.0");
    this.runProvenanceId = options.runProvenanceId ?? (() => new Date().toISOString());
    this.scenariosOverride = options.scenariosOverride;
  }

  /** Convenience wrapper: plan then runPlan. */
  async *run(cfg: SuiteConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<SuiteEvent> {
    const execPlan = await this.plan(cfg);
    yield* this.runPlan(execPlan, sink);
  }

  /**
   * Resolve all scenarios / treatments / payloads / fixture hashes / runtime
   * and write the immutable integrity manifest.  Makes ZERO IEvalRunner calls.
   *
   * EVAL-INT-04/05/11/19/20
   */
  async plan(cfg: SuiteConfig): Promise<SuiteExecutionPlan> {
    const repetitions = validateRepetitionCount(cfg.repetitions);
    const scenarios   = await this.loadScenarios(cfg.kind, cfg.subjects, this.scenariosOverride);
    const intPlan     = await this.planIntegrity(cfg, scenarios, repetitions);

    const rows: SuiteExecutionRow[]        = [];
    const subjectHashesRecord: Record<string, string> = {};

    for (const subject of cfg.subjects) {
      const subjectScenarios = scenarios.get(subject) ?? [];
      const subjectPlan = intPlan.subjects.get(subject);
      if (subjectPlan === undefined) throw new Error(`integrity plan missing subject ${subject}`);

      const hash = subjectPlan.sourceHash;
      subjectHashesRecord[subject] = hash;
      const ws   = path.join(cfg.workspace, subject, hash);

      for (const [evalId, scenarioValue] of subjectScenarios.entries()) {
        const scenario    = scenarioValue as EvalScenario;
        const fixtureHashes = subjectPlan.fixtureHashesByEvalId.get(evalId) ?? {};
        const taskKey       = `${cfg.kind}/${subject}/${evalId}`;

        for (let repetition = 0; repetition < repetitions; repetition++) {
          const ordered = repetition % 2 === 0
            ? [subjectPlan.pair.candidate, subjectPlan.pair.baseline]
            : [subjectPlan.pair.baseline,  subjectPlan.pair.candidate];

          for (const treatment of ordered) {
            const side: "candidate" | "baseline" =
              treatment.id === subjectPlan.pair.candidate.id ? "candidate" : "baseline";
            const pairWorkspace = path.join(ws, `eval-${evalId}`, `repetition-${repetition}`, side);

            const runCfg: ScenarioRunConfig = {
              kind: cfg.kind, subject, hash, scenario, evalId,
              config: treatment.id, treatment, repetition,
              workspace: pairWorkspace,
              gooseCli: cfg.gooseCli, maxTurns: cfg.maxTurns, timeoutMs: cfg.timeoutMs, ambient: cfg.ambient,
              fixtureHashes,
              plannedTaskPayload:     subjectPlan.taskPayloads.get(evalId)!,
              plannedTaskPayloadHash: intPlan.manifest.taskPayloadHashes[taskKey]!,
              provider:              intPlan.runtime.provider,
              model:                 intPlan.runtime.model,
              gooseRuntimeVersion:   intPlan.runtime.version,
              decoding:              intPlan.manifest.executionEnvelope.decoding,
              evalHubRuntimeVersion: intPlan.manifest.executionEnvelope.evalHubRuntimeVersion,
              integrity: {
                schema:              INTEGRITY_SCHEMA_V2,
                root:                intPlan.root,
                manifestHash:        intPlan.hash,
                runProvenanceId:     intPlan.manifest.runProvenanceId,
                side,
                candidateTreatmentId:   subjectPlan.pair.candidate.id,
                baselineTreatmentId:    subjectPlan.pair.baseline.id,
                candidateTreatmentHash: subjectPlan.treatments[subjectPlan.pair.candidate.id]!.definitionHash,
                baselineTreatmentHash:  subjectPlan.treatments[subjectPlan.pair.baseline.id]!.definitionHash,
                grader: intPlan.manifest.grader,
                rubric: { ...intPlan.manifest.rubric, expectedCriterionIds: expectedCriterionIdsFor(scenario) },
              },
            };
            rows.push({ subject, evalId, repetition, side, scenario, runCfg });
          }
        }
      }
    }

    return {
      cfg,
      rows,
      manifestHash:        intPlan.hash,
      fixtureSourceHashes: intPlan.manifest.fixtureHashes,
      subjectHashes:       subjectHashesRecord,
    };
  }

  /**
   * Execute exactly the rows recorded in the plan.
   *
   * EVAL-INT-04/05/11 — Before any IEvalRunner call, all fixture source files
   * are re-hashed from disk.  If any file's content has changed since plan()
   * was called the generator throws `input_mismatch` and makes zero evalRunner
   * calls.
   */
  async *runPlan(execPlan: SuiteExecutionPlan, sink: IEventSink = NULL_SINK): AsyncGenerator<SuiteEvent> {
    // ── Fixture drift guard — MUST happen before any IEvalRunner call ─────────
    await this.verifyFixtureHashes(execPlan.fixtureSourceHashes);

    const cfg     = execPlan.cfg;
    const total   = cfg.subjects.length;
    const startMs = Date.now();

    // Group rows by subject, preserving original subject order
    const rowsBySubject = new Map<string, SuiteExecutionRow[]>();
    for (const subject of cfg.subjects) rowsBySubject.set(subject, []);
    for (const row of execPlan.rows) rowsBySubject.get(row.subject)?.push(row);

    // ── Ambient isolation ─────────────────────────────────────────────────────
    const hiddenDirs: Array<{ backup: string; original: string }> = [];
    if (cfg.ambient) {
      await this.restoreLeaked();
      for (const orig of AMBIENT_HIDE_DIRS) {
        const backup = orig + "._eval_hidden";
        try { await fs.rename(orig, backup); hiddenDirs.push({ backup, original: orig }); }
        catch { /* already gone */ }
      }
    }

    // ── Completion notification queue (yield as subjects finish) ──────────────
    type Outcome = { subject: string; rc: number; ms: number };
    const queue: Array<PromiseSettledResult<Outcome>> = [];
    let notifyResolve: (() => void) | null = null;
    const notify = () => { notifyResolve?.(); notifyResolve = null; };

    const sem     = new Semaphore(cfg.workers);
    let stopped   = false;
    let fatalError: unknown;

    for (const subject of cfg.subjects) {
      if (stopped) break;
      const subjectRows = rowsBySubject.get(subject) ?? [];
      const hash        = execPlan.subjectHashes[subject] ?? "";

      sem.run(async () => {
        if (stopped) return { subject, rc: -1, ms: 0 };
        const subStart  = Date.now();
        const ws        = path.join(cfg.workspace, subject, hash);
        await fs.mkdir(ws, { recursive: true });
        // Layered workspaces record immutable provenance.
        await fs.writeFile(path.join(ws, "artifact_path.txt"), path.join(DIST_EVALS, cfg.kind, subject, hash));
        const canonical = path.join(DIST_EVALS, cfg.kind, subject, hash);

        try {
          for (const row of subjectRows) {
            if (stopped) break;
            await fs.mkdir(row.runCfg.workspace, { recursive: true });
            // Materialise fixtures from disk (copy to pair workspace).
            // runCfg.fixtureHashes is manifest-frozen — not recomputed here.
            await this.materializeFixtures(row.scenario.files ?? [], row.runCfg.workspace);
            for await (const _ev of this.evalRunner.run(row.runCfg, sink)) { /* events flow via sink */ }
          }
          return { subject, rc: 0, ms: Date.now() - subStart };
        } finally {
          // Snapshot canonical artifacts for immutable provenance.
          await fs.cp(canonical, ws, { recursive: true, force: true }).catch(() => {});
        }
      }).then(
        v => { queue.push({ status: "fulfilled",  value: v }); notify(); },
        e => { queue.push({ status: "rejected",   reason: e }); notify(); },
      );
    }

    // ── Drain completion queue ────────────────────────────────────────────────
    let done = 0;
    while (done < total && !stopped) {
      if (queue.length === 0) {
        await new Promise<void>(r => { notifyResolve = r; });
      }
      while (queue.length > 0) {
        const s = queue.shift()!;
        done++;
        if (s.status === "fulfilled") {
          const ev: SuiteEvent = {
            type: "suite.subject_done", kind: cfg.kind,
            subject: s.value.subject, rc: s.value.rc, durationMs: s.value.ms,
            doneCount: done, total,
          };
          yield ev; sink.emit(ev);
        } else {
          if (!cfg.continueOnFail) { stopped = true; fatalError = s.reason; break; }
          const ev: SuiteEvent = {
            type: "suite.subject_done", kind: cfg.kind, subject: "unknown", rc: -1,
            durationMs: 0, doneCount: done, total,
          };
          yield ev; sink.emit(ev);
        }
      }
    }

    // ── Restore hidden dirs ───────────────────────────────────────────────────
    for (const { backup, original } of [...hiddenDirs].reverse()) {
      try { await fs.rename(backup, original); } catch { /* best-effort */ }
    }
    if (fatalError !== undefined) throw fatalError;

    const finalEv: SuiteEvent = {
      type: "suite.completed", kind: cfg.kind, total,
      passed: done,
      durationMs: Date.now() - startMs,
    };
    yield finalEv; sink.emit(finalEv);
  }

  // ── Fixture drift guard ───────────────────────────────────────────────────

  /**
   * Re-hash every fixture source file and compare to the planned hash.
   * Throws `input_mismatch` (before any IEvalRunner call) on any difference.
   */
  private async verifyFixtureHashes(plannedHashes: Readonly<Record<string, string>>): Promise<void> {
    for (const [relative, expectedHash] of Object.entries(plannedHashes)) {
      const source = path.resolve(PROJECT_ROOT, relative);
      let currentHash: string;
      try {
        currentHash = await this.hasher.hash([source]);
      } catch {
        throw new Error(`input_mismatch: fixture file missing since planning: ${relative}`);
      }
      if (currentHash !== expectedHash) {
        throw new Error(`input_mismatch: fixture source bytes changed since planning: ${relative}`);
      }
    }
  }



  private async planIntegrity(cfg: SuiteConfig, scenarios: Map<string, EvalScenario[]>, repetitions: number): Promise<{
    readonly root: string;
    readonly hash: string;
    readonly manifest: IntegrityManifestV2;
    readonly runtime: GooseRuntimeIdentity;
    readonly subjects: Map<string, {
      readonly sourceHash: string;
      readonly taskPayloads: Map<number, string>;
      readonly treatments: Record<string, { readonly definitionHash: string; readonly bootstrapHash: string }>;
      readonly pair: TreatmentPair;
      readonly fixtureHashesByEvalId: Map<number, Readonly<Record<string, string>>>;
    }>;
  }> {
    const runtime = await this.runtime.identity(cfg.gooseCli);
    const provider = runtime.provider ?? "unknown";
    const model = runtime.model ?? "unknown";
    const root = path.join(cfg.workspace, "_integrity-v2", cfg.kind);
    const subjects: IntegrityManifestV2["subjects"][number][] = [];
    const treatments: IntegrityManifestV2["treatments"][number][] = [];
    const taskPayloadHashes: Record<string, string> = {};
    const fixtureHashes: Record<string, string> = {};
    const plannedSubjects = new Map<string, {
      readonly sourceHash: string;
      readonly taskPayloads: Map<number, string>;
      readonly treatments: Record<string, { readonly definitionHash: string; readonly bootstrapHash: string }>;
      readonly pair: TreatmentPair;
      readonly fixtureHashesByEvalId: Map<number, Readonly<Record<string, string>>>;
    }>();

    for (const subject of cfg.subjects) {
      const subjectScenarios = scenarios.get(subject) ?? [];
      const firstScenario = subjectScenarios[0];
      const recipeSourceTypes = new Set(subjectScenarios.map(scenario => scenario.recipe_source_type));
      if (cfg.kind === "recipes" && (recipeSourceTypes.size !== 1 || !firstScenario?.recipe_source_type)) {
        throw new Error(`source_missing: recipe ${subject} requires one explicit source type for every scenario`);
      }
      const effectivePath = cfg.kind === "recipes"
        ? await resolveTypedRecipeSource(PROJECT_RECIPES_DIR, subject, firstScenario!.recipe_source_type!)
        : await resolveSubjectPath(cfg.kind, subject);
      const sourceHash = await this.hasher.hash([effectivePath, evalJsonPath(cfg.kind, subject)]);
      const pair = buildTreatmentPair({
        kind: cfg.kind, subject, declaredSkills: firstScenario?.skills ?? [], declaredAgents: firstScenario?.agents ?? [],
        ...(cfg.kind === "recipes" ? { resolvedRecipePath: effectivePath } : {}),
      });
      const treatmentPlans: Record<string, { readonly definitionHash: string; readonly bootstrapHash: string }> = {};
      for (const [side, treatment] of [["candidate", pair.candidate], ["baseline", pair.baseline]] as const) {
        const definitionHash = treatmentContentHash(treatment);
        const bootstrapHash = hashUtf8(treatment.bootstrap.bytes);
        treatmentPlans[treatment.id] = { definitionHash, bootstrapHash };
        treatments.push({ id: treatment.id, kind: cfg.kind, subject, side, definitionHash, bootstrapHash });
      }

      const taskPayloads = new Map<number, string>();
      const fixtureHashesByEvalId = new Map<number, Readonly<Record<string, string>>>();
      const subjectFixtureHashes: Record<string, string> = {};
      for (const [evalId, scenario] of subjectScenarios.entries()) {
        const payload = this.prompt.build(scenario, pair.candidate.id);
        taskPayloads.set(evalId, payload);
        taskPayloadHashes[`${cfg.kind}/${subject}/${evalId}`] = hashUtf8(payload);
        const evalFixtureHashes = await this.hashFixtures(scenario.files ?? []);
        fixtureHashesByEvalId.set(evalId, evalFixtureHashes);
        for (const [relative, hash] of Object.entries(evalFixtureHashes)) {
          subjectFixtureHashes[relative] = hash;
        }
      }
      Object.assign(fixtureHashes, subjectFixtureHashes);
      subjects.push({ kind: cfg.kind, subject, sourceHash, evalIds: subjectScenarios.map((_, index) => index) });
      plannedSubjects.set(subject, { sourceHash, taskPayloads, treatments: treatmentPlans, pair, fixtureHashesByEvalId });
    }

    const manifest: IntegrityManifestV2 = {
      schema: INTEGRITY_SCHEMA_V2,
      runProvenanceId: this.runProvenanceId(),
      cliArguments: [
        `kind=${cfg.kind}`, `subjects=${cfg.subjects.join(",")}`, `mode=${cfg.mode}`, `repetitions=${repetitions}`,
        `maxTurns=${cfg.maxTurns}`, `timeoutMs=${cfg.timeoutMs}`, `ambient=${cfg.ambient}`,
      ],
      subjects,
      repetitions,
      treatments,
      taskPayloadHashes,
      fixtureHashes,
      executionEnvelope: {
        provider, model,
        decoding: { temperature: null, seed: null },
        timeBudgetMs: cfg.timeoutMs,
        tokenBudget: null,
        gooseRuntimeVersion: runtime.version,
        evalHubRuntimeVersion: this.evalHubRuntimeVersion(),
      },
      grader: defaultGraderDescriptor(),
      rubric: defaultRubricDescriptor(),
    };
    const stored = await new EvalIntegrityV2Store(root).createManifest(manifest);
    return { root, hash: stored.hash, manifest: stored.manifest, runtime, subjects: plannedSubjects };
  }

  private async hashFixtures(files: readonly string[]): Promise<Readonly<Record<string, string>>> {
    const hashes: Record<string, string> = {};
    for (const relative of files) {
      const source = path.resolve(PROJECT_ROOT, relative);
      const rootPrefix = PROJECT_ROOT.endsWith(path.sep) ? PROJECT_ROOT : PROJECT_ROOT + path.sep;
      if (source !== PROJECT_ROOT && !source.startsWith(rootPrefix)) {
        throw new Error(`Fixture path escapes project root: ${relative}`);
      }
      hashes[relative] = await this.hasher.hash([source]);
    }
    return hashes;
  }

  private async materializeFixtures(files: readonly string[], workspace: string): Promise<Readonly<Record<string, string>>> {
    const hashes: Record<string, string> = {};
    for (const relative of files) {
      const source = path.resolve(PROJECT_ROOT, relative);
      const rootPrefix = PROJECT_ROOT.endsWith(path.sep) ? PROJECT_ROOT : PROJECT_ROOT + path.sep;
      if (source !== PROJECT_ROOT && !source.startsWith(rootPrefix)) {
        throw new Error(`Fixture path escapes project root: ${relative}`);
      }
      const target = path.resolve(workspace, relative);
      const workspacePrefix = workspace.endsWith(path.sep) ? workspace : workspace + path.sep;
      if (target !== workspace && !target.startsWith(workspacePrefix)) {
        throw new Error(`Fixture path escapes pair workspace: ${relative}`);
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.cp(source, target, { recursive: true, force: true });
      hashes[relative] = await this.hasher.hash([source]);
    }
    return hashes;
  }

  private async loadScenarios(kind: string, subjects: readonly string[], override?: Map<string, EvalScenario[]>): Promise<Map<string, EvalScenario[]>> {
    if (override) {
      const map = new Map<string, EvalScenario[]>();
      for (const subject of subjects) map.set(subject, override.get(subject) ?? []);
      return map;
    }
    const map = new Map<string, EvalScenario[]>();
    for (const subject of subjects) {
      try {
        const raw = JSON.parse(await fs.readFile(path.join(EVALS_DIR, kind, `${subject}.json`), "utf8")) as unknown;
        map.set(subject, Array.isArray(raw) ? raw as EvalScenario[] : []);
      } catch { map.set(subject, []); }
    }
    return map;
  }

  private async restoreLeaked(): Promise<void> {
    for (const orig of AMBIENT_HIDE_DIRS) {
      const backup = orig + "._eval_hidden";
      try {
        await fs.access(backup);
        await fs.access(orig).catch(async () => {
          await fs.rename(backup, orig);
          console.error(`[eval-cleanup] Restored leaked eval backup: ${path.basename(backup)} → ${path.basename(orig)}`);
        });
      } catch { /* nothing to restore */ }
    }
  }
}

// ── Bounded concurrency semaphore ─────────────────────────────────────────────

class Semaphore {
  private running = 0;
  private readonly queue: (() => void)[] = [];
  constructor(private readonly max: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const attempt = () => {
        if (this.running < this.max) {
          this.running++;
          fn().then(resolve, reject).finally(() => { this.running--; this.queue.shift()?.(); });
        } else {
          this.queue.push(attempt);
        }
      };
      attempt();
    });
  }
}
