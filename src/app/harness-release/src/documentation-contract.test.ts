import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");
const paths = { adr007: "docs/adr/ADR-007-script-language-choice.md", adr008: "docs/adr/ADR-008-tool-agnostic-agents-layer.md", adr012: "docs/adr/ADR-012-source-runtime-separation.md", spec: "docs/specs/source-runtime-separation.md", reference: "docs/migration/source-runtime-separation.md", howto: "HOWTO.md", readme: "README.md", install: "INSTALL.md" } as const;
const text = (path: string) => readFile(resolve(root, path), "utf8");
const lines = (value: string) => value.replace(/\n$/, "").split("\n").length;
const staleCanonicalRoot = /(?:^|[\s`('"\[])(?:harness|scripts|evals)\//gm;

describe("documentation structure contract", () => {
  it("keeps concise ADR statuses and line budgets", async () => {
    const [a7, a8, a12] = await Promise.all([text(paths.adr007), text(paths.adr008), text(paths.adr012)]);
    expect(lines(a7)).toBeLessThanOrEqual(45); expect(lines(a8)).toBeLessThanOrEqual(25); expect(lines(a12)).toBeLessThanOrEqual(45);
    expect(a7).toContain("- Status: Accepted"); expect(a8).toContain("- Status: Superseded by ADR-012"); expect(a12).toContain("- Status: Accepted");
    expect(a7).toMatch(/TypeScript.*language/s); expect(a7).toContain("Short POSIX shell scripts"); expect(a7).toContain("root `justfile`");
    expect(a7).not.toMatch(/\b(?:Python|PowerShell|Make(?:file)?)\b/i);
    for (const location of ["src/harness", "src/tooling", "src/app/tooling", "src/app/eval-hub/evals"]) expect(a12).toContain(location);
    expect(a12).toContain("Short Bash and system launchers"); expect(a12).toContain("public operator interface");
  });
  it("rejects Markdown-delimited stale roots in current normative documents", async () => {
    for (const path of [paths.adr007, paths.adr012, paths.spec]) expect((await text(path)).match(staleCanonicalRoot), path).toBeNull();
  });
  it("keeps the normative spec stable rather than operational", async () => {
    const document = await text(paths.spec); expect(lines(document)).toBeLessThanOrEqual(45);
    for (const location of ["src/harness", "src/tooling", "src/app/tooling", "src/app/eval-hub/evals"]) expect(document).toContain(location);
    expect(document).not.toMatch(/~~~(?:bash|sh)|```(?:bash|sh)/i);
    expect(document).not.toMatch(/\bjust\s+(?:bootstrap|activate|verify|rollback|clean)-runtime\b/i);
    expect(document).not.toMatch(/\bresolve(?:s|d|ing)?\b[\s\S]{0,160}\bbuild(?:s|t|ing)?\b[\s\S]{0,160}\bproject(?:s|ed|ing)?\b[\s\S]{0,160}\bactivate(?:s|d|ing)?\b[\s\S]{0,160}\bverif(?:y|ies|ied|ying)\b/i);
    expect(document).not.toMatch(/\b(?:planned|future|migration sequence|currentRuntimePath|targetSourcePath|Make(?:file)?|Python|PowerShell)\b/i);
  });
  it("marks the operational guide as non-normative and removes completed plans", async () => {
    const reference = await text(paths.reference); expect(lines(reference)).toBeLessThanOrEqual(70); expect(reference).toMatch(/^---\nnormative: false\ndocument_type: reference\n---/);
    for (const command of ["bootstrap", "verify", "activate", "rollback", "clean"]) expect(reference).toContain("just " + command + "-runtime");
    for (const deleted of ["docs/migration/root-rewrite-announcement.md", "docs/migration/root-rewrite-plan.md"]) await expect(access(resolve(root, deleted))).rejects.toThrow();
  });
  it("keeps the operator HOWTO isolated and on current command surfaces", async () => {
    const [howto, readme, install] = await Promise.all([text(paths.howto), text(paths.readme), text(paths.install)]);
    expect(lines(howto)).toBeLessThanOrEqual(180);
    for (const marker of ["Non-normative operator guide", "HARNESS_RUNTIME_ROOT", "HARNESS_EMPTY_PROJECT", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "XDG variables alone do **not** redirect `~/.agents`", "does not document a `GOOSE_HOME` variable"]) expect(howto).toContain(marker);
    for (const command of ["pnpm --dir src/app install --frozen-lockfile --ignore-scripts", "just bootstrap-runtime", "just verify-runtime", "src/tooling/bin/install\" --dry-run", "goose skills list", "goose recipe list", "goose recipe validate", "--render-recipe", "./src/tooling/bin/build-docs"]) expect(howto).toContain(command);
    expect(howto).toContain("https://goose-docs.ai/docs/guides/environment-variables/");
    expect(howto).not.toMatch(/\b(?:Makefile|Python|PowerShell|requirements-ci\.txt)\b|(?:^|[\s`])scripts\//m);
    expect(howto).not.toContain("@agentic-dev/loop-breaker rebuild");
    expect(howto).not.toContain("<PROVIDER_API_KEY>=<secret>");
    const docsBuilder = await text("src/tooling/bin/build-docs");
    expect(docsBuilder).toMatch(/pnpm[\s\S]*harness-release[\s\S]*build-docs|DOCS=\([\s\S]*HOWTO\.md[\s\S]*\)/);
    const installer = await text("src/tooling/bin/install");
    expect(installer).not.toContain("Building plugin:");
    for (const document of [readme, install]) expect(document).toContain("[Harness operator HOWTO](HOWTO.md)");
    for (const stale of ["Makefile", "requirements-ci.txt", "scripts"]) await expect(access(resolve(root, stale))).rejects.toThrow();
  });
});