import { describe, expect, it } from "vitest";
import { loadMinimalHarnessCatalog } from "../minimalHarnessCatalog.js";

describe("minimal harness 53-protocol catalog", () => {
  it("contains exactly 12 agent, 21 skill, 14 recipe, and 6 architecture protocols", async () => {
    const catalog = await loadMinimalHarnessCatalog();
    expect(catalog.counts).toEqual({ agents: 12, skills: 21, recipes: 14, architecture: 6, total: 53 });
    expect(catalog.subjects).toEqual({
      agents: ["change-builder", "error-analyzer", "independent-verifier", "repository-researcher"],
      skills: ["evidence-verification", "interface-quality", "loop-control", "task-framing", "ui-design", "ux-principles", "wcag-accessibility-audit"],
      recipes: ["implement", "loop-engineering", "research", "verify"],
    });
  });

  it("includes controlled minimal/full/no-harness, skill ablation and agent ablation protocols", async () => {
    const catalog = await loadMinimalHarnessCatalog();
    const byName = new Map(catalog.architecture.map(item => [item.name, item]));
    expect(byName.get("minimal-vs-full-simple-change")?.configurations).toEqual([
      "minimal_3a_3s_4r", "full_13a_17s_13r", "no_harness",
    ]);
    expect(byName.get("skill-ablation")?.configurations).toEqual([
      "all_3_skills", "without_task_framing", "without_evidence_verification", "without_loop_control",
    ]);
    expect(byName.get("agent-ablation")?.configurations).toEqual([
      "all_3_agents", "single_general_agent", "builder_plus_verifier", "researcher_plus_builder",
    ]);
    for (const protocol of catalog.architecture) {
      expect(protocol.controlled_variables.length).toBeGreaterThan(0);
      expect(protocol.success_criteria.length).toBeGreaterThan(0);
    }
  });
});
