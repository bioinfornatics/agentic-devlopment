import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { EvalKind, TreatmentId } from "../../shared/types.js";

export interface TreatmentBootstrap {
  readonly kind: "none" | "system_instruction" | "recipe";
  readonly bytes: string;
}

export interface ExecutionTreatment {
  readonly id: TreatmentId;
  readonly bootstrap: TreatmentBootstrap;
  readonly definition: Readonly<{
    kind: EvalKind;
    subject: string;
    skills: readonly string[];
    agents: readonly string[];
  }>;
}

export interface TreatmentPair {
  readonly candidate: ExecutionTreatment;
  readonly baseline: ExecutionTreatment;
}

export interface TreatmentPairInput {
  readonly kind: EvalKind;
  readonly subject: string;
  readonly declaredSkills: readonly string[];
  readonly declaredAgents: readonly string[];
  readonly resolvedRecipePath?: string;
}

export interface InvariantExecutionEnvelope {
  readonly taskPayload: string;
  readonly fixtureHashes: Readonly<Record<string, string>>;
  readonly timeBudgetMs: number;
  readonly tokenBudget: number;
  readonly provider: string;
  readonly model: string;
  readonly decoding: Readonly<{ temperature: number | null; seed: number | null }>;
  readonly gooseRuntimeVersion: string;
  readonly evalHubRuntimeVersion: string;
}

export interface ExecutionMatrixRow {
  readonly kind: EvalKind;
  readonly subject: string;
  readonly evalId: number;
  readonly repetition: number;
  readonly side: "candidate" | "baseline";
  readonly treatment: ExecutionTreatment;
  readonly taskPayloadHash: string;
  readonly envelope: InvariantExecutionEnvelope;
  readonly workspace: string;
}

export function hashUtf8(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function treatmentContentHash(value: ExecutionTreatment): string {
  return hashUtf8(JSON.stringify(value));
}

const suffix = (maxTurns: number): string[] => [
  "--no-session",
  "--max-turns", String(maxTurns),
  "--output-format", "stream-json",
  "--quiet",
];

function systemBootstrap(skills: readonly string[], agents: readonly string[]): TreatmentBootstrap {
  const lines = [
    skills.length ? `load skill: ${skills.join(", ")}` : "",
    agents.length ? `load agent: ${agents.join(", ")}` : "",
  ].filter(Boolean);
  return lines.length
    ? { kind: "system_instruction", bytes: lines.join("\n") }
    : { kind: "none", bytes: "" };
}

function treatment(
  id: TreatmentId,
  input: TreatmentPairInput,
  bootstrap: TreatmentBootstrap,
  skills: readonly string[],
  agents: readonly string[],
): ExecutionTreatment {
  return {
    id,
    bootstrap,
    definition: { kind: input.kind, subject: input.subject, skills: [...skills], agents: [...agents] },
  };
}

/** EVAL-INT-02/19: construct the one-layer-different candidate/baseline pair. */
export function buildTreatmentPair(input: TreatmentPairInput): TreatmentPair {
  const skills = [...input.declaredSkills];
  const agents = [...input.declaredAgents];
  switch (input.kind) {
    case "skills":
      return {
        candidate: treatment("skill_l1", input, systemBootstrap([input.subject], []), [input.subject], []),
        baseline: treatment("skill_l0", input, systemBootstrap([], []), [], []),
      };
    case "agents":
      return {
        candidate: treatment("agent_l2", input, systemBootstrap(skills, [input.subject]), skills, [input.subject]),
        baseline: treatment("agent_l1", input, systemBootstrap(skills, []), skills, []),
      };
    case "recipes": {
      if (!input.resolvedRecipePath) throw new Error("source_missing: recipe candidate has no typed resolved path");
      return {
        candidate: treatment("recipe_l3", input, { kind: "recipe", bytes: input.resolvedRecipePath }, skills, agents),
        baseline: treatment("recipe_l2", input, systemBootstrap(skills, agents), skills, agents),
      };
    }
  }
}

/** EVAL-INT-01/19: task bytes are a distinct --text or typed recipe task parameter. */
export function buildGooseInvocation(
  treatment: ExecutionTreatment,
  taskPayload: string,
  maxTurns: number,
  recipeParams: Readonly<Record<string, string>> = {},
  recipeTaskParameter = "task",
  runtime: Readonly<{ provider: string | null; model: string | null }> = { provider: null, model: null },
): string[] {
  if (!Number.isInteger(maxTurns) || maxTurns < 1) throw new Error("maxTurns must be an integer of at least 1");
  if (treatment.bootstrap.kind === "recipe") {
    if (!recipeTaskParameter) throw new Error("recipe task parameter must be declared");
    const params = [
      ...Object.entries(recipeParams).filter(([key]) => key !== recipeTaskParameter),
      [recipeTaskParameter, taskPayload] as const,
    ].flatMap(([key, value]) => ["--params", `${key}=${value}`]);
    const runtimeArgs = [
      ...(runtime.provider ? ["--provider", runtime.provider] : []),
      ...(runtime.model ? ["--model", runtime.model] : []),
    ];
    return ["run", "--recipe", treatment.bootstrap.bytes, ...params, ...runtimeArgs, ...suffix(maxTurns)];
  }
  const bootstrap = treatment.bootstrap.kind === "system_instruction"
    ? ["--system", treatment.bootstrap.bytes]
    : [];
  const runtimeArgs = [
    ...(runtime.provider ? ["--provider", runtime.provider] : []),
    ...(runtime.model ? ["--model", runtime.model] : []),
  ];
  return ["run", ...bootstrap, "--text", taskPayload, ...runtimeArgs, ...suffix(maxTurns)];
}

export function validateRepetitionCount(repetitions: number): number {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error("repetition count must be an integer of at least 1");
  }
  return repetitions;
}

/** EVAL-INT-01/03: materialize repetition-aware, side-isolated work items. */
export function buildExecutionMatrix(input: {
  readonly kind: EvalKind;
  readonly subject: string;
  readonly evalIds: readonly number[];
  readonly repetitions: number;
  readonly pair: TreatmentPair;
  readonly envelope: InvariantExecutionEnvelope;
}): readonly ExecutionMatrixRow[] {
  const repetitions = validateRepetitionCount(input.repetitions);
  const taskPayloadHash = hashUtf8(input.envelope.taskPayload);
  const rows: ExecutionMatrixRow[] = [];
  for (let repetition = 0; repetition < repetitions; repetition++) {
    for (const evalId of input.evalIds) {
      const sides = repetition % 2 === 0
        ? (["candidate", "baseline"] as const)
        : (["baseline", "candidate"] as const);
      for (const side of sides) {
        rows.push({
          kind: input.kind,
          subject: input.subject,
          evalId,
          repetition,
          side,
          treatment: input.pair[side],
          taskPayloadHash,
          envelope: input.envelope,
          workspace: path.posix.join(input.subject, `eval-${evalId}`, `repetition-${repetition}`, side),
        });
      }
    }
  }
  return rows;
}

/** EVAL-INT-17: resolve only within the caller-declared recipe namespace. */
export async function resolveTypedRecipeSource(
  recipesRoot: string,
  subject: string,
  sourceType: "top_level" | "subrecipe",
): Promise<string> {
  if (!subject || path.basename(subject) !== subject || subject === "." || subject === "..") {
    throw new Error(`source_missing: invalid typed recipe subject ${subject}`);
  }
  const candidate = sourceType === "top_level"
    ? path.join(recipesRoot, `${subject}.yaml`)
    : path.join(recipesRoot, "subrecipes", `${subject}.yaml`);
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) throw new Error("not a file");
    return candidate;
  } catch {
    throw new Error(`source_missing: ${sourceType} recipe ${subject}`);
  }
}

/** EVAL-INT-06: execution completion carries no synthetic grade. */
export function terminalExecutionResult(exitCode: number | null, signal: string | null): {
  readonly status: "succeeded" | "failed";
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly score: null;
} {
  return {
    status: exitCode === 0 && signal === null ? "succeeded" : "failed",
    exitCode,
    signal,
    score: null,
  };
}
