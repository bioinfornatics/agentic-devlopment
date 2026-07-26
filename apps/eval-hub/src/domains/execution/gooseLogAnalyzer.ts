import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_FILES = 256;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_DIAGNOSTICS = 32;

export type GooseLogSeverity = "fatal" | "warning";
export type GooseLogDiagnosticCode =
  | "provider_deployment_missing"
  | "provider_authentication_failed"
  | "provider_rate_limited"
  | "extension_failed"
  | "delegated_task_failed"
  | "tool_failed"
  | "runtime_model_mismatch"
  | "runtime_error";

export interface GooseLogDiagnostic {
  readonly code: GooseLogDiagnosticCode;
  readonly severity: GooseLogSeverity;
  readonly message: string;
  readonly source: string;
  readonly timestamp: string | null;
}

export interface GooseLogAnalysis {
  readonly schema: "goose-log-analysis-v1";
  readonly status: "complete" | "partial" | "unavailable";
  readonly source: "isolated_xdg_state";
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly format: "jsonl" | "text";
  }>;
  readonly observed: {
    readonly models: readonly string[];
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly totalTokens: number | null;
    readonly durationMs: number | null;
    readonly messageCount: number | null;
    readonly retries: number;
    readonly toolCalls: number;
    readonly toolFailures: number;
    readonly warnings: number;
    readonly errors: number;
  };
  readonly fatalDiagnostics: readonly GooseLogDiagnostic[];
  readonly warnings: readonly GooseLogDiagnostic[];
  readonly insights: readonly string[];
}

export function gooseLogCaptureForWorkspace(workspace: string): { readonly stateHome: string; readonly logsRoot: string } {
  const stateHome = path.join(workspace, ".goose-state");
  return { stateHome, logsRoot: path.join(stateHome, "goose", "logs") };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function cleanMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function classify(message: string, level: string, source: string, timestamp: string | null): GooseLogDiagnostic | null {
  const definitions: ReadonlyArray<[RegExp, GooseLogDiagnosticCode, GooseLogSeverity]> = [
    [/(?:DeploymentNotFound|API deployment .+ does not exist)/i, "provider_deployment_missing", "fatal"],
    [/(?:authentication|unauthorized|invalid api key|credential).*(?:failed|error|missing|invalid)|(?:401|403).*(?:provider|api)/i, "provider_authentication_failed", "fatal"],
    [/(?:rate limit|too many requests|HTTP 429)/i, "provider_rate_limited", "warning"],
    [/extension .+(?:disconnected|unavailable|failed to (?:start|connect))/i, "extension_failed", "fatal"],
    [/TransportClosed/i, "extension_failed", "warning"],
    [/(?:Background task .+ panicked|Task panicked:|delegat(?:e|ed|ion).*(?:failed|panicked))/i, "delegated_task_failed", "fatal"],
    [/(?:Tool call completed.*(?:failure|error)|tool.+result.+(?:failure|error))/i, "tool_failed", "warning"],
  ];
  for (const [pattern, code, severity] of definitions) {
    if (pattern.test(message)) return { code, severity, message, source, timestamp };
  }
  // Unknown ERROR records are useful feedback but are not precise enough to
  // invalidate a score without a recognized provider/tool/runtime signature.
  if (level === "ERROR") return { code: "runtime_error", severity: "warning", message, source, timestamp };
  return null;
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= MAX_FILES) return;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".log"))) files.push(candidate);
    }
  }
  await walk(root);
  return files;
}

function emptyObserved() {
  return {
    models: [] as string[], inputTokens: null as number | null, outputTokens: null as number | null,
    totalTokens: null as number | null, durationMs: null as number | null, messageCount: null as number | null,
    retries: 0, toolCalls: 0, toolFailures: 0, warnings: 0, errors: 0,
  };
}

function updateMax(current: number | null, value: unknown): number | null {
  const next = finiteNumber(value);
  return next === null ? current : current === null ? next : Math.max(current, next);
}

/**
 * Analyze only an execution-owned Goose log directory. Raw prompts and model
 * responses are hashed for provenance but are never copied into eval artifacts.
 */
export async function analyzeGooseLogs(logsRoot: string, expectedModel: string | null = null): Promise<GooseLogAnalysis> {
  let paths: string[];
  try { paths = await listFiles(logsRoot); }
  catch {
    return {
      schema: "goose-log-analysis-v1", status: "unavailable", source: "isolated_xdg_state", files: [],
      observed: emptyObserved(), fatalDiagnostics: [], warnings: [],
      insights: ["Goose runtime logs were not available; transcript-only health checks were used."],
    };
  }

  const files: GooseLogAnalysis["files"][number][] = [];
  const observed = emptyObserved();
  const diagnostics: GooseLogDiagnostic[] = [];
  const modelNames = new Set<string>();
  let partial = paths.length >= MAX_FILES;

  for (const file of paths) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_BYTES) { partial = true; continue; }
      const bytes = await fs.readFile(file);
      files.push({
        path: path.relative(logsRoot, file), bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        format: file.endsWith(".jsonl") ? "jsonl" : "text",
      });
      const lines = bytes.toString("utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        let parsed: Record<string, unknown> | null = null;
        try { parsed = asObject(JSON.parse(line)); } catch { /* text log */ }
        const fields = asObject(parsed?.["fields"]);
        const eventData = asObject(parsed?.["data"]);
        const modelConfig = asObject(parsed?.["model_config"]);
        const input = asObject(parsed?.["input"]);
        const usage = asObject(parsed?.["usage"]);
        const dataUsage = asObject(eventData?.["usage"]);
        const level = String(parsed?.["level"] ?? "").toUpperCase();
        const timestamp = typeof parsed?.["timestamp"] === "string" ? parsed["timestamp"] : null;
        const source = path.relative(logsRoot, file);
        const message = cleanMessage(fields?.["message"] ?? (parsed === null ? line : ""));

        const configuredModel = modelConfig?.["model_name"] ?? input?.["model"];
        if (typeof configuredModel === "string" && configuredModel.trim()) modelNames.add(configuredModel.trim());
        const modelInMessage = message.match(/Using model:\s*([^\s]+)/i)?.[1];
        if (modelInMessage) modelNames.add(modelInMessage);

        observed.inputTokens = updateMax(observed.inputTokens, usage?.["input_tokens"] ?? dataUsage?.["input_tokens"] ?? fields?.["input_tokens"]);
        observed.outputTokens = updateMax(observed.outputTokens, usage?.["output_tokens"] ?? dataUsage?.["output_tokens"] ?? fields?.["output_tokens"]);
        observed.totalTokens = updateMax(observed.totalTokens, usage?.["total_tokens"] ?? dataUsage?.["total_tokens"] ?? fields?.["total_tokens"]);
        observed.durationMs = updateMax(observed.durationMs, fields?.["duration_ms"]);
        observed.messageCount = updateMax(observed.messageCount, fields?.["message_count"]);
        if (/Backing off .+ before retry/i.test(message)) observed.retries++;
        if (/Tool call (?:started|completed)/i.test(message)) observed.toolCalls++;
        if (/Tool call completed/i.test(message) && String(fields?.["result"] ?? "").toLowerCase() !== "success") observed.toolFailures++;
        if (level === "WARN") observed.warnings++;
        if (level === "ERROR") observed.errors++;

        const diagnostic = classify(message, level, source, timestamp);
        if (diagnostic && diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(diagnostic);
      }
    } catch { partial = true; }
  }

  observed.models = [...modelNames].sort();
  if (expectedModel !== null && observed.models.length > 0 && !observed.models.includes(expectedModel)) {
    diagnostics.push({
      code: "runtime_model_mismatch", severity: "fatal",
      message: "Goose logs report model(s) " + observed.models.join(", ") + " but the frozen execution envelope requires " + expectedModel + ".",
      source: "correlated-model-provenance", timestamp: null,
    });
  }
  const unique = new Map<string, GooseLogDiagnostic>();
  for (const diagnostic of diagnostics) unique.set([diagnostic.code, diagnostic.message, diagnostic.source].join("\0"), diagnostic);
  const allDiagnostics = [...unique.values()];
  const fatalDiagnostics = allDiagnostics.filter(item => item.severity === "fatal");
  const warnings = allDiagnostics.filter(item => item.severity === "warning");
  const insights: string[] = [];
  if (observed.retries > 0) insights.push("Provider retries were observed; latency and score stability may be affected.");
  if (observed.toolFailures > 0) insights.push("One or more Goose tool calls failed; inspect the correlated diagnostic provenance.");
  if (fatalDiagnostics.length > 0) insights.push("Fatal runtime diagnostics were found in correlated Goose logs; this execution must not be graded.");
  if (observed.totalTokens !== null) insights.push("Correlated Goose usage reported " + observed.totalTokens + " total tokens.");
  if (files.length === 0) insights.push("Goose created no analyzable runtime log files for this execution.");

  return {
    schema: "goose-log-analysis-v1", status: partial ? "partial" : "complete", source: "isolated_xdg_state",
    files, observed, fatalDiagnostics, warnings, insights,
  };
}
