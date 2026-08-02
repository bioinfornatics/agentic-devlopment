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

  it("AC3/AC4 — root justfile packaging defaults to CECILL-B and fails closed otherwise", () => {
    const justfile = readFileSync(resolve(repositoryRoot, "justfile"), "utf8");
    expect(justfile).toMatch(/^LICENSE_SPDX := "CECILL-B"$/m);
    expect(justfile).toContain('license_spdx := env_var_or_default("LICENSE_SPDX", LICENSE_SPDX)');
    expect(justfile).toContain('test "{{ license_spdx }}" = "CECILL-B"');
    expect(justfile).toContain("LICENSE_SPDX must be exactly CECILL-B");
    expect(justfile).toContain('cp "{{ justfile_directory() }}/src/app/eval-hub/LICENSE.CECILL-B"');
    expect(justfile).toContain("LICENSE-ASSERTION.json");
    expect(justfile).toContain('distributionAllowed:($spdx!="NOASSERTION")');
    expect(justfile).toContain('reviewRequired:($spdx=="NOASSERTION")');
  });

  it("AC6 — LICENSE.CECILL-B carries eval-hub provenance for user authorization", () => {
    const content = readFileSync(resolve(evalHubRoot, "LICENSE.CECILL-B"), "utf8");
    expect(content).toContain("Eval Hub");
    expect(content).toContain("Jonathan MERCIER");
  });
});
