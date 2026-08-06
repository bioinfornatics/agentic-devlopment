/**
 * Focused regression tests for --help / -h (AC-1, AC-2, AC-3).
 * Spawns the compiled entry point in a child process — no server/TUI starts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "../../dist/index.js");

function runHelp(flag: string) {
  return spawnSync(process.execPath, [DIST, flag], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      // Prevent any TTY-detection side-effect
      FORCE_COLOR: "0",
    },
  });
}

describe("Eval Hub --help mode", () => {
  it("--help exits 0", () => {
    const r = runHelp("--help");
    expect(r.status).toBe(0);
  });

  it("--help prints Usage: section to stdout", () => {
    const r = runHelp("--help");
    expect(r.stdout).toContain("Usage:");
  });

  it("--help prints Modes: section to stdout", () => {
    const r = runHelp("--help");
    expect(r.stdout).toContain("Modes:");
  });

  it("--help prints Options: section to stdout", () => {
    const r = runHelp("--help");
    expect(r.stdout).toContain("Options:");
  });

  it("-h exits 0", () => {
    const r = runHelp("-h");
    expect(r.status).toBe(0);
  });

  it("-h output matches --help output", () => {
    const full  = runHelp("--help");
    const short = runHelp("-h");
    expect(short.stdout).toBe(full.stdout);
  });

  it("--help produces no stderr", () => {
    const r = runHelp("--help");
    expect(r.stderr).toBe("");
  });

  it("--help does not start any server (exits before dynamic imports)", () => {
    const r = runHelp("--help");
    // A started server would produce "listening" in stderr; help must not.
    expect(r.stderr).not.toContain("listening");
    // Process must complete quickly — no event-loop hang from open handles.
    expect(r.status).toBe(0);
  });
});