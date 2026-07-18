# eval-hub — Architecture Plan
## TypeScript port of the post-suite Python scripts

> Status: **DESIGN** — implementation pending  
> Scope: port the 2 200 lines of `scripts/analyze-*.py`, `export-*.py`, `build-*.py`, `open-*.py`  
> Approach: DDD bounded contexts · SOLID · ports-and-adapters (hexagonal)

---

## 1. Domain map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         eval-hub domains                            │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  execution  │  │  analysis   │  │  measurement │  │reporting │ │
│  │  (exists)   │  │  (NEW ★)    │  │  (exists)    │  │(extend)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └────┬─────┘ │
│         │                │                │               │       │
│  ┌──────▼──────────────────────────────────▼───────────────▼─────┐ │
│  │                      persistence  (exists + extend)           │ │
│  │   FsWorkspaceReader · SqliteHistoryRepo · HistoryExporter ★   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────┐                                                    │
│  │ governance  │  (exists — consistency checks, unchanged)          │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Existing vs new

| Domain | File | Status |
|--------|------|--------|
| execution | `evalRunner`, `suiteRunner`, `layeredRunner` | ✅ exists |
| measurement | `deltaService`, `qualityGate` | ✅ exists |
| persistence | `workspaceReader`, `historyRepo`, `contentHash` | ✅ exists |
| reporting | `htmlBuilder` (trend only) | ⚠ partial |
| analysis | — | ❌ missing → **NEW** |
| persistence | `historyExporter` | ❌ missing → **NEW** |
| reporting | `reviewBuilder`, `analysisIndexBuilder` | ❌ missing → **NEW** |
| CLI | `--analyze`, `--report`, `--export-history`, `--open` | ❌ missing → **NEW** |

---

## 2. New value types  (`shared/types.ts` additions)

```typescript
// ── Analysis types ──────────────────────────────────────────────────

/** One parsed line from a stream-json events.jsonl file. */
export interface ParsedEvent {
  readonly turn:       number;
  readonly role:       "user" | "assistant" | "tool";
  readonly kind:       "message" | "tool_call" | "tool_result" | "error" | "system";
  readonly content:    string;
  readonly tool?:      string;
  readonly args?:      unknown;
  readonly durationMs?: number;
}

/** Ordered sequence of events for one (evalId × config × run) triple. */
export interface Timeline {
  readonly subject:        SubjectName;
  readonly evalId:         number;
  readonly config:         string;
  readonly events:         readonly ParsedEvent[];
  readonly totalTurns:     number;
  readonly durationMs:     number;
  readonly maxTurnsReached: boolean;
}

/** Something suspicious detected in a timeline. */
export interface Anomaly {
  readonly kind:     "repeated_command" | "model_error" | "browser_missing"
                   | "beads_missing"   | "scope_creep"  | "handoff_wrong";
  readonly message:  string;
  readonly turn?:    number;
  readonly severity: "warn" | "error";
}

/** One efficiency signal derived from the timeline. */
export interface EfficiencySignal {
  readonly kind:            "delegation_ok" | "tool_loop" | "scope_creep"
                          | "early_stop"    | "max_turns" | "under_budget";
  readonly turnsAffected:   number;
  readonly pct:             number;         // fraction of total turns
  readonly recommendation?: string;
}

/** Full analysis of one (subject × evalId × config × run). */
export interface RunAnalysis {
  readonly subject:       SubjectName;
  readonly evalId:        number;
  readonly config:        string;
  readonly timeline:      Timeline;
  readonly anomalies:     readonly Anomaly[];
  readonly efficiency:    readonly EfficiencySignal[];
  readonly rootCauses:    readonly string[];
  readonly mermaidSource: string;           // Mermaid sequence diagram
}

/** Aggregated analysis for all runs in one subject. */
export interface SubjectAnalysis {
  readonly subject:    SubjectName;
  readonly kind:       EvalKind;
  readonly runs:       readonly RunAnalysis[];
  readonly delta:      number;              // with − without pass-rate delta
  readonly skillImpact: "positive" | "neutral" | "negative";
}
```

---

## 3. New domain: `analysis/`

Maps directly to `analyze-skill-eval-results.py` (1 527 lines → ~5 focused classes).

### Ports (`analysis/ports.ts`)

```typescript
export interface IEventParser {
  /** Parse one events.jsonl file → ordered ParsedEvent[]. */
  parse(eventsJsonl: string): readonly ParsedEvent[];
}

export interface ITimelineBuilder {
  /** Build a timeline from parsed events + timing metadata. */
  build(events: readonly ParsedEvent[], meta: TimingRecord): Timeline;
}

export interface IAnomalyDetector {
  /** Detect anomalies in a completed timeline. */
  detect(timeline: Timeline, scenario: EvalScenario): readonly Anomaly[];
}

export interface IEfficiencyAnalyzer {
  /** Derive efficiency signals from a timeline. */
  analyze(timeline: Timeline): readonly EfficiencySignal[];
}

export interface IRootCauseClassifier {
  /** Map anomalies + grading signals → human-readable root causes. */
  classify(
    anomalies: readonly Anomaly[],
    grading:   GradingRecord,
    timing:    TimingRecord,
  ): readonly string[];
}

export interface ISequenceDiagramBuilder {
  /** Render a Mermaid sequence diagram from a timeline. */
  render(timeline: Timeline, title: string): string;
}

export interface IRunAnalyzer {
  /** Orchestrate all analysis steps for one run directory. */
  analyzeRun(
    runDir:   string,
    scenario: EvalScenario,
    subject:  SubjectName,
    evalId:   number,
    config:   string,
  ): Promise<RunAnalysis>;
}
```

### Implementations

| Class | Ports | Python origin | Responsibility |
|-------|-------|---------------|----------------|
| `EventParser` | `IEventParser` | `parse_events()` | Read JSONL → `ParsedEvent[]`, one class per event schema version |
| `TimelineBuilder` | `ITimelineBuilder` | `timeline_from_events()`, `browser_kind()`, `message_kind()` | Fold events into ordered `Timeline` |
| `AnomalyDetector` | `IAnomalyDetector` | `detect_bad_actions()`, `detect_model_errors()`, `repeated_commands()` | Pure detection, no I/O |
| `EfficiencyAnalyzer` | `IEfficiencyAnalyzer` | `analyze_efficiency()`, `efficiency_recommendations()` | Pattern matching on tool/turn sequences |
| `RootCauseClassifier` | `IRootCauseClassifier` | `classify_root_causes()` | Map signals → text |
| `MermaidSequenceDiagramBuilder` | `ISequenceDiagramBuilder` | `mermaid_sequence()`, `sanitize_mermaid()` | Pure string rendering |
| `RunAnalyzer` | `IRunAnalyzer` | `analyze_run()` | Orchestrates all above + reads FS via `IWorkspaceReader` |

### SOLID traceability

| Principle | Applied |
|-----------|---------|
| **S** | One class per analysis concern — `AnomalyDetector` knows nothing about Mermaid |
| **O** | Add new anomaly kinds by extending `Anomaly["kind"]` union, not modifying `AnomalyDetector` |
| **L** | Any `IEventParser` can replace `EventParser` — e.g. a v2 schema parser for future goose output formats |
| **I** | `IRunAnalyzer` is not split; all other interfaces are single-method or small cohesive groups |
| **D** | `RunAnalyzer` receives `IEventParser`, `ITimelineBuilder`, etc. via constructor injection |

### Testability
All five analysis classes are **pure functions wrapped in classes** — no I/O, only take typed data, return typed data. Full unit tests with inline fixtures, no temp dirs needed.

---

## 4. `reporting/` extensions

### New ports (`reporting/ports.ts`)

```typescript
export interface IReviewBuilder {
  /** Render a standalone HTML review page for one subject. */
  renderSubject(analysis: SubjectAnalysis, grading: GradingRecord[]): string;
}

export interface IAnalysisIndexBuilder {
  /** Render the index.html listing all subject reviews. */
  renderIndex(subjects: readonly SubjectAnalysis[]): string;
}
```

### New files

| File | Python origin | Responsibility |
|------|---------------|----------------|
| `reporting/reviewBuilder.ts` | `render_html_summary()`, `subject_analysis_md()`, `scenario_analysis_md()` | Per-subject HTML: timeline, Mermaid diagram, anomaly table, grading badges |
| `reporting/analysisIndexBuilder.ts` | `write_suite_summary()` | Aggregate index linking all subject reviews |
| `reporting/components/timeline.ts` | `timeline_from_events()` (HTML part) | Reusable HTML timeline component |
| `reporting/components/badge.ts` | `badge()`, `sat_badge()` | Pass/fail/delta badges |
| `reporting/components/sparkline.ts` | `sparkline()` | SVG inline sparkline |

The existing `HtmlReportBuilder` (trend dashboard) stays intact — it already covers `build-eval-report.py`'s `EvalData` + `render_*()` functions, though its data loading (`load_from_db`, `load_from_json`) needs to be wired to real `IHistoryReader` calls.

---

## 5. `persistence/` extension

### `historyExporter.ts` (new)

Maps `export-eval-history.py` (`export()` function):

```typescript
export interface IHistoryExporter {
  /** Read history from SQLite; merge with existing JSON; write. */
  export(opts: { dbPath: string; outFile: string; merge: boolean }): Promise<number>;
}

export class HistoryExporter implements IHistoryExporter { ... }
```

Single responsibility: DB rows → JSON file. Uses `IHistoryReader` (already exists in `persistence/ports.ts`), writes via `fs.writeFile`. Pure data transform, trivially testable.

---

## 6. CLI entry points

### `src/open.ts` (new, ~40 lines)

Maps `open-skill-eval-review.py`. Uses Node's `child_process.spawn` with `xdg-open`/`open`/`start` per platform. No domain logic.

```typescript
export async function startOpen(args: string[]): Promise<void>
// --open [--skill <name>] [--run <runId>]
```

### `src/analyze.ts` (new, ~80 lines)

Orchestrates: `FsWorkspaceReader` → `RunAnalyzer` → `ReviewHtmlBuilder` → `HistoryExporter` → write files.

```typescript
export async function startAnalyze(args: string[]): Promise<void>
// --analyze [--skill <name>] [--run <runId>] [--check] [--llm]
```

### `src/export.ts` (new, ~30 lines)

Thin wrapper around `HistoryExporter`.

```typescript
export async function startExport(args: string[]): Promise<void>
// --export-history [--db <path>] [--out <path>] [--no-merge]
```

### `src/report.ts` (new, ~50 lines)

Thin wrapper around `HtmlReportBuilder` wired to real `IHistoryReader`.

```typescript
export async function startReport(args: string[]): Promise<void>
// --report [--open]
```

### `src/index.ts` additions

```typescript
const wantAnalyze = args.includes("--analyze");
const wantExport  = args.includes("--export-history");
const wantReport  = args.includes("--report");
const wantOpen    = args.includes("--open");
```

---

## 7. Target file tree

```
apps/eval-hub/src/
├── domains/
│   ├── analysis/                         ← NEW
│   │   ├── ports.ts
│   │   ├── eventParser.ts
│   │   ├── timelineBuilder.ts
│   │   ├── anomalyDetector.ts
│   │   ├── efficiencyAnalyzer.ts
│   │   ├── rootCauseClassifier.ts
│   │   ├── sequenceDiagram.ts
│   │   ├── runAnalyzer.ts
│   │   └── __tests__/
│   │       ├── eventParser.test.ts
│   │       ├── timelineBuilder.test.ts
│   │       ├── anomalyDetector.test.ts
│   │       └── efficiencyAnalyzer.test.ts
│   ├── execution/                        ← exists, unchanged
│   ├── governance/                       ← exists, unchanged
│   ├── measurement/                      ← exists, unchanged
│   ├── persistence/
│   │   ├── historyExporter.ts            ← NEW
│   │   ├── ports.ts                      ← extend with IHistoryExporter
│   │   └── (existing files unchanged)
│   └── reporting/
│       ├── ports.ts                      ← NEW
│       ├── reviewBuilder.ts              ← NEW
│       ├── analysisIndexBuilder.ts       ← NEW
│       ├── htmlBuilder.ts                ← extend: wire to IHistoryReader
│       └── components/
│           ├── utils.ts                  ← exists
│           ├── badge.ts                  ← NEW (extracted from htmlBuilder)
│           ├── sparkline.ts              ← NEW
│           └── timeline.ts               ← NEW
├── analyze.ts                            ← NEW CLI entry
├── export.ts                             ← NEW CLI entry
├── report.ts                             ← NEW CLI entry
├── open.ts                               ← NEW CLI entry
├── run.ts                                ← exists
└── index.ts                              ← extend: 4 new flags
```

---

## 8. Dependency graph (direction = depends on)

```
index.ts
 ├── run.ts → LayeredRunner → SuiteRunner → SkillEvalRunner → GooseProcessRunner
 ├── analyze.ts
 │    ├── RunAnalyzer
 │    │    ├── EventParser          (pure)
 │    │    ├── TimelineBuilder      (pure)
 │    │    ├── AnomalyDetector      (pure)
 │    │    ├── EfficiencyAnalyzer   (pure)
 │    │    ├── RootCauseClassifier  (pure)
 │    │    ├── MermaidSequenceDiagramBuilder (pure)
 │    │    └── FsWorkspaceReader    (I/O adapter)
 │    ├── ReviewHtmlBuilder         (pure — in, string out)
 │    ├── AnalysisIndexBuilder      (pure)
 │    └── HistoryExporter           (I/O adapter)
 ├── export.ts → HistoryExporter → IHistoryReader
 ├── report.ts → HtmlReportBuilder → IHistoryReader
 └── open.ts   → child_process (platform open)

All domain classes depend only on interfaces from ports.ts.
No domain class imports from another domain (enforced by tsconfig paths if desired).
```

---

## 9. Test strategy

| Layer | Tool | Pattern |
|-------|------|---------|
| Pure analysis classes | vitest unit | Inline fixture data, no I/O |
| HTML builders | vitest snapshot | `expect(html).toMatchSnapshot()` |
| Persistence | vitest integration | `tmp` dir + real SQLite |
| CLI commands | vitest integration | Spawn node subprocess, assert exit + stdout |
| Server API | vitest + hono test client | Already established in `server/__tests__/api.test.ts` |

---

## 10. Sizing estimate

| New file | Est. lines | Python origin |
|----------|-----------|---------------|
| `analysis/eventParser.ts` | ~60 | `parse_events()` |
| `analysis/timelineBuilder.ts` | ~120 | `timeline_from_events()`, `browser_kind()`, `message_kind()` |
| `analysis/anomalyDetector.ts` | ~150 | `detect_bad_actions()`, `detect_model_errors()`, `repeated_commands()` |
| `analysis/efficiencyAnalyzer.ts` | ~200 | `analyze_efficiency()`, `efficiency_recommendations()` |
| `analysis/rootCauseClassifier.ts` | ~80 | `classify_root_causes()` |
| `analysis/sequenceDiagram.ts` | ~80 | `mermaid_sequence()`, `sanitize_mermaid()` |
| `analysis/runAnalyzer.ts` | ~100 | `analyze_run()` |
| `analysis/ports.ts` | ~60 | — |
| `reporting/reviewBuilder.ts` | ~200 | `render_html_summary()`, `subject_analysis_md()` |
| `reporting/analysisIndexBuilder.ts` | ~80 | `write_suite_summary()` |
| `reporting/components/badge.ts` | ~30 | `badge()`, `sat_badge()` |
| `reporting/components/sparkline.ts` | ~30 | `sparkline()` |
| `reporting/components/timeline.ts` | ~60 | HTML timeline render |
| `persistence/historyExporter.ts` | ~60 | `export-eval-history.py` |
| `src/analyze.ts` | ~80 | `main()` of analyze script |
| `src/export.ts` | ~30 | `main()` of export script |
| `src/report.ts` | ~50 | `main()` of report script |
| `src/open.ts` | ~40 | `open-skill-eval-review.py` |
| tests (×4) | ~400 | — |
| **Total** | **~1 900** | (replaces 2 200 Python lines) |

---

## 11. What is NOT ported (intentionally deferred)

| Python feature | Reason |
|---|---|
| `run_llm_analysis()` — calls goose to generate markdown commentary | Requires eval session; wire via `GooseProcessRunner` in a later iteration |
| `persist_analysis()` — writes to `analysis_runs` SQLite table | Depends on schema not yet in `historyRepo.ts`; add as part of `historyExporter.ts` extension |
| `recommended_action()`, `ranked_recommendations()` — ML-style scoring | Defer; depends on LLM analysis first |
| `scenario_quality()` — evaluates scenario design | Separate concern; belongs in `governance/` domain later |
