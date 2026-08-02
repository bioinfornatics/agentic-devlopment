#!/usr/bin/env node
/**
 * Eval Hub — entry point.
 *
 * Modes (mutually exclusive flags, first match wins):
 *   --run             Drive a layered eval (L1→L2→L3)
 *   --report          Build the HTML trend dashboard from history DB
 *   --export-history  Export history DB → src/app/eval-hub/evals/history/runs.json
 *   --open            Open the trend report in the default browser
 *   --server          Start the Hono HTTP API
 *   --tui             Start the Rezi terminal UI  (default when TTY)
 *
 * Options:
 *   --port <n>        HTTP server port (default: $EVAL_HUB_PORT or 7331)
 *
 * Environment:
 *   PROJECT_ROOT      Repo root (default: cwd)
 *   EVAL_HUB_PORT     HTTP port override
 */

const args = process.argv.slice(2);

const usage = [
  "",
  "  Usage: node src/app/eval-hub/dist/index.js <mode> [options]",
  "",
  "  Modes:",
  "    --benchmark-minimal Validate and print the controlled harness benchmark catalog",
  "    --companion-self-check Print bounded standalone package/runtime identity and exit",
  "    --evaluate-harness-release Verify and evaluate an immutable harness release",
  "    --run              Drive a layered eval (L1→L2→L3)",
  "    --report           Build HTML trend dashboard → dist/evals/report/index.html",
  "    --report --open    Build + open in browser",
  "    --export-history   Export history DB → evals/history/runs.json",
  "    --open             Open the trend report in the default browser",
  "    --server           Start the Hono HTTP API  (default when no TTY)",
  "    --tui              Start the terminal UI      (default when TTY)",
  "",
  "  Options:",
  "    Eval run options (--run):",
  "    --layers <l1,l2,l3>  Layers to run: skills,agents,recipes",
  "    --subjects <s1,s2>   Only run these subjects",
  "    --workers <n>        Parallel workers (default: 3)",
  "    --ambient-goose      Compatibility only; forbidden by release gate",
  "    --release-gate|--full Require sandbox roots",
  "    --sandbox-root <dir>  Sandbox containing all gate roots",
  "    --runtime-root <dir>  Runtime inside sandbox",
  "    --evidence-root <dir> Evidence inside sandbox",
  "    --goose-cli <path>   Path to goose binary",
  "    --resume <runId>     Resume a previous layered run",
  "",
].join("\n");

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

if (args.includes("--companion-self-check")) {
  console.log(JSON.stringify({
    schema: "eval-hub-companion-self-check-v1",
    runtime: process.versions["bun"] ? "bun" : "node",
    runtimeVersion: process.versions["bun"] ?? process.version,
    operationalModeStarted: false,
  }));
  process.exit(0);
}

if (args.includes("--benchmark-minimal")) {
  const { startBenchmark } = await import("./benchmark.js");
  await startBenchmark(args);
  process.exit(0);
}

if (args.includes("--evaluate-harness-release")) {
  const { evaluateHarnessRelease, parseReleaseEvaluationArgs } = await import("./releaseEvaluation.js");
  const result = await evaluateHarnessRelease(parseReleaseEvaluationArgs(args));
  if (result.evidence && args.includes("--dry-run")) console.log(JSON.stringify(result.evidence, Object.keys(result.evidence).sort()));
  process.exit(result.exitCode);
}

if (args.includes("--run")) {
  const { startRun }    = await import("./run.js");
  await startRun(args);
  process.exit(0);
}

if (args.includes("--report")) {
  const { startReport } = await import("./report.js");
  await startReport(args);
  process.exit(0);
}

if (args.includes("--export-history")) {
  const { startExport } = await import("./export.js");
  await startExport(args);
  process.exit(0);
}

if (args.includes("--open")) {
  const { startOpen }   = await import("./open.js");
  await startOpen(args);
  process.exit(0);
}

const wantServer = args.includes("--server") || !process.stdout.isTTY;
const wantTui    = args.includes("--tui")    || process.stdout.isTTY;
const portArg    = args.indexOf("--port");
const port       = portArg >= 0
  ? parseInt(args[portArg + 1] ?? "7331", 10)
  : parseInt(process.env["EVAL_HUB_PORT"] ?? "7331", 10);

if (wantServer) {
  const { startServer } = await import("./server/index.js");
  startServer(port);
}

if (wantTui) {
  const { startTui }    = await import("./app/index.js");
  startTui();
}

if (!wantServer && !wantTui) {
  console.error(usage);
  process.exit(1);
}
