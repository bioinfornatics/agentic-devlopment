export const LOOP_PHASES = ["trigger", "planner", "builder", "verifier", "memory", "manager", "controller"] as const;
export type LoopPhase = typeof LOOP_PHASES[number];
export type ComplianceStatus = "pass" | "fail" | "skip";
export interface PhaseObservation { readonly phase: LoopPhase; readonly ordinal: number; readonly source: string; readonly sessionId?: string; readonly modelTier?: "standard" | "premium"; }
export interface TransitionObservation { readonly value: string; readonly ordinal: number; readonly source: string; }
export interface RunPhaseEvidence { readonly status: "available" | "unavailable"; readonly observations: readonly PhaseObservation[]; readonly transitions: readonly TransitionObservation[]; readonly reason?: string; }
export interface PhaseResult { readonly phase: LoopPhase; readonly ruleId: string; readonly status: ComplianceStatus; readonly evidence: string; }
export interface RuleResult { readonly id: string; readonly status: ComplianceStatus; readonly evidence: string; }
export interface PhaseComplianceReport { readonly schema: "phase-compliance-v2"; readonly overall: "pass" | "fail" | "inconclusive"; readonly evidenceStatus: RunPhaseEvidence["status"]; readonly terminalPath: "normal" | "early" | "invalid" | "unknown"; readonly phases: readonly PhaseResult[]; readonly rules: readonly RuleResult[]; }
const EARLY = new Set(["WAIT", "REJECT", "REPLAN", "ESCALATE", "ABORT"]);
const result = (phase: LoopPhase, status: ComplianceStatus, evidence: string): PhaseResult => ({ phase, ruleId: "LE-PHASE-" + String(LOOP_PHASES.indexOf(phase) + 1).padStart(2, "0"), status, evidence });
export function checkPhaseCompliance(input: RunPhaseEvidence): PhaseComplianceReport {
  if (input.status === "unavailable") return { schema: "phase-compliance-v2", overall: "inconclusive", evidenceStatus: input.status, terminalPath: "unknown", phases: LOOP_PHASES.map(p => result(p, "skip", input.reason ?? "Evidence unavailable")), rules: [] };
  const transition = input.transitions.length === 1 ? input.transitions[0]! : undefined;
  const early = !!transition && EARLY.has(transition.value);
  const terminalPath = input.transitions.length !== 1 ? "invalid" : early ? "early" : "normal";
  const planners = input.observations.filter(o => o.phase === "planner").map(o => o.ordinal);
  const transitionAfterPlanner = !!transition && planners.length > 0 && transition.ordinal > Math.max(...planners);
  const downstreamOnEarlyPath = input.observations.filter(o => (["builder", "verifier", "memory", "manager"] as const).includes(o.phase as "builder" | "verifier" | "memory" | "manager"));
  const phases = LOOP_PHASES.map(phase => {
    const seen = input.observations.filter(o => o.phase === phase);
    if (phase === "controller" && transition) return result(phase, "pass", transition.source);
    if (seen.length) return result(phase, "pass", seen.map(x => x.source).join(", "));
    if (early && transitionAfterPlanner && !["trigger", "planner", "controller"].includes(phase)) return result(phase, "skip", "Not applicable after " + transition!.value);
    return result(phase, "fail", "Required evidence missing");
  });
  const chronology = input.observations;
  const ordered = chronology.every((x, i) => i === 0 || (x.ordinal > chronology[i-1]!.ordinal && LOOP_PHASES.indexOf(x.phase) >= LOOP_PHASES.indexOf(chronology[i-1]!.phase)));
  const builders = input.observations.filter(x => x.phase === "builder"), verifiers = input.observations.filter(x => x.phase === "verifier");
  const identitiesAvailable = builders.every(b => !!b.sessionId) && verifiers.every(v => !!v.sessionId);
  const separate = builders.length > 0 && verifiers.length > 0 && identitiesAvailable && builders.every(b => verifiers.every(v => b.sessionId !== v.sessionId));
  const premiumViolations = (["builder", "verifier"] as const).flatMap(p => input.observations.filter(o => o.phase === p && o.modelTier === "premium" && !input.observations.some(s => s.phase === p && s.modelTier === "standard" && s.ordinal < o.ordinal)).map(() => p));
  const premiumObserved = input.observations.some(o => o.modelTier === "premium");
  const rules: RuleResult[] = [
    { id: "LE-ORDER-01", status: ordered ? "pass" : "fail", evidence: ordered ? "Canonical ordinal order" : "Reordered or duplicate-ordinal observations" },
    { id: "LE-IDENTITY-01", status: early ? "skip" : separate ? "pass" : "fail", evidence: early ? "Not applicable" : separate ? "Distinct delegated child identities" : identitiesAvailable ? "Reused delegated child identity" : "Delegated child identity unavailable" },
    { id: "LE-TRANSITION-01", status: input.transitions.length === 1 ? "pass" : "fail", evidence: "Observed " + input.transitions.length + " transition(s)" },
    { id: "PC-05", status: premiumViolations.length ? "fail" : premiumObserved ? "pass" : "skip", evidence: premiumViolations.length ? "Premium bypass: " + premiumViolations.join(", ") : premiumObserved ? "Premium follows standard in each stage" : "No premium agents observed" },
  ];
  if (early) rules.push(
    { id: "LE-TERMINAL-01", status: phases[0]!.status === "pass" && phases[1]!.status === "pass" && transitionAfterPlanner ? "pass" : "fail", evidence: transitionAfterPlanner ? "Explicit early terminal after Planner " + transition!.value : "Early terminal must follow Planner" },
    { id: "LE-TERMINAL-02", status: downstreamOnEarlyPath.length === 0 ? "pass" : "fail", evidence: downstreamOnEarlyPath.length === 0 ? "No downstream phase evidence on early path" : "Downstream evidence invalidates early path: " + downstreamOnEarlyPath.map(o => o.phase).join(", ") },
  );
  const overall = [...phases, ...rules].some(x => x.status === "fail") ? "fail" : "pass";
  return { schema: "phase-compliance-v2", overall, evidenceStatus: input.status, terminalPath, phases, rules };
}
