import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { parseJSONL } from "./types.js";
const REPO = new URL("../../..", import.meta.url).pathname;
const MEM = join(REPO, ".knowledge", "memory.jsonl");
const ent = (n, t, o) => ({ type: "entity", name: n, entityType: t, observations: o });
const rel = (f, t, r, opts) => ({ type: "relation", from: f, to: t, relationType: r, ...(opts?.confidence && { confidence: opts.confidence }), ...(opts?.rule && { rule: opts.rule }) });
async function ok(p) { try {
    await access(p);
    return true;
}
catch {
    return false;
} }
async function scan(dir, ext) {
    try {
        return (await readdir(dir, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith(ext)).map(e => join(dir, e.name));
    }
    catch {
        return [];
    }
}
// Extract skill names from agent markdown files
async function extractAgentSkills(agentFile) {
    try {
        const content = await readFile(agentFile, "utf8");
        const skills = new Set();
        // Match patterns: "load skill <name>", "load skills <name>", "load skill: <name>", etc.
        const patterns = [
            /load skills?:?\s+`?([a-z0-9-]+)`?/gi,
            /load skills?:\s*`([a-z0-9-]+)`/gi,
        ];
        for (const pat of patterns) {
            let m;
            while ((m = pat.exec(content)) !== null) {
                const skill = m[1].toLowerCase();
                if (skill && skill !== "name" && !skill.startsWith("<"))
                    skills.add(skill);
            }
        }
        return [...skills];
    }
    catch {
        return [];
    }
}
// Extract agent and skill names from recipe yaml files
async function extractRecipeLoads(recipeFile) {
    try {
        const content = await readFile(recipeFile, "utf8");
        const agents = new Set();
        const skills = new Set();
        // Match load agent patterns
        const agentPat = /load agent:?\s+`?([a-z0-9-]+)`?/gi;
        let m;
        while ((m = agentPat.exec(content)) !== null) {
            const agent = m[1].toLowerCase();
            if (agent && !agent.startsWith("<"))
                agents.add(agent);
        }
        // Match load skill patterns
        const skillPat = /load skills?:?\s+`?([a-z0-9-]+)`?/gi;
        while ((m = skillPat.exec(content)) !== null) {
            const skill = m[1].toLowerCase();
            if (skill && skill !== "name" && !skill.startsWith("<"))
                skills.add(skill);
        }
        // Match delegate patterns: "delegate <agent>" or "Delegate to `<agent>`"
        const delegatePat = /delegate(?:\s+to)?\s+`?([a-z0-9-]+)`?/gi;
        while ((m = delegatePat.exec(content)) !== null) {
            const agent = m[1].toLowerCase();
            if (agent && !agent.startsWith("<"))
                agents.add(agent);
        }
        return { agents: [...agents], skills: [...skills] };
    }
    catch {
        return { agents: [], skills: [] };
    }
}
export async function collectBootstrapRecords(opts = {}) {
    const recs = [];
    const agentNames = [];
    const skillNames = [];
    const recipeNames = [];
    // Collect agents
    for (const f of await scan(join(REPO, ".agents", "agents"), ".md")) {
        const n = basename(f, ".md");
        agentNames.push(n);
        recs.push(ent("agent:" + n, "harness:agent", ["file:.agents/agents/" + n + ".md", "scope:buildtime", "namespace:harness"]));
    }
    // Collect skills
    try {
        for (const d of (await readdir(join(REPO, ".agents", "skills"), { withFileTypes: true })).filter(e => e.isDirectory())) {
            if (await ok(join(REPO, ".agents", "skills", d.name, "SKILL.md"))) {
                skillNames.push(d.name);
                recs.push(ent("skill:" + d.name, "harness:skill", ["file:.agents/skills/" + d.name + "/SKILL.md", "scope:buildtime", "namespace:harness"]));
            }
        }
    }
    catch { /* ignore */ }
    // Collect recipes
    for (const f of await scan(join(REPO, ".goose", "recipes"), ".yaml")) {
        const n = basename(f, ".yaml");
        recipeNames.push(n);
        recs.push(ent("recipe:" + n, "harness:recipe", ["file:.goose/recipes/" + n + ".yaml", "slash:/" + n, "scope:buildtime", "namespace:harness"]));
    }
    // Collect docs and create DESCRIBES relations based on filename patterns
    const docTopicMap = {
        "code-review": ["skill:code-review"],
        "security-review": ["recipe:security"],
        "ui-review": ["skill:ui-quality", "skill:ux-quality"],
        "test-review": ["skill:webapp-testing"],
        "spec-review": ["skill:sdd"],
        "skill-evaluations": ["harness:eval-framework"],
        "eval-analysis": ["harness:eval-framework"],
        "memory": ["skill:beads"],
        "getting-started": ["harness:onboarding"],
        "implementation-loop": ["skill:agentic-devlopment"],
        "release-readiness": ["recipe:release"],
        "documentation-review": ["recipe:doc-review"],
        "atomic-design": ["skill:atomic-design"],
        "design-system": ["skill:design-systems-arch"],
        "cognitive": ["skill:cognitive-ux"],
    };
    for (const f of await scan(join(REPO, "docs"), ".md")) {
        const docName = basename(f);
        recs.push(ent("doc:" + docName, "harness:doc", ["file:docs/" + docName, "scope:buildtime", "namespace:harness"]));
        // Add DESCRIBES relation based on filename pattern matching
        for (const [pattern, targets] of Object.entries(docTopicMap)) {
            if (docName.toLowerCase().includes(pattern.toLowerCase())) {
                for (const target of targets) {
                    if (target.startsWith("skill:") && skillNames.includes(target.slice(6))) {
                        recs.push(rel("doc:" + docName, target, "DESCRIBES", { confidence: 0.8, rule: "bootstrap:doc-topic-pattern" }));
                    }
                    else if (target.startsWith("recipe:") && recipeNames.includes(target.slice(7))) {
                        recs.push(rel("doc:" + docName, target, "DESCRIBES", { confidence: 0.8, rule: "bootstrap:doc-topic-pattern" }));
                    }
                    // For harness-level entities, just add them
                    if (target.startsWith("harness:")) {
                        recs.push(rel("doc:" + docName, target, "DESCRIBES", { confidence: 0.8, rule: "bootstrap:doc-topic-pattern" }));
                    }
                }
            }
        }
    }
    // Extract agent→skill relations dynamically
    for (const agentName of agentNames) {
        const agentFile = join(REPO, ".agents", "agents", agentName + ".md");
        const skills = await extractAgentSkills(agentFile);
        for (const skill of skills) {
            if (skillNames.includes(skill)) {
                recs.push(rel("agent:" + agentName, "skill:" + skill, "LOADS_SKILL", { confidence: 1.0, rule: "bootstrap:agent-skill-extract" }));
            }
        }
    }
    // Extract recipe→agent and recipe→skill relations dynamically
    for (const recipeName of recipeNames) {
        const recipeFile = join(REPO, ".goose", "recipes", recipeName + ".yaml");
        const { agents, skills } = await extractRecipeLoads(recipeFile);
        for (const agent of agents) {
            if (agentNames.includes(agent)) {
                recs.push(rel("recipe:" + recipeName, "agent:" + agent, "DELEGATES_TO", { confidence: 1.0, rule: "bootstrap:recipe-agent-extract" }));
            }
        }
        for (const skill of skills) {
            if (skillNames.includes(skill)) {
                recs.push(rel("recipe:" + recipeName, "skill:" + skill, "LOADS_SKILL", { confidence: 1.0, rule: "bootstrap:recipe-skill-extract" }));
            }
        }
    }
    // Add explicit mappings for recipe-conditional and direct-load skills (documented in SKILL.md)
    // These skills are used by recipes but not via "load skills X" patterns
    const conditionalSkillMappings = {
        "design": ["wcag-accessibility-audit", "design-critique-case-studies", "frontend-blueprint"],
        "verify": ["webapp-testing", "ui-quality"],
    };
    for (const [recipe, skills] of Object.entries(conditionalSkillMappings)) {
        if (recipeNames.includes(recipe)) {
            for (const skill of skills) {
                if (skillNames.includes(skill)) {
                    recs.push(rel("recipe:" + recipe, "skill:" + skill, "MAY_LOAD", { confidence: 0.9, rule: "bootstrap:conditional-skill-mapping" }));
                }
            }
        }
    }
    // Connect direct-load skills to a harness:direct-load entity
    const directLoadSkills = ["gdd", "skill-creator"];
    for (const skill of directLoadSkills) {
        if (skillNames.includes(skill)) {
            recs.push(rel("skill:" + skill, "harness:direct-load-skills", "USAGE_PATTERN", { confidence: 1.0, rule: "bootstrap:direct-load-skill" }));
        }
    }
    // Ensure the harness:direct-load-skills entity exists
    recs.push(ent("harness:direct-load-skills", "harness:category", ["description:Skills loaded directly by users, not routed via agents", "scope:buildtime"]));
    if (opts.product) {
        const EXTS = [".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs"];
        const scanProd = async (dir) => {
            try {
                for (const e of await readdir(dir, { withFileTypes: true })) {
                    const full = join(dir, e.name);
                    if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
                        await scanProd(full);
                    else if (e.isFile() && EXTS.includes(extname(e.name)))
                        recs.push(ent(full.replace(REPO + "/", ""), "code_file", ["scope:buildtime", "path:" + full.replace(REPO + "/", "")]));
                }
            }
            catch { /* ignore */ }
        };
        await scanProd(opts.product);
    }
    return recs;
}
export async function bootstrap(opts = {}) {
    const recs = await collectBootstrapRecords({ product: opts.product });
    const eE = new Set(), eR = new Set();
    const ex = await ok(MEM) ? await readFile(MEM, "utf8") : "";
    if (ex) {
        const { entities, relations } = parseJSONL(ex);
        entities.forEach((_, k) => eE.add(k));
        relations.forEach(r => eR.add(r.from + "|" + r.to + "|" + r.relationType));
    }
    const nr = recs.filter(r => r.type === "entity" ? !eE.has(r.name) : !eR.has(r.from + "|" + r.to + "|" + r.relationType));
    const additions = nr.map(r => JSON.stringify(r)).join("\n");
    const merged = ex + (additions ? additions + "\n" : "");
    if (opts.output) {
        await mkdir(dirname(opts.output), { recursive: true });
        await writeFile(opts.output, merged);
        console.log("Bootstrap output:", opts.output, "(" + merged.split("\n").filter(Boolean).length + " lines,", nr.length, "new)");
        return;
    }
    if (opts.dryRun) {
        console.log("Dry-run:", recs.length, "records,", nr.length, "new");
        return;
    }
    if (!nr.length) {
        console.log("Bootstrap: 0 new (up to date)");
        return;
    }
    await mkdir(join(REPO, ".knowledge"), { recursive: true });
    await writeFile(MEM, merged);
    console.log("Bootstrap: added", nr.length, "records");
}
