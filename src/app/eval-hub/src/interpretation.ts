import fs from "node:fs/promises";
import path from "node:path";
import {
  EvalIntegrityV2Store,
  type IntegrityTerminalRecordV2,
  type NormalizedIntegrityReportStateV2,
  type PairExclusionReason,
} from "./domains/persistence/integrityV2Store.js";

const MAX_DIAGNOSTIC_SLOTS = 2_048;
const MAX_ARTIFACT_BYTES = 1_048_576;

export type DiagnosticReason = "max_turns_reached" | "timeout" | "runtime_dependency" | "provider_network" | "grader_invalid" | "bootstrap" | "missing_artifacts" | "unknown";

// ── Criterion-level grading detail ────────────────────────────────────────────

export interface CriterionOutcome {
  readonly criterionId: string;
  readonly text: string;
  readonly passed: boolean;
  readonly evidence: string;
}

/** Grading detail from grading.json — per-criterion outcomes, evidence, and pass summary. */
export interface GradingDetail {
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly pass_rate: number | null;
  };
  readonly expectations: readonly CriterionOutcome[];
}

/** Per-slot KPI snapshot from execution-result, timing, and log analysis. */
export interface SlotKpi {
  readonly totalTokens: number | null;
  readonly messageCount: number | null;
  readonly toolCalls: number | null;
  readonly toolFailures: number | null;
  readonly durationMs: number | null;
  readonly turnsUsed: number | null;
  readonly maxTurns: number | null;
  readonly maxTurnsReached: boolean | null;
  readonly retries: number | null;
  readonly errors: number | null;
}

export interface PersistedSlotEvidence {
  readonly subject: string;
  readonly evalId: number;
  readonly repetition: number;
  readonly side: "candidate" | "baseline";
  readonly terminal: IntegrityTerminalRecordV2 | null;
  readonly paths: Readonly<Partial<Record<"terminal" | "execution" | "timing" | "log" | "grader" | "grading", string>>>;
  readonly timing?: { readonly turnsUsed?: number; readonly maxTurns?: number; readonly maxTurnsReached?: boolean } | null;
  readonly execution?: { readonly status?: string; readonly signal?: string | null; readonly failureReason?: string | null; readonly runtimeHealth?: { readonly status?: string } } | null;
  readonly log?: { readonly fatalDiagnostics?: ReadonlyArray<{ readonly code?: string }> } | null;
  readonly grader?: { readonly classification?: string; readonly parseOutcome?: string; readonly process?: { readonly failed?: boolean } } | null;
  /** Per-criterion grading outcomes loaded from grading.json. */
  readonly gradingDetail?: GradingDetail | null;
  /** KPI snapshot from execution + timing + log analysis. */
  readonly kpi?: SlotKpi | null;
}

export interface DiagnosticGroup {
  readonly reason: DiagnosticReason;
  readonly count: number;
  readonly slots: readonly string[];
  readonly evidence: readonly string[];
}

export interface DiagnosticProjection {
  readonly expectedPairs: number;
  readonly validPairs: number;
  readonly excludedPairs: number;
  readonly groups: readonly DiagnosticGroup[];
  readonly recommendation: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function identity(slot: PersistedSlotEvidence): string {
  return `${slot.subject}/eval-${slot.evalId}/rep-${slot.repetition}/${slot.side}`;
}

function classify(slot: PersistedSlotEvidence): DiagnosticReason {
  if (slot.terminal === null) return "missing_artifacts";
  const exclusion = slot.terminal.exclusion?.reason;
  // Explicit execution outcomes are authoritative. A timing record can report
  // maxTurnsReached because delegated/sub-session events are included in its
  // count; it must not mask a recorded runtime or provider failure.
  const failureReason = slot.execution?.failureReason;
  if (slot.execution?.signal === "SIGKILL") return "timeout";
  const codes = slot.log?.fatalDiagnostics?.map(item => item.code ?? "") ?? [];
  if (codes.some(code => code.startsWith("provider_") || code.includes("network"))) return "provider_network";
  const graderClass = slot.grader?.classification ?? "";
  if (graderClass.startsWith("provider_") || graderClass.includes("network")) return "provider_network";
  if (exclusion === "runtime_dependency_failed" || exclusion === "runtime_binary_changed" || exclusion === "runtime_binary_unavailable" || failureReason === "runtime_dependency_failed" || failureReason === "runtime_binary_changed" || failureReason === "runtime_binary_unavailable") return "runtime_dependency";
  if (exclusion === "treatment_bootstrap_failed" || failureReason === "treatment_bootstrap_failed") return "bootstrap";
  if (exclusion === "grader_invalid" || slot.terminal.grading?.validationStatus === "invalid") return "grader_invalid";
  if (slot.timing?.maxTurnsReached === true) return "max_turns_reached";
  if (exclusion === "result_missing" || slot.execution == null || slot.timing == null) return "missing_artifacts";
  return "unknown";
}

function evidenceFor(slot: PersistedSlotEvidence, reason: DiagnosticReason): string[] {
  const values: string[] = [];
  if (reason === "max_turns_reached") values.push(`turns=${slot.timing?.turnsUsed ?? "?"}/${slot.timing?.maxTurns ?? "?"}`);
  if (reason === "timeout") values.push(`signal=${slot.execution?.signal ?? "unknown"}`);
  if (slot.terminal?.exclusion?.reason) values.push(`terminal=${slot.terminal.exclusion.reason}`);
  const codes = slot.log?.fatalDiagnostics?.map(item => item.code).filter((code): code is string => Boolean(code)) ?? [];
  if (codes.length) values.push(`log_codes=${[...new Set(codes)].join("|")}`);
  if (slot.grader?.classification) values.push(`grader=${slot.grader.classification}`);
  for (const artifact of Object.values(slot.paths)) if (artifact) values.push(artifact);
  return [...new Set(values)];
}

// ── KPI builder ────────────────────────────────────────────────────────────────

function buildSlotKpi(
  execution: Record<string, any> | null | undefined,
  timing: Record<string, any> | null | undefined,
  log: Record<string, any> | null | undefined,
): SlotKpi | null {
  const observed = log?.observed as Record<string, any> | undefined;
  if (!execution && !timing && !observed) return null;
  return {
    totalTokens:    observed?.totalTokens ?? null,
    messageCount:   observed?.messageCount ?? null,
    toolCalls:      observed?.toolCalls ?? null,
    toolFailures:   observed?.toolFailures ?? null,
    durationMs:     observed?.durationMs ?? null,
    turnsUsed:      timing?.turnsUsed ?? observed?.messageCount ?? null,
    maxTurns:       timing?.maxTurns ?? null,
    maxTurnsReached: timing?.maxTurnsReached ?? null,
    retries:        observed?.retries ?? null,
    errors:         observed?.errors ?? null,
  };
}

// ── Grading detail loader ─────────────────────────────────────────────────────

async function readJsonFile(file: string): Promise<Record<string, any> | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_ARTIFACT_BYTES) return null;
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

async function readGradingDetail(file: string): Promise<GradingDetail | null> {
  const raw = await readJsonFile(file);
  if (!raw) return null;
  const summary = raw.summary as { total?: number; passed?: number; failed?: number; pass_rate?: number | null } | undefined;
  if (!summary || typeof summary.total !== "number") return null;
  const expectations: CriterionOutcome[] = [];
  const rawExpectations = raw.expectations as ReadonlyArray<Record<string, unknown>> | undefined;
  if (Array.isArray(rawExpectations)) {
    for (let i = 0; i < rawExpectations.length; i++) {
      const e = rawExpectations[i]!;
      expectations.push({
        criterionId: `expected_behavior[${i}]`,
        text:        typeof e.text === "string" ? e.text : `Criterion ${i}`,
        passed:      e.passed === true,
        evidence:    typeof e.evidence === "string" ? e.evidence : "",
      });
    }
  }
  return {
    summary: {
      total:    summary.total ?? 0,
      passed:   summary.passed ?? 0,
      failed:   summary.failed ?? 0,
      pass_rate: summary.pass_rate ?? null,
    },
    expectations,
  };
}

/** Pure, deterministic projection over already-persisted evidence. */
export function projectFailureDiagnostics(report: NormalizedIntegrityReportStateV2, slots: readonly PersistedSlotEvidence[]): DiagnosticProjection {
  const excluded = slots.filter(slot => slot.terminal === null || slot.terminal.exclusion !== null || slot.terminal.status === "failed");
  const grouped = new Map<DiagnosticReason, { slots: string[]; evidence: string[] }>();
  for (const slot of excluded) {
    const reason = classify(slot);
    const group = grouped.get(reason) ?? { slots: [], evidence: [] };
    group.slots.push(identity(slot));
    group.evidence.push(...evidenceFor(slot, reason));
    grouped.set(reason, group);
  }
  const order: DiagnosticReason[] = ["max_turns_reached", "timeout", "runtime_dependency", "provider_network", "grader_invalid", "bootstrap", "missing_artifacts", "unknown"];
  const groups = order.flatMap(reason => {
    const group = grouped.get(reason);
    return group ? [{ reason, count: group.slots.length, slots: [...group.slots].sort(), evidence: [...new Set(group.evidence)].sort().slice(0, 24) }] : [];
  });
  const excludedPairs = Object.values(report.excludedPairCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const expectedPairs = report.validPairCount + excludedPairs;
  const reasons = new Set(groups.map(group => group.reason));
  const recommendation = reasons.has("max_turns_reached") || reasons.has("timeout")
    ? "Right-size scenario complexity and the turn/time budget before rerunning; do not treat excluded pairs as measured outcomes."
    : reasons.has("provider_network") || reasons.has("missing_artifacts")
      ? "Rerun the affected slots after provider/network recovery or artifact repair; keep the scenario and scoring unchanged."
      : groups.length
        ? "Fix the recorded runtime, bootstrap, or grader fault, then rerun the affected slots."
        : "No diagnostic rerun is indicated by persisted exclusions; review the measured result."
  return { expectedPairs, validPairs: report.validPairCount, excludedPairs, groups, recommendation };
}

async function readJson(file: string): Promise<Record<string, any> | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > MAX_ARTIFACT_BYTES) return null;
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

/** Bounded filesystem adapter; raw transcripts/prompts and environment data are never read. */
export async function loadPersistedDiagnosticEvidence(layerWorkspace: string, integrityRoot: string): Promise<readonly PersistedSlotEvidence[]> {
  const store = new EvalIntegrityV2Store(integrityRoot);
  const stored = await store.loadManifest();
  const terminals = await store.listTerminals();
  const bySlot = new Map(terminals.map(item => [`${item.kind} ${item.subject} ${item.evalId} ${item.repetition} ${item.side}`, item]));
  const slots: PersistedSlotEvidence[] = [];
  for (const subject of stored.manifest.subjects) for (const evalId of subject.evalIds) for (let repetition = 0; repetition < stored.manifest.repetitions; repetition++) for (const side of ["candidate", "baseline"] as const) {
    if (slots.length >= MAX_DIAGNOSTIC_SLOTS) return slots;
    const key = `${subject.kind} ${subject.subject} ${evalId} ${repetition} ${side}`;
    const terminal = bySlot.get(key) ?? null;
    const treatments = stored.manifest.treatments.filter(item => item.kind === subject.kind && item.subject === subject.subject && item.side === side);
    if (treatments.length !== 1) throw new Error(`ambiguous diagnostic treatment for ${subject.kind}/${subject.subject}/${side}`);
    const treatmentId = treatments[0]!.id;
    if (terminal && terminal.treatmentId !== treatmentId) throw new Error(`terminal treatment does not match manifest for ${subject.kind}/${subject.subject}/${evalId}/${side}`);
    // SuiteRunner snapshots the canonical FsWorkspaceWriter tree beneath layerWorkspace.
    // FsWorkspaceWriter numbers runs from one, while integrity repetitions are zero-based.
    const root = path.join(layerWorkspace, subject.subject, subject.sourceHash, `eval-${evalId}`, treatmentId, `run-${repetition + 1}`);
    const files = {
      execution: path.join(root, "execution-result.json"),
      timing: path.join(root, "timing.json"),
      log: path.join(root, "goose-log-analysis.json"),
      graderAttempt: path.join(root, "grader-attempt-1.json"),
      gradingDiagnostic: path.join(root, "grading-diagnostic.json"),
      grading: path.join(root, "grading.json"),
    };
    const [execution, timing, log, graderAttempt, gradingDiagnostic, gradingRaw] = await Promise.all([
      readJson(files.execution),
      readJson(files.timing),
      readJson(files.log),
      readJson(files.graderAttempt),
      readJson(files.gradingDiagnostic),
      readGradingDetail(files.grading),
    ]);
    const grader = graderAttempt ?? gradingDiagnostic;
    const paths: Record<string, string> = {};
    if (terminal) paths["terminal"] = path.relative(layerWorkspace, integrityRoot) + "/terminals/<content-addressed>.json";
    if (execution) paths["execution"] = path.relative(layerWorkspace, files.execution);
    if (timing) paths["timing"] = path.relative(layerWorkspace, files.timing);
    if (log) paths["log"] = path.relative(layerWorkspace, files.log);
    if (grader) paths["grader"] = path.relative(layerWorkspace, graderAttempt ? files.graderAttempt : files.gradingDiagnostic);
    if (gradingRaw) paths["grading"] = path.relative(layerWorkspace, files.grading);
    slots.push({
      subject: subject.subject,
      evalId,
      repetition,
      side,
      terminal,
      paths,
      execution,
      timing,
      log,
      grader,
      gradingDetail: gradingRaw,
      kpi: buildSlotKpi(execution, timing, log),
    });
  }
  return slots;
}

// ── KPI rendering ─────────────────────────────────────────────────────────────

function formatKpi(kpi: SlotKpi): string {
  const parts: string[] = [];
  if (kpi.totalTokens !== null) parts.push(`${kpi.totalTokens} tok`);
  if (kpi.messageCount !== null) parts.push(`${kpi.messageCount} msgs`);
  if (kpi.toolCalls !== null) parts.push(`${kpi.toolCalls} tools`);
  if (kpi.durationMs !== null) {
    const s = Math.round(kpi.durationMs / 1000);
    parts.push(s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`);
  }
  if (kpi.toolFailures !== null && kpi.toolFailures > 0) parts.push(`${kpi.toolFailures} tool-fail`);
  if (kpi.retries !== null && kpi.retries > 0) parts.push(`${kpi.retries} retries`);
  if (kpi.errors !== null && kpi.errors > 0) parts.push(`${kpi.errors} errors`);
  return parts.join(", ") || "—";
}

function kpiDiffLine(candidate: SlotKpi | null, baseline: SlotKpi | null, label: string): string {
  const candStr = candidate ? formatKpi(candidate) : "—";
  const baseStr = baseline ? formatKpi(baseline) : "—";
  return `${label}: candidate=${candStr}  baseline=${baseStr}`;
}

// ── Grading outcome rendering ──────────────────────────────────────────────

function gradingOutcomeLines(
  grading: GradingDetail | null | undefined,
  side: string,
  subjectLabel: string,
): string[] {
  if (!grading || grading.summary.total === 0) return [];
  const lines: string[] = [];
  const passRate = grading.summary.pass_rate !== null
    ? `${(grading.summary.pass_rate * 100).toFixed(0)}%`
    : "—";
  lines.push(`${side} (${subjectLabel}): ${grading.summary.passed}/${grading.summary.total} criteria passed (${passRate})`);
  for (const exp of grading.expectations) {
    const mark = exp.passed ? "✓" : "✗";
    const evidence = exp.evidence ? `  — ${exp.evidence.slice(0, 200)}` : "";
    lines.push(`  ${mark} ${exp.text}${evidence}`);
  }
  return lines;
}

// ── Pair-level analysis ─────────────────────────────────────────────────────

interface GradedPair {
  readonly subject: string;
  readonly evalId: number;
  readonly repetition: number;
  readonly candidateDetail: GradingDetail | null | undefined;
  readonly baselineDetail: GradingDetail | null | undefined;
  readonly candidateKpi: SlotKpi | null;
  readonly baselineKpi: SlotKpi | null;
}

function collectGradedPairs(slots: readonly PersistedSlotEvidence[]): GradedPair[] {
  const byKey = new Map<string, { candidate: PersistedSlotEvidence | null; baseline: PersistedSlotEvidence | null }>();
  for (const slot of slots) {
    const key = `${slot.subject}:${slot.evalId}:${slot.repetition}`;
    const entry = byKey.get(key) ?? { candidate: null, baseline: null };
    if (slot.side === "candidate") entry.candidate = slot;
    else entry.baseline = slot;
    byKey.set(key, entry);
  }
  const pairs: GradedPair[] = [];
  for (const [key, entry] of byKey) {
    if (!entry.candidate || !entry.baseline) continue;
    // Only include graded pairs where both sides have grading data and
    // neither terminal is excluded.
    const cTerm = entry.candidate.terminal;
    const bTerm = entry.baseline.terminal;
    if (!cTerm || !bTerm) continue;
    if (cTerm.exclusion || bTerm.exclusion) continue;
    if (cTerm.status !== "succeeded" || bTerm.status !== "succeeded") continue;
    // Accept pair if either terminal grading exists OR grading details are loaded from disk.
    // This allows grading.json data (per-criterion outcomes) to drive analysis even when
    // the terminal record's grading field is absent or minimal.
    if (!cTerm.grading && !entry.candidate.gradingDetail) continue;
    if (!bTerm.grading && !entry.baseline.gradingDetail) continue;
    pairs.push({
      subject: entry.candidate.subject,
      evalId: entry.candidate.evalId,
      repetition: entry.candidate.repetition,
      candidateDetail: entry.candidate.gradingDetail,
      baselineDetail: entry.baseline.gradingDetail,
      candidateKpi: entry.candidate.kpi ?? null,
      baselineKpi: entry.baseline.kpi ?? null,
    });
  }
  return pairs;
}

function renderGradedPairAnalysis(
  pairs: GradedPair[],
  report: NormalizedIntegrityReportStateV2,
  coverage: string,
): string[] {
  const lines: string[] = [];
  if (pairs.length === 0) return lines;

  // Header with aggregate stats
  const macro = report.subjectMacro;
  if (macro.meanDeltaPp !== null && macro.candidateMean !== null && macro.baselineMean !== null) {
    const signed = macro.meanDeltaPp >= 0 ? `+${macro.meanDeltaPp.toFixed(2)}` : macro.meanDeltaPp.toFixed(2);
    const upDown = macro.meanDeltaPp < 0 ? "regressed" : macro.meanDeltaPp > 0 ? "improved" : "unchanged";
    lines.push(`Score analysis — candidate overall ${upDown} by ${signed} pp vs baseline (${coverage}; ${macro.n} subjects)`);
  }

  // Per-subject breakdown
  for (const pair of pairs) {
    const label = `${pair.subject}`;
    if (pair.candidateDetail && pair.baselineDetail) {
      lines.push("");
      lines.push(`── ${label} eval-${pair.evalId} rep-${pair.repetition} ──`);
      const candPass = pair.candidateDetail.summary.passed;
      const basePass = pair.baselineDetail.summary.passed;
      const total = pair.candidateDetail.summary.total;
      const delta = candPass - basePass;
      const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : "=";
      lines.push(`Criterion scores: candidate ${candPass}/${total} vs baseline ${basePass}/${total} (Δ ${deltaStr})`);

      // Compare per-criterion
      const maxCriteria = Math.max(pair.candidateDetail.expectations.length, pair.baselineDetail.expectations.length);
      for (let i = 0; i < maxCriteria; i++) {
        const candExp = pair.candidateDetail.expectations[i];
        const baseExp = pair.baselineDetail.expectations[i];
        const text = candExp?.text ?? baseExp?.text ?? `Criterion ${i}`;
        const candResult = candExp ? (candExp.passed ? "pass" : "FAIL") : "—";
        const baseResult = baseExp ? (baseExp.passed ? "pass" : "FAIL") : "—";
        if (candResult !== baseResult) {
          lines.push(`  ✗ criterion[${i}]: candidate=${candResult} baseline=${baseResult}`);
          lines.push(`    "${text.slice(0, 160)}"`);
          if (candExp?.evidence) lines.push(`    candidate evidence: ${candExp.evidence.slice(0, 300)}`);
          if (baseExp?.evidence) lines.push(`    baseline evidence: ${baseExp.evidence.slice(0, 300)}`);
        } else if (candResult === "FAIL") {
          lines.push(`  ✗ criterion[${i}]: both FAIL`);
          lines.push(`    "${text.slice(0, 160)}"`);
          if (candExp?.evidence) lines.push(`    candidate: ${candExp.evidence.slice(0, 200)}`);
          if (baseExp?.evidence) lines.push(`    baseline: ${baseExp.evidence.slice(0, 200)}`);
        } else {
          lines.push(`  ✓ criterion[${i}]: both pass`);
        }
      }

      // KPI comparison
      if (pair.candidateKpi || pair.baselineKpi) {
        lines.push(`  KPI: ${kpiDiffLine(pair.candidateKpi, pair.baselineKpi, "usage")}`);
        const cKpi = pair.candidateKpi;
        const bKpi = pair.baselineKpi;
        if (cKpi && bKpi && cKpi.totalTokens !== null && bKpi.totalTokens !== null) {
          const tokDelta = cKpi.totalTokens - bKpi.totalTokens;
          const tokPct = bKpi.totalTokens > 0 ? Math.round((tokDelta / bKpi.totalTokens) * 100) : 0;
          const tokSign = tokDelta >= 0 ? "+" : "";
          lines.push(`  Token delta: ${tokSign}${tokDelta} (${tokPct >= 0 ? "+" : ""}${tokPct}% vs baseline)`);
        }
        if (cKpi && bKpi && cKpi.toolCalls !== null && bKpi.toolCalls !== null) {
          const toolDelta = cKpi.toolCalls - bKpi.toolCalls;
          lines.push(`  Tool calls delta: ${toolDelta >= 0 ? "+" : ""}${toolDelta}`);
        }
        if (cKpi && bKpi && cKpi.durationMs !== null && bKpi.durationMs !== null) {
          const durDelta = cKpi.durationMs - bKpi.durationMs;
          const durSign = durDelta >= 0 ? "+" : "";
          const durLabel = `${durSign}${Math.round(durDelta / 1000)}s`;
          lines.push(`  Duration delta: ${durLabel}`);
        }
      }
    }
  }
  return lines;
}

/** Deterministic prose projection: no live events or model judgement are inputs. */
export function interpretLayerReport(label: string, report: NormalizedIntegrityReportStateV2 | null, skippedReason?: string, diagnostics?: DiagnosticProjection, allSlots?: readonly PersistedSlotEvidence[]): readonly string[] {
  if (skippedReason) return [`${label}: skipped (${skippedReason}); no result is interpreted.`];
  if (!report) return [`${label}: no persisted integrity report; no comparison can be made.`];
  const excludedCount = Object.values(report.excludedPairCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const expected = report.validPairCount + excludedCount;
  const coverage = expected === 0 ? "no expected pairs" : `${report.validPairCount}/${expected} valid/expected pairs`;
  const lines: string[] = [];
  if (diagnostics?.groups.length) {
    lines.push(`Failures first: ${diagnostics.groups.map(group => `${group.reason}=${group.count} [${group.slots.join(", ")}]`).join("; ")}.`);
    for (const group of diagnostics.groups) lines.push(`Evidence ${group.reason}: ${group.evidence.join(", ") || "no specific persisted artifact; classified unknown"}`);
    lines.push(`Action: ${diagnostics.recommendation}`);
  } else {
    const aggregate = [...Object.entries(report.excludedPairCounts), ...Object.entries(report.subjectFailureCounts)]
      .filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)
      .map(([reason, count]) => reason + "=" + count).join(", ");
    lines.push(aggregate
      ? `Failures first: ${report.validPairCount}/${report.validPairCount + (Object.values(report.excludedPairCounts).reduce((s, v) => s + (v ?? 0), 0))} expected pairs had exclusions (${aggregate}).`
      : `All ${report.validPairCount}/${report.validPairCount} expected pairs completed; no exclusions or slot failures were recorded.`);
  }

  // ── Graded pair analysis ──────────────────────────────────────────────────
  const gradedPairs = allSlots ? collectGradedPairs(allSlots) : [];
  if (gradedPairs.length > 0) {
    lines.push("");
    lines.push(...renderGradedPairAnalysis(gradedPairs, report, coverage));
  }

  const macro = report.subjectMacro;
  if (macro.meanDeltaPp === null || macro.candidateMean === null || macro.baselineMean === null) return [...lines, `${label}: no measurable candidate-versus-baseline data (${coverage}; ${report.includedSubjectCount} included subjects).`, "Conclusion: insufficient persisted data to infer an effect."];
  const signed = macro.meanDeltaPp >= 0 ? `+${macro.meanDeltaPp.toFixed(2)}` : macro.meanDeltaPp.toFixed(2);
  lines.push(`Candidate ${(macro.candidateMean * 100).toFixed(2)}% vs baseline ${(macro.baselineMean * 100).toFixed(2)}%: ${signed} pp (${coverage}; ${report.includedSubjectCount} included subjects).`);
  const interval = macro.interval;
  const intervalDesc = interval.lower !== null && interval.upper !== null
    ? `95% paired-t CI: [${interval.lower.toFixed(2)}, ${interval.upper.toFixed(2)}] pp.`
    : interval.reason === "insufficient_pairs"
      ? `95% paired-t CI: ${interval.reason} (n=${macro.n} < 2 subjects — cannot compute interval).`
      : `95% paired-t CI unavailable (${interval.reason ?? "not reported"}).`;
  lines.push(intervalDesc);

  // Determine the candidate-vs-baseline direction as a human-readable statement.
  const candidatePct = (macro.candidateMean * 100).toFixed(2);
  const baselinePct = (macro.baselineMean * 100).toFixed(2);
  const scoreGap = macro.candidateMean - macro.baselineMean;
  const gapDesc = scoreGap < 0
    ? `candidate ${candidatePct}% scored below baseline ${baselinePct}%`
    : scoreGap > 0
      ? `candidate ${candidatePct}% scored above baseline ${baselinePct}%`
      : `candidate and baseline both at ${candidatePct}%`;

  if (interval.lower !== null && interval.upper !== null && interval.lower > 0) {
    lines.push(`Conclusion: the persisted interval is wholly positive — ${gapDesc}. This run supports an improvement, but does not establish broader causality.`);
  } else if (interval.lower !== null && interval.upper !== null && interval.upper < 0) {
    lines.push(`Conclusion: the persisted interval is wholly negative — ${gapDesc}. This run indicates a regression.`);
  } else if (interval.lower !== null && interval.upper !== null) {
    lines.push(`Conclusion: the persisted interval crosses zero — ${gapDesc}. The direction remains uncertain.`);
  } else if (macro.meanDeltaPp < 0) {
    lines.push(`Conclusion: the observed delta is negative — ${gapDesc}. With only ${macro.n} paired subject(s), uncertainty is unavailable; treat it as a possible regression.`);
  } else if (macro.meanDeltaPp > 0) {
    lines.push(`Conclusion: the observed delta is positive — ${gapDesc}. With only ${macro.n} paired subject(s), uncertainty is unavailable; evidence is insufficient for a confident improvement claim.`);
  } else {
    lines.push(`Conclusion: the observed delta is zero — ${gapDesc}. No measurable difference between candidate and baseline.`);
  }
  return lines;
}