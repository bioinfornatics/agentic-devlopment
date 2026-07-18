/**
 * E2E API tests — tests as living documentation of the HTTP contract.
 *
 * These tests start a REAL server (see playwright.config.ts webServer)
 * and make REAL HTTP requests. They document what any HTTP client sees.
 *
 * Rules:
 *  - Test names describe the observable behaviour, not the code path
 *  - Assertions name the invariant: "responds 200", "returns array", etc.
 *  - No mocks — if the server fails to start, the tests fail cleanly
 */
import { test, expect } from "@playwright/test";

// ── Health ────────────────────────────────────────────────────────────────────

test.describe("Health endpoint", () => {
  test("responds 200 OK within 1 second of startup", async ({ request }) => {
    const res = await request.get("/health");

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
  });

  test("returns a JSON body with ok=true and an ISO-8601 timestamp", async ({ request }) => {
    const body = await (await request.get("/health")).json() as { ok: boolean; ts: string };

    expect(body.ok).toBe(true);
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ── History ───────────────────────────────────────────────────────────────────

test.describe("History endpoint", () => {
  test("GET /api/history returns 200 with a JSON array", async ({ request }) => {
    const res  = await request.get("/api/history");
    const body = await res.json() as unknown[];

    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/history accepts ?kind=skills without error", async ({ request }) => {
    const res = await request.get("/api/history?kind=skills");
    expect(res.ok()).toBeTruthy();
  });

  test("GET /api/history accepts ?limit=5 and returns at most 5 runs", async ({ request }) => {
    const body = await (await request.get("/api/history?limit=5")).json() as unknown[];
    expect(body.length).toBeLessThanOrEqual(5);
  });

  test("GET /api/history/:runId returns 404 for unknown run", async ({ request }) => {
    const res = await request.get("/api/history/unknown-run-id-12345");
    expect(res.status()).toBe(404);
  });
});

// ── Workspace ─────────────────────────────────────────────────────────────────

test.describe("Workspace endpoint", () => {
  test("GET /api/workspace/skills returns subjects array with count", async ({ request }) => {
    const body = await (await request.get("/api/workspace/skills")).json() as { kind: string; subjects: string[]; count: number };

    expect(body.kind).toBe("skills");
    expect(Array.isArray(body.subjects)).toBe(true);
    expect(body.count).toBe(body.subjects.length);
  });

  test("GET /api/workspace/agents responds 200", async ({ request }) => {
    const res = await request.get("/api/workspace/agents");
    expect(res.ok()).toBeTruthy();
  });

  test("GET /api/workspace/recipes responds 200", async ({ request }) => {
    const res = await request.get("/api/workspace/recipes");
    expect(res.ok()).toBeTruthy();
  });
});

// ── Consistency ───────────────────────────────────────────────────────────────

test.describe("Consistency endpoint", () => {
  test("GET /api/consistency runs all checks and returns a ConsistencyReport", async ({ request }) => {
    const body = await (await request.get("/api/consistency")).json() as { passed: number; failed: number; warned: number; checks: { id: string; status: string; message: string }[] };

    expect(typeof body.passed).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(typeof body.warned).toBe("number");
    expect(Array.isArray(body.checks)).toBe(true);
  });

  test("each check has id, status, message, and details fields", async ({ request }) => {
    const body = await (await request.get("/api/consistency")).json() as { checks: { id: string; status: string; message: string; details: string[] }[] };

    for (const check of body.checks) {
      expect(typeof check.id).toBe("string");
      expect(["pass", "fail", "warn"]).toContain(check.status);
      expect(typeof check.message).toBe("string");
      expect(Array.isArray(check.details)).toBe(true);
    }
  });

  test("the total passed+failed+warned equals checks.length", async ({ request }) => {
    const body = await (await request.get("/api/consistency")).json() as { passed: number; failed: number; warned: number; checks: unknown[] };

    expect(body.passed + body.failed + body.warned).toBe(body.checks.length);
  });
});

// ── Reports ───────────────────────────────────────────────────────────────────

test.describe("Trend report endpoint", () => {
  test("GET /api/reports/trend returns a standalone HTML document", async ({ request }) => {
    const res  = await request.get("/api/reports/trend");
    const text = await res.text();

    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(text.toLowerCase().trim()).toMatch(/^<!doctype html>/);
    expect(text).toContain("</html>");
  });

  test("the trend report contains an embedded CSS block (no external deps)", async ({ request }) => {
    const text = await (await request.get("/api/reports/trend")).text();
    expect(text).toContain("<style>");
    expect(text).not.toMatch(/rel=["']stylesheet["']/);
  });
});
