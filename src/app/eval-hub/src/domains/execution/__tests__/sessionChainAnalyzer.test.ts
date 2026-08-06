/**
 * sessionChainAnalyzer tests.
 *
 * Covers:
 *   1. Unavailable path (DB does not exist)
 *   2. Synthetic SQLite: basic delegation chain preserved
 *   3. agentDefinitionProvenance = "unavailable" for agent_delegated events
 *   4. _meta child id takes priority over heuristic
 *   5. Time-window heuristic fallback when _meta absent
 *   6. Model inference from structured message content
 *   7. sessionModelInferences = [] when no sub_agent sessions
 *   8. Recipe-delegated event type
 */
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeSessionChain } from "../sessionChainAnalyzer.js";

let tmpDir: string;
beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sca-test-")); });
afterEach(async () => { await fs.rm(tmpDir, { recursive: true, force: true }); });

// ── DB helpers ────────────────────────────────────────────────────────────────

function makeDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      session_type TEXT NOT NULL DEFAULT 'session',
      working_dir TEXT NOT NULL DEFAULT '/tmp',
      created_at TEXT NOT NULL DEFAULT '2025-01-01T00:00:00Z'
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      timestamp TEXT NOT NULL DEFAULT '2025-01-01T00:00:00Z',
      content_json TEXT NOT NULL DEFAULT '[]'
    );
  `);
  return db;
}

function insertSession(db: Database.Database, opts: {
  id: string; name?: string; description?: string;
  session_type?: string; working_dir?: string; created_at?: string;
}) {
  db.prepare(`INSERT INTO sessions (id,name,description,session_type,working_dir,created_at)
    VALUES (?,?,?,?,?,?)`).run(
    opts.id,
    opts.name ?? "",
    opts.description ?? "",
    opts.session_type ?? "session",
    opts.working_dir ?? "/tmp/workspace",
    opts.created_at ?? "2025-01-01T00:00:00.000Z",
  );
}

function insertMessage(db: Database.Database, opts: {
  session_id: string; role?: string; timestamp?: string; content_json: string;
}) {
  db.prepare(`INSERT INTO messages (session_id,role,timestamp,content_json)
    VALUES (?,?,?,?)`).run(
    opts.session_id,
    opts.role ?? "assistant",
    opts.timestamp ?? "2025-01-01T00:00:00.000Z",
    opts.content_json,
  );
}

function delegateBlock(opts: {
  id?: string; source: string; instructions?: string; status?: string;
}): string {
  return JSON.stringify([{
    type: "toolRequest",
    id: opts.id ?? "call-1",
    toolCall: {
      status: opts.status ?? "success",
      value: {
        name: "delegate",
        arguments: {
          source: opts.source,
          instructions: opts.instructions ?? "do the thing",
        },
      },
    },
  }]);
}

function toolResponseBlock(opts: { id?: string; metaSessionId?: string }): string {
  const toolResult: Record<string, unknown> = { status: "success" };
  if (opts.metaSessionId) toolResult["_meta"] = { session_id: opts.metaSessionId };
  return JSON.stringify([{
    type: "toolResponse",
    id: opts.id ?? "call-1",
    toolResult,
  }]);
}

function modelBlock(opts: { provider?: string; model?: string; resolved_model?: string }): string {
  return JSON.stringify([{ type: "metadata", ...opts }]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeSessionChain — unavailable paths", () => {
  it("returns unavailable when DB does not exist", () => {
    const result = analyzeSessionChain("/nonexistent/path/sessions.db");
    expect(result.status).toBe("unavailable");
    expect(result.events).toHaveLength(0);
    expect(result.sessionsFound).toBe(0);
    expect(result.sessionModelInferences).toHaveLength(0);
  });

  it("schema field is always session-chain-v1", () => {
    const result = analyzeSessionChain("/nonexistent/path/sessions.db");
    expect(result.schema).toBe("session-chain-v1");
  });
});

describe("analyzeSessionChain — basic delegation chain", () => {
  it("detects a single agent delegation", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "parent-1", session_type: "session", working_dir: "/work" });
    insertMessage(db, {
      session_id: "parent-1",
      timestamp: "2025-01-01T10:00:00.000Z",
      content_json: delegateBlock({ source: "change-builder" }),
    });

    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.status).toBe("complete");
    expect(result.events).toHaveLength(1);
    const evt = result.events[0]!;
    expect(evt.event).toBe("agent_delegated");
    expect(evt.agent).toBe("change-builder");
    expect(evt.stage).toBe("02-builder");
    expect(evt.modelTier).toBe("standard");
    expect(evt.status).toBe("success");
  });

  it("recognises premium model tier", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);
    insertSession(db, { id: "p1", session_type: "session" });
    insertMessage(db, {
      session_id: "p1",
      content_json: delegateBlock({ source: "change-builder-premium", status: "success" }),
    });
    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.events[0]?.modelTier).toBe("premium");
    expect(result.summary.premiumEscalations).toBe(1);
  });

  it("detects a recipe delegation", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);
    insertSession(db, { id: "p1", session_type: "session" });
    insertMessage(db, {
      session_id: "p1",
      content_json: delegateBlock({ source: "implement" }),
    });
    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.events[0]?.event).toBe("recipe_delegated");
    expect(result.summary.recipeDelegations).toBe(1);
  });
});

describe("analyzeSessionChain — agentDefinitionProvenance", () => {
  it("always unavailable for agent_delegated events", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);
    insertSession(db, { id: "p1", session_type: "session" });
    insertMessage(db, {
      session_id: "p1",
      content_json: delegateBlock({ source: "independent-verifier" }),
    });
    db.close();

    const result = analyzeSessionChain(dbPath);
    const evt = result.events[0];
    expect(evt?.agentDefinitionProvenance).toBeDefined();
    expect(evt?.agentDefinitionProvenance?.availability).toBe("unavailable");
  });

  it("absent for recipe_delegated events", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);
    insertSession(db, { id: "p1", session_type: "session" });
    insertMessage(db, {
      session_id: "p1",
      content_json: delegateBlock({ source: "verify" }),
    });
    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.events[0]?.agentDefinitionProvenance).toBeUndefined();
  });
});

describe("analyzeSessionChain — _meta child ID", () => {
  it("uses _meta.session_id from tool response as child sessionId", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "parent-1", session_type: "session", working_dir: "/work" });
    // Sub-agent session (with mismatching name to defeat name-heuristic)
    insertSession(db, {
      id: "child-from-meta",
      name: "something-else:random",
      session_type: "sub_agent",
      working_dir: "/work",
      created_at: "2025-01-01T10:00:05.000Z",
    });

    // Delegate toolRequest from parent
    insertMessage(db, {
      session_id: "parent-1",
      role: "assistant",
      timestamp: "2025-01-01T10:00:00.000Z",
      content_json: delegateBlock({ id: "call-42", source: "change-builder" }),
    });

    // Tool response with _meta.session_id
    insertMessage(db, {
      session_id: "parent-1",
      role: "user",
      timestamp: "2025-01-01T10:00:05.000Z",
      content_json: toolResponseBlock({ id: "call-42", metaSessionId: "child-from-meta" }),
    });

    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.events[0]?.sessionId).toBe("child-from-meta");
  });
});

describe("analyzeSessionChain — time-window heuristic fallback", () => {
  it("matches child session by time window when _meta absent", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "parent-1", session_type: "session", working_dir: "/work" });
    insertSession(db, {
      id: "child-heuristic",
      name: "change-builder:session-xyz",
      session_type: "sub_agent",
      working_dir: "/work",
      // created 3 seconds after delegate call — within 15s window
      created_at: "2025-01-01T10:00:03.000Z",
    });

    insertMessage(db, {
      session_id: "parent-1",
      role: "assistant",
      timestamp: "2025-01-01T10:00:00.000Z",
      content_json: delegateBlock({ id: "call-99", source: "change-builder" }),
    });
    // No user-message tool response (no _meta)

    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.events[0]?.sessionId).toBe("child-heuristic");
  });
});

describe("analyzeSessionChain — sessionModelInferences", () => {
  it("extracts provider and model from message content blocks", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "sub-1", session_type: "sub_agent" });
    insertMessage(db, {
      session_id: "sub-1",
      role: "user",
      content_json: modelBlock({ provider: "anthropic", model: "claude-3-5-sonnet" }),
    });

    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.sessionModelInferences).toHaveLength(1);
    const inf = result.sessionModelInferences[0]!;
    expect(inf.sessionId).toBe("sub-1");
    expect(inf.provider).toBe("anthropic");
    expect(inf.requestedModel).toBe("claude-3-5-sonnet");
    expect(inf.inferenceMethod).toBe("message_content");
  });

  it("extracts resolved_model when present", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "sub-2", session_type: "sub_agent" });
    insertMessage(db, {
      session_id: "sub-2",
      role: "assistant",
      content_json: modelBlock({ provider: "openai", model: "gpt-4o", resolved_model: "gpt-4o-2024-11" }),
    });

    db.close();

    const result = analyzeSessionChain(dbPath);
    const inf = result.sessionModelInferences[0]!;
    expect(inf.resolvedModel).toBe("gpt-4o-2024-11");
    expect(inf.requestedModel).toBe("gpt-4o");
  });

  it("reports inferenceMethod=unavailable when no structured model fields present", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);

    insertSession(db, { id: "sub-empty", session_type: "sub_agent" });
    insertMessage(db, {
      session_id: "sub-empty",
      role: "assistant",
      content_json: JSON.stringify([{ type: "text", content: "hello" }]),
    });

    db.close();

    const result = analyzeSessionChain(dbPath);
    const inf = result.sessionModelInferences[0]!;
    expect(inf.inferenceMethod).toBe("unavailable");
    expect(inf.provider).toBeNull();
    expect(inf.requestedModel).toBeNull();
    expect(inf.resolvedModel).toBeNull();
  });

  it("empty when no sub_agent sessions exist", () => {
    const dbPath = path.join(tmpDir, "sessions.db");
    const db = makeDb(dbPath);
    insertSession(db, { id: "main", session_type: "session" });
    db.close();

    const result = analyzeSessionChain(dbPath);
    expect(result.sessionModelInferences).toHaveLength(0);
  });
});
