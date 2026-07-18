# eval-hub — Full Architecture Review
> Date: 2026-07-18 · Reviewer: goose  
> Scope: all TypeScript sources under `apps/eval-hub/src/`

---

## Verdict

The skeleton is **well-conceived**: ports-and-adapters structure, discriminated-union event bus,
`Result<T,E>` monad, clean branded scalar types, Goose discovery precedence correctly encoded.
The measurement domain and `gooseRunner.ts` are production-quality.

Several **critical correctness bugs** make the execution pipeline unreliable today, and a cluster
of **SRP violations** will make the codebase hard to maintain as it grows.  Priority list at the end.

---

## 1. What is working well (keep as-is)

| Item | Why it's good |
|------|--------------|
| `shared/events.ts` discriminated union | Clean `EvalEvent ⊂ SuiteEvent ⊂ LayeredEvent` hierarchy; exhaustive narrowing |
| `shared/result.ts` | Proper `Result<T,E>` monad; `tryAsync` prevents unchecked throw |
| `shared/types.ts` branded scalars | `ContentHash`, `SubjectName` etc. prevent accidental mixing |
| `shared/paths.ts` | `process.cwd()` fallback, Goose precedence rules documented, `AMBIENT_HIDE_DIRS` constant |
| `measurement/` domain | Pure functions, ISP-compliant ports, well-tested — model for the rest |
| `gooseRunner.ts` | Queue/resolve streaming pattern is correct; SIGKILL timeout guard |
| `historyRepo.ts` | WAL mode, bulk-write transactions, raw-row mapping isolated |
| `vitest.config.ts` | Coverage scoped to `domains/`, living-doc verbose reporter |
| `Semaphore` class | Bounded concurrency correctly implemented |

---

## 2. Critical bugs (wrong behaviour today)

### 2.1 All granular eval events are silently dropped  ★★★

**File:** `suiteRunner.ts:87`

```typescript
for await (const _ev of this.evalRunner.run(runCfg)) {
  // events streamed; could be forwarded to a channel for live updates
}
```

Every `GooseTurn`, `GooseToolCall`, `SubjectGraded` event is discarded.
The SSE server has a `// TODO: bridge LayeredRunner generator to SSE` comment for the same reason.
Live monitoring is **impossible** until this is fixed.

**Fix:** forward events to a caller-supplied `EventEmitter` or an injected `IEventSink`:
```typescript
// ports.ts
export interface IEventSink {
  emit(event: DomainEvent): void;
}
// suiteRunner — signature change
async *run(cfg: SuiteConfig, sink?: IEventSink): AsyncGenerator<SuiteEvent>
```
Then inside the inner loop: `for await (const ev of this.evalRunner.run(runCfg)) { sink?.emit(ev); }`.

---

### 2.2 `continueOnFail` does not stop execution  ★★★

**File:** `suiteRunner.ts:110-114`

```typescript
const settled = await Promise.allSettled(results);   // ← ALL subjects run here
// ...
for (const s of settled) {
  if (s.status === "rejected" && !cfg.continueOnFail) break; // ← only stops *emitting*
}
```

`Promise.allSettled()` runs every subject to completion before the loop is reached.
The `break` only stops *yielding events*, not execution.

**Fix:** use a completion channel that yields as each promise settles:
```typescript
async function* raceSettled<T>(ps: Promise<T>[]): AsyncGenerator<PromiseSettledResult<T>> {
  const pending = ps.map((p, i) => p.then(v => ({ i, v }), e => { throw { i, e }; }));
  // ... race pattern
}
```

---

### 2.3 `computeAvgDelta` does not use `DeltaService`  ★★

**File:** `layeredRunner.ts:134-197`

`LayeredRunner` re-implements pass-rate delta computation (60 lines) independently of the
`DeltaService` that exists precisely for this purpose.  They can diverge silently.

**Fix:** inject `IDeltaService` and delegate:
```typescript
// layeredRunner constructor
constructor(
  private readonly suite: ISuiteRunner = new SuiteRunner(),
  private readonly ds:    IDeltaService = new DeltaService(),
) {}
```
Then `collectGradingDeltas` reads grading.json via `IWorkspaceReader.readGradings()` and feeds
the result to `ds.passRate()` + `ds.delta()`.

---

### 2.4 `rglob()` reimplements existing capability  ★★

**File:** `layeredRunner.ts:198-208`

`LayeredRunner.rglob()` recursively globs for filenames.  `FsWorkspaceReader` already has
`readEvents()` and `readGradings()` that navigate the same directory tree.
Two independent traversals of the same tree will diverge when the layout changes.

**Fix:** inject `IWorkspaceReader` and use it:
```typescript
const gradings = await this.workspace.readGradings(kind, subject, hash);
```

---

### 2.5 `countFiles()` cast hack causes pre-existing TS error  ★★

**File:** `layeredRunner.ts:122-129`

```typescript
const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true }
  as Parameters<typeof fs.readdir>[1]);
for (const e of entries as Awaited<ReturnType<typeof fs.readdir>>) {
  if (typeof e === "object" && "name" in e && (e as { name: string }).name === name) count++;
}
```

`recursive: true` without `encoding: "utf8"` makes `name` a `Buffer`, not a `string`.
This is the source of the standing TS2352 error.

**Fix:**
```typescript
const entries = await fs.readdir(dir, { encoding: "utf8", withFileTypes: true, recursive: true });
for (const e of entries) {
  if (e.isFile() && e.name === name) count++;
}
```

---

### 2.6 `heuristicGrade` always returns `pass_rate: 0`  ★★

**File:** `evalRunner.ts:286-295`

When the LLM grader fails (network error, parse failure, goose crash), every expectation
is marked failed, `pass_rate = 0`.  This biases the A/B delta toward negative on unreliable
infra — the worst possible systematic error for an evaluation system.

**Fix:** return `pass_rate: null` (add `null` to the schema) to signal "grading unavailable",
and exclude these records from delta computation in `DeltaService`.

---

### 2.7 `GradingRecord.feedback` is `string | undefined` but port says `string`  ★

**File:** `persistence/ports.ts:77`, `workspaceReader.ts:55`

```typescript
export interface GradingRecord {
  // ...
  feedback: string;   // port says required string
}
// workspaceReader reads:
feedback: g.feedback  // g.feedback is string | undefined → TS2379
```

**Fix:** `feedback?: string` in `GradingRecord` and add `exactOptionalPropertyTypes` handling.

---

## 3. SRP / design violations

### 3.1 `SkillEvalRunner` is a God class  ★★★

**327 lines** doing 9 distinct concerns:

| Concern | Should be |
|---------|-----------|
| Prompt building | `IPromptBuilder` → `SkillPromptBuilder` |
| Stream-json parsing | `IStreamEventParser` → `GooseStreamEventParser` |
| LLM grading | `IGrader` → `LlmGrader` |
| Grading prompt construction | part of `LlmGrader` |
| Grading JSON parsing | part of `LlmGrader` |
| Heuristic fallback | `IFallbackGrader` → `HeuristicGrader` |
| File I/O (prompt, events, timing, grading) | `IWorkspaceWriter` → `FsWorkspaceWriter` |
| Goose process management | already `IGooseRunner` ✓ |
| Event emission | thin orchestration, stays in runner |

Extracting `IGrader` alone unlocks testability: inject a `MockGrader` that returns fixed
pass rates without spawning goose.

---

### 3.2 `RawScenario` duplicates `EvalScenario`  ★★

**File:** `evalRunner.ts:20-32`

`EvalScenario` in `shared/types.ts` was updated to snake_case fields (`query`, `expected_behavior`).
`RawScenario` in `evalRunner.ts` is now **identical** but kept as a private interface to justify
the `as unknown as RawScenario` cast.

**Fix:** remove `RawScenario` and the cast; use `EvalScenario` directly after updating
`loadScenarios()` to return `EvalScenario[]`.

---

### 3.3 `CONFIGS_BY_MODE` duplicates `LAYER_META`  ★★

**File:** `suiteRunner.ts:19-23`

```typescript
const CONFIGS_BY_MODE: Record<string, string[]> = {
  "with-without":  ["with_skill",  "without_skill"],
  "layer-delta":   ["with_agent",  "agents_only"],
  ...
};
```

`LAYER_META` in `shared/types.ts` already has `configs: readonly string[]` per `EvalKind`.
Two sources of truth for the same mapping.

**Fix:** derive from `LAYER_META`:
```typescript
const configs = LAYER_META[cfg.kind].configs;
```

---

### 3.4 `SqliteHistoryRepository` — sync wrapped in `Promise.resolve()`  ★

**File:** `historyRepo.ts` (all public methods)

`better-sqlite3` is synchronous.  All methods return `Promise.resolve(syncResult)`.
This is not wrong but misrepresents the contract and makes the interface `IHistoryReader`
look async when it isn't.

**Options (pick one):**
- Keep async signatures (good for future WAL async) — wrap with `setImmediate` to avoid
  blocking the event loop on heavy queries
- Change port to sync — `listRuns(): HistoryRow[]` — honest about the implementation

---

### 3.5 `server/index.ts` — module-level singletons, no DI  ★

```typescript
const history   = new SqliteHistoryRepository();  // opened at import time
const workspace = new FsWorkspaceReader();
// ...
```

Hard to test (can't inject mocks), hard to reconfigure (can't pass a test DB path).

**Fix:** `createApp(deps?: Partial<AppDeps>)` with injectable defaults:
```typescript
export interface AppDeps {
  history:   IHistoryReader & IHistoryWriter;
  workspace: IWorkspaceReader;
  delta:     IDeltaService;
  gate:      IQualityGate;
  checker:   ConsistencyChecker;
  report:    HtmlReportBuilder;
}
export function createApp(deps: AppDeps = defaultDeps()): Hono { ... }
```
The existing `server/__tests__/api.test.ts` already shows the pattern — it just needs wiring.

---

### 3.6 `IWorkspaceWriter` declared but never implemented  ★

**File:** `persistence/ports.ts:37-53`

The interface defines `writeGrading()`, `writeTiming()`, `writeBenchmark()`.  No implementation
exists.  All writing is done directly with `fs.writeFile()` inside `evalRunner.ts`.

**Fix:** implement `FsWorkspaceWriter implements IWorkspaceWriter`, inject it into
`SkillEvalRunner`, and remove all direct `fs.writeFile` calls from the runner.

---

## 4. Missing pieces

### 4.1 No event bridge to SSE  ★★★

`POST /api/evals/layered` returns a run ID but the SSE endpoint is:
```typescript
app.get("/api/evals/layered/:runId/events", async c => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ type: "connected", ... }) });
    // TODO: bridge LayeredRunner generator to SSE
    await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });
  });
});
```

**Root cause:** generators are pull-based; SSE is push-based.  Need a shared event bus:
```typescript
// shared/eventBus.ts
export class EventBus extends EventEmitter implements IEventSink {
  emit(event: DomainEvent): boolean { return super.emit("event", event); }
  on(event: "event", listener: (e: DomainEvent) => void): this { ... }
}
```
`LayeredRunner` publishes to the bus; SSE handler subscribes.  Map runs to bus instances via `runId`.

---

### 4.2 No `IGrader` port  ★★

Grading logic can never be unit-tested or swapped without the full goose binary.
Extracting the interface is a prerequisite for the `analysis/` domain (ARCHITECTURE.md).

---

### 4.3 Zero tests outside `measurement/`  ★★

| Domain | Test files | Coverage |
|--------|-----------|----------|
| `measurement/` | ✅ 2 test files | ~100% |
| `execution/` | ❌ 0 | 0% |
| `persistence/` | ❌ 0 | 0% |
| `reporting/` | ❌ 0 (file listed in tree but empty) | 0% |
| `governance/` | ❌ 0 | 0% |
| `server/` | ⚠ 1 (api.test.ts — tests stubs only) | ~10% |

---

### 4.4 `DeltaService.passRate()` has a TypeScript error  ★

```typescript
const samples = gradings
  .filter(g => g.config === config)
  .map(g => g.passed ? 1 : 0);   // inferred as (0 | 1)[]
const mean = n > 0 ? samples.reduce((a, b) => a + b, 0) / n : 0;
//                                              ↑ error: 0 | 1 not assignable to 0|1 return
```

**Fix:**
```typescript
.map(g => (g.passed ? 1 : 0) as number)
// or
const sum = samples.reduce<number>((a, b) => a + b, 0);
```

---

### 4.5 `gooaseCli` typo throughout the codebase  ★

`GooseRunConfig.gooaseCli`, `ScenarioRunConfig.gooaseCli`, `LayeredConfig.gooaseCli`, `run.ts`.
Should be `gooseCli`.  A find-replace is safe because it's used consistently everywhere.

---

### 4.6 30+ compile errors in `app/` TUI layer (pre-existing)  ★

`src/app/routes/*.ts` use `Box`, `AppShell`, `Badge` etc. with wrong casing against the
`@rezi-ui/node` beta API.  These block `tsc` from reporting a clean exit even when domain
code is correct.

**Fix:** update to lowercase API (`box`, `appShell`, `badge`) or gate the TUI behind a
`// @ts-nocheck` until the beta API stabilises.

---

## 5. Priority list

| # | Issue | Severity | File(s) | Effort |
|---|-------|----------|---------|--------|
| 1 | Events discarded in SuiteRunner | 🔴 critical | `suiteRunner.ts` | M |
| 2 | `continueOnFail` does not stop execution | 🔴 critical | `suiteRunner.ts` | M |
| 3 | `countFiles()` cast → TS error | 🔴 critical | `layeredRunner.ts` | XS |
| 4 | `heuristicGrade` bias (`pass_rate:0`) | 🔴 critical | `evalRunner.ts` | S |
| 5 | SSE endpoint is a stub | 🔴 critical | `server/index.ts` | L |
| 6 | `computeAvgDelta` duplicates `DeltaService` | 🟠 high | `layeredRunner.ts` | M |
| 7 | `SkillEvalRunner` God class → extract `IGrader` | 🟠 high | `evalRunner.ts` | L |
| 8 | `IWorkspaceWriter` not implemented | 🟠 high | `persistence/` | M |
| 9 | `DeltaService.passRate()` TS error | 🟠 high | `deltaService.ts` | XS |
| 10 | Remove `RawScenario` duplicate | 🟡 medium | `evalRunner.ts` | S |
| 11 | `CONFIGS_BY_MODE` → derive from `LAYER_META` | 🟡 medium | `suiteRunner.ts` | S |
| 12 | Server singletons → inject deps | 🟡 medium | `server/index.ts` | M |
| 13 | `rglob()` → use `IWorkspaceReader` | 🟡 medium | `layeredRunner.ts` | S |
| 14 | `GradingRecord.feedback` nullable | 🟡 medium | `persistence/ports.ts` | S |
| 15 | `gooaseCli` typo | 🟢 low | all | XS |
| 16 | Fix TUI `@rezi-ui` API casing errors | 🟢 low | `app/routes/` | S |
| 17 | Tests for `execution/`, `persistence/`, `server/` | 🟢 low | — | XL |

**Effort key:** XS < 30 min · S < 2 h · M < 1 day · L < 3 days · XL > 3 days

---

## 6. Architecture diagram (current vs target)

```
CURRENT (what exists)
─────────────────────────────────────────────────────────────────────────────
CLI (run.ts)
  └── LayeredRunner
        ├── SuiteRunner
        │     └── SkillEvalRunner ──── [God class: prompt+goose+grader+IO]
        │           └── GooseProcessRunner
        └── [DeltaService NOT used here — reimplements instead]

server/index.ts ──── singletons ──── all domain classes directly

IWorkspaceWriter ──── DECLARED, never implemented
IGrader          ──── ABSENT
IEventSink       ──── ABSENT
EventBus         ──── ABSENT

Events from EvalRunner ──── DROPPED in SuiteRunner ──── invisible to SSE

─────────────────────────────────────────────────────────────────────────────
TARGET (after fixes)
─────────────────────────────────────────────────────────────────────────────
CLI / HTTP / TUI
  └── LayeredRunner(suite, delta, workspace)
        └── SuiteRunner(evalRunner, sink)       ← IEventSink injected
              └── SkillEvalRunner(goose, prompt, grader, writer)
                    ├── GooseProcessRunner       ← IGooseRunner
                    ├── SkillPromptBuilder       ← IPromptBuilder   [new]
                    ├── LlmGrader(goose)         ← IGrader          [new]
                    └── FsWorkspaceWriter        ← IWorkspaceWriter [new]

EventBus (pub/sub)
  ├── Publisher: SuiteRunner.sink.emit()
  └── Subscribers: SSE handler, TUI, CLI progress printer

server/index.ts ──── createApp(deps) ──── injected interfaces
```
