import { describe, it, expect } from "vitest";
import { checkPhaseCompliance } from "../phaseComplianceChecker.js";
import type { SessionChainAnalysis } from "../sessionChainAnalyzer.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeChain(events: SessionChainAnalysis["events"]): SessionChainAnalysis {
  const stages = [...new Set(events.map(e => e.stage))] as SessionChainAnalysis["summary"]["stagesObserved"];
  return {
    schema: "session-chain-v1",
    status: "complete",
    dbPath: "/fake/sessions.db",
    sessionsFound: 1,
    events,
    summary: {
      totalDelegations: events.length,
      agentDelegations: events.filter(e => e.event === "agent_delegated").length,
      recipeDelegations: events.filter(e => e.event === "recipe_delegated").length,
      stagesObserved: stages,
      premiumEscalations: events.filter(e => e.modelTier === "premium").length,
    },
  };
}

const unavailable: SessionChainAnalysis = {
  schema: "session-chain-v1", status: "unavailable", dbPath: "/x",
  sessionsFound: 0, events: [],
  summary: { totalDelegations: 0, agentDelegations: 0, recipeDelegations: 0, stagesObserved: [], premiumEscalations: 0 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkPhaseCompliance", () => {

  it("returns inconclusive when chain is unavailable", () => {
    const report = checkPhaseCompliance(unavailable);
    expect(report.overall).toBe("inconclusive");
    expect(report.chainStatus).toBe("unavailable");
    expect(report.rules).toHaveLength(1);
    expect(report.rules[0]!.status).toBe("skip");
  });

  it("passes for a correct Planner→Builder→Verifier chain", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "repository-researcher", stage: "01-planner", modelTier: "standard", status: "success", instructionsSummary: "explore" },
      { ts: "T2", event: "agent_delegated", agent: "change-builder",        stage: "02-builder", modelTier: "standard", status: "success", instructionsSummary: "implement" },
      { ts: "T3", event: "agent_delegated", agent: "independent-verifier",  stage: "03-verifier", modelTier: "standard", status: "success", instructionsSummary: "verify" },
    ]);
    const report = checkPhaseCompliance(chain);
    expect(report.overall).toBe("pass");
    expect(report.rules.every(r => r.status !== "fail")).toBe(true);
  });

  it("fails PC-01 when no builder observed", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "independent-verifier", stage: "03-verifier", modelTier: "standard", status: "success", instructionsSummary: "verify" },
    ]);
    const report = checkPhaseCompliance(chain);
    const pc01 = report.rules.find(r => r.id === "PC-01");
    expect(pc01?.status).toBe("fail");
    expect(report.overall).toBe("fail");
  });

  it("fails PC-02 when no verifier observed", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "change-builder", stage: "02-builder", modelTier: "standard", status: "success", instructionsSummary: "implement" },
    ]);
    const report = checkPhaseCompliance(chain);
    const pc02 = report.rules.find(r => r.id === "PC-02");
    expect(pc02?.status).toBe("fail");
  });

  it("fails PC-03 and PC-04 when verifier precedes builder", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "independent-verifier", stage: "03-verifier", modelTier: "standard", status: "success", instructionsSummary: "verify" },
      { ts: "T2", event: "agent_delegated", agent: "change-builder",       stage: "02-builder", modelTier: "standard", status: "success", instructionsSummary: "implement" },
    ]);
    const report = checkPhaseCompliance(chain);
    const pc03 = report.rules.find(r => r.id === "PC-03");
    const pc04 = report.rules.find(r => r.id === "PC-04");
    expect(pc03?.status).toBe("fail");
    expect(pc04?.status).toBe("fail");
    expect(report.overall).toBe("fail");
  });

  it("passes PC-05 when premium follows standard", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "change-builder",         stage: "02-builder", modelTier: "standard", status: "success", instructionsSummary: "implement" },
      { ts: "T2", event: "agent_delegated", agent: "independent-verifier",   stage: "03-verifier", modelTier: "standard", status: "success", instructionsSummary: "verify" },
      { ts: "T3", event: "agent_delegated", agent: "change-builder-premium", stage: "02-builder", modelTier: "premium",  status: "success", instructionsSummary: "retry" },
      { ts: "T4", event: "agent_delegated", agent: "independent-verifier-premium", stage: "03-verifier", modelTier: "premium", status: "success", instructionsSummary: "re-verify" },
    ]);
    const report = checkPhaseCompliance(chain);
    const pc05 = report.rules.find(r => r.id === "PC-05");
    expect(pc05?.status).toBe("pass");
    expect(report.overall).toBe("pass");
  });

  it("fails PC-05 when premium is used without prior standard in same stage", () => {
    const chain = makeChain([
      { ts: "T1", event: "agent_delegated", agent: "change-builder-premium", stage: "02-builder", modelTier: "premium", status: "success", instructionsSummary: "implement" },
      { ts: "T2", event: "agent_delegated", agent: "independent-verifier",   stage: "03-verifier", modelTier: "standard", status: "success", instructionsSummary: "verify" },
    ]);
    const report = checkPhaseCompliance(chain);
    const pc05 = report.rules.find(r => r.id === "PC-05");
    expect(pc05?.status).toBe("fail");
  });

  it("fails PC-06 when chain is empty", () => {
    const chain = makeChain([]);
    const report = checkPhaseCompliance(chain);
    const pc06 = report.rules.find(r => r.id === "PC-06");
    expect(pc06?.status).toBe("fail");
    expect(report.overall).toBe("fail");
  });

  it("schema is always phase-compliance-v1", () => {
    expect(checkPhaseCompliance(unavailable).schema).toBe("phase-compliance-v1");
  });
});
