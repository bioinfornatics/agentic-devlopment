import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// src/license.test.ts → dirname = eval-hub/src/ → ".." = eval-hub/
const evalHubRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(evalHubRoot, "../../..");

describe("Eval Hub license compliance (AC1–AC5)", () => {
  it("AC1 — LICENSE.CECILL-B exists with correct SPDX header and CeCILL-B text", () => {
    const licensePath = resolve(evalHubRoot, "LICENSE.CECILL-B");
    expect(existsSync(licensePath), "LICENSE.CECILL-B must exist").toBe(true);
    const content = readFileSync(licensePath, "utf8");
    expect(content).toContain("SPDX-License-Identifier: CECILL-B");
    expect(content).toContain("CeCILL-B FREE SOFTWARE LICENSE AGREEMENT");
    expect(content).toContain("cecill.info");
    expect(content.length).toBeGreaterThan(21000);
  });

  it("AC1 — LICENSE.CECILL-B includes source provenance note", () => {
    const content = readFileSync(resolve(evalHubRoot, "LICENSE.CECILL-B"), "utf8");
    expect(content).toContain("spdx/license-list-data");
    expect(content).toContain("agentic-devlopment-zf3d");
  });

  it("AC2 — package.json declares SPDX CECILL-B and not NOASSERTION", () => {
    const pkg = JSON.parse(readFileSync(resolve(evalHubRoot, "package.json"), "utf8"));
    expect(pkg.license).toBe("CECILL-B");
    expect(pkg.license).not.toBe("NOASSERTION");
    expect(pkg.license).not.toBe("");
    expect(pkg.license).toBeDefined();
  });

  it("AC3/AC4 — root Makefile eval targets reference the distribute-able module path", () => {
    const makefile = readFileSync(resolve(repositoryRoot, "Makefile"), "utf8");
    // The Makefile's evaluate-debug target invokes eval-hub's dist/index.js,
    // which is the distribute-able build artifact. The build dependency rule
    // ensures it's always compiled from source.
    expect(makefile).toContain("src/app/eval-hub/dist/index.js");
    // No license variables — the Makefile has no companion packaging logic.
    // License is asserted at the source level (AC2 checks package.json).
    expect(makefile).not.toContain("NOASSERTION");
  });

  it("AC6 — LICENSE.CECILL-B carries eval-hub provenance for user authorization", () => {
    const content = readFileSync(resolve(evalHubRoot, "LICENSE.CECILL-B"), "utf8");
    expect(content).toContain("Eval Hub");
    expect(content).toContain("Jonathan MERCIER");
  });
});
