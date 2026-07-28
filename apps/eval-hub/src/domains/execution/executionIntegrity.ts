import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { EvalKind, TreatmentId } from "../../shared/types.js";

export interface TreatmentActivation {
  readonly requestedSkills: readonly string[];
  readonly requestedAgents: readonly string[];
  readonly materializedSkills: readonly string[];
  readonly materializedAgents: readonly string[];
  readonly failedSkills: readonly string[];
  readonly failedAgents: readonly string[];
  /**
   * Agents confirmed as activated **in-session** via a successful Summon.load() call in this
   * session's output. Distinct from:
   *   • sessionChain delegation (delegate tool tracked by sessionChainAnalyzer)
   *   • pre-materialization alone (agent .md file copied but no explicit load() call observed)
   */
  readonly inSessionActivatedAgents: readonly string[];
  /**
   * Structured per-agent activation proof records.  Only populated when the caller supplies
   * a bootstrap descriptor via options.bootstrap — empty array in legacy/test call paths.
   *
   * mode "system_bootstrap" — agent activated via --system instruction; bootstrapHash is the
   *   SHA-256 hex of TreatmentBootstrap.bytes, proving which instruction was sent.
   * mode "explicit_load"    — agent activated via a successful Summon.load() call observed in
   *   this session's output stream; responseDigest is first-16-hex of SHA-256 of response text.
   * mode "none"             — no admissible proof found; status is at most "materialized".
   *
   * Distinguished from delegation: a delegate() tool call tracked by sessionChainAnalyzer does
   * NOT constitute explicit_load activation in this session.
   */
  readonly agentActivationProofs: readonly AgentActivationProof[];
  readonly status: "materialized" | "verified" | "failed";
}

/** Activation proof mode for a single requested agent. */
export type ActivationProofMode = "system_bootstrap" | "explicit_load" | "none";

export interface AgentActivationProof {
  readonly agentName: string;
  readonly mode: ActivationProofMode;
  /**
   * SHA-256 hex of the bootstrap bytes (system_bootstrap only).
   * Proves which --system instruction was sent to the Goose process.
   */
  readonly bootstrapHash?: string;
  /**
   * First 16 hex chars of SHA-256 of the successful load() response text (explicit_load only).
   * Sufficient for correlation; full response is in the session stream artifact.
   */
  readonly responseDigest?: string;
}

interface GooseToolEvent {
  readonly id: string;
  readonly kind: "request" | "response";
  readonly name?: string;
  readonly arguments?: unknown;
  readonly payload?: unknown;
}

function gooseToolEvents(lines: readonly string[]): GooseToolEvent[] {
  const events: GooseToolEvent[] = [];
  for (const line of lines) {
    try {
      const value = JSON.parse(line) as { message?: { role?: unknown; content?: unknown } };
      if (!Array.isArray(value.message?.content)) continue;
      for (const item of value.message.content) {
        if (item === null || typeof item !== "object") continue;
        const content = item as Record<string, unknown>;
        if (content["type"] === "toolRequest" && typeof content["id"] === "string") {
          const call = content["toolCall"] as Record<string, unknown> | undefined;
          const callValue = call?.["value"] as Record<string, unknown> | undefined;
          events.push({
            id: content["id"], kind: "request",
            ...(typeof callValue?.["name"] === "string" ? { name: callValue["name"] } : {}),
            ...(Object.hasOwn(callValue ?? {}, "arguments") ? { arguments: callValue?.["arguments"] } : {}),
          });
        }
        if (content["type"] === "toolResponse" && typeof content["id"] === "string") {
          events.push({ id: content["id"], kind: "response", payload: content });
        }
      }
    } catch { /* non-JSON output is not structured tool evidence */ }
  }
  return events;
}

function responseText(payload: unknown): string {
  return JSON.stringify(payload ?? null);
}

function successfulResponseText(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const toolResult = (payload as Record<string, unknown>)["toolResult"] as Record<string, unknown> | undefined;
  if (toolResult?.["status"] === "error") return null;
  const value = toolResult?.["value"] as Record<string, unknown> | undefined;
  if (value?.["isError"] === true) return null;
  return responseText(payload);
}

function requestedName(value: unknown, key: string): string | null {
  return value !== null && typeof value === "object" && typeof (value as Record<string, unknown>)[key] === "string"
    ? String((value as Record<string, unknown>)[key]) : null;
}

/** AC-EVAL-08/10: derive activation evidence from materialization and correlated Goose load calls. */
export function inspectTreatmentActivation(
  outputLines: readonly string[],
  requested: Readonly<{ skills: readonly string[]; agents: readonly string[] }>,
  materialized: Readonly<{ skills: readonly string[]; agents: readonly string[] }> = { skills: [], agents: [] },
  options: Readonly<{ runtimeComplete?: boolean; bootstrap?: TreatmentBootstrap }> = {},
): TreatmentActivation {
  const events = gooseToolEvents(outputLines);
  const responses = new Map(events.filter(event => event.kind === "response").map(event => [event.id, event.payload]));
  const loadResults = events.filter(event => event.kind === "request").map(event => ({
    name: event.name, arguments: event.arguments, response: responses.get(event.id),
  }));
  const skillLoads = new Map(loadResults.filter(item => item.name === "load_skill")
    .map(item => [requestedName(item.arguments, "name"), successfulResponseText(item.response)]));
  const agentLoads = new Map(loadResults.filter(item => item.name === "load")
    .map(item => [requestedName(item.arguments, "source"), successfulResponseText(item.response)]));
  const runtimeComplete = options.runtimeComplete ?? outputLines.length > 0;
  const explicitSkillFailures = requested.skills.filter(name => skillLoads.get(name)?.includes("Skill '" + name + "' not found.") ?? false);
  const explicitAgentFailures = requested.agents.filter(name => agentLoads.get(name)?.includes("Agent '" + name + "' not found.") ?? false);
  const missingSkills = requested.skills.filter(name => !materialized.skills.includes(name));
  const missingAgents = requested.agents.filter(name => !materialized.agents.includes(name));
  const unloadedSkills = runtimeComplete ? requested.skills.filter(name => {
    const response = skillLoads.get(name);
    if (response !== undefined) {
      // load_skill was explicitly called — require a success marker in the response (null = error response)
      return response === null || !response.includes("# Loaded Skill: " + name + " (skill)");
    }
    // No explicit load_skill call — accept if skill was pre-run materialized via system bootstrap hook
    // (symmetric with agents: --system "load skill: xxx" activates the skill without a tool call)
    return !materialized.skills.includes(name);
  }) : [];
  const unloadedAgents = runtimeComplete ? requested.agents.filter(name => {
    const response = agentLoads.get(name);
    if (response !== undefined) {
      // load() was explicitly called — require a success marker in the response (null = error response)
      return response === null || (!response.includes("# Loaded: " + name + " (agent)") && !response.includes("# Loaded Agent: " + name));
    }
    // No explicit load() call — accept if agent was pre-run materialized via system hook
    return !materialized.agents.includes(name);
  }) : [];
  const allFailedSkills = [...new Set([...explicitSkillFailures, ...missingSkills, ...unloadedSkills])];
  const allFailedAgents = [...new Set([...explicitAgentFailures, ...missingAgents, ...unloadedAgents])];
  // In-session activation: agents confirmed via explicit successful Summon.load() call in THIS session's output.
  // A delegate() tool call (tracked by sessionChainAnalyzer) or pre-materialization alone does NOT count.
  const inSessionActivatedAgents = requested.agents.filter(name => {
    const response = agentLoads.get(name);
    return response !== undefined && response !== null &&
      (response.includes("# Loaded: " + name + " (agent)") || response.includes("# Loaded Agent: " + name));
  });
  const failed = allFailedSkills.length > 0 || allFailedAgents.length > 0;

  // When bootstrap is provided, compute structured per-agent activation proofs.
  // status=verified requires admissible proof for every requested agent.
  // Legacy/test paths that omit bootstrap use the existing materialization check.
  let agentActivationProofs: AgentActivationProof[] = [];
  let allAgentsProven = true;

  if (options.bootstrap !== undefined) {
    const bootstrapBytes  = options.bootstrap.bytes;
    const bootstrapHash   = crypto.createHash("sha256").update(bootstrapBytes, "utf8").digest("hex");
    const isSystemBoot    = options.bootstrap.kind === "system_instruction";

    agentActivationProofs = requested.agents.map(agentName => {
      // explicit_load takes precedence: successful Summon.load() in this session's output
      const loadResponse = agentLoads.get(agentName);
      if (loadResponse !== undefined && loadResponse !== null &&
          (loadResponse.includes("# Loaded: " + agentName + " (agent)") ||
           loadResponse.includes("# Loaded Agent: " + agentName))) {
        const digest = crypto.createHash("sha256").update(loadResponse, "utf8").digest("hex").slice(0, 16);
        return { agentName, mode: "explicit_load" as const, responseDigest: digest };
      }
      // system_bootstrap: agent name in bootstrap instruction AND agent was materialized
      if (isSystemBoot && materialized.agents.includes(agentName)) {
        const loadAgentLine = bootstrapBytes.split("\n").find(line => line.startsWith("load agent:"));
        if (loadAgentLine !== undefined) {
          const listed = loadAgentLine.replace("load agent:", "").split(",").map(s => s.trim());
          if (listed.includes(agentName)) {
            return { agentName, mode: "system_bootstrap" as const, bootstrapHash };
          }
        }
      }
      return { agentName, mode: "none" as const };
    });

    allAgentsProven = agentActivationProofs.every(p => p.mode !== "none");
  }

  // verified: no failures AND runtimeComplete AND (no bootstrap given OR all agents have proof)
  const verified = runtimeComplete && (options.bootstrap === undefined || allAgentsProven);
  return {
    requestedSkills: [...requested.skills], requestedAgents: [...requested.agents],
    materializedSkills: [...materialized.skills], materializedAgents: [...materialized.agents],
    failedSkills: allFailedSkills, failedAgents: allFailedAgents,
    inSessionActivatedAgents,
    agentActivationProofs,
    status: failed ? "failed" : verified ? "verified" : "materialized",
  };
}

export interface RuntimeHealth {
  readonly status: "healthy" | "failed";
  readonly diagnostics: readonly string[];
}

/** AC-EVAL-10: classify fatal provider/delegation/extension diagnostics even on exit zero. */
export function inspectRuntimeHealth(
  outputLines: readonly string[],
  stderrLines: readonly string[] = [],
  gooseLogDiagnostics: readonly string[] = [],
): RuntimeHealth {
  const patterns = [
    /DeploymentNotFound/i,
    /API deployment .+ does not exist/i,
    /Background task .+ panicked/i,
    /Task panicked:/i,
    /extension .+(?:disconnected|unavailable|failed to (?:start|connect))/i,
  ];
  // Build a map of response-id → request tool name so we can skip command-execution
  // tool outputs (shell, write, tree, …) whose content may contain pattern-matching
  // strings that are not Goose runtime diagnostics (e.g. vitest test names containing
  // "panicked", shell output containing "DeploymentNotFound" as a quoted string).
  const allEvents = gooseToolEvents(outputLines);
  const requestNames = new Map(
    allEvents
      .filter(e => e.kind === "request" && e.name !== undefined)
      .map(e => [e.id, e.name!]),
  );
  // Tools whose output is user/command content, not Goose infrastructure messages.
  const commandTools = new Set([
    "shell", "write", "edit", "tree", "read_image",
    "list_resources", "read_resource", "analyze", "load_skill",
  ]);
  const stdoutDiagnostics = allEvents
    .filter(event => event.kind === "response")
    .filter(event => {
      const name = requestNames.get(event.id);
      // Skip responses from command-execution tools; check everything else
      // (delegation tools, unknown/orphaned responses from Goose infrastructure).
      return name === undefined || !commandTools.has(name);
    })
    .map(event => responseText(event.payload))
    .filter(evidence => patterns.some(pattern => pattern.test(evidence)));
  const stderrDiagnostics = stderrLines.filter(line => patterns.some(pattern => pattern.test(line)));
  // Goose log diagnostics have already been correlated to this execution by
  // its private XDG state root and classified by gooseLogAnalyzer.
  const diagnostics = [...stdoutDiagnostics, ...stderrDiagnostics, ...gooseLogDiagnostics];
  return { status: diagnostics.length > 0 ? "failed" : "healthy", diagnostics };
}

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
