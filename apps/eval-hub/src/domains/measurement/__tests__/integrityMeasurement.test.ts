import { describe, expect, it } from "vitest";
import {
  evaluatePair,
  scoreCriteria,
  summarizeIntegrityPairs,
  type IntegrityEvidence,
  type ValidPair,
} from "../integrityMeasurement.js";

const base = (side: "candidate" | "baseline", score: number | null = side === "candidate" ? 0.75 : 0.5): IntegrityEvidence => ({
  kind: "agents", subject: "architect", evalId: 2, repetition: 0, side,
  taskPayloadHash: "task", fixtureHashes: { "input.md": "fixture" },
  executionEnvelopeHash: "execution", candidateTreatmentId: "agent_l2",
  baselineTreatmentId: "agent_l1", candidateTreatmentHash: "l2-hash",
  baselineTreatmentHash: "l1-hash", runProvenanceId: "run",
  graderId: "judge", graderVersion: "1", rubricId: "rubric", rubricVersion: "2",
  terminalStatus: "graded", score,
});

describe("eval integrity measurement", () => {
  it("[EVAL-INT-04,08] forms an exact repetition-aware pair and reports pp", () => {
    const result = evaluatePair(base("candidate"), base("baseline"));
    expect(result).toMatchObject({ valid: true, deltaPp: 25, candidateScore: 0.75, baselineScore: 0.5 });
  });

  it.each([
    ["taskPayloadHash", "other", "input_mismatch"],
    ["runProvenanceId", "other", "provenance_mismatch"],
    ["graderVersion", "other", "grader_mismatch"],
    ["rubricVersion", "other", "rubric_mismatch"],
  ] as const)("[EVAL-INT-04] maps %s mismatch deterministically", (field, value, reason) => {
    const baseline = { ...base("baseline"), [field]: value };
    expect(evaluatePair(base("candidate"), baseline)).toEqual({ valid: false, reason });
  });

  it("[EVAL-INT-04] applies mismatch precedence input, provenance, grader, rubric", () => {
    const baseline = { ...base("baseline"), taskPayloadHash: "bad", runProvenanceId: "bad", graderId: "bad", rubricId: "bad" };
    expect(evaluatePair(base("candidate"), baseline)).toEqual({ valid: false, reason: "input_mismatch" });
  });

  it.each([
    ["taskPayloadHash", "input_mismatch"],
    ["runProvenanceId", "provenance_mismatch"],
    ["graderId", "grader_mismatch"],
    ["rubricId", "rubric_mismatch"],
  ] as const)("[EVAL-INT-04] rejects %s missing from both sides", (field, reason) => {
    const candidate = { ...base("candidate"), [field]: undefined } as unknown as IntegrityEvidence;
    const baseline = { ...base("baseline"), [field]: undefined } as unknown as IntegrityEvidence;
    expect(evaluatePair(candidate, baseline)).toEqual({ valid: false, reason });
  });

  it.each([
    [null, base("baseline"), "result_missing"],
    [base("candidate", null), base("baseline"), "grade_null"],
    [{ ...base("candidate"), score: Number.NaN }, base("baseline"), "grade_non_numeric"],
    [{ ...base("candidate"), terminalStatus: "execution_failed" as const }, base("baseline"), "execution_failed"],
    [{ ...base("candidate"), terminalStatus: "grader_invalid" as const }, base("baseline"), "grader_invalid"],
  ] as const)("[EVAL-INT-06] excludes invalid evidence symmetrically", (candidate, baseline, reason) => {
    expect(evaluatePair(candidate, baseline)).toEqual({ valid: false, reason });
  });

  it("[EVAL-INT-07,15] scores the complete expected criterion set", () => {
    expect(scoreCriteria(["a", "b", "c", "d"], [
      { criterionId: "a", passed: true }, { criterionId: "b", passed: true },
      { criterionId: "c", passed: true }, { criterionId: "d", passed: false },
    ])).toEqual({ valid: true, score: 0.75, passed: 3, expected: 4 });
  });

  it("[EVAL-INT-07] rejects absent expected criteria", () => {
    expect(scoreCriteria(undefined, [])).toEqual({ valid: false, reason: "grader_invalid", detail: "missing_expected_criteria" });
  });

  it.each([
    [[], [], "empty_expected_criteria"],
    [["a", "a"], [{ criterionId: "a", passed: true }], "duplicate_expected_criterion"],
    [["a"], [{ criterionId: "x", passed: true }], "unknown_criterion"],
    [["a", "b"], [{ criterionId: "a", passed: true }], "missing_criterion"],
    [["a"], [{ criterionId: "a", passed: true }, { criterionId: "a", passed: false }], "duplicate_outcome"],
  ] as const)("[EVAL-INT-07,15] rejects invalid criterion evidence", (expected, outcomes, detail) => {
    expect(scoreCriteria(expected, outcomes)).toEqual({ valid: false, reason: "grader_invalid", detail });
  });

  it("[EVAL-INT-06,18] keeps subject failures distinct from excluded pairs", () => {
    const report = summarizeIntegrityPairs(
      [],
      [{ valid: false, reason: "grade_null" }],
      [
        { subject: "missing-recipe", reason: "source_missing" },
        { subject: "legacy-agent", reason: "schema_legacy_incomplete" },
      ],
    );
    expect(report.exclusions).toEqual({ grade_null: 1 });
    expect(report.subjectFailures).toEqual({ source_missing: 1, schema_legacy_incomplete: 1 });
    expect(report.failedSubjects).toEqual([
      { subject: "missing-recipe", reason: "source_missing" },
      { subject: "legacy-agent", reason: "schema_legacy_incomplete" },
    ]);
    expect(report.pairMicro.n).toBe(0);
    expect(report.subjectMacro.n).toBe(0);
  });

  it("[EVAL-INT-09,18] distinguishes pair-micro from subject-macro and exposes honest n", () => {
    const pairs: ValidPair[] = [
      { valid: true, subject: "a", candidateScore: 1, baselineScore: 0, deltaPp: 100 },
      { valid: true, subject: "a", candidateScore: 0, baselineScore: 0, deltaPp: 0 },
      { valid: true, subject: "b", candidateScore: 0, baselineScore: 1, deltaPp: -100 },
    ];
    const report = summarizeIntegrityPairs(pairs, [{ valid: false, reason: "grade_null" }]);
    expect(report.pairMicro).toMatchObject({ meanDeltaPp: 0, n: 3, candidateMean: 1 / 3, baselineMean: 1 / 3 });
    expect(report.subjectMacro).toMatchObject({ meanDeltaPp: -25, n: 2 });
    expect(report.exclusions).toEqual({ grade_null: 1 });
  });

  it("[EVAL-INT-10] emits insufficient_pairs for n=1", () => {
    const report = summarizeIntegrityPairs([{ valid: true, subject: "a", candidateScore: 0.6, baselineScore: 0.5, deltaPp: 10 }], []);
    expect(report.pairMicro.interval).toEqual({ method: "paired_t_95pct_pp_v1", n: 1, lower: null, upper: null, reason: "insufficient_pairs" });
  });

  it("[EVAL-INT-10] computes the hand-calculated n=2 paired t interval", () => {
    const report = summarizeIntegrityPairs([
      { valid: true, subject: "a", candidateScore: 0.6, baselineScore: 0.5, deltaPp: 10 },
      { valid: true, subject: "a", candidateScore: 0.8, baselineScore: 0.5, deltaPp: 30 },
    ], []);
    expect(report.pairMicro.interval.lower).toBeCloseTo(-107.062, 3);
    expect(report.pairMicro.interval.upper).toBeCloseTo(147.062, 3);
  });

  it("[EVAL-INT-10] handles zero variance and negative deltas", () => {
    const report = summarizeIntegrityPairs([
      { valid: true, subject: "a", candidateScore: 0.4, baselineScore: 0.5, deltaPp: -10 },
      { valid: true, subject: "b", candidateScore: 0.4, baselineScore: 0.5, deltaPp: -10 },
    ], []);
    expect(report.pairMicro.interval).toMatchObject({ lower: -10, upper: -10, n: 2 });
  });

  it("[EVAL-INT-10] uses the exact df=31 Student-t critical value", () => {
    const pairs = Array.from({ length: 32 }, (_, deltaPp) => ({
      valid: true as const, subject: "a", candidateScore: deltaPp / 100,
      baselineScore: 0, deltaPp,
    }));
    const interval = summarizeIntegrityPairs(pairs, []).pairMicro.interval;
    expect(interval.lower).toBeCloseTo(12.11785, 5);
    expect(interval.upper).toBeCloseTo(18.88215, 5);
  });
});
