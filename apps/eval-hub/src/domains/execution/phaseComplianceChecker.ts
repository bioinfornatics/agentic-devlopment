/**
 * Deterministic phase compliance checker for loop-engineering eval runs.
 *
 * Reads a SessionChainAnalysis and validates that the loop-engineering
 * phases (Planner → Builder → Verifier) were respected in the correct
 * order and with the correct agents.
 *
 * This checker is intentionally LLM-free: it produces binary, reproducible
 * verdicts from observable structural evidence in the delegation chain.
 */
import type { SessionChainAnalysis, StageEvent, LoopStage } from "./sessionChainAnalyzer.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComplianceStatus = "pass" | "fail" | "skip";
export type OverallCompliance = "pass" | "fail" | "inconclusive";

export interface PhaseRule {
  /** Stable rule identifier — never changes across versions. */
  readonly id: string;
  readonly description: string;
  readonly status: ComplianceStatus;
  /** Human-readable justification with observed evidence. */
  readonly evidence: string;
}

export interface PhaseComplianceReport {
  readonly schema: "phase-compliance-v1";
  readonly overall: OverallCompliance;
  readonly chainStatus: SessionChainAnalysis["status"];
  readonly rules: readonly PhaseRule[];
  readonly phasesObserved: readonly LoopStage[];
  readonly delegationCount: number;
}

// ── Rule helpers ──────────────────────────────────────────────────────────────

function pass(id: string, description: string, evidence: string): PhaseRule {
  return { id, description, status: "pass", evidence };
}
function fail(id: string, description: string, evidence: string): PhaseRule {
  return { id, description, status: "fail", evidence };
}
function skip(id: string, description: string, evidence: string): PhaseRule {
  return { id, description, status: "skip", evidence };
}

function firstIndex(events: readonly StageEvent[], stage: LoopStage): number {
  return events.findIndex(e => e.stage === stage);
}

function agentsOf(events: readonly StageEvent[], stage: LoopStage): string[] {
  return events
    .filter(e => e.stage === stage)
    .map(e => e.agent ?? e.recipe ?? "anonymous");
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/**
 * PC-01 — Builder phase observed.
 * At least one successful change-builder or change-builder-premium delegation.
 */
function ruleBuilderObserved(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-01";
  const desc = "Builder phase observed (change-builder or change-builder-premium delegated)";
  const builders = events.filter(e => e.stage === "02-builder" && e.status !== "failure");
  if (builders.length > 0) {
    const agents = [...new Set(builders.map(e => e.agent ?? "?"))].join(", ");
    return pass(id, desc, `${builders.length} builder delegation(s): ${agents}`);
  }
  const failed = events.filter(e => e.stage === "02-builder");
  if (failed.length > 0) {
    return fail(id, desc, `${failed.length} builder delegation(s) all failed — no successful builder observed`);
  }
  return fail(id, desc, "No builder delegation found in chain");
}

/**
 * PC-02 — Verifier phase observed.
 * At least one independent-verifier or independent-verifier-premium delegation.
 */
function ruleVerifierObserved(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-02";
  const desc = "Verifier phase observed (independent-verifier or independent-verifier-premium delegated)";
  const verifiers = events.filter(e => e.stage === "03-verifier" && e.status !== "failure");
  if (verifiers.length > 0) {
    const agents = [...new Set(verifiers.map(e => e.agent ?? "?"))].join(", ");
    return pass(id, desc, `${verifiers.length} verifier delegation(s): ${agents}`);
  }
  const failed = events.filter(e => e.stage === "03-verifier");
  if (failed.length > 0) {
    return fail(id, desc, `${failed.length} verifier delegation(s) all failed — no successful verifier observed`);
  }
  return fail(id, desc, "No verifier delegation found in chain");
}

/**
 * PC-03 — Builder precedes verifier.
 * The first builder delegation must appear before the first verifier delegation.
 */
function ruleBuilderBeforeVerifier(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-03";
  const desc = "Builder delegation precedes verifier delegation (ordering)";
  const bi = firstIndex(events, "02-builder");
  const vi = firstIndex(events, "03-verifier");
  if (bi === -1 || vi === -1) {
    return skip(id, desc, "Cannot evaluate ordering: builder or verifier absent from chain");
  }
  if (bi < vi) {
    return pass(id, desc, `Builder at position ${bi}, verifier at position ${vi}`);
  }
  return fail(id, desc, `Verifier (position ${vi}) precedes builder (position ${bi}) — phase ordering violated`);
}

/**
 * PC-04 — No verifier-before-builder inversion.
 * No verifier delegation appears before any builder delegation.
 */
function ruleNoVerifierBeforeBuilder(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-04";
  const desc = "No verifier delegation appears before any builder delegation";
  const bi = firstIndex(events, "02-builder");
  if (bi === -1) {
    return skip(id, desc, "No builder observed — cannot evaluate inversion");
  }
  const earlyVerifiers = events.slice(0, bi).filter(e => e.stage === "03-verifier");
  if (earlyVerifiers.length === 0) {
    return pass(id, desc, `No verifier delegation before builder (position ${bi})`);
  }
  return fail(id, desc, `${earlyVerifiers.length} verifier delegation(s) found before first builder — HAR inversion`);
}

/**
 * PC-05 — Premium escalation is a promotion, not a bypass.
 * If a premium agent is observed, the corresponding standard agent must also
 * have been observed earlier in the same stage (rework_count-based escalation).
 */
function rulePremiumEscalationOrdering(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-05";
  const desc = "Premium agents follow standard agents within the same stage (escalation, not bypass)";

  const premiumBuilders = events.filter(
    e => e.stage === "02-builder" && e.modelTier === "premium"
  );
  const premiumVerifiers = events.filter(
    e => e.stage === "03-verifier" && e.modelTier === "premium"
  );

  if (premiumBuilders.length === 0 && premiumVerifiers.length === 0) {
    return skip(id, desc, "No premium agents observed — rule not applicable");
  }

  const violations: string[] = [];

  if (premiumBuilders.length > 0) {
    const firstPremiumBuilderIdx = events.indexOf(premiumBuilders[0]!);
    const standardBuilderBeforePremium = events
      .slice(0, firstPremiumBuilderIdx)
      .some(e => e.stage === "02-builder" && e.modelTier === "standard");
    if (!standardBuilderBeforePremium) {
      violations.push("change-builder-premium used without prior standard change-builder");
    }
  }

  if (premiumVerifiers.length > 0) {
    const firstPremiumVerifierIdx = events.indexOf(premiumVerifiers[0]!);
    const standardVerifierBeforePremium = events
      .slice(0, firstPremiumVerifierIdx)
      .some(e => e.stage === "03-verifier" && e.modelTier === "standard");
    if (!standardVerifierBeforePremium) {
      violations.push("independent-verifier-premium used without prior standard independent-verifier");
    }
  }

  if (violations.length === 0) {
    return pass(id, desc,
      `Premium escalation observed: ${premiumBuilders.length} builder(s), ${premiumVerifiers.length} verifier(s) — all preceded by standard tier`
    );
  }
  return fail(id, desc, violations.join("; "));
}

/**
 * PC-06 — Chain is non-trivial.
 * At least one delegation was observed (the loop did actual work).
 */
function ruleChainNonEmpty(events: readonly StageEvent[]): PhaseRule {
  const id = "PC-06";
  const desc = "Delegation chain is non-empty (loop performed at least one delegation)";
  if (events.length > 0) {
    return pass(id, desc, `${events.length} delegation(s) observed`);
  }
  return fail(id, desc, "No delegations recorded — loop may not have executed or DB was not captured");
}

// ── Main checker ──────────────────────────────────────────────────────────────

export function checkPhaseCompliance(chain: SessionChainAnalysis): PhaseComplianceReport {
  if (chain.status === "unavailable") {
    const noEvidenceRule = skip(
      "PC-ALL",
      "All phase rules",
      "Sessions DB unavailable — no delegation chain to evaluate",
    );
    return {
      schema: "phase-compliance-v1",
      overall: "inconclusive",
      chainStatus: "unavailable",
      rules: [noEvidenceRule],
      phasesObserved: [],
      delegationCount: 0,
    };
  }

  const events = chain.events;
  const rules: PhaseRule[] = [
    ruleChainNonEmpty(events),
    ruleBuilderObserved(events),
    ruleVerifierObserved(events),
    ruleBuilderBeforeVerifier(events),
    ruleNoVerifierBeforeBuilder(events),
    rulePremiumEscalationOrdering(events),
  ];

  const fails  = rules.filter(r => r.status === "fail").length;
  const passes = rules.filter(r => r.status === "pass").length;
  const overall: OverallCompliance =
    fails > 0       ? "fail"         :
    passes === 0    ? "inconclusive" : "pass";

  return {
    schema: "phase-compliance-v1",
    overall,
    chainStatus: chain.status,
    rules,
    phasesObserved: [...chain.summary.stagesObserved],
    delegationCount: chain.events.length,
  };
}
