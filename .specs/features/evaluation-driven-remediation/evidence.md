# Evidence Matrix — Layered Run 20260720T205421Z

## Decision rule
Only repeated behavioral evidence may change agent contracts. Missing fixtures, unavailable commands, panics, network errors, truncation, and null grader output are rerun blockers, not harness findings.

| Priority | Subject(s) | Evidence | Class | Action | Rerun gate |
|---|---|---|---|---|---|
| P0 | knowledge-graph, systematic-debugging, ux-quality, principal-engineer, tdd-guide | Null/parse-unavailable grading observed | infrastructure-invalid | Repair grader reliability; do not tune harness from these records | 100% non-null grading twice |
| P0 | implement, amend-spec, plan, review | Named bead/spec/diff artifacts absent in scenarios | fixture-invalid | Supply deterministic fixtures | No missing-artifact evidence |
| P0 | doc-review, harness-review | Worker panic/cancellation and unavailable `rg` prevented synthesis | infrastructure-invalid | Stabilize worker/tool environment | No panic/cancel/missing-command evidence |
| P1 | principal-engineer, architect, planner, product-owner | Across multiple scenarios, work expanded into inspection/delegation but omitted mandatory tables, gates, ADRs, scores, or final rulings | harness-behavioral | Add completion-before-expansion and canonical-final-form contract | Targeted agent evals: all non-null, delta >= 0 |
| P2 | harness-audit, doc-review, harness-review | Delegated work not collected before final answer or run termination | mixed | Address orchestration only after P0 rerun validity | Valid fixtures and completed delegates |

## Selected remediation
The P1 slice updates four currently unmodified agent contracts. Their existing eval expectations already assert the canonical artifacts, so eval JSON is unchanged: changing expectations to match failures would weaken the test.

## Success interpretation
Passing static validation proves contract coherence only. Effectiveness remains **unverified** until provider-backed targeted layer-delta reruns satisfy EVAL-REM-06.
