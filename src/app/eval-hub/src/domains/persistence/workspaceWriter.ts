/**
 * FsWorkspaceWriter — IWorkspaceWriter implementation.
 * Writes all eval artifacts to the dist/evals/<kind>/<subject>/<hash>/ tree.
 * Extracted from SkillEvalRunner to respect SRP.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import type { IWorkspaceWriter, GradingResult, TimingRecord, BenchmarkFile } from "./ports.js";
import type { EvalKind, SubjectName, ContentHash } from "../../shared/types.js";
import { DIST_EVALS } from "../../shared/paths.js";

export class FsWorkspaceWriter implements IWorkspaceWriter {

  private runDir(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number): string {
    return path.join(DIST_EVALS, kind, subject, hash, `eval-${evalId}`, config, `run-${run}`);
  }

  async writeGrading(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, data: GradingResult): Promise<void> {
    const dir = this.runDir(kind, subject, hash, evalId, config, run);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "grading.json"), JSON.stringify(data, null, 2));
  }

  async writeTiming(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, data: TimingRecord): Promise<void> {
    const dir = this.runDir(kind, subject, hash, evalId, config, run);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "timing.json"), JSON.stringify(data, null, 2));
  }

  async writeBenchmark(kind: EvalKind, subject: SubjectName, hash: ContentHash, data: BenchmarkFile): Promise<void> {
    const dir = path.join(DIST_EVALS, kind, subject, hash);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "benchmark.json"), JSON.stringify(data, null, 2));
  }

  async writePrompt(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, text: string): Promise<string> {
    const dir = this.runDir(kind, subject, hash, evalId, config, run);
    await fs.mkdir(path.join(dir, "outputs"), { recursive: true });
    const p = path.join(dir, "prompt.txt");
    await fs.writeFile(p, text);
    return p;
  }

  async appendEvent(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, line: string): Promise<void> {
    const dir = path.join(this.runDir(kind, subject, hash, evalId, config, run), "outputs");
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n");
  }

  async writeEvalMeta(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, meta: Record<string, unknown>): Promise<void> {
    const dir = path.join(DIST_EVALS, kind, subject, hash, `eval-${evalId}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "eval_metadata.json"), JSON.stringify(meta, null, 2));
  }
}
