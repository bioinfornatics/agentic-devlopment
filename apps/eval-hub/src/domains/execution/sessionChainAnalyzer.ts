/** Reconstruct the delegation chain from one isolated Goose sessions DB. */
import Database from "better-sqlite3";
import fs from "node:fs";
export type LoopStage = "00-trigger" | "01-planner" | "02-builder" | "03-verifier" | "unknown";
export type ModelTier = "standard" | "premium";
export interface StageEvent { readonly ts:string; readonly event:"agent_delegated"|"recipe_delegated"|"tool_call"; readonly agent?:string; readonly recipe?:string; readonly stage:LoopStage; readonly modelTier:ModelTier; readonly status:"success"|"failure"|"unknown"; readonly toolName?:string; readonly instructionsSummary?:string; /** Actual delegated child ID; never the delegating parent ID. */ readonly sessionId?:string; }
export interface SessionChainAnalysis { readonly schema:"session-chain-v1"; readonly status:"complete"|"unavailable"; readonly dbPath:string; readonly sessionsFound:number; readonly events:readonly StageEvent[]; readonly summary:{readonly totalDelegations:number;readonly agentDelegations:number;readonly recipeDelegations:number;readonly stagesObserved:readonly LoopStage[];readonly premiumEscalations:number;}; }
const AGENT_TO_STAGE:Record<string,LoopStage>={"repository-researcher":"01-planner","change-builder":"02-builder","change-builder-premium":"02-builder","independent-verifier":"03-verifier","independent-verifier-premium":"03-verifier"};
const RECIPE_TO_STAGE:Record<string,LoopStage>={research:"01-planner",implement:"02-builder",verify:"03-verifier"};
const inferStage=(s:string):LoopStage=>AGENT_TO_STAGE[s]??RECIPE_TO_STAGE[s]??"unknown";
const inferModelTier=(s:string):ModelTier=>s.includes("premium")?"premium":"standard";
interface RawBlock{type?:string;toolCall?:{status?:string;value?:{name?:string;arguments?:Record<string,unknown>}};timestamp?:string}
const parse=(raw:string):RawBlock[]=>{try{return JSON.parse(raw) as RawBlock[]}catch{return[]}};
const trim=(x:unknown):string=>typeof x==="string"?x.replace(/\s+/g," ").trim().slice(0,120):"";
const empty=(dbPath:string):SessionChainAnalysis=>({schema:"session-chain-v1",status:"unavailable",dbPath,sessionsFound:0,events:[],summary:{totalDelegations:0,agentDelegations:0,recipeDelegations:0,stagesObserved:[],premiumEscalations:0}});
interface SessionRow{id:string;name:string;description:string;session_type:string;working_dir:string;created_at:string}
interface MessageRow{session_id:string;timestamp:string;content_json:string;working_dir:string}
const epoch=(x:string):number=>Date.parse(x.endsWith("Z")?x:x.replace(" ","T")+"Z");
export function analyzeSessionChain(dbPath:string):SessionChainAnalysis{
 if(!fs.existsSync(dbPath))return empty(dbPath); let db:Database.Database;try{db=new Database(dbPath,{readonly:true})}catch{return empty(dbPath)}
 try{
  const sessions=db.prepare("SELECT id,name,description,session_type,working_dir,created_at FROM sessions").all() as SessionRow[];
  const messages=db.prepare(`SELECT m.session_id,m.timestamp,m.content_json,s.working_dir FROM messages m JOIN sessions s ON s.id=m.session_id WHERE m.role='assistant' AND m.content_json LIKE '%\"name\":\"delegate\"%' ORDER BY m.id ASC`).all() as MessageRow[];
  const children=sessions.filter(s=>s.session_type==="sub_agent"), used=new Set<string>(); const events:StageEvent[]=[];
  for(const msg of messages)for(const block of parse(msg.content_json)){if(block.type!=="toolRequest")continue;const call=block.toolCall?.value;if(call?.name!=="delegate")continue;const args=call.arguments??{},source=typeof args["source"]==="string"?args["source"]:null,instructions=trim(args["instructions"]),ts=msg.timestamp??new Date().toISOString();const status:StageEvent["status"]=block.toolCall?.status==="success"?"success":block.toolCall?.status==="error"?"failure":"unknown";
   const eligible=children.filter(c=>!used.has(c.id)&&c.id!==msg.session_id&&c.working_dir===msg.working_dir&&epoch(c.created_at)>=epoch(ts)-1000&&epoch(c.created_at)-epoch(ts)<=15000);
   const named=source?eligible.filter(c=>c.name.startsWith(source+":")||c.description.includes(source)):[];const candidates=named.length?named:eligible;const child=candidates.length===1?candidates[0]:undefined;if(child)used.add(child.id);
   if(source){const isAgent=source in AGENT_TO_STAGE,isRecipe=source in RECIPE_TO_STAGE;events.push({ts,status,instructionsSummary:instructions,event:isAgent?"agent_delegated":isRecipe?"recipe_delegated":"agent_delegated",...(isAgent||!isRecipe?{agent:source}:{recipe:source}),stage:inferStage(source),modelTier:inferModelTier(source),...(child?{sessionId:child.id}:{})});}
   else events.push({ts,status,instructionsSummary:instructions,event:"agent_delegated",stage:"unknown",modelTier:"standard",...(child?{sessionId:child.id}:{})});
  }
  const stages=[...new Set(events.map(e=>e.stage))] as LoopStage[];return{schema:"session-chain-v1",status:"complete",dbPath,sessionsFound:sessions.length,events,summary:{totalDelegations:events.length,agentDelegations:events.filter(e=>e.event==="agent_delegated").length,recipeDelegations:events.filter(e=>e.event==="recipe_delegated").length,stagesObserved:stages,premiumEscalations:events.filter(e=>e.modelTier==="premium").length}};
 }finally{db.close()}
}
