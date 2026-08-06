import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../../..");

describe("authoritative release workflow characterization port", () => {
  it("keeps release triggers, least privilege, companion separation, and Eval Hub exclusion", async () => {
    const text = await readFile(resolve(ROOT, ".github/workflows/harness-release.yml"), "utf8");
    expect(text).toContain("pull_request:");
    expect(text).toContain("release_tag:");
    expect(text).not.toContain("push:\n    tags:");
    expect(text).toMatch(/permissions:\s*contents: read/);
    expect(text).toContain("contents: write");
    expect(text).toContain("@harness/eval-hub build");
    expect(text).toContain("src/app/harness-release/dist/ci-harness-release.js");
    expect(text).not.toContain("--internal src/app/eval-hub");
    expect(text).toContain("package-companion");
    expect(text).toContain("eval-hub-companion-linux-x86_64");
    expect(text).toContain("dist/eval-hub-companion/**");
    expect(text).not.toContain("dist/harness-ci/release/eval-hub");
  });

  it("uses only the TypeScript toolchain for tooling and release checks", async () => {
    const release = await readFile(resolve(ROOT, ".github/workflows/harness-release.yml"), "utf8");
    const hub = await readFile(resolve(ROOT, ".github/workflows/eval-hub.yml"), "utf8");
    const tooling = await readFile(resolve(ROOT, ".github/workflows/eval-scripts.yml"), "utf8");
    for (const text of [release, hub]) {
      expect(text).toContain("--ignore-scripts");
      expect(text).toContain("rebuild better-sqlite3");
    }
    for (const text of [release, tooling]) {
      expect(text).not.toMatch(/setup-python|pip install|requirements-ci|pytest|\bpython(?:3)?\b/i);
    }
    expect(tooling).toContain("@harness/harness-release typecheck");
    expect(tooling).toContain("@harness/harness-release test");
    expect(tooling).toContain("@harness/harness-manager typecheck");
    expect(tooling).toContain("@harness/harness-manager test");
    expect(tooling).toContain("pnpm/action-setup@v4");
    expect(release).toContain("--skip-tests");
    expect(release).toContain("evaluation_run_id");
    expect(release).toContain("required: true");
    expect(release).toContain("run-id: ${{ inputs.evaluation_run_id }}");
    expect(release).not.toContain("LOCAL_EVALUATION_RUN_ID");
    expect(release).toContain("evaluation-attestation");
    expect(release).toContain("--attestation dist/evaluation-attestation/attestation.json");
    expect(release).toContain("--bindings dist/evaluation-attestation/bindings.json");
    expect(release).toContain("--profile dist/evaluation-attestation/profile.json");
    expect(release).toMatch(/publish:[\s\S]*needs: verify/);
    expect(release).toContain("Bootstrap projected harness runtime");
    expect(hub).toContain("just bootstrap-runtime");
    expect(release).toContain("Resolve release version");
    expect(release).toContain("0.0.0-pr");
  });
});