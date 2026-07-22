/** Pure paired measurement for eval-integrity-v2. */

export type PairExclusionReason =
  | "result_missing" | "grade_null" | "grade_non_numeric"
  | "execution_failed" | "grader_invalid" | "input_mismatch"
  | "provenance_mismatch" | "grader_mismatch" | "rubric_mismatch";

export type TerminalEvidenceStatus = "graded" | "execution_failed" | "grader_invalid";

export interface IntegrityEvidence {
  readonly kind: string;
  readonly subject: string;
  readonly evalId: number;
  readonly repetition: number;
  readonly side: "candidate" | "baseline";
  readonly taskPayloadHash: string;
  readonly fixtureHashes: Readonly<Record<string, string>>;
  readonly executionEnvelopeHash: string;
  readonly candidateTreatmentId: string;
  readonly baselineTreatmentId: string;
  readonly candidateTreatmentHash: string;
  readonly baselineTreatmentHash: string;
  readonly runProvenanceId: string;
  readonly graderId: string;
  readonly graderVersion: string;
  readonly rubricId: string;
  readonly rubricVersion: string;
  readonly terminalStatus: TerminalEvidenceStatus;
  readonly score: number | null;
}

export interface PairExclusion {
  readonly valid: false;
  readonly reason: PairExclusionReason;
}

export interface ValidPair {
  readonly valid: true;
  readonly subject: string;
  readonly candidateScore: number;
  readonly baselineScore: number;
  readonly deltaPp: number;
}

export type PairEvaluation = ValidPair | PairExclusion;

export interface CriterionOutcome {
  readonly criterionId: string;
  readonly passed: boolean;
}

export type CriterionScore =
  | { readonly valid: true; readonly score: number; readonly passed: number; readonly expected: number }
  | { readonly valid: false; readonly reason: "grader_invalid"; readonly detail: string };

export interface PairedInterval {
  readonly method: "paired_t_95pct_pp_v1";
  readonly n: number;
  readonly lower: number | null;
  readonly upper: number | null;
  readonly reason?: "insufficient_pairs";
}

export interface IntegritySummary {
  readonly meanDeltaPp: number | null;
  readonly candidateMean: number | null;
  readonly baselineMean: number | null;
  readonly n: number;
  readonly interval: PairedInterval;
}

export type SubjectFailureReason = "source_missing" | "schema_legacy_incomplete";

export interface SubjectFailure {
  readonly subject: string;
  readonly reason: SubjectFailureReason;
}

export interface IntegrityPairReport {
  readonly pairMicro: IntegritySummary;
  readonly subjectMacro: IntegritySummary;
  readonly exclusions: Readonly<Partial<Record<PairExclusionReason, number>>>;
  readonly subjectFailures: Readonly<Partial<Record<SubjectFailureReason, number>>>;
  readonly failedSubjects: readonly SubjectFailure[];
}

const sameFixtures = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  return ak.length === bk.length && ak.every((key, index) => key === bk[index] && a[key] === b[key]);
};

/** EVAL-INT-04/06/08: validate one candidate/baseline pair before calculating a delta. */
export function evaluatePair(
  candidate: IntegrityEvidence | null,
  baseline: IntegrityEvidence | null,
): PairEvaluation {
  if (candidate === null || baseline === null) return { valid: false, reason: "result_missing" };

  // The category order is contractual: input, provenance, grader, then rubric.
  if (
    !hasText(candidate.kind) || !hasText(baseline.kind)
    || !hasText(candidate.subject) || !hasText(baseline.subject)
    || !Number.isInteger(candidate.evalId) || !Number.isInteger(baseline.evalId)
    || !Number.isInteger(candidate.repetition) || !Number.isInteger(baseline.repetition)
    || !hasText(candidate.taskPayloadHash) || !hasText(baseline.taskPayloadHash)
    || candidate.fixtureHashes === null || candidate.fixtureHashes === undefined
    || baseline.fixtureHashes === null || baseline.fixtureHashes === undefined
    || !hasText(candidate.executionEnvelopeHash) || !hasText(baseline.executionEnvelopeHash)
    || candidate.kind !== baseline.kind || candidate.subject !== baseline.subject
    || candidate.evalId !== baseline.evalId || candidate.repetition !== baseline.repetition
    || candidate.taskPayloadHash !== baseline.taskPayloadHash
    || !sameFixtures(candidate.fixtureHashes, baseline.fixtureHashes)
    || candidate.executionEnvelopeHash !== baseline.executionEnvelopeHash
  ) return { valid: false, reason: "input_mismatch" };

  if (
    !hasText(candidate.candidateTreatmentId) || !hasText(baseline.candidateTreatmentId)
    || !hasText(candidate.baselineTreatmentId) || !hasText(baseline.baselineTreatmentId)
    || !hasText(candidate.candidateTreatmentHash) || !hasText(baseline.candidateTreatmentHash)
    || !hasText(candidate.baselineTreatmentHash) || !hasText(baseline.baselineTreatmentHash)
    || !hasText(candidate.runProvenanceId) || !hasText(baseline.runProvenanceId)
    || candidate.candidateTreatmentId !== baseline.candidateTreatmentId
    || candidate.baselineTreatmentId !== baseline.baselineTreatmentId
    || candidate.candidateTreatmentHash !== baseline.candidateTreatmentHash
    || candidate.baselineTreatmentHash !== baseline.baselineTreatmentHash
    || candidate.runProvenanceId !== baseline.runProvenanceId
  ) return { valid: false, reason: "provenance_mismatch" };

  if (
    !hasText(candidate.graderId) || !hasText(baseline.graderId)
    || !hasText(candidate.graderVersion) || !hasText(baseline.graderVersion)
    || candidate.graderId !== baseline.graderId || candidate.graderVersion !== baseline.graderVersion
  ) {
    return { valid: false, reason: "grader_mismatch" };
  }
  if (
    !hasText(candidate.rubricId) || !hasText(baseline.rubricId)
    || !hasText(candidate.rubricVersion) || !hasText(baseline.rubricVersion)
    || candidate.rubricId !== baseline.rubricId || candidate.rubricVersion !== baseline.rubricVersion
  ) {
    return { valid: false, reason: "rubric_mismatch" };
  }

  if (candidate.terminalStatus === "execution_failed" || baseline.terminalStatus === "execution_failed") {
    return { valid: false, reason: "execution_failed" };
  }
  if (candidate.terminalStatus === "grader_invalid" || baseline.terminalStatus === "grader_invalid") {
    return { valid: false, reason: "grader_invalid" };
  }
  if (candidate.score === null || baseline.score === null) return { valid: false, reason: "grade_null" };
  if (!Number.isFinite(candidate.score) || !Number.isFinite(baseline.score)) {
    return { valid: false, reason: "grade_non_numeric" };
  }

  return {
    valid: true,
    subject: candidate.subject,
    candidateScore: candidate.score,
    baselineScore: baseline.score,
    deltaPp: (candidate.score - baseline.score) * 100,
  };
}

/** EVAL-INT-07/15: score only a complete, unique and known criterion set. */
export function scoreCriteria(
  expectedCriterionIds: readonly string[] | null | undefined,
  outcomes: readonly CriterionOutcome[],
): CriterionScore {
  if (expectedCriterionIds === null || expectedCriterionIds === undefined) {
    return invalidCriteria("missing_expected_criteria");
  }
  if (expectedCriterionIds.length === 0) return invalidCriteria("empty_expected_criteria");
  if (new Set(expectedCriterionIds).size !== expectedCriterionIds.length) {
    return invalidCriteria("duplicate_expected_criterion");
  }
  const expected = new Set(expectedCriterionIds);
  const seen = new Set<string>();
  for (const outcome of outcomes) {
    if (!expected.has(outcome.criterionId)) return invalidCriteria("unknown_criterion");
    if (seen.has(outcome.criterionId)) return invalidCriteria("duplicate_outcome");
    seen.add(outcome.criterionId);
  }
  if (seen.size !== expected.size) return invalidCriteria("missing_criterion");
  const passed = outcomes.filter(outcome => outcome.passed).length;
  return { valid: true, score: passed / expected.size, passed, expected: expected.size };
}

function invalidCriteria(detail: string): CriterionScore {
  return { valid: false, reason: "grader_invalid", detail };
}

/** EVAL-INT-09/10/18: report pair-micro and subject-macro independently. */
export function summarizeIntegrityPairs(
  pairs: readonly ValidPair[],
  excluded: readonly PairExclusion[],
  failedSubjects: readonly SubjectFailure[] = [],
): IntegrityPairReport {
  const perSubject = new Map<string, ValidPair[]>();
  for (const pair of pairs) {
    const values = perSubject.get(pair.subject) ?? [];
    values.push(pair);
    perSubject.set(pair.subject, values);
  }
  const subjectObservations = [...perSubject.values()].map(subjectPairs => ({
    valid: true as const,
    subject: subjectPairs[0]!.subject,
    candidateScore: mean(subjectPairs.map(pair => pair.candidateScore)),
    baselineScore: mean(subjectPairs.map(pair => pair.baselineScore)),
    deltaPp: mean(subjectPairs.map(pair => pair.deltaPp)),
  }));
  const exclusions: Partial<Record<PairExclusionReason, number>> = {};
  for (const item of excluded) exclusions[item.reason] = (exclusions[item.reason] ?? 0) + 1;
  const subjectFailures: Partial<Record<SubjectFailureReason, number>> = {};
  for (const item of failedSubjects) subjectFailures[item.reason] = (subjectFailures[item.reason] ?? 0) + 1;
  return {
    pairMicro: summarize(pairs),
    subjectMacro: summarize(subjectObservations),
    exclusions,
    subjectFailures,
    failedSubjects: [...failedSubjects],
  };
}

function summarize(observations: readonly ValidPair[]): IntegritySummary {
  const deltas = observations.map(item => item.deltaPp);
  return {
    meanDeltaPp: observations.length === 0 ? null : mean(deltas),
    candidateMean: observations.length === 0 ? null : mean(observations.map(item => item.candidateScore)),
    baselineMean: observations.length === 0 ? null : mean(observations.map(item => item.baselineScore)),
    n: observations.length,
    interval: pairedTInterval(deltas),
  };
}

function pairedTInterval(values: readonly number[]): PairedInterval {
  const n = values.length;
  if (n < 2) return { method: "paired_t_95pct_pp_v1", n, lower: null, upper: null, reason: "insufficient_pairs" };
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (n - 1);
  const margin = tCritical95(n - 1) * Math.sqrt(variance) / Math.sqrt(n);
  return { method: "paired_t_95pct_pp_v1", n, lower: average - margin, upper: average + margin };
}

function tCritical95(df: number): number {
  // Deterministic inversion of the Student-t CDF; avoids df bucket approximations.
  let low = 0;
  let high = 16;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mid = (low + high) / 2;
    if (studentTCdf(mid, df) < 0.975) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function studentTCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? factor * betaFraction(x, a, b) / a
    : 1 - factor * betaFraction(1 - x, b, a) / b;
}

function betaFraction(x: number, a: number, b: number): number {
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d; result *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return result;
}

function logGamma(value: number): number {
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let sum = coefficients[0]!;
  for (let index = 1; index < coefficients.length; index += 1) sum += coefficients[index]! / (z + index);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
