/**
 * Canonical DTO for normalized integrity reports.
 *
 * Covers: EVAL-INT-08/09/10/13/14/16/18/20
 * Seam owner: agentic-devlopment-sur3.1
 *
 * Pure module — no filesystem, no network, no provider access.
 * Provides:
 *   buildIntegrityReport   — maps NormalizedIntegrityReportStateV2 → IntegrityReport
 *   serializeIntegrityReport   — deterministic sorted-key JSON (byte-for-byte stable)
 *   deserializeIntegrityReport — validates and rehydrates from bytes
 */

import type {
  IntegrityIntervalV2,
  NormalizedIntegrityReportStateV2,
  PairExclusionReason,
  SubjectFailureReason,
} from "../persistence/integrityV2Store.js";

export const INTEGRITY_SCHEMA_V2 = "eval-integrity-v2" as const;

// ── Canonical reason-key sets (mirror integrityV2Store.ts — kept local to stay pure) ─

const PAIR_EXCLUSION_REASONS = new Set<PairExclusionReason>([
  "result_missing",
  "grade_null",
  "grade_non_numeric",
  "execution_failed",
  "grader_invalid",
  "input_mismatch",
  "provenance_mismatch",
  "grader_mismatch",
  "rubric_mismatch",
]);

const SUBJECT_FAILURE_REASONS = new Set<SubjectFailureReason>([
  "source_missing",
  "schema_legacy_incomplete",
]);

// ── Canonical key sets (must match persistence assertValidReportState exactly) ─

/** Exact keys permitted at the IntegrityReport root object. */
const ROOT_KEYS = [
  "deltaUnit",
  "excludedPairCounts",
  "includedSubjectCount",
  "manifestHash",
  "observedDifferencesOnly",
  "pairMicro",
  "schema",
  "subjectFailureCounts",
  "subjectMacro",
  "validPairCount",
] as const;

/** Exact keys permitted in a pairMicro / subjectMacro summary object. */
const SUMMARY_KEYS = ["baselineMean", "candidateMean", "interval", "meanDeltaPp", "n"] as const;

/** Exact keys permitted in an IntegrityIntervalV2 object. */
const INTERVAL_KEYS = ["lower", "method", "reason", "upper"] as const;

// ── Canonical DTO ─────────────────────────────────────────────────────────────

export interface IntegrityReport {
  /** Schema sentinel — always "eval-integrity-v2". EVAL-INT-20 */
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  /** Manifest hash from the originating run. EVAL-INT-14 */
  readonly manifestHash: string;
  /** Delta unit — always "pp" (percentage points). EVAL-INT-08 */
  readonly deltaUnit: "pp";
  /** Causal-claim guard — always true; reports describe observed differences only. EVAL-INT-16 */
  readonly observedDifferencesOnly: true;
  /** Pair-micro summary: mean of all valid pair deltas with denominator. EVAL-INT-09 */
  readonly pairMicro: {
    readonly meanDeltaPp: number | null;
    readonly candidateMean: number | null;
    readonly baselineMean: number | null;
    readonly n: number;
    readonly interval: IntegrityIntervalV2;
  };
  /** Subject-macro summary: mean of per-subject mean deltas with denominator. EVAL-INT-09 */
  readonly subjectMacro: {
    readonly meanDeltaPp: number | null;
    readonly candidateMean: number | null;
    readonly baselineMean: number | null;
    readonly n: number;
    readonly interval: IntegrityIntervalV2;
  };
  /** Count of valid (included) pairs. EVAL-INT-18 */
  readonly validPairCount: number;
  /** Count of included subjects. EVAL-INT-18 */
  readonly includedSubjectCount: number;
  /** Per-reason excluded pair counts. EVAL-INT-18 */
  readonly excludedPairCounts: Readonly<Partial<Record<PairExclusionReason, number>>>;
  /** Per-reason subject-level failure counts. EVAL-INT-18 */
  readonly subjectFailureCounts: Readonly<Partial<Record<SubjectFailureReason, number>>>;
}

// ── Deterministic serialization ───────────────────────────────────────────────

/**
 * Canonical sorted-key JSON serializer.
 * Produces compact JSON with object keys in lexicographic order so that the
 * same logical value always produces the same byte sequence. EVAL-INT-13
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
      .join(",")}}`;
  }
  throw new TypeError("integrity report value must be JSON-compatible");
}

// ── Validation ────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns true iff the object has exactly the given keys — no more, no fewer.
 * Mirrors persistence-layer hasExactKeys so the DTO schema is equally strict.
 */
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((k, i) => k === expected[i])
  );
}

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function assertValidIntegrityReport(value: unknown): asserts value is IntegrityReport {
  if (!isObject(value)) throw new Error("integrity report must be an object");

  // EVAL-INT-13: exact root-key check — no unknown or extra fields permitted.
  if (!hasExactKeys(value, ROOT_KEYS)) {
    throw new Error(
      `integrity report root must have exactly these keys: ${ROOT_KEYS.join(", ")}`,
    );
  }

  if (value["schema"] !== INTEGRITY_SCHEMA_V2) {
    throw new Error(
      `integrity report schema must be "${INTEGRITY_SCHEMA_V2}", got ${JSON.stringify(value["schema"])}`,
    );
  }
  if (value["deltaUnit"] !== "pp") {
    throw new Error(
      `integrity report deltaUnit must be "pp", got ${JSON.stringify(value["deltaUnit"])}`,
    );
  }
  if (value["observedDifferencesOnly"] !== true) {
    throw new Error("integrity report observedDifferencesOnly must be true");
  }
  if (typeof value["manifestHash"] !== "string" || (value["manifestHash"] as string).length === 0) {
    throw new Error("integrity report manifestHash must be a non-empty string");
  }

  for (const key of ["pairMicro", "subjectMacro"] as const) {
    const summary = value[key];
    if (!isObject(summary)) throw new Error(`integrity report ${key} must be an object`);

    // EVAL-INT-13: exact summary-key check — meanDeltaPp, n, interval only.
    if (!hasExactKeys(summary, SUMMARY_KEYS)) {
      throw new Error(
        `integrity report ${key} must have exactly these keys: ${SUMMARY_KEYS.join(", ")}`,
      );
    }

    if (!isNonNegativeInteger(summary["n"])) {
      throw new Error(`integrity report ${key}.n must be a non-negative integer`);
    }

    // EVAL-INT-09: meanDeltaPp null iff n=0; finite iff n>=1
    if (!isFiniteOrNull(summary["meanDeltaPp"])) {
      throw new Error(`integrity report ${key}.meanDeltaPp must be a finite number or null`);
    }
    if ((summary["n"] as number) === 0 && summary["meanDeltaPp"] !== null) {
      throw new Error(`integrity report ${key}.meanDeltaPp must be null when n=0`);
    }
    if ((summary["n"] as number) >= 1 && summary["meanDeltaPp"] === null) {
      throw new Error(`integrity report ${key}.meanDeltaPp must be finite when n>=1`);
    }

    // EVAL-INT-14: candidateMean and baselineMean
    if (!isFiniteOrNull(summary["candidateMean"])) {
      throw new Error(`integrity report ${key}.candidateMean must be a finite number or null`);
    }
    if (!isFiniteOrNull(summary["baselineMean"])) {
      throw new Error(`integrity report ${key}.baselineMean must be a finite number or null`);
    }
    // n=0 → all three means must be null; n>=1 → all three means must be finite
    if ((summary["n"] as number) === 0) {
      if (summary["candidateMean"] !== null) {
        throw new Error(`integrity report ${key}.candidateMean must be null when n=0`);
      }
      if (summary["baselineMean"] !== null) {
        throw new Error(`integrity report ${key}.baselineMean must be null when n=0`);
      }
    }
    if ((summary["n"] as number) >= 1) {
      if (summary["candidateMean"] === null) {
        throw new Error(`integrity report ${key}.candidateMean must be finite when n>=1`);
      }
      if (summary["baselineMean"] === null) {
        throw new Error(`integrity report ${key}.baselineMean must be finite when n>=1`);
      }
    }

    if (!isObject(summary["interval"])) {
      throw new Error(`integrity report ${key}.interval must be an object`);
    }
    const interval = summary["interval"] as Record<string, unknown>;

    // EVAL-INT-10/13: exact interval-key check — method, lower, upper, reason only.
    if (!hasExactKeys(interval, INTERVAL_KEYS)) {
      throw new Error(
        `integrity report ${key}.interval must have exactly these keys: ${INTERVAL_KEYS.join(", ")}`,
      );
    }

    if (interval["method"] !== "paired_t_95pct_pp_v1") {
      throw new Error(`integrity report ${key}.interval.method must be "paired_t_95pct_pp_v1"`);
    }

    // EVAL-INT-10: lower and upper must each be a finite number or null
    if (!isFiniteOrNull(interval["lower"])) {
      throw new Error(
        `integrity report ${key}.interval.lower must be a finite number or null`,
      );
    }
    if (!isFiniteOrNull(interval["upper"])) {
      throw new Error(
        `integrity report ${key}.interval.upper must be a finite number or null`,
      );
    }

    const n = summary["n"] as number;
    if (n < 2) {
      // EVAL-INT-10: when n<2, bounds must be null and reason must be "insufficient_pairs"
      if (interval["lower"] !== null) {
        throw new Error(
          `integrity report ${key}.interval.lower must be null when n<2`,
        );
      }
      if (interval["upper"] !== null) {
        throw new Error(
          `integrity report ${key}.interval.upper must be null when n<2`,
        );
      }
      if (interval["reason"] !== "insufficient_pairs") {
        throw new Error(
          `integrity report ${key}.interval.reason must be "insufficient_pairs" when n<2`,
        );
      }
    } else {
      // EVAL-INT-10: when n>=2, bounds must be finite, reason must be exactly null,
      // and the interval must contain the mean (lower<=mean<=upper, lower<=upper).
      if (!Number.isFinite(interval["lower"] as number)) {
        throw new Error(
          `integrity report ${key}.interval.lower must be finite when n>=2`,
        );
      }
      if (!Number.isFinite(interval["upper"] as number)) {
        throw new Error(
          `integrity report ${key}.interval.upper must be finite when n>=2`,
        );
      }
      if (interval["reason"] !== null) {
        throw new Error(
          `integrity report ${key}.interval.reason must be null when n>=2`,
        );
      }
      const lower = interval["lower"] as number;
      const upper = interval["upper"] as number;
      const mean = summary["meanDeltaPp"] as number;
      if (lower > upper) {
        throw new Error(
          `integrity report ${key}.interval.lower must be <= upper`,
        );
      }
      if (mean < lower || mean > upper) {
        throw new Error(
          `integrity report ${key}.interval must contain meanDeltaPp when n>=2`,
        );
      }
    }
  }

  if (!isNonNegativeInteger(value["validPairCount"])) {
    throw new Error("integrity report validPairCount must be a non-negative integer");
  }
  if (!isNonNegativeInteger(value["includedSubjectCount"])) {
    throw new Error("integrity report includedSubjectCount must be a non-negative integer");
  }

  // EVAL-INT-09/18: pairMicro.n must equal validPairCount; subjectMacro.n must equal includedSubjectCount
  const pairMicro = value["pairMicro"] as Record<string, unknown>;
  if ((pairMicro["n"] as number) !== (value["validPairCount"] as number)) {
    throw new Error("integrity report pairMicro.n must equal validPairCount");
  }
  const subjectMacro = value["subjectMacro"] as Record<string, unknown>;
  if ((subjectMacro["n"] as number) !== (value["includedSubjectCount"] as number)) {
    throw new Error("integrity report subjectMacro.n must equal includedSubjectCount");
  }

  if (!isObject(value["excludedPairCounts"])) {
    throw new Error("integrity report excludedPairCounts must be an object");
  }
  // EVAL-INT-18: keys must be PairExclusionReason literals; values must be non-negative integers
  for (const [k, v] of Object.entries(value["excludedPairCounts"] as Record<string, unknown>)) {
    if (!PAIR_EXCLUSION_REASONS.has(k as PairExclusionReason)) {
      throw new Error(
        `integrity report excludedPairCounts key "${k}" is not a valid PairExclusionReason`,
      );
    }
    if (!isNonNegativeInteger(v)) {
      throw new Error(
        `integrity report excludedPairCounts.${k} must be a non-negative integer`,
      );
    }
  }
  if (!isObject(value["subjectFailureCounts"])) {
    throw new Error("integrity report subjectFailureCounts must be an object");
  }
  // EVAL-INT-18: keys must be SubjectFailureReason literals; values must be non-negative integers
  for (const [k, v] of Object.entries(value["subjectFailureCounts"] as Record<string, unknown>)) {
    if (!SUBJECT_FAILURE_REASONS.has(k as SubjectFailureReason)) {
      throw new Error(
        `integrity report subjectFailureCounts key "${k}" is not a valid SubjectFailureReason`,
      );
    }
    if (!isNonNegativeInteger(v)) {
      throw new Error(
        `integrity report subjectFailureCounts.${k} must be a non-negative integer`,
      );
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build an IntegrityReport DTO from a normalized report state.
 * Pure — no side effects, no filesystem or provider access.
 * EVAL-INT-08/09/10/14/16/18/20
 */
export function buildIntegrityReport(state: NormalizedIntegrityReportStateV2): IntegrityReport {
  return {
    schema: INTEGRITY_SCHEMA_V2,
    manifestHash: state.manifestHash,
    deltaUnit: "pp",
    observedDifferencesOnly: true,
    pairMicro: state.pairMicro,
    subjectMacro: state.subjectMacro,
    validPairCount: state.validPairCount,
    includedSubjectCount: state.includedSubjectCount,
    excludedPairCounts: state.excludedPairCounts,
    subjectFailureCounts: state.subjectFailureCounts,
  };
}

/**
 * Serialize an IntegrityReport to a deterministic JSON string.
 * Object keys are sorted lexicographically so the same logical report
 * always produces the same byte sequence. EVAL-INT-13
 */
export function serializeIntegrityReport(report: IntegrityReport): string {
  return canonicalize(report);
}

/**
 * Deserialize and validate an IntegrityReport from a JSON string.
 *
 * Throws if:
 * - bytes are not valid JSON
 * - required fields are missing or extra fields are present (exact-key enforcement)
 * - schema is not "eval-integrity-v2"
 * - deltaUnit is not "pp"
 * - any semantic invariant (EVAL-INT-09/10/18) is violated
 *
 * Pure — no filesystem or provider access. EVAL-INT-13
 */
export function deserializeIntegrityReport(bytes: string): IntegrityReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes) as unknown;
  } catch {
    throw new Error("integrity report bytes are not valid JSON");
  }
  assertValidIntegrityReport(parsed);
  return parsed;
}
