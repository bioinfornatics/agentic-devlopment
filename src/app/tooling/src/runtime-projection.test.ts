import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manageCli, manageProjectRuntime } from "./manage-project-runtime.js";
import { projectCli, projectHarnessRuntime } from "./project-harness-runtime.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function temporary(): string { const root = mkdtempSync(join(tmpdir(), "tooling-runtime-")); roots.push(root); return root; }
function fixture(root: string, label: string): [string, string] {
  const internal = join(root, label + "-internal"); const external = join(root, label + "-external");
  for (const path of [".agents/agents", ".agents/skills/internal", ".agents/plugins/p", ".goose/recipes"]) mkdirSync(join(internal, path), { recursive: true });
  writeFileSync(join(internal, ".agents/agents/a.md"), "a"); writeFileSync(join(internal, ".agents/skills/internal/SKILL.md"), "i");
  writeFileSync(join(internal, ".agents/plugins/p/plugin.json"), "{}"); writeFileSync(join(internal, ".goose/recipes/r.yaml"), "title: r");
  writeFileSync(join(internal, "build-manifest.json"), "{}"); mkdirSync(join(external, "external"), { recursive: true });
  writeFileSync(join(external, "external/SKILL.md"), "e"); writeFileSync(join(external, "resolved.json"), "{}"); return [internal, external];
}

describe("runtime projection", () => {
  it("projects a deterministic content-addressed release and manifest", () => {
    const root = temporary(); const [internal, external] = fixture(root, "same"); const runtime = join(root, "runtime");
    const first = projectHarnessRuntime(internal, external, runtime); const second = projectHarnessRuntime(internal, external, runtime);
    expect(second).toBe(first); expect(readFileSync(join(runtime, "candidate"), "utf8")).toBe(first + "\n");
    const manifest = JSON.parse(readFileSync(join(runtime, "releases", first, ".harness-runtime.json"), "utf8"));
    expect(manifest).toMatchObject({ schema: "harness-runtime-projection-v1", digest: first, target: "linux-x86_64" });
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
      ".agents/agents/a.md", ".agents/plugins/p/plugin.json", ".agents/skills/external/SKILL.md",
      ".agents/skills/internal/SKILL.md", ".goose/recipes/r.yaml",
    ]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(projectCli(["--internal", internal, "--external", external, "--runtime-root", runtime])).toBe(0);
    expect(log).toHaveBeenLastCalledWith(first); log.mockRestore();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(projectCli(["--internal", internal])).toBe(1);
    expect(manageCli(["unknown", "--runtime-root", runtime, "--project-root", root])).toBe(1);
    expect(error).toHaveBeenCalled(); error.mockRestore();
  });

  it("keeps the root Just runtime interface on built tooling CLIs", () => {
    const justfile = readFileSync(resolve(import.meta.dirname, "../../../../justfile"), "utf8");
    for (const recipe of ["project-runtime", "activate-runtime", "verify-runtime", "rollback-runtime", "clean-runtime"])
      expect(justfile).toMatch(new RegExp("^" + recipe + ": _build-runtime-tooling$", "m"));
    expect(justfile).toContain("pnpm --dir src/app --filter @harness/tooling build");
    expect(justfile).not.toMatch(/project-harness-runtime\.py|manage-project-runtime\.py/);
  });

  it("projects, activates, verifies, rolls back, and detects drift", () => {
    const root = temporary(); const project = join(root, "project"); mkdirSync(project); const runtime = join(project, "build/harness/runtime");
    const [i1, e1] = fixture(root, "one"); const first = projectHarnessRuntime(i1, e1, runtime);
    manageProjectRuntime("activate", runtime, project); expect(manageProjectRuntime("verify", runtime, project)).toBe(first);
    expect(readFileSync(join(project, ".agents/skills/external/SKILL.md"), "utf8")).toBe("e");
    const [i2, e2] = fixture(root, "two"); writeFileSync(join(i2, ".agents/agents/a.md"), "changed"); const second = projectHarnessRuntime(i2, e2, runtime);
    expect(second).not.toBe(first); manageProjectRuntime("activate", runtime, project); manageProjectRuntime("rollback", runtime, project);
    expect(realpathSync(join(runtime, "current"))).toBe(join(runtime, "releases", first));
    writeFileSync(join(project, ".agents/agents/a.md"), "tamper"); expect(() => manageProjectRuntime("verify", runtime, project)).toThrow("runtime drift: .agents/agents/a.md");
  });

  it("clean retains only current and previous releases", () => {
    const root = temporary(); const project = join(root, "project"); mkdirSync(project); const runtime = join(project, "build/harness/runtime");
    const [i1,e1] = fixture(root,"one"); const first=projectHarnessRuntime(i1,e1,runtime); manageProjectRuntime("activate",runtime,project);
    const [i2,e2] = fixture(root,"two"); writeFileSync(join(i2,".agents/agents/a.md"),"2"); const second=projectHarnessRuntime(i2,e2,runtime); manageProjectRuntime("activate",runtime,project);
    const [i3,e3] = fixture(root,"three"); writeFileSync(join(i3,".agents/agents/a.md"),"3"); const third=projectHarnessRuntime(i3,e3,runtime);
    manageProjectRuntime("clean",runtime,project); expect(() => readFileSync(join(runtime,"releases",third,".harness-runtime.json"))).toThrow();
    expect(readFileSync(join(runtime,"releases",first,".harness-runtime.json"),"utf8")).toContain(first); expect(realpathSync(join(runtime,"current"))).toContain(second);
  });
});
