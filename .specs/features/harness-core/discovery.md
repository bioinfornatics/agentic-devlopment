# Discovery — Harness Eval Coverage Sprint

> Created: 2026-07-09
> Status: Active
> Scope: Close R1 gaps (7 ACs sans test) + consolidate harness quality

## Intent

The KG reveals 7 acceptance criteria (AC-RECIPE-02, AC-SKILL-02, AC-EVAL-01/02, AC-KG-01/02, AC-BEADS-01)
that have no linked test (R1:ac-test-gap). These ACs define harness quality but are only verified manually.

**Goal:** Create automated verifications (evals or unit tests) for each AC so the KG
`derived.jsonl` shows 0 R1 gaps on the harness itself.

## Users

- **Agent** — implementation-worker, review-critic who rely on harness correctness
- **Maintainer** — humans iterating on the harness who need a quality gate

## Success metrics

1. `node apps/kg/dist/cli.js reason` → R1:ac-test-gap = 0 for harness ACs
2. `pnpm -r test` → all green (apps/kg + apps/kg-visualizer)
3. `python3 scripts/analyze-skill-eval-results.py --check` → no negative deltas

## Implicit requirements sweep

| Dimension | Decision |
|---|---|
| Input validation | AC evals take recipe/skill names as input — validate they exist before running |
| Failure states | If eval infrastructure broken, report clearly (not silently skip) |
| Idempotency | KG pipeline runs idempotently — `node apps/kg/dist/cli.js pipeline` always safe |
| Observability | Each AC verification reports pass/fail to KG as `add_observations` |
| Auth/permissions | No auth needed — local project only |
| Data lifecycle | Test results are observations in KG (not persisted separately) |
| Concurrency | Eval suite supports --max-workers 3 (already implemented) |

## Non-goals

- Not automating WCAG UI tests (manual for now)
- Not CI/CD integration (manual trigger)
- Not multi-project KG federation
