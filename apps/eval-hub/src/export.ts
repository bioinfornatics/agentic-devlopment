/**
 * --export-history CLI mode.
 * Replaces the legacy Python script: scripts/export-eval-history.py
 *
 * Usage:
 *   node dist/index.js --export-history [--out <path>] [--no-merge]
 *
 * Default output: evals/history/runs.json  (git-committable, GitHub Pages)
 * With --no-merge: overwrites instead of deduplicating by runId.
 */
import path from "node:path";
import { SqliteHistoryRepository } from "./domains/persistence/historyRepo.js";
import { HistoryExporter }         from "./domains/persistence/historyExporter.js";
import { PROJECT_ROOT }            from "./shared/paths.js";

function opt(args: string[], flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
}

export async function startExport(args: string[]): Promise<void> {
  const noMerge = args.includes("--no-merge");
  const outFile = opt(
    args, "--out",
    path.join(PROJECT_ROOT, "evals", "history", "runs.json"),
  );

  console.log("\n══════════════════════════════════════════");
  console.log("  Eval Hub — Exporting History");
  console.log("══════════════════════════════════════════\n");
  console.log(`  Output  : ${outFile}`);
  console.log(`  Merge   : ${!noMerge}\n`);

  let history: SqliteHistoryRepository;
  try {
    history = new SqliteHistoryRepository();
  } catch (e) {
    console.error("  ✗  Cannot open evaluation.db:", (e as Error).message);
    process.exit(1);
  }

  const exporter = new HistoryExporter(history);
  const count    = await exporter.export({ outFile, merge: !noMerge });

  console.log(`  ✓  Exported ${count} run(s) → ${outFile}\n`);
  console.log("     Commit with:");
  console.log(`     git add ${outFile} && git commit -m "chore: update eval history"\n`);
}
