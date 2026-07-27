/**
 * Database connection and initialization.
 */

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import * as schema from "./schema";

// Database location: plugin data directory
function getDbPath(): string {
  const pluginRoot = process.env.PLUGIN_ROOT || dirname(dirname(__dirname));
  const dataDir = join(pluginRoot, "data");
  
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  
  return join(dataDir, "loop-breaker.db");
}

// Singleton database instance
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const dbPath = getDbPath();
    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    sqlite.exec("PRAGMA journal_mode = WAL");
    sqlite.exec("PRAGMA synchronous = NORMAL");
    
    _db = drizzle(sqlite, { schema });
    
    // Auto-create tables if needed
    initializeTables(sqlite);
  }
  return _db;
}

function initializeTables(sqlite: Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS error_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT NOT NULL UNIQUE,
      tool TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      correction TEXT NOT NULL,
      key_insight TEXT,
      anti_patterns TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0,
      source_sessions TEXT
    );
    
    CREATE TABLE IF NOT EXISTS session_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      counter_type TEXT NOT NULL,
      tool_name TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS corrections_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      error_signature TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_patterns_signature ON error_patterns(signature);
    CREATE INDEX IF NOT EXISTS idx_counters_session ON session_counters(session_id, counter_type);
    CREATE INDEX IF NOT EXISTS idx_corrections_session ON corrections_sent(session_id, tool_name);
  `);
}

export { schema };
