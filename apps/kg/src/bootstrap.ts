import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { parseJSONL, type Entity, type Relation } from "./types.js";
const REPO = new URL("../../..", import.meta.url).pathname;
const MEM = join(REPO, ".knowledge", "memory.jsonl");
const ent = (n: string, t: string, o: string[]): Entity => ({ type: "entity", name: n, entityType: t, observations: o });
const rel = (f: string, t: string, r: string): Relation => ({ type: "relation", from: f, to: t, relationType: r });
async function ok(p: string) { try { await access(p); return true; } catch { return false; } }
async function scan(dir: string, ext: string): Promise<string[]> {
  try { return (await readdir(dir, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith(ext)).map(e => join(dir, e.name)); }
  catch { return []; }
}
export async function bootstrap(opts: { product?: string; dryRun?: boolean } = {}) {
  const recs: (Entity | Relation)[] = [];
  for (const f of await scan(join(REPO, ".agents", "agents"), ".md")) {
    const n = basename(f, ".md");
    recs.push(ent("agent:" + n, "harness:agent", ["file:.agents/agents/" + n + ".md", "scope:buildtime", "namespace:harness"]));
  }
  try {
    for (const d of (await readdir(join(REPO, ".agents", "skills"), { withFileTypes: true })).filter(e => e.isDirectory())) {
      if (await ok(join(REPO, ".agents", "skills", d.name, "SKILL.md")))
        recs.push(ent("skill:" + d.name, "harness:skill", ["file:.agents/skills/" + d.name + "/SKILL.md", "scope:buildtime", "namespace:harness"]));
    }
  } catch { /* ignore */ }
  for (const f of await scan(join(REPO, ".goose", "recipes"), ".yaml")) {
    const n = basename(f, ".yaml");
    recs.push(ent("recipe:" + n, "harness:recipe", ["file:.goose/recipes/" + n + ".yaml", "slash:/" + n, "scope:buildtime", "namespace:harness"]));
  }
  for (const f of await scan(join(REPO, "docs"), ".md"))
    recs.push(ent("doc:" + basename(f), "harness:doc", ["file:docs/" + basename(f), "scope:buildtime", "namespace:harness"]));
  const RS: Record<string,string> = { dev:"agentic-dev-harness", review:"code-review", implement:"beads-harness", spec:"sdd", discover:"sdd", plan:"beads-harness", verify:"webapp-testing", design:"ux-quality", sdd:"sdd" };
  const RA: Record<string,string> = { review:"review-critic", implement:"implementation-worker", discover:"product-owner", spec:"architect", plan:"planner", verify:"qa-automation", design:"ux-researcher" };
  for (const [r, s] of Object.entries(RS)) recs.push(rel("recipe:" + r, "skill:" + s, "USES_SKILL"));
  for (const [r, a] of Object.entries(RA)) recs.push(rel("recipe:" + r, "agent:" + a, "DELEGATES_TO"));
  if (opts.product) {
    const EXTS = [".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs"];
    const scanProd = async (dir: string): Promise<void> => {
      try {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") await scanProd(full);
          else if (e.isFile() && EXTS.includes(extname(e.name))) recs.push(ent(full.replace(REPO + "/", ""), "code_file", ["scope:buildtime", "path:" + full.replace(REPO + "/", "")]));
        }
      } catch { /* ignore */ }
    };
    await scanProd(opts.product);
  }
  if (opts.dryRun) { console.log("Dry-run:", recs.length, "records"); return; }
  const eE = new Set<string>(), eR = new Set<string>();
  if (await ok(MEM)) {
    const { entities, relations } = parseJSONL(await readFile(MEM, "utf8"));
    entities.forEach((_, k) => eE.add(k));
    relations.forEach(r => eR.add(r.from + "|" + r.to + "|" + r.relationType));
  }
  const nr = recs.filter(r => r.type === "entity" ? !eE.has(r.name) : !eR.has((r as Relation).from + "|" + (r as Relation).to + "|" + (r as Relation).relationType));
  if (!nr.length) { console.log("Bootstrap: 0 new (up to date)"); return; }
  const ex = await ok(MEM) ? await readFile(MEM, "utf8") : "";
  await mkdir(join(REPO, ".knowledge"), { recursive: true });
  await writeFile(MEM, ex + nr.map(r => JSON.stringify(r)).join("\n") + "\n");
  console.log("Bootstrap: added", nr.length, "records");
}