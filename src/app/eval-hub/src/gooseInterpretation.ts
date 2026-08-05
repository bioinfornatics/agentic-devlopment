import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NormalizedIntegrityReportStateV2 } from "./domains/persistence/integrityV2Store.js";

const GOOSE_INTERPRETATION_TIMEOUT_MS = 30_000;
const GOOSE_INTERPRETATION_MAX_OUTPUT = 16_384;

export type HumanValidationDecision = "APPROVE" | "BLOCK";
export type HumanValidationState = "PENDING_HUMAN_VALIDATION" | HumanValidationDecision;

export interface GooseInterpretationRunner {
  generate(prompt: string, config: { gooseCli: string; provider: string; model: string }): Promise<string>;
}

export interface BeadsValidationAdapter {
  persist(input: { taskId: string; state: HumanValidationState; runId: string; manifestHashes: readonly string[]; comment: string }): Promise<void>;
}

export interface CommandRunner {
  run(command: string, args: readonly string[]): Promise<void>;
}

export function buildGooseInterpretationPrompt(
  reports: readonly NormalizedIntegrityReportStateV2[],
): string {
  return [
    "Explain these persisted evaluation metrics cautiously. Do not rescore, infer missing data, or override the deterministic report.",
    JSON.stringify(reports.map(report => ({
      manifestHash: report.manifestHash,
      pairMicro: report.pairMicro,
      subjectMacro: report.subjectMacro,
      validPairCount: report.validPairCount,
      includedSubjectCount: report.includedSubjectCount,
      excludedPairCounts: report.excludedPairCounts,
      subjectFailureCounts: report.subjectFailureCounts,
    }))),
  ].join("\n");
}

export function orderedManifestHashes(reports: readonly NormalizedIntegrityReportStateV2[]): readonly string[] {
  return [...new Set(reports.map(report => report.manifestHash))];
}

export class GooseCliInterpretationRunner implements GooseInterpretationRunner {
  async generate(prompt: string, config: { gooseCli: string; provider: string; model: string }): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eval-hub-interpretation-"));
    const promptPath = path.join(directory, "prompt.txt");
    await fs.writeFile(promptPath, prompt, { mode: 0o600 });
    try {
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(config.gooseCli, ["run", "--instructions", promptPath, "--provider", config.provider, "--model", config.model, "--no-session", "--max-turns", "1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const finish = (callback: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          callback();
        };
        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          finish(() => reject(new Error(`Goose interpretation timed out after ${GOOSE_INTERPRETATION_TIMEOUT_MS}ms`)));
        }, GOOSE_INTERPRETATION_TIMEOUT_MS);
        child.stdout.on("data", chunk => {
          if (stdout.length < GOOSE_INTERPRETATION_MAX_OUTPUT) {
            stdout += String(chunk).slice(0, GOOSE_INTERPRETATION_MAX_OUTPUT - stdout.length);
          }
        });
        child.stderr.on("data", chunk => {
          if (stderr.length < GOOSE_INTERPRETATION_MAX_OUTPUT) {
            stderr += String(chunk).slice(0, GOOSE_INTERPRETATION_MAX_OUTPUT - stderr.length);
          }
        });
        child.on("error", error => finish(() => reject(error)));
        child.on("close", code => finish(() => code === 0 && stdout.trim()
          ? resolve(stdout.trim())
          : reject(new Error(`Goose interpretation failed (exit ${code}): ${stderr.trim()}`))));
      });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

export class SpawnCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], { stdio: "ignore" });
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    });
  }
}

export class BeadsCliValidationAdapter implements BeadsValidationAdapter {
  constructor(private readonly commands: CommandRunner = new SpawnCommandRunner()) {}

  async persist(input: { taskId: string; state: HumanValidationState; runId: string; manifestHashes: readonly string[]; comment: string }): Promise<void> {
    if (input.manifestHashes.length === 0) throw new Error("Human validation requires at least one manifest hash");
    const hashesJson = JSON.stringify(input.manifestHashes);
    const binding = `run_id=${input.runId} manifest_hashes=${hashesJson}`;
    await this.commands.run("bd", ["comment", input.taskId, `${input.comment}\n${binding}`]);
    await this.commands.run("bd", ["set-state", input.taskId, `human_validation=${input.state}`, "--reason", binding]);
    await this.commands.run("bd", ["update", input.taskId,
      "--set-metadata", `human_validation_state=${input.state}`,
      "--set-metadata", `human_validation_run_id=${input.runId}`,
      "--set-metadata", "human_validation_manifest_binding_schema=ordered_hashes_v1",
      "--set-metadata", `human_validation_manifest_hashes=${hashesJson}`,
      ...(input.manifestHashes.length === 1
        ? ["--set-metadata", `human_validation_manifest_hash=${input.manifestHashes[0]}`]
        : []),
    ]);
  }
}

export async function generateAndPersistInterpretation(input: {
  reports: readonly NormalizedIntegrityReportStateV2[];
  runId: string;
  taskId: string;
  gooseCli: string;
  provider: string;
  model: string;
  runner: GooseInterpretationRunner;
  beads: BeadsValidationAdapter;
}): Promise<string> {
  if (input.reports.length === 0) throw new Error("No persisted reports are available for Goose interpretation");
  const text = await input.runner.generate(buildGooseInterpretationPrompt(input.reports), input);
  const rendered = `Généré par Goose (${input.provider}/${input.model})\n${text}\nValidation humaine obligatoire`;
  await input.beads.persist({ taskId: input.taskId, state: "PENDING_HUMAN_VALIDATION", runId: input.runId, manifestHashes: orderedManifestHashes(input.reports), comment: rendered });
  return rendered;
}

export async function persistHumanDecision(input: {
  decision: HumanValidationDecision;
  reports: readonly NormalizedIntegrityReportStateV2[];
  runId: string;
  taskId: string;
  beads: BeadsValidationAdapter;
}): Promise<void> {
  if (input.reports.length === 0) throw new Error("Cannot bind human validation without a persisted report");
  await input.beads.persist({ taskId: input.taskId, state: input.decision, runId: input.runId, manifestHashes: orderedManifestHashes(input.reports), comment: `HUMAN_VALIDATION ${input.decision}` });
}
