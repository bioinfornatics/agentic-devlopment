import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseJSONL, makeRel, makeStatus } from "./types.js";
const REPO = new URL("../../..", import.meta.url).pathname;
const MEM = join(REPO, ".knowledge", "memory.jsonl");
const DER = join(REPO, ".knowledge", "derived.jsonl");
const rk = (r) => r.from + "|" + r.to + "|" + r.relationType;
const R1 = ({ entities, relations }) => { const v = new Set(relations.filter(r => r.relationType === "VALIDATES").map(r => r.to)); return [...entities.values()].filter(e => e.entityType === "acceptance_criterion" && !v.has(e.name)).map(e => makeStatus(e.name, "test-gap", e.name + " no VALIDATES test", "R1:ac-test-gap")); };
const R2 = ({ entities, relations }) => { const v = new Set(relations.filter(r => r.relationType === "REFINED_INTO").map(r => r.from)); return [...entities.values()].filter(e => e.entityType === "feature" && !v.has(e.name)).map(e => makeStatus(e.name, "not-decomposed", e.name + " no REFINED_INTO", "R2:feature-not-decomposed")); };
const R3 = ({ entities, relations }) => { const v = new Set(relations.filter(r => r.relationType === "IMPLEMENTS").map(r => r.to)); return [...entities.values()].filter(e => e.entityType === "feature" && !v.has(e.name)).map(e => makeStatus(e.name, "not-implemented", e.name + " no IMPLEMENTS", "R3:feature-not-implemented")); };
const R4 = ({ relations }, rs) => { const out = []; for (const u of relations.filter(r => r.relationType === "USES_SKILL"))
    for (const l of relations.filter(r => r.from === u.to && ["LOADS", "REFERENCED_BY"].includes(r.relationType))) {
        const r = makeRel(u.from, l.to, "TRANSITIVELY_USES", { confidence: 0.9, rule: "R4:transitive-skill" });
        if (!rs.has(rk(r)))
            out.push(r);
    } return out; };
const R5 = ({ relations }) => { const ef = new Map(); relations.filter(r => r.relationType === "DECOMPOSES_INTO").forEach(r => { const a = ef.get(r.to) ?? []; a.push(r.from); ef.set(r.to, a); }); const ni = new Set(relations.filter(r => r.relationType === "HAS_STATUS" && r.status_value === "not-implemented").map(r => r.from)); const out = []; for (const [e, fs] of ef)
    if (fs.length > 0 && fs.every(f => ni.has(f)))
        out.push(makeStatus(e, "blocked", "All " + fs.length + " features not-implemented", "R5:epic-blocked")); return out; };
export const RULES = [
    { name: "R1:ac-test-gap", fn: R1 },
    { name: "R2:feature-not-decomposed", fn: R2 },
    { name: "R3:feature-not-implemented", fn: R3 },
    { name: "R4:transitive-skill", fn: R4 },
    { name: "R5:epic-blocked", fn: R5 },
];
export async function reason(opts = {}) {
    if (opts.listRules) {
        RULES.forEach(r => console.log(r.name));
        return;
    }
    const text = await readFile(MEM, "utf8").catch(() => "");
    const kg = parseJSONL(text);
    console.log("Loaded:", kg.entities.size, "entities,", kg.relations.length, "relations");
    const all = [...kg.relations], rs = new Set(all.map(rk)), der = [];
    for (let i = 0; i < 10; i++) {
        const nf = [];
        for (const rule of RULES)
            for (const r of rule.fn({ entities: kg.entities, relations: all }, rs))
                if (!rs.has(rk(r))) {
                    rs.add(rk(r));
                    all.push(r);
                    nf.push(r);
                    der.push(r);
                }
        if (!nf.length)
            break;
    }
    console.log("Derived:", der.length, "facts");
    if (opts.dryRun) {
        console.log("Dry-run.");
        return;
    }
    const sc = { "status:test-gap": "#fc8181", "status:not-decomposed": "#f6ad55", "status:not-implemented": "#fc8181", "status:blocked": "#e53e3e" };
    const se = new Map();
    der.filter(r => r.relationType === "HAS_STATUS").forEach(r => { if (!se.has(r.to))
        se.set(r.to, { type: "entity", name: r.to, entityType: "derived_status", derived: true, observations: ["color:" + (sc[r.to] ?? "#aaa"), "derived:true"] }); });
    await mkdir(join(REPO, ".knowledge"), { recursive: true });
    const lines = [...[...se.values()].map(e => JSON.stringify(e)), ...der.map(r => JSON.stringify(r))];
    await writeFile(DER, lines.join("\n") + "\n");
    console.log("Written:", DER, "(" + lines.length + " lines)");
}
