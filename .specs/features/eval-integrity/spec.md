# Spec: Layered Evaluation Integrity

> Status: Active — architect and testability checks passed 2026-07-22
> Created: 2026-07-21
> Scope: agentic-devlopment-ymo5 (supersedes the earlier agentic-devlopment-2q6b integrity scope)

## Intent
Ensure layered evaluation scores compare the intended harness layers using complete, same-scenario evidence from the exact layered run. The contract prevents marginal-value claims from being produced when treatments, inputs, provenance, repetitions, graders, or summaries are not pairwise comparable.

## Global Requirement Mapping

| Global ID | Requirement theme | Acceptance criteria |
|---|---|---|
| GLOBAL-01 | Controlled paired treatments and invariant execution envelope | EVAL-INT-01, EVAL-INT-02, EVAL-INT-03, EVAL-INT-17 |
| GLOBAL-02 | Exact pair identity, provenance, immutable run manifest, and versioned persistence | EVAL-INT-04, EVAL-INT-05, EVAL-INT-11, EVAL-INT-19, EVAL-INT-20 |
| GLOBAL-03 | Symmetric missing/null/failure exclusion and honest denominators | EVAL-INT-06, EVAL-INT-12, EVAL-INT-17, EVAL-INT-18, EVAL-INT-20 |
| GLOBAL-04 | Criterion scoring, percentage-point deltas, summaries, and paired intervals | EVAL-INT-07, EVAL-INT-08, EVAL-INT-09, EVAL-INT-10 |
| GLOBAL-05 | Resume completeness and offline reproduction across CLI/state/JSON/HTML | EVAL-INT-11, EVAL-INT-12, EVAL-INT-13, EVAL-INT-14, EVAL-INT-19, EVAL-INT-20 |
| GLOBAL-06 | Grader reliability metadata and causal-claim limits | EVAL-INT-15, EVAL-INT-16 |

## Acceptance Criteria

### EVAL-INT-01 — Pair invariant execution envelope
WHEN the runner schedules the candidate and baseline sides for the same `kind`, `subject`, eval ID, and repetition
THEN both sides SHALL use the same user-task payload bytes, fixture content hashes, time budget, token budget, provider, model, decoding parameters (including temperature and seed when supported, otherwise the same recorded unset value), Goose runtime version, eval-hub runtime version, and working-directory-relative fixture paths
AND treatment bootstrap bytes SHALL be stored separately from the invariant user-task payload and SHALL contain only the layer-loading operation declared by EVAL-INT-02 and EVAL-INT-19
AND any mismatch in invariant fields SHALL mark the comparison pair as excluded with reason code `input_mismatch` before score or delta calculation.

### EVAL-INT-02 — Effective layer treatments
WHEN a layered evaluation runs for `kind=skill`, `kind=agent`, or `kind=recipe`
THEN the effective treatments SHALL be: skill candidate L1 = subject skill automatically loaded and baseline L0 = no subject skill, no harness agent, and no recipe; agent candidate L2 = subject agent automatically loaded with its declared skills and baseline L1 = the same declared skills loaded without the subject agent; recipe candidate L3 = the real resolved recipe invoked through Goose `--recipe` and baseline L2 = the configured recipe agents and skills loaded without invoking the recipe
AND the task prompt SHALL NOT simulate a higher layer by instructing the model to behave as a skill, agent, or recipe.

### EVAL-INT-03 — Repetition schedule completeness
WHEN a suite is configured with repetition count `R`
THEN `R` SHALL be an integer greater than or equal to 1, and every expected `kind`/`subject`/eval ID/treatment side SHALL be scheduled for repetition indexes `0` through `R-1`
AND reports SHALL expose the repetition index for every result and SHALL NOT aggregate across repetitions until pair validity has been evaluated per repetition.

### EVAL-INT-04 — Exact pair key
WHEN candidate and baseline results are considered for pairing
THEN they SHALL pair only when all pair-key fields match exactly: `kind`, `subject`, eval ID, repetition index, task payload hash, fixture hash set, candidate treatment ID, baseline treatment ID, candidate treatment content hash, baseline treatment content hash, run provenance ID, grader ID and version, and rubric ID and version
AND results with any missing or unequal pair-key field SHALL be excluded from both sides with reason code `input_mismatch` for task/fixture/execution-envelope fields, `provenance_mismatch` for treatment/content/run-provenance fields, `grader_mismatch` for grader fields, or `rubric_mismatch` for rubric fields, matching the first failing field category in that order.

### EVAL-INT-05 — Exact-run provenance
WHEN a layered score, pair key, or report references source content for a run
THEN the runner SHALL read the content hash recorded beneath that layered run's subject directory or immutable manifest
AND SHALL NOT substitute the latest canonical history hash, working-tree hash, or an empty-content hash for missing source content.

### EVAL-INT-06 — Symmetric missing, null, and failure exclusion
WHEN either side of a candidate/baseline pair has a missing result, null grade, non-numeric grade, execution failure, invalid grader output, or pair-key mismatch
THEN that pair SHALL be excluded symmetrically from candidate aggregates, baseline aggregates, deltas, subject-macro summaries, pair-micro summaries, and confidence intervals
AND a pair-level exclusion SHALL record exactly one primary reason code from `result_missing`, `grade_null`, `grade_non_numeric`, `execution_failed`, `grader_invalid`, `input_mismatch`, `provenance_mismatch`, `grader_mismatch`, or `rubric_mismatch`
AND a subject that cannot form pairs SHALL record exactly one subject-level reason code from `source_missing` or `schema_legacy_incomplete`; subject-level failures SHALL remain distinct from pair-level exclusions and SHALL NOT be counted as excluded pairs
AND missing, null, failed, or excluded values SHALL never be coerced to numeric zero in persisted state, CLI output, JSON output, HTML output, or summary calculations.

### EVAL-INT-07 — Criterion score formula
WHEN a grader returns per-criterion outcomes for an eval result
THEN the numeric score SHALL equal `passed_criteria_count / expected_criteria_count`, where `passed_criteria_count` counts only criteria explicitly marked passed and `expected_criteria_count` counts the rubric criteria expected for that eval ID
AND if `expected_criteria_count` is zero or absent, the result SHALL be invalid with reason code `grader_invalid` and SHALL NOT receive score `0`, score `1`, or any default numeric score.

### EVAL-INT-08 — Delta units are percentage points
WHEN a valid candidate/baseline pair has numeric scores
THEN the pair delta SHALL be `(candidate_score - baseline_score) * 100` and SHALL be labeled `percentage_points` or `pp`
AND reports SHALL NOT express the primary delta as relative percent change; for example candidate `0.75` and baseline `0.60` SHALL produce `+15.0 pp`, not `+25%`.

### EVAL-INT-09 — Subject-macro and pair-micro summaries
WHEN a run report is produced
THEN it SHALL include an explicit `subject_macro` summary computed as the arithmetic mean of per-subject mean paired deltas across subjects with at least one valid pair
AND it SHALL include an explicit `pair_micro` summary computed as the arithmetic mean of all valid pair deltas across all included subjects, eval IDs, and repetitions
AND each summary SHALL expose its denominator: included subject count for `subject_macro` and valid pair count for `pair_micro`.

### EVAL-INT-10 — Deterministic paired 95% interval
WHEN a summary has at least two observations in its applicable scope
THEN `pair_micro` SHALL compute its paired 95% interval as `mean_delta_pp ± t_0.975,n-1 * sample_standard_deviation_delta_pp / sqrt(n)` over all valid pair deltas, while `subject_macro` SHALL use the same formula over the per-subject mean paired deltas (one observation per included subject), and each report SHALL identify the method as `paired_t_95pct_pp_v1` and expose the corresponding observation count `n`
AND when the corresponding summary has fewer than two observations, the interval lower and upper bounds SHALL be absent or null and the summary SHALL carry reason code `insufficient_pairs`.

### EVAL-INT-11 — Immutable run manifest
WHEN a layered run starts
THEN it SHALL create an immutable manifest containing the CLI arguments, resolved subject list, eval IDs, repetition count, treatment definitions, source hashes, user-task payload hashes, treatment-bootstrap hashes, fixture hashes, provider, model, decoding parameters, time budget, token budget, Goose runtime version, eval-hub runtime version, grader ID and version, rubric ID and version, and output schema version `eval-integrity-v2`
AND after the first result is recorded, the manifest bytes and manifest hash SHALL remain unchanged for the lifetime of that run.

### EVAL-INT-12 — Resume completeness gate
WHEN resume inspects a previous run for a subject
THEN the subject SHALL be considered complete only if every expected eval ID, treatment side, and repetition has a terminal result with valid numeric criterion score, matching manifest pair-key fields, and all required persisted state needed to regenerate reports
AND null grades, missing results, failed executions, partial matrices, manifest mismatches, missing pair-key fields, or missing report state SHALL cause the affected work to be rerun or rejected as incomplete rather than counted as complete.

### EVAL-INT-13 — Offline reproduction
WHEN an operator reproduces a completed run from its saved manifest and persisted state without provider, model, network, or source-control access
THEN the reproduction SHALL regenerate the same CLI summary, machine-readable state, JSON report, and HTML report values for pair counts, exclusions, scores, deltas, intervals, provenance hashes, and summary denominators
AND the reproduction SHALL NOT make new provider calls, re-grade outputs, read the current working tree as source truth, or change the original manifest hash.

### EVAL-INT-14 — Cross-output report consistency
WHEN CLI output, persisted state, JSON report, and HTML report are produced for the same run
THEN all four outputs SHALL expose the same included pair count, excluded pair count by reason code, subject count denominator, score formula, candidate score, baseline score, delta in percentage points, interval bounds or `insufficient_pairs`, and manifest hash for each reported scope
AND any output that cannot represent one of those fields SHALL mark the run report invalid rather than silently omitting the field.

### EVAL-INT-15 — Grader reliability metadata
WHEN a grader produces or validates an eval result
THEN the persisted result SHALL include grader ID, grader version, rubric ID, rubric version, expected criterion IDs, per-criterion pass/fail outcomes, parse status, and validation status
AND results with unparseable grader output, unknown criterion IDs, duplicate criterion IDs, missing expected criterion outcomes, or a grader/rubric version mismatch against the pair key SHALL be excluded with reason code `grader_invalid`, `grader_mismatch`, or `rubric_mismatch` as applicable.

### EVAL-INT-16 — Causal-claim limits
WHEN a CLI, JSON, HTML, or persisted report describes layered deltas
THEN it SHALL describe them as observed paired differences for the configured eval suite, subjects, repetitions, grader, and runtime recorded in the manifest
AND it SHALL NOT state or imply that the layer caused the difference, proves general skill quality, or generalizes beyond the configured eval suite; reports with `insufficient_pairs` or intervals crossing zero SHALL NOT use the phrase `statistically significant` for that summary.

### EVAL-INT-17 — Recipe source resolution and real recipe execution
WHEN an eval subject names a recipe or worker subrecipe such as `amend-spec`
THEN source resolution and hashing SHALL locate exactly one concrete recipe file: an explicitly typed top-level subject at `.goose/recipes/<name>.yaml`, or an explicitly typed worker subrecipe at `.goose/recipes/subrecipes/<name>.yaml`; resolution SHALL NOT guess by basename across both locations, and an ambiguous or type-mismatched subject SHALL fail as `source_missing`
AND missing recipe or subrecipe source SHALL fail the subject with reason code `source_missing` rather than silently receiving the empty-content hash
AND recipe candidate execution SHALL pass the resolved recipe to Goose through `--recipe`.

### EVAL-INT-18 — Honest denominators
WHEN a layer, subject, or suite summary completes
THEN its emitted and persisted denominator SHALL count only subjects or pairs that satisfy the validity rules for that denominator
AND incomplete subjects, excluded pairs, missing sides, null grades, failed executions, and source-missing subjects SHALL be reported in the applicable pair- or subject-level exclusion counts but SHALL NOT inflate included subject counts, included pair counts, or score denominators.

### EVAL-INT-19 — Layer bootstrap boundary and typed treatments
WHEN the runner constructs a candidate or baseline invocation
THEN it SHALL select a typed treatment ID from `skill_l1`, `skill_l0`, `agent_l2`, `agent_l1`, `recipe_l3`, or `recipe_l2`, persist that ID and its definition in the manifest, and build the layer bootstrap independently from the invariant user-task payload
AND skill and agent treatment bootstrap SHALL use Goose's supported session instruction to load the declared skill or agent before the unchanged user task, recipe candidate SHALL use `--recipe`, and no bootstrap SHALL ask the model to imitate or role-play the evaluated layer
AND tests SHALL compare captured Goose arguments and exact persisted user-task payload hashes rather than relying on prompt substring differences alone.

### EVAL-INT-20 — Versioned persistence and legacy compatibility
WHEN eval-hub opens or imports persisted evaluation data
THEN new integrity runs SHALL write schema `eval-integrity-v2`, including the immutable manifest, repetition-aware terminal records, complete pair-key fields, grader/rubric metadata, exclusions, and normalized summaries required to reproduce every output offline
AND pre-v2 runs SHALL remain readable for historical display without destructive migration, but SHALL NOT enter integrity summaries unless all required v2 evidence can be reconstructed exactly; otherwise the subject SHALL be classified `schema_legacy_incomplete`
AND a crash or retry SHALL NOT overwrite a frozen manifest, duplicate a terminal result for the same manifest/treatment/eval/repetition key, or silently reinterpret legacy `run-1` as integrity evidence.

## Test Strategy

Every test assertion for this change SHALL cite one or more `EVAL-INT-*` IDs. RED tests are partitioned by Bead ownership so execution, measurement, persistence, and rendering can evolve behind typed ports.

| Test slice | Required deterministic cases | Primary seam | Owner |
|---|---|---|---|
| Treatments and scheduling | six typed treatments; captured `--recipe` vs session instructions; exact invariant task hash; `R=0`/fraction rejected; indexes `0..R-1`; timeout and nonzero exit terminal status; top-level/subrecipe/missing/type-mismatch resolution | fake `IGooseRunner`, temporary workspace, fake clock/runtime-version provider | `hlt7` |
| Pair validity and statistics | every pair-key mismatch; each null/non-numeric/failure reason; no zero coercion; criterion set empty/missing/duplicate/unknown; unequal subject sizes proving macro ≠ micro; hand-calculated t intervals for `n=1`, `n=2`, zero variance, and negative deltas | pure measurement fixtures with no filesystem/provider | `a96l` |
| Persistence contract | fresh v2 schema; v1 historical read; `schema_legacy_incomplete`; immutable-manifest second-write rejection; crash between manifest/result and idempotent resume; duplicate terminal-key rejection; byte-for-byte offline reload | temporary SQLite/workspace fixtures and injected filesystem failures | `agentic-devlopment-ymo5.1` |
| Reporting and resume | partial treatment matrix; null grade; failed execution; manifest mismatch; exact valid/excluded denominators; same normalized DTO rendered by CLI/state/JSON/HTML; `pp` labels; interval-crosses-zero language; no provider/source-control access during offline reproduction | normalized `IntegrityReport` golden fixture and provider that throws if called | `sur3` |

The implementation SHALL demonstrate RED before GREEN per slice and SHALL run unit tests, typecheck, build, consistency checks, and the KG pipeline before the epic closes.

## Non-goals
- Changing harness behavior to compensate for provider failures.
- Treating one corrected run as statistical significance.
- Automatically weakening grader expectations.
- Inferring production performance, user satisfaction, or universal model quality from this eval suite alone.
