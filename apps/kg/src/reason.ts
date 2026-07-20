import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseJSONL, makeRel, makeStatus, type Entity, type Relation, type KG } from "./types.js";
const REPO = new URL("../../..", import.meta.url).pathname;
const MEM = join(REPO, ".knowledge", "memory.jsonl");
const DER = join(REPO, ".knowledge", "derived.jsonl");
const rk = (r: Relation) => r.from + "|" + r.to + "|" + r.relationType;
type Rule = (kg: KG, rs: Set<string>) => Relation[];
const R1: Rule = ({ entities, relations }) => { const v = new Set(relations.filter(r => r.relationType === "VALIDATES").map(r => r.to)); return [...entities.values()].filter(e => e.entityType === "acceptance_criterion" && !v.has(e.name)).map(e => makeStatus(e.name, "test-gap", e.name + " no VALIDATES test", "R1:ac-test-gap")); };
const R2: Rule = ({ entities, relations }) => { const v = new Set(relations.filter(r => ["REFINED_INTO", "DECOMPOSES_INTO", "HAS_CRITERION"].includes(r.relationType)).map(r => r.from)); return [...entities.values()].filter(e => e.entityType === "feature" && !v.has(e.name)).map(e => makeStatus(e.name, "not-decomposed", e.name + " no REFINED_INTO/DECOMPOSES_INTO/HAS_CRITERION", "R2:feature-not-decomposed")); };
const R3: Rule = ({ entities, relations }) => {
  // A feature is implemented if: (code_file IMPLEMENTS feature) OR (feature IMPLEMENTED_BY code_file)
  const byImplements   = new Set(relations.filter(r => r.relationType === "IMPLEMENTS").map(r => r.to));
  const byImplementedBy = new Set(relations.filter(r => r.relationType === "IMPLEMENTED_BY").map(r => r.from));
  const byImplementedIn = new Set(relations.filter(r => r.relationType === "IMPLEMENTED_IN").map(r => r.from));
  const implemented = new Set([...byImplements, ...byImplementedBy, ...byImplementedIn]);
  return [...entities.values()].filter(e => e.entityType === "feature" && !implemented.has(e.name))
    .map(e => makeStatus(e.name, "not-implemented", e.name + " no IMPLEMENTS, IMPLEMENTED_BY, or IMPLEMENTED_IN", "R3:feature-not-implemented"));
};
const R4: Rule = ({ relations }, rs) => { const out: Relation[] = []; for (const u of relations.filter(r => r.relationType === "USES_SKILL")) for (const l of relations.filter(r => r.from === u.to && ["LOADS","REFERENCED_BY"].includes(r.relationType))) { const r = makeRel(u.from, l.to, "TRANSITIVELY_USES", { confidence: 0.9, rule: "R4:transitive-skill" }); if (!rs.has(rk(r))) out.push(r); } return out; };
const R5: Rule = ({ relations }) => { const ef = new Map<string,string[]>(); relations.filter(r => r.relationType === "DECOMPOSES_INTO").forEach(r => { const a = ef.get(r.to) ?? []; a.push(r.from); ef.set(r.to, a); }); const ni = new Set(relations.filter(r => r.relationType === "HAS_STATUS" && r.status_value === "not-implemented").map(r => r.from)); const out: Relation[] = []; for (const [e, fs] of ef) if (fs.length > 0 && fs.every(f => ni.has(f))) out.push(makeStatus(e, "blocked", "All " + fs.length + " features not-implemented", "R5:epic-blocked")); return out; };

const R6: Rule = ({ entities, relations }) => {
  // Feature IMPLEMENTED_BY ≥2 code_files where one is deprecated → HAS_STATUS superseded
  const implBy = new Map<string, string[]>();
  relations.filter(r => r.relationType === "IMPLEMENTED_BY").forEach(r => {
    const arr = implBy.get(r.from) ?? []; arr.push(r.to); implBy.set(r.from, arr);
  });
  // Files with a canonical _v2 counterpart or "distinct" role are not truly deprecated
  const canonicalPaths = new Set(
    [...entities.values()]
      .filter(e => e.entityType === "code_file" && e.observations.some(o => o.includes("status: canonical")))
      .flatMap(e => e.observations.filter(o => o.startsWith("path: ")).map(o => o.slice(6)))
  );
  const deprecated = new Set(
    [...entities.values()]
      .filter(e => e.entityType === "code_file"
        && e.observations.some(o => o.includes("status: deprecated"))
        && !e.observations.some(o => o.includes("role: distinct") || o.includes("distinct-role"))
        && !canonicalPaths.has(e.name))
      .map(e => e.name)
  );
  const out: Relation[] = [];
  for (const [feature, files] of implBy) {
    const hasDep = files.some(f => deprecated.has(f));
    const hasNew = files.some(f => !deprecated.has(f));
    if (hasDep && hasNew) {
      const depFiles = files.filter(f => deprecated.has(f));
      out.push(makeStatus(feature, "has-deprecated-impl",
        depFiles.join(", ") + " deprecated — superseded by newer code_file",
        "R6:deprecated-impl-detection"));
      // Also mark each deprecated file individually
      for (const df of depFiles)
        out.push(makeStatus(df, "deprecated", "Superseded by canonical implementation in apps/", "R6:deprecated-impl-detection"));
    }
  }
  return out;
};

const dispositionRelations = new Set(["TRACKED_BY", "WAIVED_BY", "ACCEPTED_RISK", "SUPERSEDED_BY"]);
function obsDisposition(e: Entity | undefined, status?: string): { target: string; kind: string; reason: string } | undefined {
  if (status === "has-deprecated-impl") return { target: "canonical implementation", kind: "SUPERSEDED_BY", reason: "deprecated implementation status is disposed by canonical replacement" };
  if (!e) return undefined;
  const bead = e.observations.find(o => o.startsWith("beads-issue:"));
  if (bead) return { target: bead.slice("beads-issue:".length).trim(), kind: "TRACKED_BY", reason: "entity observation beads-issue" };
  const superseded = e.observations.find(o => o.startsWith("superseded_by:"));
  if (superseded) return { target: superseded.slice("superseded_by:".length).trim(), kind: "SUPERSEDED_BY", reason: "entity observation superseded_by" };
  return undefined;
}
const R7: Rule = ({ entities, relations }, rs) => {
  const out: Relation[] = [];
  for (const hs of relations.filter(r => r.relationType === "HAS_STATUS")) {
    const explicit = relations.find(r => r.from === hs.from && dispositionRelations.has(r.relationType));
    if (explicit) {
      const d = makeRel(hs.from, explicit.to, "STATUS_DISPOSED_BY", { confidence: explicit.confidence ?? 1.0, rule: "R7:status-disposition", reason: explicit.relationType + " disposition for " + hs.to, status_value: hs.status_value });
      if (!rs.has(rk(d))) out.push(d);
      continue;
    }
    const inferred = obsDisposition(entities.get(hs.from), hs.status_value);
    if (inferred) {
      const d = makeRel(hs.from, inferred.target, "STATUS_DISPOSED_BY", { confidence: 0.9, rule: "R7:status-disposition", reason: inferred.kind + " inferred from " + inferred.reason + " for " + hs.to, status_value: hs.status_value });
      if (!rs.has(rk(d))) out.push(d);
    }
  }
  return out;
};
export const RULES = [
  { name: "R1:ac-test-gap", fn: R1 },
  { name: "R2:feature-not-decomposed", fn: R2 },
  { name: "R3:feature-not-implemented", fn: R3 },
  { name: "R4:transitive-skill", fn: R4 },
  { name: "R5:epic-blocked", fn: R5 },
  { name: "R6:deprecated-impl-detection", fn: R6 },
  { name: "R7:status-disposition", fn: R7 },
];
export async function reason(opts: { dryRun?: boolean; listRules?: boolean; input?: string; output?: string } = {}) {
  if (opts.listRules) { RULES.forEach(r => console.log(r.name)); return; }
  const input = opts.input ?? MEM;
  const text = await readFile(input, "utf8").catch(() => "");
  const kg = parseJSONL(text);
  console.log("Loaded:", kg.entities.size, "entities,", kg.relations.length, "relations", "from", input);
  const all = [...kg.relations], rs = new Set(all.map(rk)), der: Relation[] = [];
  for (let i = 0; i < 10; i++) {
    const nf: Relation[] = [];
    for (const rule of RULES) for (const r of rule.fn({ entities: kg.entities, relations: all }, rs)) if (!rs.has(rk(r))) { rs.add(rk(r)); all.push(r); nf.push(r); der.push(r); }
    if (!nf.length) break;
  }
  console.log("Derived:", der.length, "facts");
  const output = opts.output ?? DER;
  if (opts.dryRun && !opts.output) { console.log("Dry-run."); return; }
  const sc: Record<string,string> = { "status:test-gap":"#fc8181","status:not-decomposed":"#f6ad55","status:not-implemented":"#fc8181","status:blocked":"#e53e3e" };
  const se = new Map<string,object>();
  der.filter(r => r.relationType === "HAS_STATUS").forEach(r => { if (!se.has(r.to)) se.set(r.to, { type:"entity", name:r.to, entityType:"derived_status", derived:true, observations:["color:" + (sc[r.to] ?? "#aaa"), "derived:true"] }); });
  await mkdir(dirname(output), { recursive: true });
  const lines = [...[...se.values()].map(e => JSON.stringify(e)), ...der.map(r => JSON.stringify(r))];
  await writeFile(output, lines.join("\n") + "\n");
  console.log("Written:", output, "(" + lines.length + " lines)");
}