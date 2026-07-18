/**
 * IEvalRunner — thin orchestrator. Delegates to:
 *   IPromptBuilder   → SkillPromptBuilder
 *   IGrader          → LlmGrader
 *   IWorkspaceWriter → FsWorkspaceWriter
 *   IGooseRunner     → GooseProcessRunner
 *   IEventSink       → EventBus / NULL_SINK
 */
import os   from "node:os";
import fs   from "node:fs/promises";
import path from "node:path";
import type { IEvalRunner, IGooseRunner, IPromptBuilder, IGrader, ScenarioRunConfig, IEventSink } from "./ports.js";
import type { EvalEvent } from "../../shared/events.js";
import { GooseProcessRunner }  from "./gooseRunner.js";
import { SkillPromptBuilder }  from "./promptBuilder.js";
import { LlmGrader }           from "./grader.js";
import { FsWorkspaceWriter }   from "../persistence/workspaceWriter.js";
import type { IWorkspaceWriter } from "../persistence/ports.js";
import { PROJECT_ROOT }        from "../../shared/paths.js";
import { NULL_SINK }           from "../../shared/eventBus.js";

export class SkillEvalRunner implements IEvalRunner {
  constructor(
    private readonly goose:   IGooseRunner    = new GooseProcessRunner(),
    private readonly prompt:  IPromptBuilder  = new SkillPromptBuilder(),
    private readonly grader:  IGrader         = new LlmGrader(),
    private readonly writer:  IWorkspaceWriter = new FsWorkspaceWriter(),
  ) {}

  async *run(cfg: ScenarioRunConfig, sink: IEventSink = NULL_SINK): AsyncGenerator<EvalEvent> {
    const { kind, subject, hash, scenario, evalId, config, runNumber, gooseCli } = cfg;
    const run = runNumber;

    await this.writer.writeEvalMeta(kind, subject, hash, evalId, {
      evalId, evalName: scenario.query?.slice(0, 60), difficulty: scenario.difficulty, hash,
    });

    const ev0 = { type: "subject.started" as const, kind, subject, hash, evalId, config, run };
    yield ev0; sink.emit(ev0);

    // ── Prompt ───────────────────────────────────────────────────────────────
    const promptText = this.prompt.build(scenario, config);
    const promptPath = await this.writer.writePrompt(kind, subject, hash, evalId, config, run, promptText);

    // ── cwd / env ────────────────────────────────────────────────────────────
    const isWith = config.startsWith("with_");
    const tmpCwd = cfg.ambient && !isWith
      ? await fs.mkdtemp(path.join(os.tmpdir(), "goose-eval-cwd-"))
      : null;
    const cwd = cfg.ambient ? (isWith ? PROJECT_ROOT : tmpCwd!) : cfg.workspace;
    const env: Record<string, string> = {};
    if (!cfg.ambient) {
      const home = path.join(cfg.workspace, `eval-${evalId}`, config, `run-${run}`, ".goose_home");
      await fs.mkdir(path.join(home, ".config", "goose"), { recursive: true });
      await fs.writeFile(path.join(home, ".config", "goose", "config.yaml"), "# eval isolation\n");
      env["HOME"] = home;
      env["XDG_CONFIG_HOME"] = path.join(home, ".config");
    }

    // ── Run Goose ─────────────────────────────────────────────────────────────
    const maxTurns   = (scenario.max_turns ?? cfg.maxTurns) || cfg.maxTurns;
    const args       = ["run", "--instructions", promptPath, "--no-session",
                        "--max-turns", String(maxTurns), "--output-format", "stream-json", "--quiet"];
    const startMs    = Date.now();
    let   turns      = 0;
    let   rc: number | null = null;
    const outputLines: string[] = [];

    try {
      for await (const raw of this.goose.run({ gooseCli, args, env, cwd, timeoutMs: cfg.timeoutMs })) {
        if (raw.type === "exit") { rc = raw.code; break; }
        if (raw.stream !== "stdout" || !raw.text.trim()) continue;
        outputLines.push(raw.text);
        await this.writer.appendEvent(kind, subject, hash, evalId, config, run, raw.text);
        const parsed = parseStreamLine(raw.text);
        if (parsed?.isTurn) {
          turns++;
          const te = { type: "goose.turn" as const, subject, evalId, config, turn: turns, role: "assistant" as const, preview: parsed.preview ?? "" };
          yield te; sink.emit(te);
        }
        if (parsed?.isToolCall) {
          const tc = { type: "goose.tool_call" as const, subject, evalId, config, tool: parsed.tool ?? "unknown", args: parsed.args };
          yield tc; sink.emit(tc);
        }
      }
    } finally {
      if (tmpCwd) fs.rm(tmpCwd, { recursive: true, force: true }).catch(() => {});
    }

    const durationMs = Date.now() - startMs;
    await this.writer.writeTiming(kind, subject, hash, evalId, config, run, {
      startedAt: new Date(startMs).toISOString(), completedAt: new Date().toISOString(),
      durationMs, turnsUsed: turns, maxTurns, maxTurnsReached: turns >= maxTurns,
    });

    const ev1 = { type: "subject.completed" as const, kind, subject, hash, evalId, config, run, rc: rc ?? -1, turns, durationMs };
    yield ev1; sink.emit(ev1);

    // ── Grade ─────────────────────────────────────────────────────────────────
    const grading = await this.grader.grade(scenario, config, outputLines.join("\n"), cfg.workspace, gooseCli);
    await this.writer.writeGrading(kind, subject, hash, evalId, config, run, grading);
    const passRate = grading.summary.pass_rate;
    const ev2 = { type: "subject.graded" as const, subject, evalId, config, passed: passRate !== null && passRate === 1.0, score: passRate ?? 0 };
    yield ev2; sink.emit(ev2);
  }
}

function parseStreamLine(line: string): { isTurn?: boolean; isToolCall?: boolean; tool?: string; args?: unknown; preview?: string } | null {
  try {
    const ev = JSON.parse(line) as Record<string, unknown>;
    if (ev["role"] === "assistant" || ev["type"] === "message") {
      const content = ev["content"];
      const text = Array.isArray(content)
        ? (content as Record<string, unknown>[]).filter(c => c["type"] === "text").map(c => String(c["text"] ?? "")).join("")
        : String(content ?? "");
      return { isTurn: true, preview: text.slice(0, 120) };
    }
    if (ev["type"] === "tool_use" || ev["name"]) {
      return { isToolCall: true, tool: String(ev["name"] ?? ev["type"] ?? "tool"), args: ev["input"] ?? ev["arguments"] };
    }
    return null;
  } catch { return null; }
}
