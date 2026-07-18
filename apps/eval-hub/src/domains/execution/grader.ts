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
  ): Promise<GradingResult> {
    const expectations = scenario.expected_behavior ?? [];
    if (expectations.length === 0) {
      return { summary: { total: 0, passed: 0, failed: 0, pass_rate: null }, expectations: [] };
    }

    const prompt = this.buildGradingPrompt(scenario, config, gooseOutput);
    const promptPath = path.join(runDir, "grading_prompt.txt");
    await fs.writeFile(promptPath, prompt);

    let gradingOutput = "";
    try {
      for await (const raw of this.goose.run({
        gooseCli,
        args:      ["run", "--instructions", promptPath, "--no-session", "--max-turns", "1", "--quiet"],
        cwd:       runDir,
        timeoutMs: 120_000,
      })) {
        if (raw.type === "exit") break;
        if (raw.stream === "stdout") gradingOutput += raw.text + "\n";
      }
    } catch {
      // Goose failed — return null so result is excluded from delta, not biased
      return this.nullResult(expectations, "grader process failed");
    }

    return this.parseOutput(gradingOutput, expectations);
  }

  private buildGradingPrompt(scenario: EvalScenario, config: string, output: string): string {
    const expectations = scenario.expected_behavior ?? [];
    return `Grade this A/B skill evaluation run. Return JSON only — no markdown fences, no explanation.

Configuration: ${config}
User query: ${scenario.query ?? ""}

Expected behaviors to grade (each independently):
${JSON.stringify(expectations, null, 2)}

Goose run output (last 20 000 chars):
\`\`\`
${output.slice(-20_000)}
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
    try {
      const parsed = JSON.parse(jsonMatches[jsonMatches.length - 1]!) as GradingResult;
      if (parsed.summary && Array.isArray(parsed.expectations)) return parsed;
    } catch { /* fall through */ }
    return this.nullResult(expectations, "JSON parse failed");
  }

  /** pass_rate: null — excluded from delta, not penalised. */
  private nullResult(expectations: readonly string[], reason: string): GradingResult {
    return {
      summary: { total: expectations.length, passed: 0, failed: expectations.length, pass_rate: null },
      expectations: expectations.map(text => ({ text, passed: false, evidence: `Grader unavailable: ${reason}` })),
    };
  }
}
