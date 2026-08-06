import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";

type Obj = Record<string, unknown>;
export interface ValidationResult { errors: string[]; recipeCount: number }
const object = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const repr = (v: unknown): string => {
  if (v == null) return "None";
  if (typeof v === "string") return "'" + v.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return "[" + v.map(repr).join(", ") + "]";
  if (object(v)) return "{" + Object.entries(v).map(([k, x]) => repr(k) + ": " + repr(x)).join(", ") + "}";
  return String(v);
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
async function names(path: string, dirs: boolean, suffix = ""): Promise<string[]> {
  try { return (await readdir(path, { withFileTypes: true })).filter(e => dirs ? e.isDirectory() : e.isFile() && e.name.endsWith(suffix)).map(e => suffix ? e.name.slice(0, -suffix.length) : e.name).sort(); } catch { return []; }
}
async function loadJson(root: string, path: string, errors: string[]): Promise<unknown> {
  try { return JSON.parse(await readFile(join(root, path), "utf8")); }
  catch (e) { const code = object(e) && typeof e.code === "string" ? e.code : ""; errors.push(code === "ENOENT" ? "missing " + path : "cannot read " + path + ": " + (e instanceof Error ? e.message : String(e))); return null; }
}
export async function validateRecipeMetadata(root: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const metadata = await loadJson(root, ".specs/harness/recipe-workflow-metadata.json", errors);
  const schema = await loadJson(root, ".specs/schemas/recipe-workflow-metadata.schema.json", errors);
  if (metadata !== null && schema !== null) try {
    const Ajv = Ajv2020 as unknown as new (options: { allErrors: boolean; strict: boolean }) => { compile(schema: object | boolean): ((data: unknown) => boolean) & { errors?: import("ajv").ErrorObject[] | null } };
    const validate = new Ajv({ allErrors: true, strict: true }).compile(schema as object | boolean);
    if (!validate(metadata)) for (const e of [...(validate.errors ?? [])].sort((a, b) => a.instancePath.localeCompare(b.instancePath))) errors.push("schema " + (e.instancePath.replace(/^\//, "").replaceAll("/", ".") || "<root>") + ": " + (e.message ?? "validation failed"));
  } catch (e) { errors.push("invalid JSON Schema: " + (e instanceof Error ? e.message : String(e))); }
  let recipeCount = 0;
  if (object(metadata)) {
    const agents = metadata.agents, agentNames = await names(join(root, "src/agents"), false, ".md"), skillNames = await names(join(root, "src/skills"), true);
    if (!object(agents) || !equal(Object.keys(agents).sort(), agentNames)) errors.push("metadata agents " + repr(object(agents) ? Object.keys(agents).sort() : []) + " != active agents " + repr(agentNames));
    const entries = metadata.recipes, activeNames = await names(join(root, "src/recipes"), false, ".yaml");
    recipeCount = object(entries) ? Object.keys(entries).length : 0;
    if (!object(entries) || !equal(Object.keys(entries).sort(), activeNames)) errors.push("metadata recipes " + repr(object(entries) ? Object.keys(entries).sort() : []) + " != active recipes " + repr(activeNames));
    for (const name of activeNames) {
      const item = object(entries) ? entries[name] : undefined; if (!object(item)) continue;
      const expected = "src/recipes/" + name + ".yaml";
      if (item.source_path !== expected) errors.push(name + " source_path must be " + expected);
      let recipe: unknown; try { recipe = parseYaml(await readFile(join(root, expected), "utf8")); } catch (e) { errors.push("cannot parse " + expected + ": " + (e instanceof Error ? e.message : String(e))); continue; }
      if (!object(recipe)) { errors.push(expected + " must contain a YAML object"); continue; }
      const instructions = recipe.instructions; if (typeof instructions !== "string") { errors.push(name + " instructions must be text"); continue; }
      const marker = /^\s*##\s*AD-001 pattern:\s*(.+?)\s*$/m.exec(instructions), actual = marker?.[1] === undefined ? null : normalized(marker[1]);
      if (actual !== item.ad001_pattern) errors.push(name + " ad001_pattern " + repr(actual) + " != metadata " + repr(item.ad001_pattern));
      for (const field of ["phase", "entry_criteria", "exit_criteria"] as const) for (const d of Array.isArray(item[field]) ? item[field] : [item[field]]) if (typeof d === "string" && !instructions.includes(d)) errors.push(name + " " + field + " declaration not found in recipe: " + repr(d));
      for (const field of ["retry", "session"] as const) if (!equal(recipe[field], item[field])) errors.push(name + " " + field + " " + repr(recipe[field]) + " != metadata " + repr(item[field]));
      const ext = recipe.extensions, hasSkills = Array.isArray(ext) && ext.some(x => object(x) && x.type === "platform" && x.name === "skills");
      if (item.skills_extension_required && !hasSkills) errors.push(name + " missing required skills platform extension");
      const refs: Array<[unknown, string]> = [];
      if (Array.isArray(item.controller_skills)) for (const x of item.controller_skills) if (object(x)) refs.push([x.skill, name + " controller skill"]);
      if (Array.isArray(item.delegates)) for (const d of item.delegates) { if (!object(d)) continue; const agent = d.agent; if (typeof agent !== "string" || !agentNames.includes(agent)) errors.push(name + " delegate references unknown agent " + repr(agent)); const required = d.mandatory_skills ?? [], dec = typeof agent === "string" && object(agents) ? agents[agent] : undefined, baseline = object(dec) ? dec.mandatory_skills : undefined; if (!equal(baseline, required)) errors.push(name + " delegate " + repr(agent) + " mandatory_skills " + repr(required) + " != agent baseline " + repr(baseline)); if (Array.isArray(required)) for (const s of required) refs.push([s, name + " delegate " + repr(agent) + " skill"]); }
      for (const [skill, context] of refs) if (typeof skill !== "string" || skill.includes("/") || skill.includes("\\")) errors.push(context + " must be a name-only reference: " + repr(skill)); else if (!skillNames.includes(skill)) errors.push(context + " references unknown skill " + repr(skill));
    }
    if (object(agents)) for (const [agent, dec] of Object.entries(agents)) if (object(dec) && Array.isArray(dec.mandatory_skills)) for (const skill of dec.mandatory_skills) if (typeof skill !== "string" || skill.includes("/") || skill.includes("\\")) errors.push("agent " + repr(agent) + " skill must be a name-only reference: " + repr(skill)); else if (!skillNames.includes(skill)) errors.push("agent " + repr(agent) + " references unknown skill " + repr(skill));
  }
  return { errors, recipeCount };
}
export async function runRecipeMetadata(root: string): Promise<{ stdout: string; exitCode: 0 | 1 }> { const r = await validateRecipeMetadata(root); return r.errors.length ? { stdout: "FAIL recipe metadata\n" + r.errors.map(e => "- " + e).join("\n") + "\n", exitCode: 1 } : { stdout: "PASS recipe metadata/schema and YAML contract for " + r.recipeCount + " active recipes\n", exitCode: 0 }; }
