import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E API tests.
 *
 * These tests treat eval-hub as a black box:
 *   - start the real server
 *   - make real HTTP calls
 *   - assert on real responses
 *
 * No browser is launched — we use Playwright's API testing (request fixture).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  // Timeout per test
  timeout: 30_000,

  // Retry in CI (flaky network, slow startup)
  retries: process.env["CI"] ? 2 : 0,

  // Reporter — stdout for local, GitHub Actions annotation in CI
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    // The base URL all requests are relative to
    baseURL: `http://localhost:${process.env["EVAL_HUB_PORT"] ?? "7331"}`,

    // Trace on first retry (helps diagnose CI failures)
    trace: "on-first-retry",
  },

  // Start the real server before running tests; tear it down after.
  webServer: {
    command: "node dist/index.js --server --port 7331",
    url:     "http://localhost:7331/health",

    // Reuse a running server locally; always start fresh in CI
    reuseExistingServer: !process.env["CI"],

    // Allow up to 10s for the server to start
    timeout: 10_000,

    // Forward server stdout/stderr to test output (visible with --reporter=list)
    stdout: "pipe",
    stderr: "pipe",
  },

  projects: [
    {
      name: "api",
      use:  { ...devices["Desktop Chrome"] },  // unused for API tests but required by type
    },
  ],
});
