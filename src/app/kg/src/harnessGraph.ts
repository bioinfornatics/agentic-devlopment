import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SKILL_RE = /load\s+skills?\s*:?\s*([a-z][a-z0-9-]+)/gi;
const AGENT_RE = /load\s+agent\s+([a-z][a-z0-9-]+)/gi;
const PHASES: Record<string, string> = {
  constitution: "Constitution", discover: "Discover", clarify: "Clarify",
  spec: "Specify", plan: "Plan", implement: "Implement", review: "Review",
  verify: "Verify", release: "Release", remember: "Memory", explore: "Explore",
  design: "Design", sdd: "LifecycleOrchestration",
};
const CONSTRAINTS = [
  "Every active Agent should have at least one responsibility.",
  "Every active Skill should be loaded by an Agent or Recipe unless justified.",
  "Every active Recipe should implement a LifecyclePhase or cross-cutting function.",
  "Every explicit relationship should include source_path and source_lines.",
];

export type GraphNode = {
  id: string; type: string; name: string; description: string;
  source_path: string | null; source_lines: number[] | null; source_kind: string;
  confidence: number; status: string; version: null; created_at: null;
  updated_at: null; tags: string[]; [key: string]: unknown;
};
export type GraphRelationship = {
  id: string; type: string; source: string; target: string; direction: "directed";
  evidence: string | null; source_path: string | null; source_lines: number[] | null;
  source_kind: string; confidence: number; status: "active"; condition: null;
  cardinality: null;
};
export interface HarnessGraph {
  schema: "harness-property-graph-v0"; root: string; nodes: GraphNode[];
  relationships: GraphRelationship[]; constraints: string[];
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
async function readLines(path: string): Promise<string[]> {
  try { return (await readFile(path, "utf8")).split(/\r?\n/); } catch { return []; }
}
function matches(pattern: RegExp, text: string): string[] {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].map(match => match[1]!).filter(Boolean);
}
function sourcePath(root: string, path?: string): string | null {
  return path ? relative(root, path).split("\\").join("/") : null;
}
function node(root: string, id: string, type: string, name: string, path?: string,
  extra: Record<string, unknown> = {}): GraphNode {
  return { id, type, name, description: "", source_path: sourcePath(root, path),
    source_lines: null, source_kind: "explicit", confidence: 1, status: "active",
    version: null, created_at: null, updated_at: null, tags: [], ...extra };
}
function relationship(root: string, type: string, source: string, target: string,
  path?: string, line?: number, confidence = 1, sourceKind = "explicit",
  evidence: string | null = null): GraphRelationship {
  return { id: `rel:${type}:${source}:${target}:${line ?? "na"}`, type, source, target,
    direction: "directed", evidence, source_path: sourcePath(root, path),
    source_lines: line ? [line] : null, source_kind: sourceKind, confidence,
    status: "active", condition: null, cardinality: null };
}
async function children(path: string) {
  try { return await readdir(path, { withFileTypes: true }); } catch { return []; }
}
const byName = <T extends { name: string }>(a: T, b: T) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
const byId = <T extends { id: string }>(a: T, b: T) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Collect the graph described by scripts/export-harness-graph.py without timestamps. */
export async function collectHarnessGraph(root: string): Promise<HarnessGraph> {
  const nodes: GraphNode[] = [];
  const relationships: GraphRelationship[] = [];
  const seen = new Set<string>();
  const add = (value: GraphNode) => { if (!seen.has(value.id)) { seen.add(value.id); nodes.push(value); } };

  for (const entry of (await children(join(root, "src/skills"))).sort(byName)) {
    const skill = join(root, "src/skills", entry.name, "SKILL.md");
    if (entry.isDirectory() && await exists(skill)) add(node(root, `skill:${entry.name}`, "Skill", entry.name, skill, { layer: "L1" }));
  }
  for (const entry of (await children(join(root, "src/agents"))).filter(e => e.isFile() && e.name.endsWith(".md")).sort(byName)) {
    const name = entry.name.slice(0, -3); const path = join(root, "src/agents", entry.name); const id = `agent:${name}`;
    add(node(root, id, "Agent", name, path, { layer: "L2" }));
    for (const [index, line] of (await readLines(path)).entries())
      for (const skill of matches(SKILL_RE, line)) relationships.push(relationship(root, "Agent_LOADS_SKILL", id, `skill:${skill}`, path, index + 1, 1, "explicit", line.trim()));
  }
  for (const entry of (await children(join(root, "src/recipes"))).filter(e => e.isFile() && e.name.endsWith(".yaml")).sort(byName)) {
    const name = entry.name.slice(0, -5); const path = join(root, "src/recipes", entry.name); const id = `recipe:${name}`;
    add(node(root, id, "Recipe", name, path, { layer: "L3" }));
    if (PHASES[name]) { const phase = PHASES[name]!; add(node(root, `phase:${phase}`, "LifecyclePhase", phase, undefined, { source_kind: "inferred", confidence: .85 })); relationships.push(relationship(root, "Recipe_IMPLEMENTS_PHASE", id, `phase:${phase}`, path, undefined, .85, "inferred")); }
    for (const [index, line] of (await readLines(path)).entries()) {
      for (const skill of matches(SKILL_RE, line)) relationships.push(relationship(root, "Recipe_LOADS_SKILL", id, `skill:${skill}`, path, index + 1, 1, "explicit", line.trim()));
      for (const agent of matches(AGENT_RE, line)) relationships.push(relationship(root, "Recipe_INVOLVES_AGENT", id, `agent:${agent}`, path, index + 1, 1, "explicit", line.trim()));
    }
  }

  const audit = join(root, ".audit/harness");
  for (const entry of (await children(audit)).filter(e => e.isFile()).sort(byName)) add(node(root, `artifact:${entry.name}`, "Artifact", entry.name, join(audit, entry.name), { layer: "Audit" }));
  const findings = join(audit, "findings-register.md");
  if (await exists(findings)) { let current: string | undefined; for (const [index, line] of (await readLines(findings)).entries()) { const match = /id:\s*(F-[A-Z]+-[0-9]+)/.exec(line); if (match) { current = `finding:${match[1]}`; add(node(root, current, "Finding", match[1]!, findings, { layer: "Audit" })); } if (current && line.includes("affected_files:")) relationships.push(relationship(root, "Finding_HAS_EVIDENCE", current, "artifact:findings-register.md", findings, index + 1, 1, "explicit", line.trim())); } }

  const state = join(root, ".specs/STATE.md");
  for (const line of await readLines(state)) { const match = /^##\s+(AD-[0-9]+)\s+—\s+(.+)/.exec(line); if (match) add(node(root, `decision:${match[1]}`, "Decision", match[1]!, state, { title: match[2] })); }

  try { const { stdout } = await execFileAsync("bd", ["list", "--json"], { cwd: root, timeout: 10_000 }); for (const bead of JSON.parse(stdout) as Array<Record<string, unknown>>) { if (!bead.id) continue; const id = String(bead.id); add(node(root, `bead:${id}`, "BeadTask", id, join(root, ".beads/issues.jsonl"), { status: bead.status ?? "active", priority: bead.priority ?? null, issue_type: bead.issue_type ?? null })); for (const dependency of (bead.dependencies ?? []) as Array<Record<string, unknown>>) if (dependency.depends_on_id) relationships.push(relationship(root, "Bead_DEPENDS_ON", `bead:${id}`, `bead:${dependency.depends_on_id}`, join(root, ".beads/issues.jsonl"), undefined, .9)); } } catch { /* Python oracle also treats Beads as optional. */ }

  const metadata = join(root, ".specs/harness/recipe-workflow-metadata.json");
  try { const recipes = (JSON.parse(await readFile(metadata, "utf8")) as { recipes?: Record<string, { entry_criteria?: string[]; exit_criteria?: string[]; artifacts?: string[] }> }).recipes ?? {}; for (const [recipe, info] of Object.entries(recipes)) { const recipeId = `recipe:${recipe}`; let index = 0; for (const gate of [...(info.entry_criteria ?? []), ...(info.exit_criteria ?? [])]) { const id = `gate:${recipe}:${++index}`; add(node(root, id, "Gate", gate, metadata, { layer: "L3" })); relationships.push(relationship(root, "Recipe_HAS_GATE", recipeId, id, metadata, undefined, .9)); } for (const artifact of info.artifacts ?? []) { const id = `artifact-type:${artifact}`; add(node(root, id, "ArtifactType", artifact, metadata, { layer: "L3" })); relationships.push(relationship(root, "Recipe_PRODUCES_ARTIFACT", recipeId, id, metadata, undefined, .9)); } } } catch { /* Optional metadata. */ }

  nodes.sort(byId); relationships.sort(byId);
  return { schema: "harness-property-graph-v0", root, nodes, relationships, constraints: CONSTRAINTS };
}

export function graphJSONL(graph: HarnessGraph): string {
  const records = [...graph.nodes.map(value => ({ record: "node", ...value })), ...graph.relationships.map(value => ({ record: "relationship", ...value }))];
  return records.map(record => JSON.stringify(record)).join("\n") + "\n";
}
export function graphSummary(graph: HarnessGraph): { nodes: Record<string, number>; relationships: Record<string, number> } {
  const count = (values: Array<{ type: string }>) => Object.fromEntries([...new Set(values.map(value => value.type))].sort().map(type => [type, values.filter(value => value.type === type).length]));
  return { nodes: count(graph.nodes), relationships: count(graph.relationships) };
}
export async function exportHarnessGraph(options: { root?: string; output?: string; summary?: boolean } = {}): Promise<HarnessGraph> {
  const defaultRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const graph = await collectHarnessGraph(options.root ?? defaultRoot);
  const text = options.summary ? JSON.stringify(graphSummary(graph), null, 2) + "\n" : graphJSONL(graph);
  if (options.output) { await mkdir(dirname(options.output), { recursive: true }); await writeFile(options.output, text); }
  else process.stdout.write(text);
  return graph;
}
