# Spec: Evaluation-Driven Harness Remediation

> Status: Proposed
> Created: 2026-07-21
> Scope: agentic-devlopment-ojve

## Intent
Use layered run `20260720T205421Z` as evidence while preventing infrastructure failures from being misdiagnosed as harness defects.

## Acceptance Criteria

### EVAL-REM-01 — Evidence classification
WHEN a failed expectation is reviewed
THEN it SHALL be classified as infrastructure-invalid, fixture-invalid, or harness-behavioral with source evidence.

### EVAL-REM-02 — Remediation threshold
WHEN a harness artifact is changed
THEN at least two independent scenarios or one repeated systemic pattern SHALL support the change, and infrastructure-only evidence SHALL NOT justify it.

### EVAL-REM-03 — Completion-before-expansion
WHEN an agent has mandatory final artifacts
THEN its contract SHALL reserve execution budget, stop optional exploration/delegation, collect outstanding results, and emit every required final section before termination.

### EVAL-REM-04 — Contract-specific final forms
WHEN principal-engineer, architect, planner, or product-owner completes work
THEN it SHALL use its canonical required tables/gates/verdicts rather than a generic substitute.

### EVAL-REM-05 — Traceability
WHEN remediation is reviewed
THEN the evidence matrix SHALL identify affected subjects, failure class, artifact, action, and rerun gate.

### EVAL-REM-06 — Rerun gate
WHEN fixes are ready for evaluation
THEN targeted agent layer-delta runs SHALL have non-null grading for every scenario and SHALL show no negative delta before the remediation is declared effective.

## Non-goals
- Changing harness artifacts to compensate for missing fixtures, missing commands, grader parse failures, network failures, or truncated runs.
- Claiming effectiveness before a provider-backed rerun.
