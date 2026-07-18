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
import type { ISuiteRunner, IEvalRunner, SuiteConfig, IEventSink } from "./ports.js";
import type { SuiteEvent } from "../../shared/events.js";
import type { EvalScenario } from "../../shared/types.js";
import { LAYER_META } from "../../shared/types.js";
import { SkillEvalRunner }  from "./evalRunner.js";
import { ContentHasher }    from "../persistence/contentHash.js";
import { EVALS_DIR, resolveSubjectPath, AMBIENT_HIDE_DIRS } from "../../shared/paths.js";
import { NULL_SINK } from "../../shared/eventBus.js";

export class SuiteRunner implements ISuiteRunner {
  private readonly hasher = new ContentHasher();

  constructor(private readonly evalRunner: IEvalRunner = new SkillEvalRunner()) {}

  async *run(cfg: SuiteConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<SuiteEvent> {
    const scenarios = await this.loadScenarios(cfg.kind, cfg.subjects);
    const total     = cfg.subjects.length;
    const startMs   = Date.now();

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

    const sem = new Semaphore(cfg.workers);
    let stopped = false;

    for (const subject of cfg.subjects) {
      if (stopped) break;
      const subjectScenarios = scenarios.get(subject) ?? [];
      // Configs from LAYER_META — single source of truth
      const configs = [...LAYER_META[cfg.kind].configs];

      sem.run(async () => {
        if (stopped) return { subject, rc: -1, ms: 0 };
        const effectivePath = await resolveSubjectPath(cfg.kind, subject);
        const hash          = await this.hasher.hash([effectivePath]);
        const ws            = path.join(cfg.workspace, subject, hash);
        await fs.mkdir(ws, { recursive: true });

        const subStart = Date.now();
        for (const [evalId, scenario] of subjectScenarios.entries()) {
          for (const config of configs) {
            if (stopped) break;
            const runCfg = {
              kind: cfg.kind, subject, hash,
              scenario: scenario as EvalScenario,
              evalId, config, runNumber: 1, workspace: ws,
              gooseCli: cfg.gooseCli, maxTurns: cfg.maxTurns,
              timeoutMs: cfg.timeoutMs, ambient: cfg.ambient,
            };
            for await (const _ev of this.evalRunner.run(runCfg, sink)) {
              // All events forwarded via sink; typed events yielded by evalRunner
            }
          }
        }
        return { subject, rc: 0, ms: Date.now() - subStart };
      }).then(
        v  => { queue.push({ status: "fulfilled",  value: v });  notify(); },
        e  => { queue.push({ status: "rejected",   reason: e }); notify(); },
      );
    }

    // ── Drain completion queue ─────────────────────────────────────────────────
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
            subject:    s.value.subject,
            rc:         s.value.rc,
            durationMs: s.value.ms,
            doneCount:  done,
            total,
          };
          yield ev; sink.emit(ev);
        } else {
          if (!cfg.continueOnFail) { stopped = true; break; }
        }
      }
    }

    // ── Restore hidden dirs ───────────────────────────────────────────────────
    for (const { backup, original } of [...hiddenDirs].reverse()) {
      try { await fs.rename(backup, original); } catch { /* best-effort */ }
    }

    const finalEv: SuiteEvent = {
      type: "suite.completed", kind: cfg.kind, total,
      passed:     done - (stopped ? 0 : 0), // count completed
      durationMs: Date.now() - startMs,
    };
    yield finalEv; sink.emit(finalEv);
  }

  private async loadScenarios(kind: string, subjects: readonly string[]): Promise<Map<string, EvalScenario[]>> {
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
