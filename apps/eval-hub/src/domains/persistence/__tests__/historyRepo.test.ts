/**
 * SqliteHistoryRepository — integration tests as living documentation.
 *
 * These tests use a REAL SQLite database in a temp directory.
 * Reading them tells you exactly what the schema stores and how to query it.
 * They are slower than unit tests (~10ms each) because they hit real I/O.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteHistoryRepository } from "../historyRepo.js";
import type { HistoryRow, ResultRow, ImprovementRow } from "../ports.js";
import path from "node:path";
import os   from "node:os";
import fs   from "node:fs/promises";

// ── Fixture factories ────────────────────────────────────────────────────────

function run(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    runId:               "run-001",
    kind:                "skills",
    subject:             "code-review",
    contentHash:         "abc123def456abcd",
    gitCommit:           "deadbeef1234",
    gitDirty:            false,
    provider:            "anthropic",
    model:               "claude-sonnet-4-5",
    turnsUsedMean:       4.5,
    maxTurnsMean:        8,
    maxTurnsReachedRate: 0.1,
    createdAt:           "2026-07-18T08:00:00Z",
    ...overrides,
  };
}

function result(overrides: Partial<ResultRow> = {}): ResultRow {
  return {
    runId:           "run-001",
    evalId:          0,
    configuration:   "with_skill",
    passRate:        0.8,
    turnsUsed:       4,
    maxTurns:        8,
    maxTurnsReached: 0,
    ...overrides,
  };
}

function improvement(overrides: Partial<ImprovementRow> = {}): ImprovementRow {
  return {
    runId:     "run-001",
    metric:    "pass_rate",
    baseline:  0.4,
    candidate: 0.8,
    delta:     0.4,
    ...overrides,
  };
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

describe("SqliteHistoryRepository", () => {
  let tmpDir: string;
  let repo: SqliteHistoryRepository;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-hub-db-"));
    repo = new SqliteHistoryRepository(path.join(tmpDir, "test.db"));
  });

  afterEach(async () => {
    repo.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── Basic CRUD ────────────────────────────────────────────────────────────

  describe("after recordRun()", () => {
    it("persists the run so findRun() returns it", async () => {
      await repo.recordRun(run());

      const found = await repo.findRun("run-001");

      expect(found).not.toBeNull();
      expect(found!.runId).toBe("run-001");
      expect(found!.subject).toBe("code-review");
    });

    it("stores all scalar fields without loss", async () => {
      const original = run();
      await repo.recordRun(original);

      const found = await repo.findRun("run-001");

      expect(found!.kind).toBe("skills");
      expect(found!.contentHash).toBe("abc123def456abcd");
      expect(found!.gitCommit).toBe("deadbeef1234");
      expect(found!.gitDirty).toBe(false);
      expect(found!.provider).toBe("anthropic");
      expect(found!.model).toBe("claude-sonnet-4-5");
      expect(found!.turnsUsedMean).toBeCloseTo(4.5);
      expect(found!.maxTurnsReachedRate).toBeCloseTo(0.1);
    });

    it("is idempotent — INSERT OR REPLACE does not duplicate rows", async () => {
      await repo.recordRun(run({ model: "claude-3-opus" }));
      await repo.recordRun(run({ model: "claude-sonnet-4-5" })); // same runId

      const all = await repo.listRuns();

      expect(all).toHaveLength(1);
      expect(all[0]!.model).toBe("claude-sonnet-4-5"); // last write wins
    });
  });

  describe("findRun() when run does not exist", () => {
    it("returns null rather than throwing", async () => {
      const found = await repo.findRun("does-not-exist");
      expect(found).toBeNull();
    });
  });

  // ── listRuns() filtering ──────────────────────────────────────────────────

  describe("listRuns(filter)", () => {
    beforeEach(async () => {
      await repo.recordRun(run({ runId: "r1", kind: "skills",  subject: "code-review", createdAt: "2026-07-17T00:00:00Z" }));
      await repo.recordRun(run({ runId: "r2", kind: "agents",  subject: "review-critic", createdAt: "2026-07-18T00:00:00Z" }));
      await repo.recordRun(run({ runId: "r3", kind: "skills",  subject: "sdd", createdAt: "2026-07-19T00:00:00Z" }));
    });

    it("returns all runs in descending chronological order when no filter applied", async () => {
      const all = await repo.listRuns();

      expect(all.map(r => r.runId)).toEqual(["r3", "r2", "r1"]);
    });

    it("filters by kind — returns only skill runs", async () => {
      const skills = await repo.listRuns({ kind: "skills" });

      expect(skills.every(r => r.kind === "skills")).toBe(true);
      expect(skills).toHaveLength(2);
    });

    it("filters by subject — returns only that subject's runs", async () => {
      const runs = await repo.listRuns({ subject: "code-review" });

      expect(runs).toHaveLength(1);
      expect(runs[0]!.subject).toBe("code-review");
    });

    it("respects the limit — returns at most N rows", async () => {
      const limited = await repo.listRuns({ limit: 2 });

      expect(limited).toHaveLength(2);
    });
  });

  // ── recordResults / listResults ───────────────────────────────────────────

  describe("after recordResults()", () => {
    beforeEach(async () => {
      await repo.recordRun(run());
    });

    it("persists scenario results and retrieves them by runId", async () => {
      await repo.recordResults([
        result({ evalId: 0, configuration: "with_skill",    passRate: 0.8 }),
        result({ evalId: 0, configuration: "without_skill", passRate: 0.4 }),
        result({ evalId: 1, configuration: "with_skill",    passRate: 1.0 }),
      ]);

      const results = await repo.listResults("run-001");

      expect(results).toHaveLength(3);
    });

    it("stores pass_rate with full precision", async () => {
      await repo.recordResults([result({ passRate: 0.666_666_7 })]);

      const found = await repo.listResults("run-001");

      expect(found[0]!.passRate).toBeCloseTo(0.666_666_7, 5);
    });
  });

  // ── recordImprovements / listImprovements ─────────────────────────────────

  describe("after recordImprovements()", () => {
    beforeEach(async () => {
      await repo.recordRun(run());
    });

    it("writes all improvement rows transactionally", async () => {
      await repo.recordImprovements([
        improvement({ metric: "pass_rate",  delta: 0.4 }),
        improvement({ metric: "turns_used", delta: -1.5 }),
      ]);

      const found = await repo.listImprovements("run-001");

      expect(found).toHaveLength(2);
      expect(found.find(r => r.metric === "pass_rate")!.delta).toBeCloseTo(0.4);
      expect(found.find(r => r.metric === "turns_used")!.delta).toBeCloseTo(-1.5);
    });
  });
});
