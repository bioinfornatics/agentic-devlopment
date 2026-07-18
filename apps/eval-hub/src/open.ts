/**
 * --open CLI mode.
 * Replaces the legacy Python script: scripts/open-skill-eval-review.py
 *
 * Usage:
 *   node dist/index.js --open [--file <path>]
 *
 * Default target: dist/evals/report/index.html
 * When --analyze is implemented, --skill <name> will resolve per-subject review.html
 */
import fs   from "node:fs/promises";
import path from "node:path";
import { spawn }        from "node:child_process";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./shared/paths.js";

function opt(args: string[], flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
}

/** Open a local file in the platform-default browser, detached. */
export function openInBrowser(filePath: string): void {
  const uri  = pathToFileURL(path.resolve(filePath)).href;
  const plat = process.platform;
  const [cmd, ...cmdArgs] =
    plat === "darwin" ? ["open",    uri] :
    plat === "win32"  ? ["cmd",     "/c", "start", "", uri] :
    /* linux */         ["xdg-open", uri];
  spawn(cmd, cmdArgs, { detached: true, stdio: "ignore" }).unref();
}

export async function startOpen(args: string[]): Promise<void> {
  const fileArg = opt(args, "--file", "");

  const target = fileArg
    ? path.resolve(fileArg)
    : path.join(PROJECT_ROOT, "dist", "evals", "report", "index.html");

  try {
    await fs.access(target);
  } catch {
    console.error(`\n  ✗  File not found: ${target}`);
    console.error(`     Generate it first with:\n`);
    console.error(`       node apps/eval-hub/dist/index.js --report\n`);
    process.exit(1);
  }

  openInBrowser(target);
  console.log(`\n  ✓  Opened: ${target}\n`);
}
