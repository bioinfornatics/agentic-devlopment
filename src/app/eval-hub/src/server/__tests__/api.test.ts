/**
 * Hono HTTP API — integration tests as living documentation.
 *
 * Uses Hono's built-in `app.request()` — no real TCP port needed.
 * These tests document the HTTP contract: method, path, response shape.
 *
 * A consumer reading this file learns:
 *   - exactly which routes exist
 *   - exactly what shape each response has
 *   - exactly which status codes to expect
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { createApp } from "../index.js";

// Prevent real SQLite / filesystem access in route handlers by mocking domain services
vi.mock("../../domains/persistence/historyRepo.js", () => ({
  SqliteHistoryRepository: vi.fn().mockImplementation(() => ({
    listRuns:           vi.fn().mockResolvedValue([]),
    findRun:            vi.fn().mockResolvedValue(null),
    listResults:        vi.fn().mockResolvedValue([]),
    listImprovements:   vi.fn().mockResolvedValue([]),
    recordRun:          vi.fn().mockResolvedValue(undefined),
    recordResults:      vi.fn().mockResolvedValue(undefined),
    recordImprovements: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../domains/persistence/workspaceReader.js", () => ({
  FsWorkspaceReader: vi.fn().mockImplementation(() => ({
    listSubjects: vi.fn().mockResolvedValue(["code-review", "sdd"]),
    listRuns:     vi.fn().mockResolvedValue([]),
    readGradings: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../domains/governance/consistencyChecker.js", () => ({
  ConsistencyChecker: vi.fn().mockImplementation(() => ({
    runAll: vi.fn().mockResolvedValue({ passed: 5, failed: 0, warned: 1, checks: [] }),
  })),
}));

describe("Hono HTTP API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  // ── Health ────────────────────────────────────────────────────────────────

  describe("GET /health", () => {
    it("responds 200 OK", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
    });

    it("returns { ok: true } with an ISO timestamp", async () => {
      const res  = await app.request("/health");
      const body = await res.json() as { ok: boolean; ts: string };

      expect(body.ok).toBe(true);
      expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ── History ───────────────────────────────────────────────────────────────

  describe("GET /api/history", () => {
    it("responds 200 with a JSON array", async () => {
      const res  = await app.request("/api/history");
      const body = await res.json() as unknown[];

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it("accepts optional ?kind filter without error", async () => {
      const res = await app.request("/api/history?kind=skills&limit=10");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/history/:runId when run not found", () => {
    it("responds 404 with { error: 'not found' }", async () => {
      const res  = await app.request("/api/history/does-not-exist");
      const body = await res.json() as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("not found");
    });
  });

  // ── Workspace ─────────────────────────────────────────────────────────────

  describe("GET /api/workspace/:kind", () => {
    it("responds 200 with subjects array and count", async () => {
      const res  = await app.request("/api/workspace/skills");
      const body = await res.json() as { kind: string; subjects: string[]; count: number };

      expect(res.status).toBe(200);
      expect(body.kind).toBe("skills");
      expect(Array.isArray(body.subjects)).toBe(true);
      expect(body.count).toBe(body.subjects.length);
    });
  });

  // ── Consistency ───────────────────────────────────────────────────────────

  describe("GET /api/consistency", () => {
    it("responds 200 with a ConsistencyReport shape", async () => {
      const res  = await app.request("/api/consistency");
      const body = await res.json() as { passed: number; failed: number; warned: number; checks: unknown[] };

      expect(res.status).toBe(200);
      expect(typeof body.passed).toBe("number");
      expect(typeof body.failed).toBe("number");
      expect(typeof body.warned).toBe("number");
      expect(Array.isArray(body.checks)).toBe(true);
    });
  });

  // ── Reports ───────────────────────────────────────────────────────────────

  describe("GET /api/reports/trend", () => {
    it("responds 200 with Content-Type text/html", async () => {
      const res = await app.request("/api/reports/trend");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("returns a standalone HTML document", async () => {
      const res  = await app.request("/api/reports/trend");
      const text = await res.text();

      expect(text.toLowerCase().trim()).toMatch(/^<!doctype html>/);
      expect(text).toContain("</html>");
    });
  });
});
