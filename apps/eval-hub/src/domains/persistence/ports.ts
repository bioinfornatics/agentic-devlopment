/** Persistence domain ports — workspace FS, history DB, content hashing. */
import type { EvalKind, ContentHash, SubjectName } from "../../shared/types.js";
import type { Result } from "../../shared/result.js";

// ── Content hasher ────────────────────────────────────────────────────────────

export interface IContentHasher {
  hash(paths: readonly string[]): Promise<ContentHash>;
}

// ── Workspace reader ──────────────────────────────────────────────────────────

export interface IWorkspaceReader {
  listSubjects(kind: EvalKind): Promise<SubjectName[]>;
  listRuns(kind: EvalKind, subject: SubjectName): Promise<RunManifest[]>;
  readGradings(kind: EvalKind, subject: SubjectName, hash: ContentHash): Promise<GradingRecord[]>;
  readGradingsAt(hashDir: string): Promise<GradingRecord[]>;
  readBenchmark(kind: EvalKind, subject: SubjectName, hash: ContentHash): Promise<BenchmarkFile | null>;
  readEvents(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run?: number): AsyncGenerator<string>;
  readLayeredState(layeredRunId: string): Promise<LayeredState | null>;
}

// ── Workspace writer ──────────────────────────────────────────────────────────

export interface IWorkspaceWriter {
  writeGrading(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, data: GradingResult): Promise<void>;
  writeTiming(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, data: TimingRecord): Promise<void>;
  writeBenchmark(kind: EvalKind, subject: SubjectName, hash: ContentHash, data: BenchmarkFile): Promise<void>;
  writePrompt(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, text: string): Promise<string>;
  appendEvent(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, config: string, run: number, line: string): Promise<void>;
  writeEvalMeta(kind: EvalKind, subject: SubjectName, hash: ContentHash, evalId: number, meta: Record<string, unknown>): Promise<void>;
}

// ── History DB ────────────────────────────────────────────────────────────────

export interface IHistoryReader {
  listRuns(filter?: HistoryFilter): Promise<HistoryRow[]>;
  findRun(runId: string): Promise<HistoryRow | null>;
  listResults(runId: string): Promise<ResultRow[]>;
  listImprovements(runId: string): Promise<ImprovementRow[]>;
}

export interface IHistoryWriter {
  recordRun(row: HistoryRow): Promise<void>;
  recordResults(rows: ResultRow[]): Promise<void>;
  recordImprovements(rows: ImprovementRow[]): Promise<void>;
}

// ── Value objects ─────────────────────────────────────────────────────────────

export interface RunManifest {
  readonly hash:       ContentHash;
  readonly path:       string;
  readonly modifiedAt: string;
}

export interface GradingRecord {
  readonly evalId:   number;
  readonly config:   string;
  readonly run:      number;
  readonly passed:   boolean;
  readonly score:    number;
  readonly feedback?: string;
}

export interface TimingRecord {
  readonly startedAt:       string;
  readonly completedAt:     string;
  readonly durationMs:      number;
  readonly turnsUsed:       number;
  readonly maxTurns:        number;
  readonly maxTurnsReached: boolean;
}

/** Written by grader into grading.json — mirrors GradingResult from execution/ports. */
export interface GradingResult {
  readonly summary: {
    readonly total:     number;
    readonly passed:    number;
    readonly failed:    number;
    readonly pass_rate: number | null;
  };
  readonly expectations: ReadonlyArray<{
    readonly text:     string;
    readonly passed:   boolean;
    readonly evidence: string;
  }>;
}

export interface BenchmarkFile {
  readonly subject:    SubjectName;
  readonly kind:       EvalKind;
  readonly runId:      ContentHash;
  readonly runSummary: Record<string, unknown> & { delta?: { pass_rate?: number } };
  readonly runs:       readonly Record<string, unknown>[];
}

export interface LayeredState {
  readonly layers: Partial<Record<EvalKind, {
    status:    "done";
    /** null when no valid pairs were found for this layer. */
    avgDelta:  number | null;
    n:         number;
    elapsedMs: number;
  }>>;
}

export interface HistoryRow {
  readonly runId:               string;
  readonly kind:                EvalKind;
  readonly subject:             string;
  readonly contentHash:         string | null;
  readonly gitCommit:           string | null;
  readonly gitDirty:            boolean;
  readonly provider:            string | null;
  readonly model:               string | null;
  readonly turnsUsedMean:       number | null;
  readonly maxTurnsMean:        number | null;
  readonly maxTurnsReachedRate: number | null;
  readonly createdAt:           string;
}

export interface ResultRow {
  readonly runId:          string;
  readonly evalId:         number;
  readonly configuration:  string;
  readonly passRate:       number | null;
  readonly turnsUsed:      number | null;
  readonly maxTurns:       number | null;
  readonly maxTurnsReached: number | null;
}

export interface ImprovementRow {
  readonly runId:     string;
  readonly metric:    string;
  readonly baseline:  number;
  readonly candidate: number;
  readonly delta:     number;
}

export interface HistoryFilter {
  kind?:    EvalKind;
  subject?: string;
  since?:   string;
  limit?:   number;
}
