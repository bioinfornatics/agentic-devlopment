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
    const hashDir = path.join(DIST_EVALS, kind, subject, hash);
    const records: GradingRecord[] = [];
    try {
      const evalDirs = await fs.readdir(hashDir, { withFileTypes: true });
      for (const ed of evalDirs.filter(e => e.isDirectory() && e.name.startsWith("eval-"))) {
        const evalId = parseInt(ed.name.replace("eval-", ""), 10);
        const evalDir = path.join(hashDir, ed.name);
        const configs = await fs.readdir(evalDir, { withFileTypes: true });
        for (const cd of configs.filter(e => e.isDirectory())) {
          const runDir = path.join(evalDir, cd.name, "run-1");
          try {
            const raw = await fs.readFile(path.join(runDir, "grading.json"), "utf8");
            const g   = JSON.parse(raw) as { passed: boolean; score: number; feedback?: string };
            records.push({ evalId, config: cd.name, run: 1, passed: g.passed, score: g.score, ...(g.feedback !== undefined ? { feedback: g.feedback } : {}) });
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
}
