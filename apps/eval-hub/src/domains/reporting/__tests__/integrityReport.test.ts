/**
 * RED tests for IntegrityReport canonical DTO.
 *
 * Covers: EVAL-INT-08/09/10/13/14/16/18/20
 * Seam owner: agentic-devlopment-sur3.1
 *
 * These tests MUST FAIL before integrityReport.ts is created.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedIntegrityReportStateV2 } from "../../persistence/integrityV2Store.js";
import type { IntegrityReport } from "../integrityReport.js";
import {
  buildIntegrityReport,
  deserializeIntegrityReport,
  serializeIntegrityReport,
} from "../integrityReport.js";

// ── Golden fixture ────────────────────────────────────────────────────────────

const goldenState: NormalizedIntegrityReportStateV2 = {
  schema: "eval-integrity-v2",
  manifestHash: "abc123def456",
  pairMicro: {
    meanDeltaPp: 15.0,
    candidateMean: 0.65,
    baselineMean: 0.50,
    n: 4,
    interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: null },
  },
  subjectMacro: {
    meanDeltaPp: 12.5,
    candidateMean: 0.625,
    baselineMean: 0.50,
    n: 2,
    interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: null },
  },
  validPairCount: 4,
  includedSubjectCount: 2,
  excludedPairCounts: { grade_null: 1 },
  subjectFailureCounts: {},
};

/**
 * State with n=1 (insufficient CI) but a finite mean.
 *
 * n=1 < 2 → interval bounds must be null and reason="insufficient_pairs".
 * n=1 ≥ 1 → meanDeltaPp must be a finite number (not null).
 * validPairCount=1 is consistent with pairMicro.n=1.
 */
const insufficientState: NormalizedIntegrityReportStateV2 = {
  ...goldenState,
  pairMicro: {
    meanDeltaPp: 5.0,
    candidateMean: 0.55,
    baselineMean: 0.50,
    n: 1,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  subjectMacro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 1,
  includedSubjectCount: 0,
};

/** State where meanDeltaPp is null (no valid pairs at all) */
const nullMeanState: NormalizedIntegrityReportStateV2 = {
  ...goldenState,
  pairMicro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  subjectMacro: {
    meanDeltaPp: null,
    candidateMean: null,
    baselineMean: null,
    n: 0,
    interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
  },
  validPairCount: 0,
  includedSubjectCount: 0,
  excludedPairCounts: { grade_null: 2, execution_failed: 1 },
  subjectFailureCounts: { schema_legacy_incomplete: 1 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildIntegrityReport", () => {
  it("[EVAL-INT-20] schema field equals eval-integrity-v2", () => {
    const report: IntegrityReport = buildIntegrityReport(goldenState);
    expect(report.schema).toBe("eval-integrity-v2");
  });

  it("[EVAL-INT-14] manifestHash propagated from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.manifestHash).toBe("abc123def456");
  });

  it("[EVAL-INT-08] deltaUnit is pp", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.deltaUnit).toBe("pp");
  });

  it("[EVAL-INT-16] observedDifferencesOnly is true — no causal claim", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.observedDifferencesOnly).toBe(true);
  });

  it("[EVAL-INT-09] pairMicro.n equals state.pairMicro.n", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.n).toBe(4);
  });

  it("[EVAL-INT-09] subjectMacro.n equals state.subjectMacro.n", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.subjectMacro.n).toBe(2);
  });

  it("[EVAL-INT-09] pairMicro.meanDeltaPp equals state value", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.meanDeltaPp).toBe(15.0);
  });

  it("[EVAL-INT-09] subjectMacro.meanDeltaPp equals state value", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.subjectMacro.meanDeltaPp).toBe(12.5);
  });

  it("[EVAL-INT-10] interval method is paired_t_95pct_pp_v1", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.interval.method).toBe("paired_t_95pct_pp_v1");
    expect(report.subjectMacro.interval.method).toBe("paired_t_95pct_pp_v1");
  });

  it("[EVAL-INT-10] interval lower/upper propagated when n>=2", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.interval.lower).toBe(5.0);
    expect(report.pairMicro.interval.upper).toBe(25.0);
    expect(report.pairMicro.interval.reason).toBeNull();
  });

  it("[EVAL-INT-10] interval null and reason=insufficient_pairs when n<2", () => {
    const report = buildIntegrityReport(insufficientState);
    expect(report.pairMicro.interval.lower).toBeNull();
    expect(report.pairMicro.interval.upper).toBeNull();
    expect(report.pairMicro.interval.reason).toBe("insufficient_pairs");
  });

  it("[EVAL-INT-09] pairMicro.meanDeltaPp finite when n=1", () => {
    const report = buildIntegrityReport(insufficientState);
    expect(report.pairMicro.meanDeltaPp).toBe(5.0);
  });

  it("[EVAL-INT-18] validPairCount from state — excluded pairs not counted", () => {
    // goldenState has grade_null:1 excluded but validPairCount:4 (not 5)
    const report = buildIntegrityReport(goldenState);
    expect(report.validPairCount).toBe(4);
  });

  it("[EVAL-INT-18] includedSubjectCount from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.includedSubjectCount).toBe(2);
  });

  it("[EVAL-INT-18] excludedPairCounts preserved", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.excludedPairCounts).toEqual({ grade_null: 1 });
  });

  it("[EVAL-INT-18] subjectFailureCounts preserved", () => {
    const report = buildIntegrityReport(nullMeanState);
    expect(report.subjectFailureCounts).toEqual({ schema_legacy_incomplete: 1 });
  });

  it("[EVAL-INT-18] null meanDeltaPp stays null — no zero coercion", () => {
    const report = buildIntegrityReport(nullMeanState);
    expect(report.pairMicro.meanDeltaPp).toBeNull();
    expect(report.subjectMacro.meanDeltaPp).toBeNull();
  });

  it("[EVAL-INT-18] multiple exclusion reasons preserved independently", () => {
    const report = buildIntegrityReport(nullMeanState);
    expect(report.excludedPairCounts.grade_null).toBe(2);
    expect(report.excludedPairCounts.execution_failed).toBe(1);
  });

  it("[EVAL-INT-14] different manifestHash values produce matching reports", () => {
    const stateA = { ...goldenState, manifestHash: "hash-A" };
    const stateB = { ...goldenState, manifestHash: "hash-B" };
    const reportA = buildIntegrityReport(stateA);
    const reportB = buildIntegrityReport(stateB);
    expect(reportA.manifestHash).toBe("hash-A");
    expect(reportB.manifestHash).toBe("hash-B");
    expect(reportA.manifestHash).not.toBe(reportB.manifestHash);
  });

  it("[EVAL-INT-14] pairMicro.candidateMean propagated from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.candidateMean).toBe(0.65);
  });

  it("[EVAL-INT-14] pairMicro.baselineMean propagated from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.pairMicro.baselineMean).toBe(0.50);
  });

  it("[EVAL-INT-14] subjectMacro.candidateMean propagated from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.subjectMacro.candidateMean).toBe(0.625);
  });

  it("[EVAL-INT-14] subjectMacro.baselineMean propagated from state", () => {
    const report = buildIntegrityReport(goldenState);
    expect(report.subjectMacro.baselineMean).toBe(0.50);
  });

  it("[EVAL-INT-14] candidateMean/baselineMean are null when n=0", () => {
    const report = buildIntegrityReport(nullMeanState);
    expect(report.pairMicro.candidateMean).toBeNull();
    expect(report.pairMicro.baselineMean).toBeNull();
    expect(report.subjectMacro.candidateMean).toBeNull();
    expect(report.subjectMacro.baselineMean).toBeNull();
  });

  it("[EVAL-INT-14] candidateMean/baselineMean are finite when n=1", () => {
    const report = buildIntegrityReport(insufficientState);
    expect(report.pairMicro.candidateMean).toBe(0.55);
    expect(report.pairMicro.baselineMean).toBe(0.50);
  });
});

describe("serializeIntegrityReport", () => {
  it("[EVAL-INT-13] serialization is deterministic — same report same bytes", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes1 = serializeIntegrityReport(report);
    const bytes2 = serializeIntegrityReport(report);
    expect(bytes1).toBe(bytes2);
  });

  it("[EVAL-INT-13] serialization produces valid JSON string", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    expect(() => JSON.parse(bytes)).not.toThrow();
  });

  it("[EVAL-INT-13] serialized form contains manifestHash", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    expect(bytes).toContain("abc123def456");
  });
});

describe("deserializeIntegrityReport", () => {
  it("[EVAL-INT-13] byte-for-byte round-trip", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const restored = deserializeIntegrityReport(bytes);
    const rebytes = serializeIntegrityReport(restored);
    expect(rebytes).toBe(bytes);
  });

  it("[EVAL-INT-13] byte-for-byte round-trip — valid n=1 insufficient interval", () => {
    // insufficientState.pairMicro: n=1 (finite mean=5.0), null bounds, reason=insufficient_pairs
    // n=1 < 2 → CI bounds must be null; n=1 >= 1 → mean must be finite.
    // This verifies the intermediate case round-trips correctly through serialize/deserialize.
    const report = buildIntegrityReport(insufficientState);
    const bytes = serializeIntegrityReport(report);
    const restored = deserializeIntegrityReport(bytes);
    const rebytes = serializeIntegrityReport(restored);
    expect(rebytes).toBe(bytes);
  });

  it("[EVAL-INT-13] deserialization preserves all required fields", () => {
    const report = buildIntegrityReport(goldenState);
    const restored = deserializeIntegrityReport(serializeIntegrityReport(report));
    expect(restored.schema).toBe("eval-integrity-v2");
    expect(restored.deltaUnit).toBe("pp");
    expect(restored.observedDifferencesOnly).toBe(true);
    expect(restored.manifestHash).toBe("abc123def456");
    expect(restored.validPairCount).toBe(4);
    expect(restored.includedSubjectCount).toBe(2);
  });

  it("[EVAL-INT-13] offline — deserialize does not access provider or filesystem (pure operation)", () => {
    // If this throws, deserialization requires external resources — that violates EVAL-INT-13
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    // Must not throw even with no network, no DB, no provider
    expect(() => deserializeIntegrityReport(bytes)).not.toThrow();
  });

  it("[EVAL-INT-13] deserialize rejects invalid JSON", () => {
    expect(() => deserializeIntegrityReport("{not-valid-json")).toThrow();
  });

  it("[EVAL-INT-13] deserialize rejects missing required fields", () => {
    const partial = JSON.stringify({ schema: "eval-integrity-v2" });
    expect(() => deserializeIntegrityReport(partial)).toThrow();
  });

  it("[EVAL-INT-13] deserialize rejects wrong schema version", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const parsed = JSON.parse(bytes) as Record<string, unknown>;
    parsed["schema"] = "legacy-v1";
    expect(() => deserializeIntegrityReport(JSON.stringify(parsed))).toThrow();
  });

  it("[EVAL-INT-13] deserialize rejects wrong deltaUnit", () => {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const parsed = JSON.parse(bytes) as Record<string, unknown>;
    parsed["deltaUnit"] = "percent";
    expect(() => deserializeIntegrityReport(JSON.stringify(parsed))).toThrow();
  });

  it("[EVAL-INT-16] deserialized report still asserts observedDifferencesOnly", () => {
    const report = buildIntegrityReport(goldenState);
    const restored = deserializeIntegrityReport(serializeIntegrityReport(report));
    expect(restored.observedDifferencesOnly).toBe(true);
  });
});

// ── Exact-key schema enforcement (matches persistence assertValidReportState) ─
//
// deserializeIntegrityReport must reject objects that carry any key not in the
// canonical schema for root, summary, or interval objects.  The persistence
// layer uses hasExactKeys() for this; the DTO validator must do the same.

describe("deserializeIntegrityReport — exact-key schema enforcement", () => {
  /** Serialize golden report then apply a mutation before returning bytes. */
  function buildMutated(mutate: (obj: Record<string, unknown>) => void): string {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const obj = JSON.parse(bytes) as Record<string, unknown>;
    mutate(obj);
    return JSON.stringify(obj);
  }

  // ── Extra keys at root level ─────────────────────────────────────────────

  it("[EVAL-INT-13] rejects root object with extra unknown key", () => {
    const bytes = buildMutated(obj => { obj["unknownField"] = "injected"; });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-13] rejects root object with extra numeric key", () => {
    const bytes = buildMutated(obj => { obj["extra"] = 42; });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── Extra keys in summary objects ────────────────────────────────────────

  it("[EVAL-INT-13] rejects pairMicro with extra unknown key", () => {
    const bytes = buildMutated(obj => {
      (obj["pairMicro"] as Record<string, unknown>)["extraKey"] = 99;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-13] rejects subjectMacro with extra unknown key", () => {
    const bytes = buildMutated(obj => {
      (obj["subjectMacro"] as Record<string, unknown>)["extraKey"] = 99;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── Extra keys in interval objects ───────────────────────────────────────

  it("[EVAL-INT-10/13] rejects pairMicro.interval with extra unknown key", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      (pm["interval"] as Record<string, unknown>)["extraKey"] = "injected";
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10/13] rejects subjectMacro.interval with extra unknown key", () => {
    const bytes = buildMutated(obj => {
      const sm = obj["subjectMacro"] as Record<string, unknown>;
      (sm["interval"] as Record<string, unknown>)["extraKey"] = "injected";
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-14] rejects pairMicro missing candidateMean", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      delete pm["candidateMean"];
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-14] rejects pairMicro with extra unknown key beyond five canonical", () => {
    const bytes = buildMutated(obj => {
      (obj["pairMicro"] as Record<string, unknown>)["extraField"] = 42;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });
});

// ── Malformed-state rejection (EVAL-INT-10/18/09) ─────────────────────────────
//
// These tests verify that deserializeIntegrityReport rejects persisted reports
// whose interval bounds, n-consistency, count values, or mean nullability
// violate the invariants defined by EVAL-INT-09/10/18.
//
// Every test below MUST FAIL against an implementation that only checks
// interval.method and does not validate lower/upper/reason vs n or count values.

describe("deserializeIntegrityReport — malformed interval/counts/nullability (EVAL-INT-10/18/09)", () => {
  /** Serialize a valid golden report then apply a mutation before returning bytes. */
  function buildMutated(mutate: (obj: Record<string, unknown>) => void): string {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const obj = JSON.parse(bytes) as Record<string, unknown>;
    mutate(obj);
    return JSON.stringify(obj);
  }

  // ── interval lower/upper type ────────────────────────────────────────────

  it("[EVAL-INT-10] rejects pairMicro.interval.lower that is a string (not finite-or-null)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: "5.0", upper: 25.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects pairMicro.interval.upper that is a string (not finite-or-null)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: "25.0", reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects subjectMacro.interval.lower that is a boolean (not finite-or-null)", () => {
    const bytes = buildMutated(obj => {
      const sm = obj["subjectMacro"] as Record<string, unknown>;
      sm["interval"] = { method: "paired_t_95pct_pp_v1", lower: true, upper: 27.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── n < 2 consistency ────────────────────────────────────────────────────

  it("[EVAL-INT-10] rejects n=1 with finite lower bound (null required when n<2)", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 5.0, n: 1,
        interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: null, reason: "insufficient_pairs" },
      };
      obj["validPairCount"] = 1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n=1 with finite upper bound (null required when n<2)", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 5.0, n: 1,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: 25.0, reason: "insufficient_pairs" },
      };
      obj["validPairCount"] = 1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n=1 with reason null instead of insufficient_pairs", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 5.0, n: 1,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: null },
      };
      obj["validPairCount"] = 1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n=0 with reason null (insufficient_pairs required when n<2)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectMacro"] = {
        meanDeltaPp: null, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: null },
      };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── n >= 2 consistency ────────────────────────────────────────────────────

  it("[EVAL-INT-10] rejects n=4 with null lower bound (finite required when n>=2)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: null, upper: 25.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n=4 with null upper bound (finite required when n>=2)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: null, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n=2 with reason insufficient_pairs (must be null when n>=2)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectMacro"] = {
        meanDeltaPp: 12.5, n: 2,
        interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: "insufficient_pairs" },
      };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── count values non-negative integer ────────────────────────────────────

  it("[EVAL-INT-18] rejects excludedPairCounts entry value of -1", () => {
    const bytes = buildMutated(obj => {
      (obj["excludedPairCounts"] as Record<string, unknown>)["grade_null"] = -1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects excludedPairCounts entry value of 0.5 (non-integer)", () => {
    const bytes = buildMutated(obj => {
      (obj["excludedPairCounts"] as Record<string, unknown>)["grade_null"] = 0.5;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects subjectFailureCounts entry value of -2", () => {
    const bytes = buildMutated(obj => {
      (obj["subjectFailureCounts"] as Record<string, unknown>)["source_missing"] = -2;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── mean nullability consistency ─────────────────────────────────────────

  it("[EVAL-INT-09] rejects pairMicro.meanDeltaPp finite when n=0 (no observations to average)", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 15.0, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-09] rejects subjectMacro.meanDeltaPp finite when n=0 (no observations to average)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectMacro"] = {
        meanDeltaPp: 12.5, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-14] rejects pairMicro.candidateMean finite when n=0", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: null, candidateMean: 0.5, baselineMean: null, n: 0,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      };
      obj["validPairCount"] = 0;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-14] rejects pairMicro.baselineMean null when n=1", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 5.0, candidateMean: 0.55, baselineMean: null, n: 1,
        interval: { method: "paired_t_95pct_pp_v1", lower: null, upper: null, reason: "insufficient_pairs" },
      };
      obj["validPairCount"] = 1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });
});

// ── NormalizedIntegrityReportStateV2 persistence semantics (EVAL-INT-09/10/18) ─
//
// These tests verify that deserializeIntegrityReport aligns exactly with the
// invariants enforced by assertValidReportState in integrityV2Store.ts.
// Each MUST FAIL against an implementation that does not check these constraints.

describe("deserializeIntegrityReport — NormalizedIntegrityReportStateV2 persistence invariants", () => {
  /** Serialize golden report then apply a mutation before returning bytes. */
  function buildMutated(mutate: (obj: Record<string, unknown>) => void): string {
    const report = buildIntegrityReport(goldenState);
    const bytes = serializeIntegrityReport(report);
    const obj = JSON.parse(bytes) as Record<string, unknown>;
    mutate(obj);
    return JSON.stringify(obj);
  }

  // ── n>=1 requires a finite (non-null) mean ───────────────────────────────

  it("[EVAL-INT-09] rejects pairMicro.meanDeltaPp null when n=2 (n>=1 requires finite mean)", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: null, n: 2,
        interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: null },
      };
      obj["validPairCount"] = 2;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-09] rejects subjectMacro.meanDeltaPp null when n=2 (n>=1 requires finite mean)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectMacro"] = {
        meanDeltaPp: null, n: 2,
        interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: null },
      };
      // includedSubjectCount stays 2 — matching subjectMacro.n
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── n>=2 interval: lower<=upper, interval contains mean, reason exactly null ─

  it("[EVAL-INT-10] rejects n>=2 interval when lower > upper", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      // lower=30 > upper=10 — inverted bounds
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 30.0, upper: 10.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n>=2 interval when mean is below lower bound (mean not contained)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      // mean=15.0 but lower=20.0 — mean lies below the interval
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 20.0, upper: 25.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n>=2 interval when mean is above upper bound (mean not contained)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      // mean=15.0 but upper=10.0 — mean lies above the interval
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 10.0, reason: null };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-10] rejects n>=2 interval.reason that is any non-null string (reason must be exactly null)", () => {
    const bytes = buildMutated(obj => {
      const pm = obj["pairMicro"] as Record<string, unknown>;
      pm["interval"] = { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: "other_reason" };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── pairMicro.n must equal validPairCount ────────────────────────────────

  it("[EVAL-INT-09/18] rejects validPairCount != pairMicro.n (denominator mismatch)", () => {
    const bytes = buildMutated(obj => {
      // pairMicro.n stays 4, but validPairCount disagrees
      obj["validPairCount"] = 3;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-09/18] rejects pairMicro.n != validPairCount when pairMicro.n is smaller", () => {
    const bytes = buildMutated(obj => {
      obj["pairMicro"] = {
        meanDeltaPp: 15.0, n: 3,
        interval: { method: "paired_t_95pct_pp_v1", lower: 5.0, upper: 25.0, reason: null },
      };
      // validPairCount stays 4 — disagreement
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── subjectMacro.n must equal includedSubjectCount ───────────────────────

  it("[EVAL-INT-09/18] rejects includedSubjectCount != subjectMacro.n (denominator mismatch)", () => {
    const bytes = buildMutated(obj => {
      // subjectMacro.n stays 2, but includedSubjectCount disagrees
      obj["includedSubjectCount"] = 1;
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-09/18] rejects subjectMacro.n != includedSubjectCount when subjectMacro.n is larger", () => {
    const bytes = buildMutated(obj => {
      obj["subjectMacro"] = {
        meanDeltaPp: 12.5, n: 3,
        interval: { method: "paired_t_95pct_pp_v1", lower: -2.0, upper: 27.0, reason: null },
      };
      // includedSubjectCount stays 2 — disagreement
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── excluded pair count keys must be in the nine PairExclusionReason literals ─

  it("[EVAL-INT-18] rejects excludedPairCounts with unknown reason key", () => {
    const bytes = buildMutated(obj => {
      obj["excludedPairCounts"] = { unknown_reason: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects excludedPairCounts with subject-failure key (source_missing is not a pair reason)", () => {
    const bytes = buildMutated(obj => {
      obj["excludedPairCounts"] = { source_missing: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects excludedPairCounts with schema_legacy_incomplete key (not a pair reason)", () => {
    const bytes = buildMutated(obj => {
      obj["excludedPairCounts"] = { schema_legacy_incomplete: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  // ── subject failure count keys must be source_missing or schema_legacy_incomplete ─

  it("[EVAL-INT-18] rejects subjectFailureCounts with unknown key", () => {
    const bytes = buildMutated(obj => {
      obj["subjectFailureCounts"] = { unknown_failure: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects subjectFailureCounts with pair-exclusion key (grade_null is not a subject-failure reason)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectFailureCounts"] = { grade_null: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });

  it("[EVAL-INT-18] rejects subjectFailureCounts with pair-exclusion key (execution_failed is not a subject-failure reason)", () => {
    const bytes = buildMutated(obj => {
      obj["subjectFailureCounts"] = { execution_failed: 1 };
    });
    expect(() => deserializeIntegrityReport(bytes)).toThrow();
  });
});
