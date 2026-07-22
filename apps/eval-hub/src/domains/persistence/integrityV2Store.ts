/** Versioned, offline persistence for controlled layered evaluations. */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const INTEGRITY_SCHEMA_V2 = "eval-integrity-v2" as const;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface IntegrityManifestV2 {
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  readonly runProvenanceId: string;
  readonly cliArguments: readonly string[];
  readonly subjects: ReadonlyArray<{
    readonly kind: string;
    readonly subject: string;
    readonly sourceHash: string;
    readonly evalIds: readonly number[];
  }>;
  readonly repetitions: number;
  readonly treatments: ReadonlyArray<{
    readonly id: string;
    readonly kind: string;
    readonly subject: string;
    readonly side: "candidate" | "baseline";
    readonly definitionHash: string;
    readonly bootstrapHash: string;
  }>;
  readonly taskPayloadHashes: Readonly<Record<string, string>>;
  readonly fixtureHashes: Readonly<Record<string, string>>;
  readonly executionEnvelope: {
    readonly provider: string;
    readonly model: string;
    readonly decoding: { readonly temperature: number | null; readonly seed: number | null };
    readonly timeBudgetMs: number | null;
    readonly tokenBudget: number | null;
    readonly gooseRuntimeVersion: string;
    readonly evalHubRuntimeVersion: string;
  };
  readonly grader: { readonly id: string; readonly version: string };
  readonly rubric: { readonly id: string; readonly version: string };
}

export interface StoredIntegrityManifestV2 {
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  readonly hash: string;
  readonly manifest: IntegrityManifestV2;
}

export interface IntegrityPairKeyV2 {
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
}

export type PairExclusionReason =
  | "result_missing" | "grade_null" | "grade_non_numeric" | "execution_failed"
  | "grader_invalid" | "input_mismatch" | "provenance_mismatch"
  | "grader_mismatch" | "rubric_mismatch";
export type SubjectFailureReason = "source_missing" | "schema_legacy_incomplete";

export interface IntegrityTerminalRecordV2 {
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  readonly manifestHash: string;
  readonly kind: string;
  readonly subject: string;
  readonly evalId: number;
  readonly repetition: number;
  readonly side: "candidate" | "baseline";
  readonly treatmentId: string;
  readonly status: "succeeded" | "failed";
  readonly pairKey: IntegrityPairKeyV2;
  readonly grading: {
    readonly graderId: string;
    readonly graderVersion: string;
    readonly rubricId: string;
    readonly rubricVersion: string;
    readonly expectedCriterionIds: readonly string[];
    readonly outcomes: ReadonlyArray<{ readonly criterionId: string; readonly passed: boolean }>;
    readonly parseStatus: string;
    readonly validationStatus: string;
    readonly score: number | null;
  } | null;
  readonly exclusion: { readonly level: "pair"; readonly reason: PairExclusionReason } | null;
}

export interface IntegrityIntervalV2 {
  readonly method: "paired_t_95pct_pp_v1";
  readonly lower: number | null;
  readonly upper: number | null;
  readonly reason: "insufficient_pairs" | null;
}

export interface NormalizedIntegrityReportStateV2 {
  readonly schema: typeof INTEGRITY_SCHEMA_V2;
  readonly manifestHash: string;
  readonly pairMicro: {
    readonly meanDeltaPp: number | null;
    readonly candidateMean: number | null;
    readonly baselineMean: number | null;
    readonly n: number;
    readonly interval: IntegrityIntervalV2;
  };
  readonly subjectMacro: {
    readonly meanDeltaPp: number | null;
    readonly candidateMean: number | null;
    readonly baselineMean: number | null;
    readonly n: number;
    readonly interval: IntegrityIntervalV2;
  };
  readonly validPairCount: number;
  readonly includedSubjectCount: number;
  readonly excludedPairCounts: Readonly<Partial<Record<PairExclusionReason, number>>>;
  readonly subjectFailureCounts: Readonly<Partial<Record<SubjectFailureReason, number>>>;
}

export type IntegrityCompatibility =
  | { readonly schema: typeof INTEGRITY_SCHEMA_V2; readonly historicalOnly: false; readonly integrityEligible: true; readonly subjectFailureReason: null }
  | { readonly schema: typeof INTEGRITY_SCHEMA_V2; readonly historicalOnly: false; readonly integrityEligible: false; readonly subjectFailureReason: null; readonly incompleteReason: "manifest_invalid" | "terminal_matrix_incomplete" | "report_state_missing" | "report_state_inconsistent" }
  | { readonly schema: "legacy-v1"; readonly historicalOnly: true; readonly integrityEligible: false; readonly subjectFailureReason: "schema_legacy_incomplete" };

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  throw new TypeError("integrity evidence must be JSON-compatible");
};

const sha256 = (bytes: string): string => createHash("sha256").update(bytes, "utf8").digest("hex");

/** Stable hash for values embedded by reference in pair keys. */
export const integrityValueHash = (value: unknown): string => sha256(canonicalize(value));

async function readOptional(file: string): Promise<string | null> {
  try { return await fs.readFile(file, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeExclusive(file: string, bytes: string): Promise<void> {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await fs.open(temporary, "wx");
  try {
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    // link is atomic and refuses to replace an existing immutable artifact.
    await fs.link(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

const PAIR_EXCLUSION_REASONS = new Set<PairExclusionReason>([
  "result_missing", "grade_null", "grade_non_numeric", "execution_failed", "grader_invalid",
  "input_mismatch", "provenance_mismatch", "grader_mismatch", "rubric_mismatch",
]);
const SUBJECT_FAILURE_REASONS = new Set<SubjectFailureReason>(["source_missing", "schema_legacy_incomplete"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validInterval(value: unknown, n: number): boolean {
  if (!isObject(value) || !hasExactKeys(value, ["method", "lower", "upper", "reason"])) return false;
  if (value.method !== "paired_t_95pct_pp_v1" || !isFiniteOrNull(value.lower) || !isFiniteOrNull(value.upper)) return false;
  if (n < 2) return value.lower === null && value.upper === null && value.reason === "insufficient_pairs";
  return typeof value.lower === "number" && typeof value.upper === "number" && value.reason === null;
}

function validSummary(value: unknown): value is NormalizedIntegrityReportStateV2["pairMicro"] {
  if (!isObject(value) || !hasExactKeys(value, ["candidateMean", "baselineMean", "meanDeltaPp", "n", "interval"]) || !isNonNegativeInteger(value.n)) return false;
  if (!isFiniteOrNull(value.meanDeltaPp) || !isFiniteOrNull(value.candidateMean) || !isFiniteOrNull(value.baselineMean)) return false;
  // n=0 requires all three means null; n>=1 requires all three means finite
  if (value.n === 0) {
    if (value.meanDeltaPp !== null || value.candidateMean !== null || value.baselineMean !== null) return false;
  } else {
    if (typeof value.meanDeltaPp !== "number" || typeof value.candidateMean !== "number" || typeof value.baselineMean !== "number") return false;
  }
  if (!validInterval(value.interval, value.n)) return false;
  if (value.n >= 2) {
    const interval = value.interval as { readonly lower: number; readonly upper: number };
    return interval.lower <= interval.upper && interval.lower <= value.meanDeltaPp! && value.meanDeltaPp! <= interval.upper;
  }
  return true;
}

function validReasonCounts(value: unknown, allowed: ReadonlySet<string>): boolean {
  if (!isObject(value)) return false;
  return Object.entries(value).every(([reason, count]) => allowed.has(reason) && isNonNegativeInteger(count));
}

function assertNoDuplicateManifestSubjects(manifest: IntegrityManifestV2): void {
  const seen = new Set<string>();
  for (const subject of manifest.subjects) {
    const key = canonicalize([subject.kind, subject.subject]);
    if (seen.has(key)) throw new Error("integrity manifest has duplicate subject entries");
    seen.add(key);
  }
}

function assertValidReportState(value: unknown): asserts value is NormalizedIntegrityReportStateV2 {
  if (!isObject(value) || !hasExactKeys(value, [
    "schema", "manifestHash", "pairMicro", "subjectMacro", "validPairCount",
    "includedSubjectCount", "excludedPairCounts", "subjectFailureCounts",
  ])) throw new Error("normalized report state is invalid");
  if (value.schema !== INTEGRITY_SCHEMA_V2 || typeof value.manifestHash !== "string" || value.manifestHash.length === 0
    || !validSummary(value.pairMicro) || !validSummary(value.subjectMacro)
    || !isNonNegativeInteger(value.validPairCount) || !isNonNegativeInteger(value.includedSubjectCount)
    || value.pairMicro.n !== value.validPairCount || value.subjectMacro.n !== value.includedSubjectCount
    || !validReasonCounts(value.excludedPairCounts, PAIR_EXCLUSION_REASONS)
    || !validReasonCounts(value.subjectFailureCounts, SUBJECT_FAILURE_REASONS)) {
    throw new Error("normalized report state is invalid");
  }
}

export class EvalIntegrityV2Store {
  constructor(private readonly root: string) {}

  private get manifestPath(): string { return path.join(this.root, "manifest.json"); }
  private get manifestHashPath(): string { return path.join(this.root, "manifest.sha256"); }
  private get reportPath(): string { return path.join(this.root, "report-state.json"); }

  async createManifest(manifest: IntegrityManifestV2): Promise<StoredIntegrityManifestV2> {
    if (manifest.schema !== INTEGRITY_SCHEMA_V2) throw new Error("unsupported integrity manifest schema");
    assertNoDuplicateManifestSubjects(manifest);
    const bytes = canonicalize(manifest);
    const hash = sha256(bytes);
    const [existing, existingHash] = await Promise.all([readOptional(this.manifestPath), readOptional(this.manifestHashPath)]);
    if (existing !== null) {
      if (existing !== bytes) throw new Error("integrity manifest is immutable");
      if (existingHash === null) await writeExclusive(this.manifestHashPath, hash + "\n");
      return this.loadManifest();
    }
    if (existingHash !== null) throw new Error("integrity manifest is incomplete");
    await fs.mkdir(this.root, { recursive: true });
    await writeExclusive(this.manifestPath, bytes);
    try { await writeExclusive(this.manifestHashPath, hash + "\n"); }
    catch (error) {
      await fs.rm(this.manifestPath, { force: true });
      throw error;
    }
    return { schema: INTEGRITY_SCHEMA_V2, hash, manifest };
  }

  async loadManifest(): Promise<StoredIntegrityManifestV2> {
    const [bytes, expected] = await Promise.all([readOptional(this.manifestPath), readOptional(this.manifestHashPath)]);
    if (bytes === null || expected === null) throw new Error("integrity manifest is incomplete");
    const actual = sha256(bytes);
    if (actual !== expected.trim()) throw new Error("integrity manifest hash mismatch");
    let manifest: IntegrityManifestV2;
    try { manifest = JSON.parse(bytes) as IntegrityManifestV2; }
    catch { throw new Error("integrity manifest is invalid JSON"); }
    if (manifest.schema !== INTEGRITY_SCHEMA_V2 || canonicalize(manifest) !== bytes) {
      throw new Error("integrity manifest hash or canonical bytes invalid");
    }
    assertNoDuplicateManifestSubjects(manifest);
    return { schema: INTEGRITY_SCHEMA_V2, hash: actual, manifest };
  }

  private terminalPath(record: IntegrityTerminalRecordV2): string {
    const identity = canonicalize({
      manifestHash: record.manifestHash, kind: record.kind, subject: record.subject, evalId: record.evalId,
      repetition: record.repetition, side: record.side, treatmentId: record.treatmentId,
    });
    return path.join(this.root, "terminals", `${sha256(identity)}.json`);
  }

  private treatmentPair(manifest: IntegrityManifestV2, kind: string, subject: string): readonly [IntegrityManifestV2["treatments"][number], IntegrityManifestV2["treatments"][number]] {
    const scoped = manifest.treatments.filter(item => item.kind === kind && item.subject === subject);
    const candidates = scoped.filter(item => item.side === "candidate");
    const baselines = scoped.filter(item => item.side === "baseline");
    if (candidates.length !== 1 || baselines.length !== 1) throw new Error("manifest must declare exactly one candidate and baseline treatment per subject");
    return [candidates[0]!, baselines[0]!];
  }

  private validateTerminal(record: IntegrityTerminalRecordV2, stored: StoredIntegrityManifestV2): void {
    const manifest = stored.manifest;
    if (record.manifestHash !== stored.hash) throw new Error("manifest hash mismatch for terminal evidence");
    const subject = manifest.subjects.find(item => item.kind === record.kind && item.subject === record.subject);
    if (subject === undefined || !subject.evalIds.includes(record.evalId)) throw new Error("terminal subject or eval is not declared by manifest");
    if (!Number.isInteger(record.repetition) || record.repetition < 0 || record.repetition >= manifest.repetitions) throw new Error("terminal repetition is not declared by manifest");

    const [candidate, baseline] = this.treatmentPair(manifest, record.kind, record.subject);
    const selected = record.side === "candidate" ? candidate : baseline;
    if (selected.id !== record.treatmentId) throw new Error("terminal treatment does not match manifest side");

    const pair = record.pairKey;
    const taskHash = manifest.taskPayloadHashes[`${record.kind}/${record.subject}/${record.evalId}`];
    if (taskHash === undefined || pair.taskPayloadHash !== taskHash) throw new Error("terminal task payload does not match manifest");
    if (canonicalize(pair.fixtureHashes) !== canonicalize(manifest.fixtureHashes)) throw new Error("terminal fixture hashes do not match manifest");
    if (pair.executionEnvelopeHash !== integrityValueHash(manifest.executionEnvelope)) throw new Error("terminal execution envelope does not match manifest");
    if (pair.candidateTreatmentId !== candidate.id || pair.baselineTreatmentId !== baseline.id
      || pair.candidateTreatmentHash !== candidate.definitionHash || pair.baselineTreatmentHash !== baseline.definitionHash) {
      throw new Error("terminal treatment pair does not match manifest");
    }
    if (pair.runProvenanceId !== manifest.runProvenanceId) throw new Error("terminal run provenance does not match manifest");
    if (pair.graderId !== manifest.grader.id || pair.graderVersion !== manifest.grader.version) throw new Error("terminal grader does not match manifest");
    if (pair.rubricId !== manifest.rubric.id || pair.rubricVersion !== manifest.rubric.version) throw new Error("terminal rubric does not match manifest");
    if (record.grading !== null) {
      if (record.grading.graderId !== pair.graderId || record.grading.graderVersion !== pair.graderVersion) throw new Error("grading grader does not match pair key");
      if (record.grading.rubricId !== pair.rubricId || record.grading.rubricVersion !== pair.rubricVersion) throw new Error("grading rubric does not match pair key");
    }
  }

  async recordTerminal(record: IntegrityTerminalRecordV2): Promise<void> {
    if (record.schema !== INTEGRITY_SCHEMA_V2) throw new Error("unsupported terminal schema");
    const stored = await this.loadManifest();
    if (record.manifestHash !== stored.hash) throw new Error("manifest hash mismatch for terminal evidence");
    const file = this.terminalPath(record);
    if (await readOptional(file) !== null) throw new Error("duplicate terminal key");
    this.validateTerminal(record, stored);
    try { await writeExclusive(file, canonicalize(record)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("duplicate terminal key");
      throw error;
    }
  }

  async readTerminalKey(key: IntegrityTerminalRecordV2): Promise<IntegrityTerminalRecordV2 | null> {
    const bytes = await readOptional(this.terminalPath(key));
    if (bytes === null) return null;
    let record: IntegrityTerminalRecordV2;
    try { record = JSON.parse(bytes) as IntegrityTerminalRecordV2; }
    catch { throw new Error("terminal evidence is incomplete or corrupt"); }
    const manifest = await this.loadManifest();
    if (record.schema !== INTEGRITY_SCHEMA_V2 || canonicalize(record) !== bytes) throw new Error("terminal evidence failed integrity validation");
    this.validateTerminal(record, manifest);
    return record;
  }

  async isTerminalComplete(key: IntegrityTerminalRecordV2): Promise<boolean> {
    const record = await this.readTerminalKey(key);
    if (record === null) return false;
    return this.terminalIsComplete(record);
  }

  async writeReportState(state: NormalizedIntegrityReportStateV2): Promise<void> {
    assertValidReportState(state);
    const manifest = await this.loadManifest();
    if (state.manifestHash !== manifest.hash) throw new Error("manifest hash mismatch for report state");
    const bytes = canonicalize(state);
    const existing = await readOptional(this.reportPath);
    if (existing === bytes) return;
    if (existing !== null) throw new Error("normalized report state is immutable");
    await writeExclusive(this.reportPath, bytes);
  }

  async readReportState(): Promise<NormalizedIntegrityReportStateV2 | null> {
    const bytes = await readOptional(this.reportPath);
    if (bytes === null) return null;
    let state: unknown;
    try { state = JSON.parse(bytes) as unknown; }
    catch { throw new Error("normalized report state is invalid JSON"); }
    assertValidReportState(state);
    const manifest = await this.loadManifest();
    if (state.manifestHash !== manifest.hash || canonicalize(state) !== bytes) {
      throw new Error("normalized report state failed integrity validation");
    }
    return state;
  }

  private terminalIsComplete(record: IntegrityTerminalRecordV2): boolean {
    if (record.status !== "succeeded" || record.exclusion !== null || record.grading === null) return false;
    const grading = record.grading;
    if (!Number.isFinite(grading.score) || grading.expectedCriterionIds.length === 0
      || grading.parseStatus !== "parsed" || grading.validationStatus !== "valid") return false;
    const expected = new Set(grading.expectedCriterionIds);
    if (expected.size !== grading.expectedCriterionIds.length || grading.outcomes.length !== expected.size) return false;
    if (!grading.outcomes.every(outcome => expected.has(outcome.criterionId))
      || new Set(grading.outcomes.map(outcome => outcome.criterionId)).size !== expected.size) return false;
    const computedScore = grading.outcomes.filter(outcome => outcome.passed).length / expected.size;
    return grading.score === computedScore && grading.score >= 0 && grading.score <= 1;
  }

  private async hasCompleteTerminalMatrix(stored: StoredIntegrityManifestV2): Promise<boolean> {
    const { manifest } = stored;
    for (const subject of manifest.subjects) {
      let candidate: IntegrityManifestV2["treatments"][number];
      let baseline: IntegrityManifestV2["treatments"][number];
      try { [candidate, baseline] = this.treatmentPair(manifest, subject.kind, subject.subject); }
      catch { return false; }
      for (const evalId of subject.evalIds) {
        for (let repetition = 0; repetition < manifest.repetitions; repetition += 1) {
          for (const [side, treatmentId] of [["candidate", candidate.id], ["baseline", baseline.id]] as const) {
            const template = {
              schema: INTEGRITY_SCHEMA_V2, manifestHash: stored.hash, kind: subject.kind, subject: subject.subject,
              evalId, repetition, side, treatmentId,
            } as IntegrityTerminalRecordV2;
            const bytes = await readOptional(this.terminalPath(template));
            if (bytes === null) return false;
            let record: IntegrityTerminalRecordV2;
            try { record = JSON.parse(bytes) as IntegrityTerminalRecordV2; } catch { return false; }
            try {
              if (record.schema !== INTEGRITY_SCHEMA_V2 || canonicalize(record) !== bytes) return false;
              this.validateTerminal(record, stored);
            } catch { return false; }
            if (!this.terminalIsComplete(record)) return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Enumerate all terminal records persisted under root/terminals/.
   * Validates canonical bytes and manifest consistency for each file.
   * Throws on any corrupt file or duplicate slot identity
   * (kind × subject × evalId × repetition × side).
   * Offline only — does not launch any process.
   */
  async listTerminals(): Promise<IntegrityTerminalRecordV2[]> {
    const stored = await this.loadManifest();
    const terminalsDir = path.join(this.root, "terminals");

    let fileNames: string[];
    try {
      fileNames = (await fs.readdir(terminalsDir)).filter(e => e.endsWith(".json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const slotsSeen = new Set<string>();
    const results: IntegrityTerminalRecordV2[] = [];

    for (const fileName of fileNames) {
      const bytes = await readOptional(path.join(terminalsDir, fileName));
      if (bytes === null) continue;

      let parsed: unknown;
      try { parsed = JSON.parse(bytes); }
      catch { throw new Error(`terminal evidence is corrupt (invalid JSON): ${fileName}`); }

      if (!isObject(parsed as Record<string, unknown>)
          || (parsed as Record<string, unknown>)["schema"] !== INTEGRITY_SCHEMA_V2
          || canonicalize(parsed) !== bytes) {
        throw new Error(`terminal evidence is corrupt (invalid bytes or schema): ${fileName}`);
      }

      try {
        this.validateTerminal(parsed as IntegrityTerminalRecordV2, stored);
      } catch (e) {
        throw new Error(`terminal evidence is corrupt: ${fileName}: ${(e as Error).message}`);
      }

      const t = parsed as IntegrityTerminalRecordV2;
      const slotKey = `${t.kind}:${t.subject}:${t.evalId}:${t.repetition}:${t.side}`;
      if (slotsSeen.has(slotKey)) {
        throw new Error(`duplicate slot identity in terminal store: ${slotKey}`);
      }
      slotsSeen.add(slotKey);
      results.push(t);
    }

    return results;
  }

  async inspectCompatibility(): Promise<IntegrityCompatibility> {
    if (await readOptional(this.manifestPath) !== null) {
      const stored = await this.loadManifest();
      if (!await this.hasCompleteTerminalMatrix(stored)) {
        return { schema: INTEGRITY_SCHEMA_V2, historicalOnly: false, integrityEligible: false, subjectFailureReason: null, incompleteReason: "terminal_matrix_incomplete" };
      }
      const report = await this.readReportState();
      if (report === null) {
        return { schema: INTEGRITY_SCHEMA_V2, historicalOnly: false, integrityEligible: false, subjectFailureReason: null, incompleteReason: "report_state_missing" };
      }
      const subjectKeys = new Set<string>();
      const pairKeys = new Set<string>();
      for (const subject of stored.manifest.subjects) {
        const subjectKey = canonicalize([subject.kind, subject.subject]);
        if (subject.evalIds.length > 0) subjectKeys.add(subjectKey);
        for (const evalId of new Set(subject.evalIds)) {
          for (let repetition = 0; repetition < stored.manifest.repetitions; repetition += 1) {
            pairKeys.add(canonicalize([subject.kind, subject.subject, evalId, repetition]));
          }
        }
      }
      const excludedCount = Object.values(report.excludedPairCounts).reduce((sum, count) => sum + (count ?? 0), 0);
      const subjectFailureCount = Object.values(report.subjectFailureCounts).reduce((sum, count) => sum + (count ?? 0), 0);
      if (report.validPairCount !== pairKeys.size || report.pairMicro.n !== pairKeys.size
        || report.includedSubjectCount !== subjectKeys.size || report.subjectMacro.n !== subjectKeys.size
        || excludedCount !== 0 || subjectFailureCount !== 0) {
        return { schema: INTEGRITY_SCHEMA_V2, historicalOnly: false, integrityEligible: false, subjectFailureReason: null, incompleteReason: "report_state_inconsistent" };
      }
      return { schema: INTEGRITY_SCHEMA_V2, historicalOnly: false, integrityEligible: true, subjectFailureReason: null };
    }
    return { schema: "legacy-v1", historicalOnly: true, integrityEligible: false, subjectFailureReason: "schema_legacy_incomplete" };
  }
}
