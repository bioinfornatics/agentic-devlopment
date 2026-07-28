/**
 * Reconstruct the delegation chain from one isolated Goose sessions DB.
 *
 * Enrichments over the minimal baseline:
 *   - _meta child-id detection (primary) with time-window heuristic fallback
 *   - Per-sub_agent-session model inference from message content blocks
 *   - agentDefinitionProvenance always "unavailable" (Goose does not expose
 *     agent definition path, hash, or origin in any inspectable form)
 */
import Database from "better-sqlite3";
import fs from "node:fs";

// ── Public types ──────────────────────────────────────────────────────────────

export type LoopStage = "00-trigger" | "01-planner" | "02-builder" | "03-verifier" | "unknown";
export type ModelTier = "standard" | "premium";

/**
 * Provenance of the agent definition loaded by Goose for this delegation.
 * Goose does not expose file path, hash, or origin in the sessions DB.
 * The availability is always "unavailable" — never inferred from indirect signals.
 */
export interface AgentDefinitionProvenance {
  readonly availability: "unavailable";
}

/**
 * Provider and model inference for one sub_agent session.
 * Only extracted from structured JSON fields in message content_json —
 * never pattern-matched from free text to avoid false positives.
 */
export interface SessionModelInference {
  readonly sessionId: string;
  /** Extracted "provider" value; null when not found in structured content. */
  readonly provider: string | null;
  /** Extracted "model" or "requested_model" value; null when not found. */
  readonly requestedModel: string | null;
  /** Extracted "resolved_model" value when distinct; null when not found. */
  readonly resolvedModel: string | null;
  /** "message_content" when at least one field was found; "unavailable" otherwise. */
  readonly inferenceMethod: "message_content" | "unavailable";
}

export interface StageEvent {
  readonly ts: string;
  readonly event: "agent_delegated" | "recipe_delegated" | "tool_call";
  readonly agent?: string;
  readonly recipe?: string;
  readonly stage: LoopStage;
  readonly modelTier: ModelTier;
  readonly status: "success" | "failure" | "unknown";
  readonly toolName?: string;
  readonly instructionsSummary?: string;
  /**
   * Actual delegated child session ID.
   * Resolution order:
   *   1. _meta.session_id in the delegate tool response (primary — Goose-provided direct ID)
   *   2. Time-window heuristic (fallback):
   *      child session in same working_dir, created within [−1 s, +15 s] of the delegate
   *      toolRequest timestamp, whose name starts with "<source>:" or description contains
   *      "<source>"; single unambiguous match required.
   */
  readonly sessionId?: string;
  /**
   * For agent_delegated events.
   * Always "unavailable": Goose does not expose agent definition path, hash,
   * or origin in any DB-inspectable form. Never inferred.
   */
  readonly agentDefinitionProvenance?: AgentDefinitionProvenance;
}

export interface SessionChainAnalysis {
  readonly schema: "session-chain-v1";
  readonly status: "complete" | "unavailable";
  readonly dbPath: string;
  readonly sessionsFound: number;
  readonly events: readonly StageEvent[];
  readonly summary: {
    readonly totalDelegations: number;
    readonly agentDelegations: number;
    readonly recipeDelegations: number;
    readonly stagesObserved: readonly LoopStage[];
    readonly premiumEscalations: number;
  };
  /** Per-sub_agent-session model inference extracted from structured message content. */
  readonly sessionModelInferences: readonly SessionModelInference[];
}

// ── Stage / tier maps ─────────────────────────────────────────────────────────

const AGENT_TO_STAGE: Record<string, LoopStage> = {
  "repository-researcher": "01-planner",
  "change-builder":        "02-builder",
  "change-builder-premium": "02-builder",
  "independent-verifier":  "03-verifier",
  "independent-verifier-premium": "03-verifier",
};

const RECIPE_TO_STAGE: Record<string, LoopStage> = {
  research:  "01-planner",
  implement: "02-builder",
  verify:    "03-verifier",
};

const inferStage    = (s: string): LoopStage  => AGENT_TO_STAGE[s] ?? RECIPE_TO_STAGE[s] ?? "unknown";
const inferModelTier = (s: string): ModelTier => s.includes("premium") ? "premium" : "standard";

// ── Internal row shapes ───────────────────────────────────────────────────────

interface SessionRow {
  id: string; name: string; description: string;
  session_type: string; working_dir: string; created_at: string;
}

interface DelegateMessageRow {
  session_id: string; timestamp: string; content_json: string; working_dir: string;
}

interface AllMessageRow {
  session_id: string; role: string; content_json: string;
}

interface RawBlock {
  type?: string;
  id?: string;
  /** Delegate toolRequest payload */
  toolCall?: {
    status?: string;
    value?: { name?: string; arguments?: Record<string, unknown> };
  };
  /** Delegate toolResponse payload */
  toolResult?: {
    status?: string;
    value?: unknown;
    _meta?: { session_id?: string };
  };
  /** Optional root-level _meta (some Goose versions) */
  _meta?: { session_id?: string };
}

// ── Helper: parse content_json safely ────────────────────────────────────────

function parseBlocks(raw: string): RawBlock[] {
  try { return JSON.parse(raw) as RawBlock[]; } catch { return []; }
}

// ── Helper: extract _meta.session_id from a toolResponse block ───────────────

function findMetaSessionId(block: RawBlock): string | null {
  // Primary: root-level _meta
  if (typeof block._meta?.session_id === "string") return block._meta.session_id;
  // In toolResult._meta
  const tr = block.toolResult;
  if (tr) {
    if (typeof tr._meta?.session_id === "string") return tr._meta.session_id;
    // In toolResult.value._meta
    if (typeof tr.value === "object" && tr.value !== null) {
      const valMeta = (tr.value as Record<string, unknown>)["_meta"];
      if (typeof valMeta === "object" && valMeta !== null) {
        const sid = (valMeta as Record<string, unknown>)["session_id"];
        if (typeof sid === "string") return sid;
      }
    }
  }
  return null;
}

// ── Helper: model inference from a flat list of blocks ───────────────────────

function inferModelFromBlocks(sessionId: string, blocks: RawBlock[]): SessionModelInference {
  let provider: string | null = null;
  let requestedModel: string | null = null;
  let resolvedModel: string | null = null;

  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    if (typeof b["provider"] === "string" && provider === null) provider = b["provider"];
    if (typeof b["requested_model"] === "string" && requestedModel === null) requestedModel = b["requested_model"];
    if (typeof b["resolved_model"] === "string" && resolvedModel === null) resolvedModel = b["resolved_model"];
    if (typeof b["model"] === "string" && requestedModel === null) requestedModel = b["model"];
    const meta = b["metadata"];
    if (typeof meta === "object" && meta !== null) {
      const m = meta as Record<string, unknown>;
      if (typeof m["provider"] === "string" && provider === null) provider = m["provider"];
      if (typeof m["model"] === "string" && requestedModel === null) requestedModel = m["model"];
    }
  }

  const found = provider !== null || requestedModel !== null || resolvedModel !== null;
  return {
    sessionId, provider, requestedModel, resolvedModel,
    inferenceMethod: found ? "message_content" : "unavailable",
  };
}

// ── Helper: ISO → epoch ───────────────────────────────────────────────────────

function toEpoch(x: string): number {
  return Date.parse(x.endsWith("Z") ? x : x.replace(" ", "T") + "Z");
}

// ── Empty (unavailable) result ────────────────────────────────────────────────

const empty = (dbPath: string): SessionChainAnalysis => ({
  schema: "session-chain-v1",
  status: "unavailable",
  dbPath,
  sessionsFound: 0,
  events: [],
  summary: {
    totalDelegations: 0, agentDelegations: 0, recipeDelegations: 0,
    stagesObserved: [], premiumEscalations: 0,
  },
  sessionModelInferences: [],
});

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeSessionChain(dbPath: string): SessionChainAnalysis {
  if (!fs.existsSync(dbPath)) return empty(dbPath);

  let db: Database.Database;
  try { db = new Database(dbPath, { readonly: true }); }
  catch { return empty(dbPath); }

  try {
    // ── Load sessions and delegate toolRequest messages ───────────────────────
    const sessions = db.prepare(
      "SELECT id,name,description,session_type,working_dir,created_at FROM sessions"
    ).all() as SessionRow[];

    const delegateMsgs = db.prepare(
      `SELECT m.session_id, m.timestamp, m.content_json, s.working_dir
       FROM messages m JOIN sessions s ON s.id=m.session_id
       WHERE m.role='assistant' AND m.content_json LIKE '%"name":"delegate"%'
       ORDER BY m.id ASC`
    ).all() as DelegateMessageRow[];

    // ── Build _meta child-id map from user messages (tool responses) ──────────
    // Primary child-ID source: _meta.session_id embedded by Goose in the delegate
    // tool response. Keyed by "parentSessionId:toolCallId".
    const delegateSessionIds = [...new Set(delegateMsgs.map(m => m.session_id))];
    const metaChildIds = new Map<string, string>();

    if (delegateSessionIds.length > 0) {
      try {
        const ph = delegateSessionIds.map(() => "?").join(",");
        const responseRows = db.prepare(
          `SELECT m.session_id, m.role, m.content_json
           FROM messages m
           WHERE m.role='user' AND m.session_id IN (${ph})
           ORDER BY m.id ASC`
        ).all(...delegateSessionIds) as AllMessageRow[];

        for (const row of responseRows) {
          for (const block of parseBlocks(row.content_json)) {
            if (block.type !== "toolResponse" || typeof block.id !== "string") continue;
            const metaId = findMetaSessionId(block);
            if (metaId) metaChildIds.set(`${row.session_id}:${block.id}`, metaId);
          }
        }
      } catch { /* tool-response query unavailable — fall back to heuristic */ }
    }

    // ── Build StageEvent list ─────────────────────────────────────────────────
    const children     = sessions.filter(s => s.session_type === "sub_agent");
    const usedChildIds = new Set<string>();
    const events: StageEvent[] = [];

    for (const msg of delegateMsgs) {
      for (const block of parseBlocks(msg.content_json)) {
        if (block.type !== "toolRequest") continue;
        const call = block.toolCall?.value;
        if (call?.name !== "delegate") continue;

        const args   = call.arguments ?? {};
        const source = typeof args["source"] === "string" ? args["source"] : null;
        const instructions = (() => {
          const v = args["instructions"];
          return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "";
        })();
        const ts = msg.timestamp ?? new Date().toISOString();
        const callStatus: StageEvent["status"] =
          block.toolCall?.status === "success" ? "success"
          : block.toolCall?.status === "error" ? "failure"
          : "unknown";

        // ── Resolve child session ID ──────────────────────────────────────────
        // 1. Primary: _meta.session_id from the tool response
        let childId: string | undefined;
        const metaKey  = typeof block.id === "string" ? `${msg.session_id}:${block.id}` : null;
        const metaDirect = metaKey !== null ? metaChildIds.get(metaKey) : undefined;
        if (metaDirect !== undefined) {
          childId = metaDirect;
          usedChildIds.add(childId);
        } else {
          // 2. Fallback: time-window + working-dir + name heuristic
          const msgEpoch = toEpoch(ts);
          const eligible = children.filter(c =>
            !usedChildIds.has(c.id) &&
            c.id !== msg.session_id &&
            c.working_dir === msg.working_dir &&
            toEpoch(c.created_at) >= msgEpoch - 1000 &&
            toEpoch(c.created_at) - msgEpoch <= 15000
          );
          const named = source
            ? eligible.filter(c => c.name.startsWith(source + ":") || c.description.includes(source))
            : [];
          const candidates = named.length > 0 ? named : eligible;
          if (candidates.length === 1) {
            const matched = candidates[0];
            if (matched !== undefined) { childId = matched.id; usedChildIds.add(childId); }
          }
        }

        if (source !== null) {
          const isAgent  = source in AGENT_TO_STAGE;
          const isRecipe = source in RECIPE_TO_STAGE;
          const event: StageEvent = {
            ts, status: callStatus,
            instructionsSummary: instructions,
            event: isAgent ? "agent_delegated" : isRecipe ? "recipe_delegated" : "agent_delegated",
            ...(isAgent || !isRecipe ? { agent: source } : { recipe: source }),
            stage:     inferStage(source),
            modelTier: inferModelTier(source),
            ...(childId !== undefined ? { sessionId: childId } : {}),
            ...(isAgent ? { agentDefinitionProvenance: { availability: "unavailable" as const } } : {}),
          };
          events.push(event);
        } else {
          events.push({
            ts, status: callStatus,
            instructionsSummary: instructions,
            event: "agent_delegated", stage: "unknown", modelTier: "standard",
            ...(childId !== undefined ? { sessionId: childId } : {}),
          });
        }
      }
    }

    // ── Model inference for all sub_agent sessions ────────────────────────────
    const subAgentSessions = sessions.filter(s => s.session_type === "sub_agent");
    const sessionModelInferences: SessionModelInference[] = [];

    if (subAgentSessions.length > 0) {
      try {
        const ph = subAgentSessions.map(() => "?").join(",");
        const allMsgRows = db.prepare(
          `SELECT m.session_id, m.role, m.content_json
           FROM messages m WHERE m.session_id IN (${ph})
           ORDER BY m.id ASC`
        ).all(...subAgentSessions.map(s => s.id)) as AllMessageRow[];

        const blocksBySession = new Map<string, RawBlock[]>();
        for (const row of allMsgRows) {
          const arr = blocksBySession.get(row.session_id) ?? [];
          for (const b of parseBlocks(row.content_json)) arr.push(b);
          blocksBySession.set(row.session_id, arr);
        }

        for (const session of subAgentSessions) {
          const blocks = blocksBySession.get(session.id) ?? [];
          sessionModelInferences.push(inferModelFromBlocks(session.id, blocks));
        }
      } catch {
        // Inference unavailable: fill with unavailable entries for completeness
        for (const s of subAgentSessions) {
          sessionModelInferences.push({
            sessionId: s.id, provider: null, requestedModel: null, resolvedModel: null,
            inferenceMethod: "unavailable",
          });
        }
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const stagesObserved = [...new Set(events.map(e => e.stage))] as LoopStage[];

    return {
      schema: "session-chain-v1",
      status: "complete",
      dbPath,
      sessionsFound: sessions.length,
      events,
      summary: {
        totalDelegations:   events.length,
        agentDelegations:   events.filter(e => e.event === "agent_delegated").length,
        recipeDelegations:  events.filter(e => e.event === "recipe_delegated").length,
        stagesObserved,
        premiumEscalations: events.filter(e => e.modelTier === "premium").length,
      },
      sessionModelInferences,
    };
  } finally {
    db.close();
  }
}
