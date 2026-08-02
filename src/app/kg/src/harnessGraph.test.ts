import { afterEach, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { collectHarnessGraph, graphJSONL, type GraphNode, type GraphRelationship, type HarnessGraph } from "./harnessGraph.js";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

async function fixture(): Promise<{ root: string; env: NodeJS.ProcessEnv }> {
  root = await mkdtemp(join(tmpdir(), "harness-graph-"));
  const files: Record<string, string> = {
    "src/skills/demo/SKILL.md": "# Demo\n",
    "src/agents/agent-one.md": "Load skill: demo\n",
    "src/recipes/verify.yaml": "Load agent agent-one\nLoad skills: demo\n",
    ".audit/harness/findings-register.md": "id: F-TEST-1\naffected_files: [src/agents/agent-one.md]\n",
    ".specs/STATE.md": "## AD-1 — Keep it deterministic\n",
    ".specs/harness/recipe-workflow-metadata.json": JSON.stringify({ recipes: { verify: { entry_criteria: ["Ready"], exit_criteria: ["Done"], artifacts: ["report"] } } }),
  };
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, contents);
  }
  const bin = join(root, "bin"); await mkdir(bin);
  const bd = join(bin, "bd"); await writeFile(bd, "#!/bin/sh\nprintf '[]\n'\n"); await chmod(bd, 0o755);
  return { root, env: { ...process.env, PATH: bin + ":" + process.env.PATH } };
}

function expectedGraph(fixtureRoot: string): HarnessGraph {
  const node = (id: string, type: string, name: string, source_path: string | null, extra: Partial<GraphNode> = {}): GraphNode => ({
    id, type, name, description: "", source_path, source_lines: null, source_kind: "explicit", confidence: 1,
    status: "active", version: null, created_at: null, updated_at: null, tags: [], ...extra,
  });
  const rel = (type: string, source: string, target: string, source_path: string, source_lines: number[] | null,
    extra: Partial<GraphRelationship> = {}): GraphRelationship => ({
    id: `rel:${type}:${source}:${target}:${source_lines?.[0] ?? "na"}`, type, source, target,
    direction: "directed", evidence: null, source_path, source_lines, source_kind: "explicit", confidence: 1,
    status: "active", condition: null, cardinality: null, ...extra,
  });
  const nodes = [
    node("agent:agent-one", "Agent", "agent-one", "src/agents/agent-one.md", { layer: "L2" }),
    node("artifact:findings-register.md", "Artifact", "findings-register.md", ".audit/harness/findings-register.md", { layer: "Audit" }),
    node("artifact-type:report", "ArtifactType", "report", ".specs/harness/recipe-workflow-metadata.json", { layer: "L3" }),
    node("decision:AD-1", "Decision", "AD-1", ".specs/STATE.md", { title: "Keep it deterministic" }),
    node("finding:F-TEST-1", "Finding", "F-TEST-1", ".audit/harness/findings-register.md", { layer: "Audit" }),
    node("gate:verify:1", "Gate", "Ready", ".specs/harness/recipe-workflow-metadata.json", { layer: "L3" }),
    node("gate:verify:2", "Gate", "Done", ".specs/harness/recipe-workflow-metadata.json", { layer: "L3" }),
    node("phase:Verify", "LifecyclePhase", "Verify", null, { source_kind: "inferred", confidence: .85 }),
    node("recipe:verify", "Recipe", "verify", "src/recipes/verify.yaml", { layer: "L3" }),
    node("skill:demo", "Skill", "demo", "src/skills/demo/SKILL.md", { layer: "L1" }),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const metadata = ".specs/harness/recipe-workflow-metadata.json";
  const relationships = [
    rel("Agent_LOADS_SKILL", "agent:agent-one", "skill:demo", "src/agents/agent-one.md", [1], { evidence: "Load skill: demo" }),
    rel("Finding_HAS_EVIDENCE", "finding:F-TEST-1", "artifact:findings-register.md", ".audit/harness/findings-register.md", [2], { evidence: "affected_files: [src/agents/agent-one.md]" }),
    rel("Recipe_HAS_GATE", "recipe:verify", "gate:verify:1", metadata, null, { confidence: .9 }),
    rel("Recipe_HAS_GATE", "recipe:verify", "gate:verify:2", metadata, null, { confidence: .9 }),
    rel("Recipe_IMPLEMENTS_PHASE", "recipe:verify", "phase:Verify", "src/recipes/verify.yaml", null, { source_kind: "inferred", confidence: .85 }),
    rel("Recipe_INVOLVES_AGENT", "recipe:verify", "agent:agent-one", "src/recipes/verify.yaml", [1], { evidence: "Load agent agent-one" }),
    rel("Recipe_LOADS_SKILL", "recipe:verify", "skill:demo", "src/recipes/verify.yaml", [2], { evidence: "Load skills: demo" }),
    rel("Recipe_PRODUCES_ARTIFACT", "recipe:verify", "artifact-type:report", metadata, null, { confidence: .9 }),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return {
    schema: "harness-property-graph-v0", root: fixtureRoot, nodes, relationships,
    constraints: [
      "Every active Agent should have at least one responsibility.",
      "Every active Skill should be loaded by an Agent or Recipe unless justified.",
      "Every active Recipe should implement a LifecyclePhase or cross-cutting function.",
      "Every explicit relationship should include source_path and source_lines.",
    ],
  };
}

it("collects the exact fixture nodes and relationships", async () => {
  const setup = await fixture();
  expect(await collectHarnessGraph(setup.root)).toEqual(expectedGraph(setup.root));
});

it("emits deterministic JSONL with exact provenance", async () => {
  const setup = await fixture();
  const expected = expectedGraph(setup.root);
  const expectedJSONL = [...expected.nodes.map(value => ({ record: "node", ...value })),
    ...expected.relationships.map(value => ({ record: "relationship", ...value }))]
    .map(value => JSON.stringify(value)).join("\n") + "\n";
  const first = await collectHarnessGraph(setup.root);
  const second = await collectHarnessGraph(setup.root);
  expect(graphJSONL(first)).toBe(expectedJSONL);
  expect(graphJSONL(second)).toBe(expectedJSONL);
});

it("supports CLI summary and JSONL output", async () => {
  const setup = await fixture();
  const summary = await execFileAsync(process.execPath, [CLI, "export-harness-graph", "--root", setup.root, "--summary"], { env: setup.env });
  expect(summary.stderr).toBe("");
  expect(summary.stdout).toBe(JSON.stringify({
    nodes: { Agent: 1, Artifact: 1, ArtifactType: 1, Decision: 1, Finding: 1, Gate: 2, LifecyclePhase: 1, Recipe: 1, Skill: 1 },
    relationships: { Agent_LOADS_SKILL: 1, Finding_HAS_EVIDENCE: 1, Recipe_HAS_GATE: 2, Recipe_IMPLEMENTS_PHASE: 1, Recipe_INVOLVES_AGENT: 1, Recipe_LOADS_SKILL: 1, Recipe_PRODUCES_ARTIFACT: 1 },
  }, null, 2) + "\n");

  const output = join(setup.root, "out", "graph.jsonl");
  const written = await execFileAsync(process.execPath, [CLI, "export-harness-graph", "--root", setup.root, "--output", output], { env: setup.env });
  expect(written).toMatchObject({ stdout: "", stderr: "" });
  expect(await readFile(output, "utf8")).toBe(graphJSONL(expectedGraph(setup.root)));
});
