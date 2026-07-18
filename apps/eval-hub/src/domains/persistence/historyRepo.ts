/**
 * SQLite-backed history repository using better-sqlite3 (synchronous).
 * Mirrors the schema used by Python's eval_utils.record_eval_run().
 */
import Database from "better-sqlite3";
import path     from "node:path";
import fs       from "node:fs";
import { EVAL_DB } from "../../shared/paths.js";
import type { IHistoryReader, IHistoryWriter, HistoryRow, ResultRow, ImprovementRow, HistoryFilter } from "./ports.js";

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS eval_runs (
    run_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject TEXT NOT NULL,
    content_hash TEXT,
    git_commit TEXT,
    git_dirty INTEGER DEFAULT 0,
    provider TEXT,
    model TEXT,
    turns_used_mean REAL,
    max_turns_mean REAL,
    max_turns_reached_rate REAL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE TABLE IF NOT EXISTS eval_run_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES eval_runs(run_id),
    eval_id INTEGER NOT NULL,
    configuration TEXT NOT NULL,
    pass_rate REAL,
    turns_used REAL,
    max_turns REAL,
    max_turns_reached REAL
  );
  CREATE TABLE IF NOT EXISTS eval_improvements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES eval_runs(run_id),
    metric TEXT NOT NULL,
    baseline REAL NOT NULL,
    candidate REAL NOT NULL,
    delta REAL NOT NULL
  );
  PRAGMA journal_mode=WAL;
`;

export class SqliteHistoryRepository implements IHistoryReader, IHistoryWriter {
  private db: Database.Database;

  constructor(dbPath: string = EVAL_DB) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(INIT_SQL);
  }

  // ── IHistoryReader ────────────────────────────────────────────────────────

  listRuns(filter?: HistoryFilter): Promise<HistoryRow[]> {
    let sql = "SELECT * FROM eval_runs";
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.kind)    { where.push("kind = ?");    params.push(filter.kind); }
    if (filter?.subject) { where.push("subject = ?"); params.push(filter.subject); }
    if (filter?.since)   { where.push("created_at >= ?"); params.push(filter.since); }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY created_at DESC";
    if (filter?.limit) { sql += " LIMIT ?"; params.push(filter.limit); }
    return Promise.resolve(
      (this.db.prepare(sql).all(...params) as RawRow[]).map(rowToHistory)
    );
  }

  findRun(runId: string): Promise<HistoryRow | null> {
    const raw = this.db.prepare("SELECT * FROM eval_runs WHERE run_id = ?").get(runId) as RawRow | undefined;
    return Promise.resolve(raw ? rowToHistory(raw) : null);
  }

  listResults(runId: string): Promise<ResultRow[]> {
    const rows = this.db.prepare("SELECT * FROM eval_run_results WHERE run_id = ?").all(runId) as RawResult[];
    return Promise.resolve(rows.map(r => ({
      runId:          r.run_id,
      evalId:         r.eval_id,
      configuration:  r.configuration,
      passRate:       r.pass_rate,
      turnsUsed:      r.turns_used,
      maxTurns:       r.max_turns,
      maxTurnsReached: r.max_turns_reached,
    })));
  }

  listImprovements(runId: string): Promise<ImprovementRow[]> {
    const rows = this.db.prepare("SELECT * FROM eval_improvements WHERE run_id = ?").all(runId) as RawImprovement[];
    return Promise.resolve(rows.map(r => ({
      runId: r.run_id, metric: r.metric, baseline: r.baseline, candidate: r.candidate, delta: r.delta,
    })));
  }

  // ── IHistoryWriter ────────────────────────────────────────────────────────

  recordRun(row: HistoryRow): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO eval_runs
        (run_id,kind,subject,content_hash,git_commit,git_dirty,provider,model,
         turns_used_mean,max_turns_mean,max_turns_reached_rate,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      row.runId, row.kind, row.subject, row.contentHash, row.gitCommit,
      row.gitDirty ? 1 : 0, row.provider, row.model,
      row.turnsUsedMean, row.maxTurnsMean, row.maxTurnsReachedRate,
      row.createdAt,
    );
    return Promise.resolve();
  }

  recordResults(rows: ResultRow[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO eval_run_results (run_id,eval_id,configuration,pass_rate,turns_used,max_turns,max_turns_reached)
      VALUES (?,?,?,?,?,?,?)
    `);
    const tx = this.db.transaction((rs: ResultRow[]) => {
      for (const r of rs) stmt.run(r.runId, r.evalId, r.configuration, r.passRate, r.turnsUsed, r.maxTurns, r.maxTurnsReached);
    });
    tx(rows);
    return Promise.resolve();
  }

  recordImprovements(rows: ImprovementRow[]): Promise<void> {
    const stmt = this.db.prepare("INSERT INTO eval_improvements (run_id,metric,baseline,candidate,delta) VALUES (?,?,?,?,?)");
    const tx = this.db.transaction((rs: ImprovementRow[]) => {
      for (const r of rs) stmt.run(r.runId, r.metric, r.baseline, r.candidate, r.delta);
    });
    tx(rows);
    return Promise.resolve();
  }

  close(): void { this.db.close(); }
}

// ── Raw SQLite row types ──────────────────────────────────────────────────────

interface RawRow { run_id: string; kind: string; subject: string; content_hash: string | null; git_commit: string | null; git_dirty: number; provider: string | null; model: string | null; turns_used_mean: number | null; max_turns_mean: number | null; max_turns_reached_rate: number | null; created_at: string; }
interface RawResult { run_id: string; eval_id: number; configuration: string; pass_rate: number | null; turns_used: number | null; max_turns: number | null; max_turns_reached: number | null; }
interface RawImprovement { run_id: string; metric: string; baseline: number; candidate: number; delta: number; }

function rowToHistory(r: RawRow): HistoryRow {
  return {
    runId: r.run_id, kind: r.kind as HistoryRow["kind"], subject: r.subject,
    contentHash: r.content_hash, gitCommit: r.git_commit, gitDirty: r.git_dirty === 1,
    provider: r.provider, model: r.model, turnsUsedMean: r.turns_used_mean,
    maxTurnsMean: r.max_turns_mean, maxTurnsReachedRate: r.max_turns_reached_rate,
    createdAt: r.created_at,
  };
}
