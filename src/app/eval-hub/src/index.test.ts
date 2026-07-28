import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const entryPoint = fileURLToPath(new URL("../dist/index.js", import.meta.url));

for (const alias of ["--help", "-h"]) {
  describe(`Eval Hub ${alias}`, () => {
    it("prints help and exits without starting an operational mode", () => {
      const result = spawnSync(process.execPath, [entryPoint, alias], {
        encoding: "utf8",
        env: { ...process.env, EVAL_HUB_PORT: "0" },
        timeout: 2_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("Modes:");
      expect(result.stdout).toContain("Options:");
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(
        /Eval Hub API listening|server started/i,
      );
    });
  });
}
describe("Eval Hub companion self-check", () => {
  it("prints bounded runtime identity and starts no operational mode", () => {
    const result = spawnSync(process.execPath, [entryPoint, "--companion-self-check"], { encoding: "utf8", timeout: 5_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const identity = JSON.parse(result.stdout.trim());
    expect(identity).toMatchObject({ schema: "eval-hub-companion-self-check-v1", operationalModeStarted: false });
    expect(["node", "bun"]).toContain(identity.runtime);
  });
});
