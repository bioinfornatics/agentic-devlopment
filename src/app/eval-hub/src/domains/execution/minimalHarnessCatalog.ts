import fs from "node:fs/promises";
import path from "node:path";
import { EVALS_DIR, PROJECT_ROOT } from "../../shared/paths.js";

export const STANDARD_AGENTS = ["change-builder", "error-analyzer", "independent-verifier", "repository-researcher"] as const;
export const STANDARD_RECIPES = ["implement", "loop-engineering", "research", "verify"] as const;
export const MINIMAL_HARNESS_SUBJECTS = {
  agents: STANDARD_AGENTS,
  skills: ["domain-modeling", "evidence-verification", "grill-me", "grill-with-docs", "grilling", "interface-quality", "loop-control", "output-discipline", "skill-creator", "task-framing", "ui-design", "ux-principles", "wcag-accessibility-audit"],
  recipes: STANDARD_RECIPES,
} as const;

export interface ArchitectureProtocol { readonly name:string; readonly objective:string; readonly configurations:readonly string[]; readonly controlled_variables:readonly string[]; readonly success_criteria:readonly string[]; readonly efficiency_winner:string }
export interface MinimalHarnessCatalog { readonly subjects:{readonly agents:readonly string[];readonly skills:readonly string[];readonly recipes:readonly string[]};readonly architecture:readonly ArchitectureProtocol[];readonly counts:{readonly agents:number;readonly skills:number;readonly recipes:number;readonly architecture:number;readonly total:number} }
type Kind=keyof typeof MINIMAL_HARNESS_SUBJECTS;
type Obj=Record<string,unknown>;
const object=(v:unknown):v is Obj=>typeof v==="object"&&v!==null&&!Array.isArray(v);
const names=(v:unknown):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];
async function json(file:string):Promise<unknown>{return JSON.parse(await fs.readFile(file,"utf8"));}
async function scenarios(kind:Kind,subject:string):Promise<Obj[]>{const v=await json(path.join(EVALS_DIR,kind,subject+".json"));if(!Array.isArray(v)||!v.every(object))throw new Error(kind+"/"+subject+": root must be a scenario array");return v;}
async function stems(dir:string,suffix:string):Promise<string[]>{return(await fs.readdir(dir,{withFileTypes:true})).filter(x=>suffix===""?x.isDirectory():x.isFile()&&x.name.endsWith(suffix)).map(x=>suffix===""?x.name:x.name.slice(0,-suffix.length)).sort();}
function exact(label:string,actual:readonly string[],expected:readonly string[]):void{const a=[...actual].sort(),e=[...expected].sort();if(JSON.stringify(a)!==JSON.stringify(e))throw new Error(label+" mismatch; expected="+e.join(",")+" actual="+a.join(","));}
interface LockedSkillDependency { readonly name:string; readonly dependencies:readonly string[] }
async function activeLockedSkills():Promise<LockedSkillDependency[]>{
 const lock=await json(path.join(PROJECT_ROOT,"src/harness/external-skills.lock.json"));if(!object(lock)||!Array.isArray(lock.skills))throw new Error("invalid external skill lock");
 return lock.skills.filter(object).filter(x=>x.active===true).map(x=>({name:String(x.name),dependencies:names(x.dependencies).filter(d=>d.startsWith("skill:")).map(d=>d.slice(6))}));
}
async function activeSkills():Promise<string[]>{
 const manifest=await json(path.join(PROJECT_ROOT,"src/harness/source-manifest.json"));if(!object(manifest)||!Array.isArray(manifest.components))throw new Error("invalid source manifest");
 const source=manifest.components.filter(object).filter(x=>x.kind==="skill").filter((x:any)=>x.evaluation?.required!==false).map(x=>String(x.name));
 const active=await activeLockedSkills();
 for(const {name} of active)if(!source.includes(name))throw new Error("active locked skill omitted from source manifest: "+name);
 return [...new Set(source)].sort();
}
export function validateSkillScenarioDependencies(skill:string, required:readonly string[], values:readonly RecipeScenarioDependencies[]):void {
 for(const [i,scenario] of values.entries()){const declared=scenario.skills??[];if(!declared.includes(skill))throw new Error(skill+" scenario "+i+" omits its subject skill");for(const dependency of required)if(!declared.includes(dependency))throw new Error(skill+" scenario "+i+" omits locked dependency "+dependency);}
}
export interface RecipeScenarioDependencies { readonly skills?: readonly string[]; readonly agents?: readonly string[]; readonly delegated_agents?: readonly string[] }
export const RECIPE_DEPENDENCY_CLOSURE = {
  implement: { agents: [], delegated_agents: ["change-builder"], skills: ["task-framing"] },
  "loop-engineering": { agents: [], delegated_agents: ["repository-researcher", "change-builder", "change-builder-premium", "independent-verifier", "independent-verifier-premium"], skills: ["task-framing", "evidence-verification", "loop-control"] },
  research: { agents: [], delegated_agents: ["repository-researcher"], skills: ["task-framing"] },
  verify: { agents: [], delegated_agents: ["independent-verifier"], skills: ["evidence-verification", "loop-control"] },
} as const satisfies Record<(typeof STANDARD_RECIPES)[number], RecipeScenarioDependencies>;
export function validateRecipeScenarioClosure(recipe:string, scenarios:readonly RecipeScenarioDependencies[]):void {
 const expected=RECIPE_DEPENDENCY_CLOSURE[recipe as keyof typeof RECIPE_DEPENDENCY_CLOSURE]; if(!expected)throw new Error("unknown recipe dependency contract: "+recipe);
 for(const [i,scenario] of scenarios.entries()){exact(recipe+" scenario "+i+" agents",scenario.agents??[],expected.agents);exact(recipe+" scenario "+i+" delegated_agents",scenario.delegated_agents??[],expected.delegated_agents);exact(recipe+" scenario "+i+" skills",scenario.skills??[],expected.skills);}
}
export async function validateRecipeDependencyClosures():Promise<void>{
 const activeAgents=await stems(path.join(PROJECT_ROOT,"src/agents"),".md"); const activeSkills=await stems(path.join(PROJECT_ROOT,"src/skills"),"");
 for(const recipe of STANDARD_RECIPES){const contract=RECIPE_DEPENDENCY_CLOSURE[recipe];const text=await fs.readFile(path.join(PROJECT_ROOT,"src/recipes",recipe+".yaml"),"utf8");exact(recipe+" source delegated agents",activeAgents.filter(name=>text.includes(name)),contract.delegated_agents);exact(recipe+" source required skills",activeSkills.filter(name=>text.includes(name)),contract.skills);validateRecipeScenarioClosure(recipe,await scenarios("recipes",recipe));}
}

export interface CoverageExemption {component:string;type:"premium-variant"|"unsupported-provider"|"non-behavioral";variantOf?:string;layer?:string;owner:string;reason:string;expiresAt:string}
export function validateExemptions(value:unknown,activeAgents:readonly string[],now=new Date()):CoverageExemption[]{
 if(!object(value)||!Array.isArray(value.exemptions))throw new Error("coverage exemptions must contain exemptions[]");
 const out:CoverageExemption[]=[];
 for(const raw of value.exemptions){if(!object(raw))throw new Error("invalid coverage exemption");const e=raw as unknown as CoverageExemption;
  if(!e.component||!e.owner||!e.reason||!e.expiresAt||!["premium-variant","unsupported-provider","non-behavioral"].includes(e.type))throw new Error("coverage exemption missing typed owner/reason/expiry fields");
  const expiry=new Date(e.expiresAt);if(Number.isNaN(expiry.valueOf())||expiry<=now)throw new Error("expired coverage exemption: "+e.component);
  if(e.type==="premium-variant"&&(!e.component.startsWith("agent:")||e.layer!=="L2-B"||!e.variantOf||!STANDARD_AGENTS.includes(e.variantOf as never)))throw new Error("premium variant misclassification: "+e.component);
  if(e.type==="premium-variant"&&!activeAgents.includes(e.component.slice(6)))throw new Error("premium exemption references inactive agent: "+e.component);
  const [kind,name=""]=e.component.split(":",2);
  if((kind==="agent"&&(STANDARD_AGENTS as readonly string[]).includes(name))||(kind==="skill"&&(MINIMAL_HARNESS_SUBJECTS.skills as readonly string[]).includes(name)))throw new Error("stale exemption for covered component: "+e.component);
  out.push(e);
 }
 return out;
}
export async function validateHarnessCoverage(now=new Date()):Promise<void>{
 await validateRecipeDependencyClosures();
 const expectedSkills=await activeSkills();exact("skill corpus",await stems(path.join(EVALS_DIR,"skills"),".json"),expectedSkills);
 exact("standard agent corpus",await stems(path.join(EVALS_DIR,"agents"),".json"),STANDARD_AGENTS);
 exact("recipe corpus",await stems(path.join(EVALS_DIR,"recipes"),".json"),STANDARD_RECIPES);
 const activeAgents=await stems(path.join(PROJECT_ROOT,"src/agents"),".md");const exemptions=validateExemptions(await json(path.join(EVALS_DIR,"exemptions.json")),activeAgents,now);
 const coveredAgents=new Set<string>(STANDARD_AGENTS);for(const e of exemptions)if(e.component.startsWith("agent:"))coveredAgents.add(e.component.slice(6));exact("active agent coverage",[...coveredAgents],activeAgents);
 const lockedDependencies=new Map((await activeLockedSkills()).map(skill=>[skill.name,skill.dependencies]));
 for(const skill of expectedSkills){const skillScenarios=await scenarios("skills",skill);if(skillScenarios.length<3)throw new Error("skill "+skill+" has fewer than 3 scenarios");validateSkillScenarioDependencies(skill,lockedDependencies.get(skill)??[],skillScenarios);}
 for(const agent of STANDARD_AGENTS)if((await scenarios("agents",agent)).length<4)throw new Error("standard agent "+agent+" has fewer than 4 scenarios");
}
async function countsFor(kind:Kind):Promise<number>{let total=0;for(const subject of MINIMAL_HARNESS_SUBJECTS[kind])total+=(await scenarios(kind,subject)).length;return total;}
export async function loadMinimalHarnessCatalog():Promise<MinimalHarnessCatalog>{
 await validateHarnessCoverage();
 const architectureUnknown=await json(path.join(EVALS_DIR,"benchmarks/architecture-ablation.json"));if(!Array.isArray(architectureUnknown))throw new Error("architecture benchmark root must be an array");const architecture=architectureUnknown as ArchitectureProtocol[];
 for(const item of architecture)if(!item.name||!item.objective||!Array.isArray(item.configurations)||item.configurations.length<2||!item.controlled_variables?.length||!item.success_criteria?.length||!item.efficiency_winner)throw new Error("invalid architecture protocol: "+(item.name||"unnamed"));
 const counts={agents:await countsFor("agents"),skills:await countsFor("skills"),recipes:await countsFor("recipes"),architecture:architecture.length,total:0};counts.total=counts.agents+counts.skills+counts.recipes+counts.architecture;
 return{subjects:MINIMAL_HARNESS_SUBJECTS,architecture,counts};
}