# Flaky test quarantine

## Active quarantines

None.

## Resolved quarantines

### `scripts/tests/unit/test_analyze_skill_eval_results.py`

- **Previously affected tests:** `GetEfficiencySummaryTest` and `EfficiencyRecommendationsTest`
- **Tracking issue:** `agentic-devlopment-105k`
- **Original symptom:** Ten executions failed during dynamic import with `FileNotFoundError` while `scripts/analyze-skill-eval-results.py` was absent; later executions passed after the implementation file appeared in the same working tree.
- **Root cause:** **Unstable workspace prerequisite**, not assertion nondeterminism. The test module dynamically imports a sibling implementation file, and concurrent/uncommitted workspace mutation changed whether that prerequisite existed.
- **Current disposition:** The implementation is present at the canonical path in this working tree and the maintained tests are collected from `scripts/tests/unit/`. No skip marker is active; `agentic-devlopment-105k` remains open until the prerequisite is tracked and stable in a clean checkout.
- **Removal evidence (2026-07-21):** Ten consecutive unit-suite runs passed (20 tests/run), exceeding the repeatability criterion. The classes remain enabled because the observed defect is now a deterministic missing-prerequisite failure in checkouts that lack the implementation, rather than intermittent assertion behavior.

## Current test evidence (2026-07-21)

- Python unit suite: 20/20 passed; branch coverage 96% (gate: 65%).
- Eval corpus integration suite: 3/3 passed.
- Eval-hub unit suite: 74/74 passed in each of 10 repetitions.
- KG visualizer suite: 3/3 passed in each of 10 repetitions.
- Eval-hub E2E API suite: 14/14 passed in each of 10 repetitions against `http://localhost:7331`. Playwright reused the pre-existing server (PID 2248995), so this run did not stop it.
- KG suite: 49/50 passed in each of 10 repetitions. The consistent `AC-EVAL-02` failure is deterministic and is **not quarantined**: every `evals/recipes/plan.json` scenario declares only `planner`, while the test currently requires both `architect` and `planner`.
- Eval-hub smoke command: `pnpm --filter @harness/eval-hub test:smoke` found no tests because Playwright's configured `testDir` is `./e2e`; this is a deterministic command/configuration defect, not a flaky test, and is **not quarantined**.

No newly flaky tests were observed, so no active quarantine was added.
