/**
 * QualityGate — tests as living documentation.
 *
 * This file documents EXACTLY when a gate passes, fails, or warns.
 * If you change the thresholds, these tests must be updated — the tests
 * ARE the specification.
 */
import { describe, it, expect } from "vitest";
import { QualityGate } from "../qualityGate.js";

describe("QualityGate", () => {
  const gate = new QualityGate();

  // ── .negativeDeltaGate() ─────────────────────────────────────────────────

  describe(".negativeDeltaGate(deltas)", () => {
    it("passes when every subject shows a positive delta", () => {
      const result = gate.negativeDeltaGate([0.5, 0.2, 0.1]);

      expect(result.status).toBe("pass");
      expect(result.details).toHaveLength(0);
    });

    it("passes when every subject is exactly zero (no regression)", () => {
      const result = gate.negativeDeltaGate([0, 0, 0]);

      expect(result.status).toBe("pass");
    });

    it("fails when any single subject shows a negative delta", () => {
      // One skill made things worse — the gate must catch it
      const result = gate.negativeDeltaGate([0.3, -0.1, 0.2]);

      expect(result.status).toBe("fail");
    });

    it("reports the count of failing subjects in the message", () => {
      const result = gate.negativeDeltaGate([-0.1, -0.2, 0.5]);

      expect(result.message).toContain("2");
    });

    it("includes each failing delta value in the details array", () => {
      const result = gate.negativeDeltaGate([-0.1, -0.2]);

      expect(result.details).toHaveLength(2);
      expect(result.details.some(d => d.includes("-0.1000"))).toBe(true);
      expect(result.details.some(d => d.includes("-0.2000"))).toBe(true);
    });

    it("passes for an empty suite (nothing to fail)", () => {
      const result = gate.negativeDeltaGate([]);

      expect(result.status).toBe("pass");
    });
  });

  // ── .efficiencyGate() ────────────────────────────────────────────────────

  describe(".efficiencyGate(meansUsed, maxTurns)", () => {
    it("passes when all subjects use less than 80% of the turn budget", () => {
      // maxTurns=10, threshold=80% → limit=8. Subjects used 3, 5, 7 turns.
      const result = gate.efficiencyGate([3, 5, 7], 10);

      expect(result.status).toBe("pass");
    });

    it("warns (not fails) when a subject exceeds the turn budget threshold", () => {
      // maxTurns=10, limit=8. Subject used 9 turns — that's 90% of budget.
      const result = gate.efficiencyGate([9], 10);

      expect(result.status).toBe("warn");
    });

    it("passes exactly at the 80% boundary (limit is exclusive)", () => {
      // maxTurns=10, limit=8. Subject used exactly 8 turns — still passing.
      const result = gate.efficiencyGate([8], 10);

      // 8 is NOT > 8, so it passes
      expect(result.status).toBe("pass");
    });

    it("reports the subject's mean turns in the details", () => {
      const result = gate.efficiencyGate([9.5], 10);

      expect(result.details[0]).toContain("9.5");
      expect(result.details[0]).toContain("10");
    });

    it("respects a custom threshold (60% instead of 80%)", () => {
      // With 60% threshold: limit = 6. Subject used 7 turns → warn.
      const result = gate.efficiencyGate([7], 10, 0.6);

      expect(result.status).toBe("warn");
      expect(result.message).toContain("60%");
    });

    it("passes for an empty suite", () => {
      const result = gate.efficiencyGate([], 8);

      expect(result.status).toBe("pass");
    });
  });
});
