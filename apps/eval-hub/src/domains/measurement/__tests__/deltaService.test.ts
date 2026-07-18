/**
 * DeltaService — tests as living documentation.
 *
 * Reading this file tells you the FULL CONTRACT of DeltaService:
 *   • how pass rate is computed from grading records
 *   • what "delta" means (candidate minus baseline)
 *   • how layer-level averages work
 *   • edge cases that are explicitly guaranteed
 */
import { describe, it, expect } from "vitest";
import { DeltaService } from "../deltaService.js";
import type { GradingRecord } from "../../persistence/ports.js";

// ── Fixture factory — inline, explicit, no hidden globals ────────────────────

function grading(
  evalId: number,
  config: string,
  passed: boolean,
  score = passed ? 1 : 0,
): GradingRecord {
  return { evalId, config, run: 1, passed, score };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("DeltaService", () => {
  const svc = new DeltaService();

  // ── .passRate() ──────────────────────────────────────────────────────────

  describe(".passRate(gradings, config)", () => {
    it("returns mean=1.0 and n=3 when all three scenarios pass", () => {
      const gradings = [
        grading(0, "with_skill", true),
        grading(1, "with_skill", true),
        grading(2, "with_skill", true),
      ];

      const result = svc.passRate(gradings, "with_skill");

      expect(result.mean).toBe(1);
      expect(result.n).toBe(3);
      expect(result.samples).toEqual([1, 1, 1]);
    });

    it("returns mean=0.0 when all scenarios fail", () => {
      const gradings = [
        grading(0, "without_skill", false),
        grading(1, "without_skill", false),
      ];

      const result = svc.passRate(gradings, "without_skill");

      expect(result.mean).toBe(0);
      expect(result.n).toBe(2);
    });

    it("returns mean=0.6 for 3 passing out of 5 scenarios", () => {
      const gradings = [
        grading(0, "with_skill", true),
        grading(1, "with_skill", false),
        grading(2, "with_skill", true),
        grading(3, "with_skill", false),
        grading(4, "with_skill", true),
      ];

      const result = svc.passRate(gradings, "with_skill");

      expect(result.mean).toBeCloseTo(0.6, 10);
      expect(result.n).toBe(5);
    });

    it("ignores gradings that belong to a different config", () => {
      const gradings = [
        grading(0, "with_skill",    true),
        grading(0, "without_skill", false),
        grading(1, "with_skill",    true),
        grading(1, "without_skill", false),
      ];

      const withResult    = svc.passRate(gradings, "with_skill");
      const withoutResult = svc.passRate(gradings, "without_skill");

      expect(withResult.mean).toBe(1);
      expect(withResult.n).toBe(2);
      expect(withoutResult.mean).toBe(0);
      expect(withoutResult.n).toBe(2);
    });

    it("returns mean=0 and n=0 when no gradings exist for the requested config", () => {
      const result = svc.passRate([], "with_skill");

      expect(result.mean).toBe(0);
      expect(result.n).toBe(0);
      expect(result.samples).toEqual([]);
    });
  });

  // ── .delta() ─────────────────────────────────────────────────────────────

  describe(".delta(candidate, baseline)", () => {
    it("returns positive passRate delta when candidate outperforms baseline", () => {
      // Skill improves pass rate from 40% → 80%: delta should be +0.4
      const candidate = { mean: 0.8, samples: [1, 1, 0, 1, 1], n: 5 };
      const baseline  = { mean: 0.4, samples: [0, 1, 0, 0, 1], n: 5 };

      const result = svc.delta(candidate, baseline);

      expect(result.passRate).toBeCloseTo(0.4, 10);
    });

    it("returns negative passRate delta when baseline outperforms candidate", () => {
      // Skill actually hurts performance: without_skill passes more
      const candidate = { mean: 0.2, samples: [0, 0, 1, 0], n: 4 };
      const baseline  = { mean: 0.75, samples: [1, 1, 0, 1], n: 4 };

      const result = svc.delta(candidate, baseline);

      expect(result.passRate).toBeCloseTo(-0.55, 10);
    });

    it("returns exactly 0.0 when both configs perform identically", () => {
      const both = { mean: 0.5, samples: [0, 1], n: 2 };

      const result = svc.delta(both, both);

      expect(result.passRate).toBe(0);
    });

    it("returns 0.0 delta when both configs have zero samples (not yet evaluated)", () => {
      const empty = { mean: 0, samples: [], n: 0 };

      const result = svc.delta(empty, empty);

      expect(result.passRate).toBe(0);
    });

    it("sets turnsUsed and maxTurnsReached to null (enrichment is a separate concern)", () => {
      const stats = { mean: 0.5, samples: [0, 1], n: 2 };

      const result = svc.delta(stats, stats);

      expect(result.turnsUsed).toBeNull();
      expect(result.maxTurnsReached).toBeNull();
    });
  });

  // ── .layerAvgDelta() ─────────────────────────────────────────────────────

  describe(".layerAvgDelta(perSubjectDeltas)", () => {
    it("returns 0 for an empty layer (no subjects evaluated)", () => {
      expect(svc.layerAvgDelta([])).toBe(0);
    });

    it("returns the single delta unchanged for a one-subject layer", () => {
      expect(svc.layerAvgDelta([0.25])).toBe(0.25);
    });

    it("returns arithmetic mean across all subjects", () => {
      // 3 skills: +0.6, +0.4, +0.2 → mean = 0.4
      const result = svc.layerAvgDelta([0.6, 0.4, 0.2]);
      expect(result).toBeCloseTo(0.4, 10);
    });

    it("returns negative mean when most subjects regress", () => {
      const result = svc.layerAvgDelta([-0.3, -0.1, +0.1]);
      expect(result).toBeCloseTo(-0.1, 10);
    });
  });

  // ── DeltaService.format() ─────────────────────────────────────────────────

  describe("DeltaService.format(delta) [static]", () => {
    it("prefixes positive deltas with a + sign", () => {
      expect(DeltaService.format(0.1234)).toBe("+0.1234");
    });

    it("prefixes zero with a + sign (non-negative)", () => {
      expect(DeltaService.format(0)).toBe("+0.0000");
    });

    it("does not add a sign prefix to negative deltas (they already have −)", () => {
      expect(DeltaService.format(-0.05)).toBe("-0.0500");
    });
  });
});
