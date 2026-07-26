/**
 * Reconstructs the stage/agent execution chain from the Goose sessions SQLite DB.
 * Uses better-sqlite3 (synchronous) — same pattern as historyRepo.ts.
 * The DB is expected at: $XDG_DATA_HOME/goose/sessions/sessions.db
 * In eval runs this is: workspace/.goose-state/goose/sessions/sessions.db
 */
import Database from "better-sqlite3";
import fs from "node:fs";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoopStage =
  | "00-trigger"
  | "01-planner"
  | "02-builder"
  | "03-verifier"
  | "unknown";

export type ModelTier = "standard" | "premium";

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
}

// ── Stage inference ───────────────────────────────────────────────────────────

const AGENT_TO_STAGE: Record<string, LoopStage> = {
  "repository-researcher": "01-planner",
  "change-builder": "02-builder",
  "change-builder-premium": "02-builder",
  "independent-verifier": "03-verifier",
  "independent-verifier-premium": "03-verifier",
};

const RECIPE_TO_STAGE: Record<string, LoopStage> = {
  "research": "01-planner",
  "implement": "02-builder",
  "verify": "03-verifier",
};

function inferStage(source: string): LoopStage {
  return AGENT_TO_STAGE[source] ?? RECIPE_TO_STAGE[source] ?? "unknown";
}

function inferModelTier(source: string): ModelTier {
  return source.includes("premium") ? "premium" : "standard";
}

// ── Content block parsing ─────────────────────────────────────────────────────

interface RawBlock {
  type?: string;
  toolCall?: {
    status?: string;
    value?: {
      name?: string;
      arguments?: Record<string, unknown>;
    };
  };
  timestamp?: string;
}

function parseContentJson(raw: string): RawBlock[] {
  try { return JSON.parse(raw) as RawBlock[]; }
  catch { return []; }
}

function trimInstructions(instructions: unknown): string {
  if (typeof instructions !== "string") return "";
  return instructions.replace(/\s+/g, " ").trim().slice(0, 120);
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

export function analyzeSessionChain(dbPath: string): SessionChainAnalysis {
  if (!fs.existsSync(dbPath)) {
    return {
      schema: "session-chain-v1", status: "unavailable", dbPath,
      sessionsFound: 0, events: [],
      summary: { totalDelegations: 0, agentDelegations: 0, recipeDelegations: 0, stagesObserved: [], premiumEscalations: 0 },
    };
  }

  let db: Database.Database;
  try { db = new Database(dbPath, { readonly: true }); }
  catch {
    return {
      schema: "session-chain-v1", status: "unavailable", dbPath,
      sessionsFound: 0, events: [],
      summary: { totalDelegations: 0, agentDelegations: 0, recipeDelegations: 0, stagesObserved: [], premiumEscalations: 0 },
    };
  }

  try {
    const sessions = db.prepare("SELECT id FROM sessions").all() as Array<{ id: string }>;

    const rawMessages = db.prepare(`
      SELECT m.session_id, m.timestamp, m.content_json
      FROM messages m
      WHERE m.role = 'assistant'
        AND m.content_json LIKE '%"name":"delegate"%'
      ORDER BY m.id ASC
    `).all() as Array<{ session_id: string; timestamp: string; content_json: string }>;

    const events: StageEvent[] = [];

    for (const msg of rawMessages) {
      const blocks = parseContentJson(msg.content_json);
      for (const block of blocks) {
        if (block.type !== "toolRequest") continue;
        const call = block.toolCall?.value;
        if (call?.name !== "delegate") continue;

        const args = call.arguments ?? {};
        const source = typeof args["source"] === "string" ? args["source"] : null;
        const instructions = args["instructions"];
        const status: StageEvent["status"] =
          block.toolCall?.status === "success" ? "success" :
          block.toolCall?.status === "error" ? "failure" : "unknown";

        const ts = msg.timestamp ?? new Date().toISOString();
        const instructionsSummary = trimInstructions(instructions);

        if (source) {
          // Named agent or recipe delegation
          const isAgent = source in AGENT_TO_STAGE;
          const isRecipe = source in RECIPE_TO_STAGE;
          events.push({
            ts, status, instructionsSummary,
            event: isAgent ? "agent_delegated" : isRecipe ? "recipe_delegated" : "agent_delegated",
            ...(isAgent || (!isRecipe) ? { agent: source } : { recipe: source }),
            stage: inferStage(source),
            modelTier: inferModelTier(source),
          });
        } else {
          // Anonymous delegation (instructions-only, no source)
          events.push({
            ts, status, instructionsSummary,
            event: "agent_delegated",
            stage: "unknown",
            modelTier: "standard",
          });
        }
      }
    }

    const stages = [...new Set(events.map(e => e.stage))] as LoopStage[];
    const agentDels = events.filter(e => e.event === "agent_delegated").length;
    const recipeDels = events.filter(e => e.event === "recipe_delegated").length;
    const premiumEsc = events.filter(e => e.modelTier === "premium").length;

    return {
      schema: "session-chain-v1", status: "complete", dbPath,
      sessionsFound: sessions.length, events,
      summary: {
        totalDelegations: events.length,
        agentDelegations: agentDels,
        recipeDelegations: recipeDels,
        stagesObserved: stages,
        premiumEscalations: premiumEsc,
      },
    };
  } finally {
    db.close();
  }
}
