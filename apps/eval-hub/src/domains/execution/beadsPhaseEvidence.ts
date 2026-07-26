import type { BeadsIssueEvidence } from "../../shared/beadsAdapter.js";
import type { SessionChainAnalysis } from "./sessionChainAnalyzer.js";
import { LOOP_PHASES, type LoopPhase, type PhaseObservation, type RunPhaseEvidence } from "./phaseComplianceChecker.js";
const stagePhase = (stage: string): LoopPhase | null => stage === "01-planner" ? "planner" : stage === "02-builder" ? "builder" : stage === "03-verifier" ? "verifier" : null;
const mentionsExactId = (text: string, id: string): boolean => text.split(/[^A-Za-z0-9._-]+/).includes(id);
/** Projects only evidence whose exact task identity is present in this run's isolated session chain. */
export function projectPhaseEvidence(chain: SessionChainAnalysis, issues: readonly BeadsIssueEvidence[]): RunPhaseEvidence {
  if (chain.status === "unavailable") return { status:"unavailable", observations:[], transitions:[], reason:"Session evidence unavailable" };
  const matches = issues.filter(i => chain.events.some(e => mentionsExactId(e.instructionsSummary ?? "", i.id)));
  if (matches.length !== 1) return { status:"unavailable", observations:[], transitions:[], reason:matches.length ? "Ambiguous Beads task identity in run evidence" : "No exact Beads task identity in run evidence" };
  const task=matches[0]!, run=task.parentId ? issues.find(i => i.id === task.parentId) : undefined;
  if (task.parentId && !run) return { status:"unavailable", observations:[], transitions:[], reason:"Task parent absent from isolated Beads evidence" };
  const session:PhaseObservation[]=chain.events.flatMap((e,ordinal)=>{const phase=stagePhase(e.stage);return phase&&e.status!=="failure"?[{phase,ordinal:ordinal+10,source:"session:"+(e.sessionId??"identity-unavailable"),...(e.sessionId?{sessionId:e.sessionId}:{}),modelTier:e.modelTier}]:[];});
  const raw=task.metadata["loop_phase_evidence"];
  const durable:PhaseObservation[]=Array.isArray(raw)?raw.flatMap((x:unknown):PhaseObservation[]=>{if(!x||typeof x!=="object")return[];const item=x as Record<string,unknown>;if(typeof item["phase"]!=="string"||!LOOP_PHASES.includes(item["phase"] as LoopPhase)||typeof item["ordinal"]!=="number")return[];return[{phase:item["phase"] as LoopPhase,ordinal:item["ordinal"],source:typeof item["source"]==="string"?item["source"]:"beads:"+task.id,...(typeof item["sessionId"]==="string"?{sessionId:item["sessionId"]}:{}),...(item["modelTier"]==="standard"||item["modelTier"]==="premium"?{modelTier:item["modelTier"]}:{})}];}):[];
  const transitionValues=[task.metadata["loop_transition"],run?.metadata["loop_transition_evidence"]].flat().filter((x):x is string=>typeof x==="string");
  const observations:PhaseObservation[]=[{phase:"trigger",ordinal:0,source:"beads:"+(run?.id??task.id)}];
  if(task.specId&&task.acceptanceCriteria)observations.push({phase:"planner",ordinal:1,source:"beads:"+task.id}); observations.push(...session,...durable);
  const transitionOrdinal=task.metadata["loop_transition_ordinal"];
  if(transitionValues.length>0&&typeof transitionOrdinal!=="number")return{status:"unavailable",observations:[],transitions:[],reason:"Transition chronology unavailable: explicit ordinal required"};
  return{status:"available",observations:observations.sort((a,b)=>a.ordinal-b.ordinal),transitions:transitionValues.map((value,i)=>({value,ordinal:(transitionOrdinal as number)+i,source:"beads:"+(i?(run?.id??task.id):task.id)}))};
}
