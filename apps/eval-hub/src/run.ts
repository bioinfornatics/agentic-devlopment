/**
 * `--run` CLI mode — drives the LayeredRunner and streams human-readable progress.
 *
 * UX design:
 *  • Subject completion   — one permanent line per subject (scrollable history)
 *  • Live heartbeat       — EventBus subscription; setInterval ticker every 2 s
 *                           shows all currently-running subjects with turn + elapsed
 *  • ANSI colors          — green ✓ / red ✗ / yellow ⚠ / dim metadata
 *  • ETA                  — computed from done/total ratio × elapsed time
 *  • Summary table        — aligned columns, colored deltas
 *
 * Options:
 *   --goose-cli <path>         Goose binary (default: "goose")
 *   --layers <l1,l2,l3>        Comma-separated: skills,agents,recipes (default: all)
 *   --subjects <s1,s2>         Comma/space-separated subject filter
 *   --workers <n>              Parallel subjects (default: 3)
 *   --max-turns <n>            Max turns per goose run (default: 8)
 *   --timeout <s>              Per-run timeout in seconds (default: 900)
 *   --ambient-goose            Hide user skill dirs for clean isolation
 *   --continue-on-failure      Don't abort on first failure
 *   --no-early-stop            Disable L1→L2→L3 early-stop gate
 *   --early-stop-threshold <d> Avg Δ threshold (default: 0)
 *   --resume <runId>           Resume a previous layered run
 */
import type { EvalKind } from "./shared/types.js";
import type { LayeredConfig } from "./domains/execution/ports.js";
import type { DomainEvent } from "./shared/events.js";
import { LayeredRunner } from "./domains/execution/layeredRunner.js";
import { EventBus }      from "./shared/eventBus.js";

// ── ANSI color helpers (no deps) ──────────────────────────────────────────────

const isTTY = process.stdout.isTTY ?? false;
const esc   = (code: string) => isTTY ? `\x1b[${code}` : "";
const C = {
  reset:   esc("0m"),
  bold:    esc("1m"),
  dim:     esc("2m"),
  green:   esc("32m"),
  red:     esc("31m"),
  yellow:  esc("33m"),
  blue:    esc("34m"),
  cyan:    esc("36m"),
  gray:    esc("90m"),
  // Composite
  ok:      esc("1m") + esc("32m"),
  fail:    esc("1m") + esc("31m"),
  warn:    esc("1m") + esc("33m"),
  heading: esc("1m") + esc("34m"),
};

const SPINNER = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let   spinIdx = 0;

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0)  return `${h}h${String(m % 60).padStart(2,"0")}m`;
  if (m > 0)  return `${m}m${String(s % 60).padStart(2,"0")}s`;
  return `${s}s`;
}

/**
 * Format one active-subject slot at exactly 50 characters (stripped of ANSI):
 *   <name 22>  [<config 13>]  t<turn 4>  <dur 6>
 *
 * Examples (ANSI stripped):
 *   atomic-design-fundamen  [with_skill   ]  t 98   732s
 *   sdd                     [without_skill]   t 7    45s
 *   agentic-devlopment      [with_agent   ]  t 14   1m32s
 */
function fmtActiveSlot(subj: string, config: string, turn: number, elapsedSec: number): string {
  // Name: 22 chars (truncate with ellipsis if longer)
  const name = (subj.length > 22 ? subj.slice(0, 21) + "…" : subj).padEnd(22);
  // Config inside brackets: fixed 15 chars total ("[" + 13 + "]")
  const cfgInner = config.padEnd(13).slice(0, 13);
  const cfg      = `[${cfgInner}]`;           // 15 chars
  // Turn: "t" + right-aligned number in 4 chars
  const turnStr  = ("t" + turn).padStart(5);  //  5 chars (space + t + digits)
  // Duration: right-aligned in 7 chars
  const dur      = fmtElapsed(elapsedSec).padStart(7);
  //                         22  +1+  15  +1+  5  +1+  7  = 52 ≈ 50
  return `${name} ${cfg}${turnStr} ${dur}`;
}

function fmtElapsed(s: number): string {
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(s / 3600);
  return `${h}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

function fmtDelta(d: number, colored = true): string {
  const s = (d >= 0 ? "+" : "") + d.toFixed(4);
  if (!colored) return s;
  return d > 0 ? C.green + s + C.reset : d < 0 ? C.red + s + C.reset : C.dim + s + C.reset;
}

function fmtPct(p: number): string {
  return (p * 100).toFixed(0).padStart(3) + "%";
}

function eta(doneCount: number, total: number, elapsedMs: number): string {
  if (doneCount === 0 || doneCount >= total) return "";
  const remainMs = (elapsedMs / doneCount) * (total - doneCount);
  return ` · ETA ${fmtMs(remainMs)}`;
}

// ── CLI arg helpers ───────────────────────────────────────────────────────────

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}
function opt(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1]! : fallback;
}
function optInt(args: string[], name: string, fallback: number): number {
  const v = parseFloat(opt(args, name, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function startRun(args: string[]): Promise<void> {
  const gooseCli   = opt(args, "--goose-cli", "goose");
  const workers    = optInt(args, "--workers", 3);
  const maxTurns   = optInt(args, "--max-turns", 8);
  const timeoutMs  = optInt(args, "--timeout", 900) * 1000;
  const ambient    = flag(args, "--ambient-goose");
  const noEarlyStop         = flag(args, "--no-early-stop");
  const continueOnFail      = flag(args, "--continue-on-failure");
  const earlyStopThreshold  = parseFloat(opt(args, "--early-stop-threshold", "0"));
  const resumeId    = flag(args, "--resume") ? opt(args, "--resume", "") : undefined;
  const layersRaw   = opt(args, "--layers", "skills,agents,recipes");
  const layers      = layersRaw.split(",").map(s => s.trim()).filter(Boolean) as EvalKind[];
  const subjectsRaw = opt(args, "--subjects", "");
  const subjectFilter = subjectsRaw
    ? subjectsRaw.split(/[, ]+/).map(s => s.trim()).filter(Boolean)
    : undefined;

  const threshold = Number.isFinite(earlyStopThreshold) ? earlyStopThreshold : 0;

  // ── Header ──────────────────────────────────────────────────────────────────
  const sep = C.heading + "══════════════════════════════════════════════════════" + C.reset;
  console.log(sep);
  console.log(`  ${C.bold}HARNESS LAYERED EVAL${C.reset}  ${C.gray}eval-hub · TypeScript runner${C.reset}`);
  console.log(sep);
  console.log(`  ${C.dim}Goose CLI  :${C.reset} ${gooseCli}`);
  console.log(`  ${C.dim}Layers     :${C.reset} ${layers.join(", ")}`);
  console.log(`  ${C.dim}Workers    :${C.reset} ${workers}`);
  console.log(`  ${C.dim}Max turns  :${C.reset} ${maxTurns}`);
  console.log(`  ${C.dim}Timeout    :${C.reset} ${timeoutMs / 1000}s`);
  console.log(`  ${C.dim}Ambient    :${C.reset} ${ambient}`);
  if (resumeId)      console.log(`  ${C.dim}Resuming   :${C.reset} ${resumeId}`);
  if (subjectFilter) console.log(`  ${C.dim}Subjects   :${C.reset} ${subjectFilter.join(", ")}`);
  console.log();

  // ── Event bus — live heartbeat state ────────────────────────────────────────
  interface ActiveInfo { config: string; turn: number; startMs: number; }
  const active   = new Map<string, ActiveInfo>();   // subject → live state
  const scores   = new Map<string, number>();        // "subject:config" → pass_rate

  const bus = new EventBus();
  bus.onEvent((ev: DomainEvent) => {
    switch (ev.type) {
      case "subject.started":
        active.set(ev.subject, { config: ev.config, turn: 0, startMs: Date.now() });
        break;
      case "goose.turn":
        active.get(ev.subject)!?.turn && (active.get(ev.subject)!.turn = ev.turn);
        // Update turn count safely
        { const a = active.get(ev.subject); if (a) a.turn = ev.turn; }
        break;
      case "subject.graded":
        scores.set(`${ev.subject}:${ev.config}`, ev.score);
        break;
      case "subject.completed":
        active.delete(ev.subject);
        break;
    }
  });

  // ── Heartbeat ticker — prints active subjects every 2 s ─────────────────────
  let layerStartMs = Date.now();
  let layerDone    = 0;
  let layerTotal   = 0;

  const ticker = setInterval(() => {
    if (active.size === 0) return;
    const now    = Date.now();
    const spin   = SPINNER[spinIdx++ % SPINNER.length]!;
    const etaStr = layerDone > 0
      ? C.gray + eta(layerDone, layerTotal, now - layerStartMs) + C.reset
      : "";
    // One line per active subject, fixed-width columns, left-indented
    const lines = [...active.entries()].map(([subj, info]) => {
      const elapsed = Math.round((now - info.startMs) / 1000);
      const slot    = fmtActiveSlot(subj, info.config, info.turn, elapsed);
      return `${C.dim}  ${spin} ${C.reset}${C.cyan}${slot}${C.reset}`;
    });
    process.stdout.write(lines.join("\n") + etaStr + "\n");
  }, 2000);

  // ── Layer/suite state ────────────────────────────────────────────────────────
  const cfg: LayeredConfig = {
    layers, workers, gooseCli, maxTurns, timeoutMs, ambient,
    continueOnFail, earlyStopThreshold: threshold, noEarlyStop,
    ...(resumeId      ? { layeredRunId: resumeId }  : {}),
    ...(subjectFilter ? { subjectFilter }            : {}),
  };

  const runner  = new LayeredRunner();
  const overall = Date.now();
  const summary: Array<{
    level: string; kind: string; avgDelta: number; n: number;
    elapsedMs: number; skipped: boolean; reason?: string;
  }> = [];

  try {
    for await (const ev of runner.run(cfg, bus)) {

      // ── Layer events ──────────────────────────────────────────────────────
      if (ev.type === "layer.started") {
        layerStartMs = Date.now();
        layerDone    = 0;
        layerTotal   = ev.total;
        const bar    = "─".repeat(54);
        console.log(`\n${C.heading}${bar}${C.reset}`);
        console.log(
          `  ${C.bold}${ev.level} ${ev.kind.toUpperCase()}${C.reset}`
          + `  ${C.dim}${ev.total} subjects · ${ev.workers} workers${C.reset}`,
        );
        console.log(`${C.dim}${bar}${C.reset}`);
        continue;
      }

      if (ev.type === "layer.skipped") {
        const reason = ev.reason === "already_done" ? "already done (resume)" : ev.reason;
        console.log(`  ${C.dim}⏭  ${ev.level ?? ""} ${ev.kind} — ${reason}${C.reset}`);
        summary.push({ level: ev.level ?? "", kind: ev.kind, avgDelta: 0, n: 0, elapsedMs: 0, skipped: true, reason });
        continue;
      }

      if (ev.type === "layer.completed") {
        const sign   = ev.avgDelta >= 0 ? "+" : "";
        const dcolor = ev.avgDelta > threshold ? C.green : ev.avgDelta < 0 ? C.red : C.yellow;
        const note   = ev.avgDelta <= threshold ? C.yellow + " [no improvement]" + C.reset : "";
        console.log(
          `\n  ${C.bold}Layer result:${C.reset}`
          + ` avg Δ = ${dcolor}${sign}${ev.avgDelta.toFixed(4)}${C.reset}`
          + `  ${C.dim}(${ev.n} subjects · ${fmtMs(ev.durationMs)})${C.reset}${note}`,
        );
        summary.push({ level: ev.level, kind: ev.kind, avgDelta: ev.avgDelta, n: ev.n, elapsedMs: ev.durationMs, skipped: false });
        continue;
      }

      // ── Suite events ──────────────────────────────────────────────────────
      if (ev.type === "suite.subject_done") {
        layerDone++;
        const ok     = ev.rc === 0;
        const mark   = ok ? C.green + "✓" + C.reset : C.red + "✗" + C.reset;
        const name   = ev.subject.padEnd(36);
        const time   = C.dim + fmtMs(ev.durationMs).padStart(6) + C.reset;
        const prog   = C.gray + `(${ev.doneCount}/${ev.total})` + C.reset;
        const pct    = C.dim + `${Math.round(ev.doneCount * 100 / (ev.total || 1))}%` + C.reset;
        const etaStr = C.gray + eta(ev.doneCount, ev.total, Date.now() - layerStartMs) + C.reset;
        console.log(`  [${mark}] ${name} ${time}  ${prog} ${pct}${etaStr}`);
        continue;
      }

      if (ev.type === "suite.completed") {
        console.log(
          `\n  ${C.dim}Suite done: ${ev.passed}/${ev.total} subjects · ${fmtMs(ev.durationMs)}${C.reset}`,
        );
        continue;
      }

      // ── Early stop ────────────────────────────────────────────────────────
      if (ev.type === "early_stop") {
        console.log(
          `\n  ${C.warn}⚠  EARLY STOP${C.reset}`
          + `  ${ev.level} avg Δ = ${fmtDelta(ev.avgDelta)} ≤ threshold ${threshold}`,
        );
        const skipping = ev.skipping as readonly string[];
        console.log(`     ${C.dim}Skipping: ${skipping.join(", ")}${C.reset}`);
        continue;
      }
    }
  } finally {
    clearInterval(ticker);
  }

  // ── Final summary table ──────────────────────────────────────────────────────
  const totalMs  = Date.now() - overall;
  const colW     = [4, 10, 14, 12, 8];   // mark, level+kind, avgDelta, subjects, time

  console.log();
  console.log(sep);
  console.log(`  ${C.bold}LAYERED EVAL SUMMARY${C.reset}  ${C.gray}${fmtMs(totalMs)} total${C.reset}`);
  console.log(sep);
  console.log(
    C.dim
    + "  " + "   ".padEnd(colW[0]!)
    + "Layer".padEnd(colW[1]! + colW[2]! - 2)
    + "Avg Δ".padEnd(colW[2]!)
    + "Subjects".padEnd(colW[3]!)
    + "Time"
    + C.reset,
  );
  console.log(C.dim + "  " + "─".repeat(52) + C.reset);

  for (const r of summary) {
    if (r.skipped) {
      console.log(
        `  ${C.dim}[–] ${r.level} ${r.kind.padEnd(10)} SKIPPED`
        + (r.reason ? `  (${r.reason})` : "") + C.reset,
      );
    } else {
      const ok   = r.avgDelta > threshold;
      const mark = ok ? C.ok + "[✓]" + C.reset : C.fail + "[✗]" + C.reset;
      const lvl  = `${r.level} ${r.kind}`.padEnd(14);
      const dlt  = fmtDelta(r.avgDelta).padEnd(18);  // colored string + padding
      const subj = C.dim + String(r.n).padEnd(colW[3]!) + C.reset;
      const time = C.dim + fmtMs(r.elapsedMs) + C.reset;
      console.log(`  ${mark} ${C.bold}${lvl}${C.reset} ${dlt} ${subj} ${time}`);
    }
  }

  console.log(C.dim + "  " + "─".repeat(52) + C.reset);
  console.log(`  ${C.dim}Total: ${fmtMs(totalMs)}${C.reset}`);
  console.log(sep);
  console.log();
}
