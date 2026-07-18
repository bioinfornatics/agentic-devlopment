/**
 * HistoryExporter — SQLite → JSON export for GitHub Pages / trend reporting.
 * Replaces the legacy Python script: scripts/export-eval-history.py
 *
 * Merges with an existing JSON file by default (deduplicates by runId).
 */
import fs   from "node:fs/promises";
import path from "node:path";
import type { IHistoryReader, HistoryRow, ResultRow } from "./ports.js";

export interface ExportOptions {
  readonly outFile: string;
  readonly merge:   boolean;
}

export interface IHistoryExporter {
  export(opts: ExportOptions): Promise<number>;
}

export interface HistoryRecord extends HistoryRow {
  readonly results: readonly ResultRow[];
}

export class HistoryExporter implements IHistoryExporter {
  constructor(private readonly reader: IHistoryReader) {}

  async export({ outFile, merge }: ExportOptions): Promise<number> {
    // Read all runs + per-run results from DB
    const runs    = await this.reader.listRuns({ limit: 50_000 });
    const results = (
      await Promise.all(runs.map(r => this.reader.listResults(r.runId)))
    ).flat();

    const resultsByRun = new Map<string, ResultRow[]>();
    for (const r of results) {
      (resultsByRun.get(r.runId) ?? resultsByRun.set(r.runId, []).get(r.runId)!).push(r);
    }

    const records: HistoryRecord[] = runs.map(r => ({
      ...r,
      results: resultsByRun.get(r.runId) ?? [],
    }));

    let merged = records;

    if (merge) {
      try {
        const existing = JSON.parse(
          await fs.readFile(outFile, "utf8"),
        ) as HistoryRecord[];
        const seenIds = new Set(records.map(r => r.runId));
        merged = [
          ...records,
          ...existing.filter(r => !seenIds.has(r.runId)),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch { /* first export — no existing file */ }
    }

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, JSON.stringify(merged, null, 2) + "\n");
    return merged.length;
  }
}
