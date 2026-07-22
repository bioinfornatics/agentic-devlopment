/**
 * FileSystem workspace reader — reads the dist/evals/<kind>/<subject>/<hash>/ tree.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createReadStream } from "node:fs";
import { DIST_EVALS, LAYERED_ROOT } from "../../shared/paths.js";
import type {
  IWorkspaceReader, RunManifest, GradingRecord, BenchmarkFile, LayeredState,
} from "./ports.js";
import type { EvalKind, ContentHash, SubjectName } from "../../shared/types.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
  type IntegrityCompatibility,
} from "./integrityV2Store.js";

export class FsWorkspaceReader implements IWorkspaceReader {

  async listSubjects(kind: EvalKind): Promise<string[]> {
    const dir = path.join(DIST_EVALS, kind);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    } catch { return []; }
  }

  async listRuns(kind: EvalKind, subject: SubjectName): Promise<RunManifest[]> {
    const dir = path.join(DIST_EVALS, kind, subject);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: RunManifest[] = [];
      for (const e of entries.filter(ent => ent.isDirectory())) {
        const stat = await fs.stat(path.join(dir, e.name));
        results.push({
          hash:       e.name,
          path:       path.join(dir, e.name),
          modifiedAt: stat.mtime.toISOString(),
        });
      }
      return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    } catch { return []; }
  }

  async readGradings(kind: EvalKind, subject: SubjectName, hash: ContentHash): Promise<GradingRecord[]> {
    return this.readGradingsAt(path.join(DIST_EVALS, kind, subject, hash));
  }

  async readGradingsAt(hashDir: string): Promise<GradingRecord[]> {
    const records: GradingRecord[] = [];
    try {
      const evalDirs = await fs.readdir(hashDir, { withFileTypes: true });
      for (const ed of evalDirs.filter(e => e.isDirectory() && e.name.startsWith("eval-"))) {
        const evalId = parseInt(ed.name.replace("eval-", ""), 10);
        const evalDir = path.join(hashDir, ed.name);
        const configs = await fs.readdir(evalDir, { withFileTypes: true });
        for (const cd of configs.filter(e => e.isDirectory())) {
          const configDir = path.join(evalDir, cd.name);
          const runDirs = (await fs.readdir(configDir, { withFileTypes: true }))
            .filter(entry => entry.isDirectory() && /^run-\d+$/.test(entry.name))
            .sort((a, b) => Number(a.name.slice(4)) - Number(b.name.slice(4)));
          for (const rd of runDirs) try {
            const run = Number(rd.name.slice(4));
            const raw = await fs.readFile(path.join(configDir, rd.name, "grading.json"), "utf8");
            const g   = JSON.parse(raw) as {
              passed?: boolean;
              score?: number;
              feedback?: string;
              summary?: { pass_rate?: number | null };
            };
            const passRate = typeof g.summary?.pass_rate === "number"
              ? g.summary.pass_rate
              : (typeof g.score === "number" ? g.score : null);
            if (passRate === null) continue; // grader unavailable; exclude from delta instead of biasing to zero
            records.push({
              evalId,
              config: cd.name,
              run,
              passed: passRate >= 1,
              score: passRate,
              ...(g.feedback !== undefined ? { feedback: g.feedback } : {}),
            });
          } catch { /* grading not yet written */ }
        }
      }
    } catch { /* subject hash dir absent */ }
    return records;
  }

  async readBenchmark(kind: EvalKind, subject: SubjectName, hash: ContentHash): Promise<BenchmarkFile | null> {
    const p = path.join(DIST_EVALS, kind, subject, hash, "benchmark.json");
    try {
      return JSON.parse(await fs.readFile(p, "utf8")) as BenchmarkFile;
    } catch { return null; }
  }

  async *readEvents(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run = 1): AsyncGenerator<string> {
    const p = path.join(DIST_EVALS, kind, subject, hash, `eval-${evalId}`, config, `run-${run}`, "outputs", "events.jsonl");
    try {
      const rl = readline.createInterface({ input: createReadStream(p), crlfDelay: Infinity });
      for await (const line of rl) { if (line.trim()) yield line; }
    } catch { /* file absent */ }
  }

  async readLayeredState(layeredRunId: string): Promise<LayeredState | null> {
    const p = path.join(LAYERED_ROOT, layeredRunId, "state.json");
    try {
      return JSON.parse(await fs.readFile(p, "utf8")) as LayeredState;
    } catch { return null; }
  }

  /**
   * Classify a hash-directory for integrity eligibility without mutating any files.
   * [EVAL-INT-05/06/12/13/20] Delegates to EvalIntegrityV2Store.inspectCompatibility().
   *
   * Decision tree:
   *  - manifest.json absent → legacy-v1  (inspectCompatibility returns, never throws)
   *  - manifest.json present but loadManifest() fails (hash mismatch, corrupt JSON,
   *    or missing sha256 sidecar) → incompleteReason: "manifest_invalid"
   *  - manifest.json loads cleanly but inspectCompatibility() subsequently throws
   *    (e.g. report-state.json is corrupt or structurally invalid) →
   *    incompleteReason: "report_state_inconsistent"
   *  - inspectCompatibility() returns without throwing → pass its value through unchanged
   *
   * Two-phase approach: probe loadManifest() first (read-only), then run the full
   * inspection. The pre-probe result tells the catch handler which failure occurred,
   * keeping manifest_invalid strictly scoped to unreadable manifests.
   */
  async classifyHashDir(hashDir: string): Promise<IntegrityCompatibility> {
    const store = new EvalIntegrityV2Store(hashDir);

    // Phase 1: probe manifest readability (read-only, no side effects).
    // loadManifest() also throws when manifest.json is absent, but in that case
    // inspectCompatibility() returns legacy-v1 without throwing, so the outer
    // catch in Phase 2 is never triggered for the absent-manifest path.
    let manifestLoaded = false;
    try {
      await store.loadManifest();
      manifestLoaded = true;
    } catch { /* absent or unreadable — classified below */ }

    // Phase 2: run the full compatibility check and route any throw by its origin.
    try {
      return await store.inspectCompatibility();
    } catch {
      if (manifestLoaded) {
        // loadManifest() succeeded; the throw originated from a later stage
        // (e.g. assertValidReportState failed on a corrupt/invalid report-state.json).
        return {
          schema: INTEGRITY_SCHEMA_V2,
          historicalOnly: false,
          integrityEligible: false,
          subjectFailureReason: null,
          incompleteReason: "report_state_inconsistent",
        };
      }
      // manifest.json is present but loadManifest() failed
      // (hash mismatch, corrupt JSON, or incomplete sha256 sidecar).
      return {
        schema: INTEGRITY_SCHEMA_V2,
        historicalOnly: false,
        integrityEligible: false,
        subjectFailureReason: null,
        incompleteReason: "manifest_invalid",
      };
    }
  }
}
