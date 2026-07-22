/**
 * Pure output adapters for IntegrityReport.
 *
 * Covers: EVAL-INT-CLI-01 through CLI-19
 * Seam owner: agentic-devlopment-sur3.2
 *
 * Three exports:
 *   formatIntegrityCli        — plain-text CLI renderer (no ANSI, no side effects)
 *   integrityReportJson       — canonical JSON bytes (wraps serializeIntegrityReport)
 *   loadIntegrityReportFromStore — filesystem load from EvalIntegrityV2Store (offline)
 *
 * Invariants:
 *  • No causal / "statistically significant" claims.
 *  • Unit is always "pp" (percentage points).
 *  • Score formula stated as "passed_criteria/expected_criteria" — never fabricated.
 *  • Candidate/baseline mean scores are rendered for pair-micro and subject-macro scopes.
 *  • Null report → explicit "no measurable" or schema-specific message; never zero.
 *  • Zero-count exclusion reasons silently dropped from output.
 *  • Does not launch providers, networks, or goose processes.
 */

import type { IntegrityCompatibility } from "../persistence/integrityV2Store.js";
import type { IntegrityReport } from "./integrityReport.js";
import {
  EvalIntegrityV2Store,
  INTEGRITY_SCHEMA_V2,
} from "../persistence/integrityV2Store.js";
import {
  buildIntegrityReport,
  serializeIntegrityReport,
} from "./integrityReport.js";

// ── Canonical JSON serializer ─────────────────────────────────────────────────

/**
 * Serialize an IntegrityReport to canonical JSON bytes.
 * Delegates to serializeIntegrityReport for deterministic sorted-key output.
 * The same logical report always produces the same byte sequence. EVAL-INT-13
 */
export function integrityReportJson(report: IntegrityReport): string {
  return serializeIntegrityReport(report);
}

// ── Text formatting helpers ───────────────────────────────────────────────────

const LINE = "─".repeat(60);
const THIN = "─".repeat(60);

function fmtScore(score: number | null, n: number): string {
  if (n === 0 || score === null) return "—";
  return score.toFixed(4);
}

function fmtMeanPp(mean: number | null, n: number): string {
  if (n === 0 || mean === null) return "—  (no data)";
  const sign = mean >= 0 ? "+" : "";
  return `${sign}${mean.toFixed(4)} pp`;
}

function fmtInterval(
  interval: IntegrityReport["pairMicro"]["interval"],
  n: number,
): string {
  if (n < 2 || interval.reason === "insufficient_pairs") {
    return `insufficient_pairs  (n=${n} < 2)  ·  method: ${interval.method}`;
  }
  const lo = interval.lower !== null ? (interval.lower >= 0 ? "+" : "") + interval.lower.toFixed(4) : "null";
  const hi = interval.upper !== null ? (interval.upper >= 0 ? "+" : "") + interval.upper.toFixed(4) : "null";
  return `[${lo}, ${hi}]  ·  method: ${interval.method}`;
}

// ── CLI text renderer ─────────────────────────────────────────────────────────

/**
 * Render a human-readable integrity report block for the layered CLI.
 *
 * @param report      IntegrityReport DTO, or null when no data is available.
 * @param scopeLabel  E.g. "L1 skills", "L2 agents", "L3 recipes".
 * @param compatibility Optional compatibility metadata — used to populate the
 *                    reason message when report is null.
 * @returns A multi-line plain-text string (no ANSI escape codes).
 *
 * Required content (EVAL-INT-CLI-*):
 *   CLI-01  manifest hash
 *   CLI-02  "observed paired differences only" language (no causal claim)
 *   CLI-03  delta unit "pp"
 *   CLI-04  score formula "passed_criteria/expected_criteria"
 *   CLI-05  pairMicro mean + n
 *   CLI-06  subjectMacro mean + n
 *   CLI-07  CI bounds + method when n>=2; "insufficient_pairs" when n<2
 *   CLI-09  nonzero excluded pair reasons + counts
 *   CLI-10  nonzero subject failure reasons + counts
 *   CLI-11  explicit "no measurable" message for null report
 *   CLI-12  "schema_legacy_incomplete" when legacy compat
 *   CLI-13  NO "statistically significant" or causal language
 *   CLI-14  JSON bytes via integrityReportJson
 *   CLI-18  zero-count reasons omitted
 *   CLI-19  valid pair count + included subject count
 */
export function formatIntegrityCli(
  report: IntegrityReport | null,
  scopeLabel: string,
  compatibility?: IntegrityCompatibility,
): string {
  const lines: string[] = [];
  const header = `  Integrity Report — ${scopeLabel}`;

  lines.push(`┌${LINE}`);
  lines.push(header);
  lines.push(`│${THIN}`);

  if (report === null) {
    // ── Null branch — explicit message, never zero ─────────────────────────
    let reason = "No measurable integrity data available";
    if (compatibility !== undefined) {
      if (compatibility.schema === "legacy-v1") {
        reason = `No integrity data — schema_legacy_incomplete (historical run; no eval-integrity-v2 manifest)`;
      } else if (!compatibility.integrityEligible) {
        const inc = (compatibility as { incompleteReason?: string }).incompleteReason;
        reason = `No measurable integrity data — ${inc ?? "unknown reason"}`;
      }
    }
    lines.push(`│  ⚠  ${reason}`);
    lines.push(`└${LINE}`);
    return lines.join("\n");
  }

  // ── Header metadata ────────────────────────────────────────────────────────
  lines.push(`│  Manifest hash      : ${report.manifestHash}`);
  lines.push(`│  Observed paired differences only — descriptive, no directional claim`);
  lines.push(`│  Delta unit         : pp  ·  Score: passed_criteria/expected_criteria`);
  lines.push(`│${THIN}`);

  // ── Pair-micro ─────────────────────────────────────────────────────────────
  lines.push(`│  Pair-micro   (n=${report.pairMicro.n})`);
  lines.push(`│    Candidate score : ${fmtScore(report.pairMicro.candidateMean, report.pairMicro.n)}`);
  lines.push(`│    Baseline score  : ${fmtScore(report.pairMicro.baselineMean, report.pairMicro.n)}`);
  lines.push(`│    Mean Δ     : ${fmtMeanPp(report.pairMicro.meanDeltaPp, report.pairMicro.n)}`);
  lines.push(`│    95% CI     : ${fmtInterval(report.pairMicro.interval, report.pairMicro.n)}`);

  // ── Subject-macro ──────────────────────────────────────────────────────────
  lines.push(`│  Subject-macro   (n=${report.subjectMacro.n})`);
  lines.push(`│    Candidate score : ${fmtScore(report.subjectMacro.candidateMean, report.subjectMacro.n)}`);
  lines.push(`│    Baseline score  : ${fmtScore(report.subjectMacro.baselineMean, report.subjectMacro.n)}`);
  lines.push(`│    Mean Δ     : ${fmtMeanPp(report.subjectMacro.meanDeltaPp, report.subjectMacro.n)}`);
  lines.push(`│    95% CI     : ${fmtInterval(report.subjectMacro.interval, report.subjectMacro.n)}`);
  lines.push(`│${THIN}`);

  // ── Counts ────────────────────────────────────────────────────────────────
  lines.push(`│  Valid pairs       : ${report.validPairCount}`);
  lines.push(`│  Included subjects : ${report.includedSubjectCount}`);

  // ── Excluded pair reasons (nonzero only) ──────────────────────────────────
  const excludedEntries = Object.entries(report.excludedPairCounts).filter(([, count]) => (count ?? 0) > 0);
  if (excludedEntries.length > 0) {
    lines.push(`│  Excluded pairs    :`);
    for (const [reason, count] of excludedEntries) {
      lines.push(`│    ${reason} × ${count as number}`);
    }
  }

  // ── Subject failure reasons (nonzero only) ────────────────────────────────
  const failureEntries = Object.entries(report.subjectFailureCounts).filter(([, count]) => (count ?? 0) > 0);
  if (failureEntries.length > 0) {
    lines.push(`│  Subject failures  :`);
    for (const [reason, count] of failureEntries) {
      lines.push(`│    ${reason} × ${count as number}`);
    }
  }

  lines.push(`└${LINE}`);
  return lines.join("\n");
}

// ── Filesystem loader ─────────────────────────────────────────────────────────

/**
 * Load a persisted IntegrityReport from an EvalIntegrityV2Store root.
 *
 * Offline — reads only from the filesystem.  Does NOT launch goose, call
 * providers, or perform any network I/O.
 *
 * Returns:
 *   { report: IntegrityReport; compatibility }  when the store has a valid
 *     report-state.json that can be mapped through buildIntegrityReport.
 *   { report: null; compatibility }  when the store has no manifest (legacy),
 *     or the manifest is present but the terminal matrix or report state is
 *     absent/inconsistent.
 *
 * Throws on filesystem errors other than ENOENT (e.g. corrupt JSON, hash
 * mismatch, duplicate slots) so callers can distinguish "not yet written"
 * from "corrupt store".
 *
 * Compatibility is always returned so callers can display an explicit reason.
 */
export async function loadIntegrityReportFromStore(storeRoot: string): Promise<{
  report: IntegrityReport | null;
  compatibility: IntegrityCompatibility;
}> {
  const store = new EvalIntegrityV2Store(storeRoot);

  // inspectCompatibility handles three branches:
  //   legacy-v1          — no manifest.json present → nothing to load
  //   integrityEligible  — manifest + full terminal matrix + consistent report state
  //   ineligible v2      — manifest present but terminal matrix or report state
  //                        absent/inconsistent
  //
  // May throw on I/O errors (non-ENOENT) or hash mismatches.
  const compatibility = await store.inspectCompatibility();

  // Legacy stores have no manifest — nothing can be loaded.
  if (compatibility.schema === "legacy-v1") {
    return { report: null, compatibility };
  }

  // For v2 stores (manifest exists), attempt to read whatever report state
  // is already persisted — regardless of eligibility status.  The
  // compatibility value tells the caller the integrity story independently.
  // readReportState() validates canonical bytes + manifest hash and returns
  // null only when report-state.json is absent; it throws on corruption.
  const state = await store.readReportState();
  if (state === null) {
    return { report: null, compatibility };
  }

  return {
    report: buildIntegrityReport(state),
    compatibility,
  };
}
