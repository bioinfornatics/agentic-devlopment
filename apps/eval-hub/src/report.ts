/**
 * --report CLI mode.
 * Replaces the legacy Python scripts:
 *   scripts/build-eval-report.py
 *   scripts/open-skill-eval-review.py  (index / post-suite view)
 *
 * Usage:
 *   node dist/index.js --report [--open] [--limit <n>] [--kind skills,agents,recipes]
 *
 * Data sources (merged, newest wins on duplicate runId):
 *   1. Filesystem workspace  dist/evals/<kind>/<subject>/<hash>/**\/grading.json
 *      — always present, covers both TS and legacy Python eval runs
 *   2. SQLite history DB     dist/evals/evaluation.db
 *      — populated when historyRepo.recordRun() is called; adds git/model metadata
 *
 * Output: dist/evals/report/index.html  (standalone, 226 KB, no CDN)
 */
import fs   from "node:fs/promises";
import path from "node:path";
import { SqliteHistoryRepository }   from "./domains/persistence/historyRepo.js";
import { HtmlReportBuilder }         from "./domains/reporting/htmlBuilder.js";
import { WorkspaceDataCollector }    from "./domains/reporting/workspaceDataCollector.js";
import { openInBrowser }             from "./open.js";
import { PROJECT_ROOT }              from "./shared/paths.js";
import { EVAL_KINDS }                from "./shared/types.js";
import type { EvalKind }             from "./shared/types.js";
import type { HistoryRow, ResultRow } from "./domains/persistence/ports.js";

function opt(args: string[], flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
}
function optInt(args: string[], flag: string, fallback: number): number {
  const v = parseInt(opt(args, flag, String(fallback)), 10);
  return isNaN(v) ? fallback : v;
}

export async function startReport(args: string[]): Promise<void> {
  const wantOpen  = args.includes("--open");
  const limit     = optInt(args, "--limit", 2000);
  const kindsArg  = opt(args, "--kind", "");
  const kinds     = kindsArg
    ? (kindsArg.split(",").map(s => s.trim()) as EvalKind[])
    : [...EVAL_KINDS];

  console.log("\n══════════════════════════════════════════");
  console.log("  Eval Hub — Building Trend Report");
  console.log(`  Layers: ${kinds.join(", ")}`);
  console.log("══════════════════════════════════════════\n");

  // ── Source 1: filesystem workspace (ground truth) ─────────────────────────
  const collector = new WorkspaceDataCollector();
  const wsData    = await collector.collect(kinds);
  console.log(`  Workspace  : ${wsData.runs.length} run(s) across ${kinds.join("/")}`);;

  // ── Source 2: SQLite DB (adds git/model metadata) ─────────────────────────
  let dbRuns: HistoryRow[]    = [];
  let dbResults: ResultRow[] = [];
  try {
    const history = new SqliteHistoryRepository();
    dbRuns    = await history.listRuns({ limit });
    dbResults = (await Promise.all(dbRuns.map(r => history.listResults(r.runId)))).flat();
    console.log(`  SQLite DB  : ${dbRuns.length} run(s)`);
  } catch {
    console.log("  SQLite DB  : unavailable (no evaluation.db yet)");
  }

  // ── Merge: workspace wins on pass_rate; SQLite wins on metadata ───────────
  const merged = mergeData(wsData, dbRuns, dbResults, kinds, limit);
  console.log(`  Merged     : ${merged.runs.length} run(s), ${merged.results.length} result(s)\n`);

  if (merged.runs.length === 0) {
    console.error("  ✗  No eval data found.");
    console.error(`     Run an eval first:\n`);
    console.error(`       node apps/eval-hub/dist/index.js --run --layers ${kinds.join(",")} --ambient-goose\n`);
    process.exit(1);
  }

  // ── Build HTML ────────────────────────────────────────────────────────────
  const builder = new HtmlReportBuilder();
  const html    = await builder.build({
    runs:        merged.runs,
    results:     merged.results,
    generatedAt: new Date().toISOString(),
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const outDir  = path.join(PROJECT_ROOT, "dist", "evals", "report");
  const outFile = path.join(outDir, "index.html");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, html);

  const kb = (html.length / 1024).toFixed(0);
  console.log(`  ✓  Report: ${outFile}  (${kb} KB)`);

  if (wantOpen) {
    openInBrowser(outFile);
    console.log("     Opened in browser.");
  } else {
    console.log(`     Open with:\n       node apps/eval-hub/dist/index.js --open\n`);
  }
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

function mergeData(
  ws:        { runs: HistoryRow[]; results: ResultRow[] },
  dbRuns:    HistoryRow[],
  dbResults: ResultRow[],
  kinds:     readonly EvalKind[],
  limit:     number,
): { runs: HistoryRow[]; results: ResultRow[] } {
  // Build a map of workspace runs (runId → row)
  const wsById = new Map(ws.runs.map(r => [r.runId, r]));

  // Enrich workspace rows with SQLite metadata where available
  for (const dbRow of dbRuns) {
    const ws = wsById.get(dbRow.runId);
    if (ws) {
      // SQLite has git/model metadata — merge it in
      wsById.set(dbRow.runId, { ...ws, gitCommit: dbRow.gitCommit, provider: dbRow.provider, model: dbRow.model });
    }
  }

  // Add SQLite-only rows (runs not in filesystem — older/archived data)
  const dbOnlyIds = new Set(dbRuns.map(r => r.runId).filter(id => !wsById.has(id)));
  for (const r of dbRuns) {
    if (dbOnlyIds.has(r.runId) && kinds.includes(r.kind)) wsById.set(r.runId, r);
  }

  const runs = [...wsById.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  // Merge results: workspace results + SQLite-only results
  const wsResultRunIds = new Set(ws.results.map(r => r.runId));
  const results = [
    ...ws.results,
    ...dbResults.filter(r => !wsResultRunIds.has(r.runId)),
  ];

  return { runs, results };
}
