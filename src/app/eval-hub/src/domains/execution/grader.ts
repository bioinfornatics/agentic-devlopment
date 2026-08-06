/**
 * IGrader implementations.
 *
 * LlmGrader  — runs a second goose process to grade the output.
 * NullGrader  — returns pass_rate: null (grading unavailable).
 *
 * When the LLM grader fails (network/parse/goose crash), it returns
 * pass_rate: null so the failure does NOT bias the A/B delta.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import type { IGrader, GradingResult, IGooseRunner } from "./ports.js";
import type { EvalScenario } from "../../shared/types.js";
import { GooseProcessRunner } from "./gooseRunner.js";
import { analyzeGooseLogs, gooseLogCaptureForWorkspace } from "./gooseLogAnalyzer.js";

const MAX_CAPTURED_OUTPUT = 16_384;
const RATE_LIMIT_PATTERN = /(?:usage[_ -]?limit[_ -]?reached|rate[_ -]?limit(?:ed)?|too many requests|http\s*429|\b429\b)/i;
const KEYED_SECRET_PATTERN = /((?:authorization|api[_-]?key|token|secret|password)\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi;
const BEARER_SECRET_PATTERN = /(\bbearer\s+)[^\s,;]+/gi;
const OPENAI_STYLE_SECRET_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g;

function redactSecrets(value: string): string {
  return value
    .replace(KEYED_SECRET_PATTERN, "$1[REDACTED]")
    .replace(BEARER_SECRET_PATTERN, "$1[REDACTED]")
    .replace(OPENAI_STYLE_SECRET_PATTERN, "[REDACTED]");
}

function safeCapturedOutput(value: string): string {
  const bounded = value.length > MAX_CAPTURED_OUTPUT ? value.slice(0, MAX_CAPTURED_OUTPUT) + "\n[truncated]" : value;
  return redactSecrets(bounded);
}

function sanitizeForArtifact<T>(value: T): T {
  // Log analysis is already structurally bounded by gooseLogAnalyzer; redact it
  // without truncating serialized JSON into an invalid artifact.
  return JSON.parse(redactSecrets(JSON.stringify(value))) as T;
}

function isProviderRateLimited(
  stdout: string,
  stderr: string,
  analysis: Awaited<ReturnType<typeof analyzeGooseLogs>>,
): boolean {
  if (RATE_LIMIT_PATTERN.test(stdout) || RATE_LIMIT_PATTERN.test(stderr)) return true;
  return [...analysis.fatalDiagnostics, ...analysis.warnings].some(diagnostic =>
    diagnostic.code === "provider_rate_limited" || RATE_LIMIT_PATTERN.test(diagnostic.message),
  );
}


export interface DescriptorV1 {
  readonly id: string;
  readonly version: string;
}

export function defaultGraderDescriptor(): DescriptorV1 {
  return { id: "llm-grader", version: "v1" };
}

export function defaultRubricDescriptor(): DescriptorV1 {
  return { id: "expected_behavior_index", version: "v1" };
}

export function expectedCriterionIdsFor(scenario: EvalScenario): readonly string[] {
  return (scenario.expected_behavior ?? []).map((_, index) => `expected_behavior[${index}]`);
}

// ── Null grader (grading unavailable, no bias) ────────────────────────────────

export class NullGrader implements IGrader {
  async grade(): Promise<GradingResult> {
    return { summary: { total: 0, passed: 0, failed: 0, pass_rate: null }, expectations: [] };
  }
}

// ── LLM grader ────────────────────────────────────────────────────────────────

export class LlmGrader implements IGrader {
  constructor(private readonly goose: IGooseRunner = new GooseProcessRunner()) {}

  async grade(
    scenario:    EvalScenario,
    config:      string,
    gooseOutput: string,
    runDir:      string,
    gooseCli:    string,
    runtime: Readonly<{ provider: string | null; model: string | null; sandbox?: import("./ports.js").SandboxProcessConfig }> = { provider: null, model: null },
  ): Promise<GradingResult> {
    const expectations = scenario.expected_behavior ?? [];
    if (expectations.length === 0) {
      return { summary: { total: 0, passed: 0, failed: 0, pass_rate: null }, expectations: [] };
    }

    const prompt = this.buildGradingPrompt(scenario, config, gooseOutput);
    const promptPath = path.join(runDir, "grading_prompt.txt");
    await fs.writeFile(promptPath, prompt);

    const graderRoot = path.join(runDir, ".grader");
    const graderProject = path.join(graderRoot, "project");
    await fs.mkdir(graderProject, { recursive: true });
    const runtimeArgs = [
      ...(runtime.provider ? ["--provider", runtime.provider] : []),
      ...(runtime.model ? ["--model", runtime.model] : []),
    ];
    let lastResult: GradingResult = this.nullResult(expectations, "grader_runtime_unavailable");
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let stdout = "";
      let stderr = "";
      let processFailed = false;
      let sawExit = false;
      let exit: { code: number | null; signal: string | null } | null = null;
      const logCapture = gooseLogCaptureForWorkspace(graderRoot);
      try {
        for await (const raw of this.goose.run({
          gooseCli,
          args: ["run", "--instructions", promptPath, ...runtimeArgs, "--no-session", "--max-turns", "1", "--quiet"],
          env: { ...(runtime.sandbox?.env ?? {}), XDG_STATE_HOME: logCapture.stateHome, XDG_DATA_HOME: logCapture.stateHome },
          cwd: runtime.sandbox ? graderProject : runDir,
          inheritEnv: !runtime.sandbox,
          timeoutMs: 120_000,
        })) {
          if (raw.type === "exit") {
            exit = { code: raw.code, signal: raw.signal };
            sawExit = true;
            processFailed = raw.code !== 0 || raw.signal !== null;
            break;
          }
          if (raw.stream === "stdout") stdout += raw.text + "\n";
          else stderr += raw.text + "\n";
        }
      } catch (error) {
        processFailed = true;
        stderr += error instanceof Error ? error.message : "grader process threw";
      }
      const logAnalysis = await analyzeGooseLogs(logCapture.logsRoot, runtime.model);
      await fs.rm(logCapture.stateHome, { recursive: true, force: true }).catch(() => undefined);

      if (!sawExit) processFailed = true;
      const rateLimited = isProviderRateLimited(stdout, stderr, logAnalysis);
      const parsed = !processFailed && logAnalysis.fatalDiagnostics.length === 0
        ? this.parseOutput(stdout, expectations)
        : this.nullResult(expectations, "grader_runtime_unavailable");
      const parseOutcome = Number.isFinite(parsed.summary.pass_rate) ? "valid" : "invalid";
      await fs.writeFile(path.join(runDir, `grader-attempt-${attempt}.json`), JSON.stringify({
        schema: "grader-attempt-diagnostic-v1",
        attempt,
        process: { failed: processFailed, exit },
        output: { stdout: safeCapturedOutput(stdout), stderr: safeCapturedOutput(stderr) },
        logAnalysis: sanitizeForArtifact(logAnalysis),
        parseOutcome,
        classification: rateLimited ? "provider_rate_limited" : processFailed ? "grader_runtime_unavailable" : parseOutcome === "invalid" ? "malformed_grader_json" : "ok",
      }, null, 2));

      if (rateLimited) {
        return this.nullResult(expectations, `grader_runtime_unavailable/provider_rate_limited; inspect grader-attempt-${attempt}.json`);
      }
      lastResult = parsed;
      if (parseOutcome === "valid") return parsed;
      // Only a non-rate-limit transient failure receives one retry.
    }
    return this.nullResult(expectations, "malformed_grader_json after one retry; inspect grader-attempt-1.json and grader-attempt-2.json");
  }

  private buildGradingPrompt(scenario: EvalScenario, config: string, output: string): string {
    const expectations = scenario.expected_behavior ?? [];
    return `Grade this A/B skill evaluation run. Return JSON only — no markdown fences, no explanation.

User query: ${scenario.query ?? ""}

Expected behaviors to grade (each independently):
${JSON.stringify(expectations, null, 2)}

Goose events.jsonl transcript (complete; earliest tool calls included):
\`\`\`
${output}
\`\`\`

Required JSON (return ONLY this, nothing else):
{
  "summary": { "total": <n>, "passed": <n>, "failed": <n>, "pass_rate": <decimal> },
  "expectations": [
    { "text": "<exact text>", "passed": <bool>, "evidence": "<brief quote>" }
  ]
}`;
  }

  private parseOutput(output: string, expectations: readonly string[]): GradingResult {
    const jsonMatches = output.match(/\{[\s\S]*\}/g);
    if (!jsonMatches) return this.nullResult(expectations, "no JSON in grader output");
    for (let index = jsonMatches.length - 1; index >= 0; index -= 1) {
      try {
        const parsed = JSON.parse(jsonMatches[index]!) as Partial<GradingResult>;
        const summary = parsed.summary;
        const rows = parsed.expectations;
        if (!summary || !Array.isArray(rows) || rows.length !== expectations.length) continue;
        const passed = rows.filter(row => row && typeof row.passed === "boolean").length;
        if (passed !== expectations.length) continue;
        const passedCount = rows.filter(row => row.passed).length;
        const failedCount = expectations.length - passedCount;
        const passRate = summary.pass_rate;
        if (typeof passRate !== "number" || !Number.isFinite(passRate)) continue;
        return {
          summary: { total: expectations.length, passed: passedCount, failed: failedCount, pass_rate: passRate },
          expectations: rows.map((row, rowIndex) => ({ text: typeof row.text === "string" && row.text.length > 0 ? row.text : expectations[rowIndex]!, passed: row.passed, evidence: typeof row.evidence === "string" ? row.evidence : "" })),
        };
      } catch { /* try the previous JSON object */ }
    }
    return this.nullResult(expectations, "JSON parse or schema validation failed");
  }

  /** pass_rate: null — excluded from delta, not penalised. */
  private nullResult(expectations: readonly string[], reason: string): GradingResult {
    return {
      summary: { total: expectations.length, passed: 0, failed: expectations.length, pass_rate: null },
      expectations: expectations.map(text => ({ text, passed: false, evidence: `Grader unavailable: ${reason}` })),
    };
  }
}
