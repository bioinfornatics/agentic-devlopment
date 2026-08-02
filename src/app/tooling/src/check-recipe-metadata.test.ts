import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runRecipeMetadata } from "./check-recipe-metadata.js";
const repo = resolve(import.meta.dirname, "../../../..");
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), "recipe-metadata-")); roots.push(root); for (const p of [".specs/harness/recipe-workflow-metadata.json", ".specs/schemas/recipe-workflow-metadata.schema.json", "src/recipes", "src/agents", "src/skills"]) await cp(join(repo, p), join(root, p), { recursive: true }); return root; }
async function mutate(root: string, fn: (data: any) => void) { const p = join(root, ".specs/harness/recipe-workflow-metadata.json"), data = JSON.parse(await readFile(p, "utf8")); fn(data); await writeFile(p, JSON.stringify(data)); return runRecipeMetadata(root); }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
describe("recipe metadata", () => {
  it("accepts active contract", async () => { const r = await runRecipeMetadata(await fixture()); expect(r.exitCode).toBe(0); expect(r.stdout).toMatch(/^PASS recipe metadata\/schema and YAML contract for \d+ active recipes\n$/); });
  it("rejects missing agent", async () => { const root = await fixture(), r = await mutate(root, d => { delete d.agents["repository-researcher"]; }); expect(r.exitCode).toBe(1); expect(r.stdout).toContain("metadata agents"); });
  it("rejects unknown skill", async () => { const root = await fixture(), r = await mutate(root, d => { d.recipes.implement.controller_skills[0].skill = "missing-skill"; }); expect(r.stdout).toContain("unknown skill"); });
  it("rejects skill path", async () => { const root = await fixture(), r = await mutate(root, d => { d.recipes.implement.controller_skills[0].skill = "src/skills/task-framing"; }); expect(r.stdout).toContain("name-only"); });
  it("rejects missing skills extension", async () => { const root = await fixture(), p = join(root, "src/recipes/implement.yaml"), text = await readFile(p, "utf8"), ext = "  - type: platform\n    name: skills\n"; expect(text).toContain(ext); await writeFile(p, text.replace(ext, "")); expect((await runRecipeMetadata(root)).stdout).toContain("missing required skills platform extension"); });
  it("rejects malformed JSON", async () => { const root = await fixture(); await writeFile(join(root, ".specs/harness/recipe-workflow-metadata.json"), "{"); const r = await runRecipeMetadata(root); expect(r.exitCode).toBe(1); expect(r.stdout).toContain("cannot read .specs/harness/recipe-workflow-metadata.json"); });
  it("rejects malformed YAML", async () => { const root = await fixture(); await writeFile(join(root, "src/recipes/implement.yaml"), "instructions: [unterminated"); const r = await runRecipeMetadata(root); expect(r.exitCode).toBe(1); expect(r.stdout).toContain("cannot parse src/recipes/implement.yaml"); });
});
