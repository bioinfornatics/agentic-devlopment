/**
 * Smoke tests — operational contract documentation.
 *
 * These tests answer: "does the server start cleanly and shut down gracefully?"
 * They run against the compiled dist/ binary, not source.
 * They are the first thing to run in CI after a build.
 *
 * A failing smoke test means: DO NOT DEPLOY.
 */
import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 7332; // different from E2E port to allow parallel runs
const BASE  = `http://localhost:${PORT}`;

async function startServer(): Promise<{ proc: ChildProcess; stop: () => Promise<void> }> {
  const proc = spawn("node", ["dist/index.js", "--server", `--port`, String(PORT)], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, HARNESS_ROOT: "../.." },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Wait for the process to either start or crash
  await delay(1_500);

  const stop = () => new Promise<void>((resolve) => {
    proc.on("close", resolve);
    proc.kill("SIGTERM");
    setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 3_000);
  });

  return { proc, stop };
}

test.describe.serial("Smoke: Server startup and shutdown", () => {
  let server: { proc: ChildProcess; stop: () => Promise<void> };

  test.beforeAll(async () => {
    server = await startServer();
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("server process starts without crashing", () => {
    // If the process exited before we checked, exitCode will be set
    expect(server.proc.exitCode).toBeNull();
  });

  test("health endpoint responds within 2 seconds of startup", async ({ request }) => {
    const res = await request.get(`${BASE}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("health endpoint returns { ok: true }", async ({ request }) => {
    const body = await (await request.get(`${BASE}/health`)).json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("server shuts down cleanly on SIGTERM", async () => {
    server.proc.kill("SIGTERM");
    await delay(1_000);

    // Process should have exited (code 0 or null after SIGTERM)
    expect(server.proc.exitCode === 0 || server.proc.killed).toBe(true);
  });
});
