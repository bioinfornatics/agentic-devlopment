# Spec: Eval Feedback Report

> Status: Proposed
> Created: 2026-07-21
> Scope: agentic-devlopment-7dx8

## Intent
Turn persisted grader expectations into a safe, traceable final report that explains what failed and what to do next without requiring users to inspect scattered JSON files.

## Acceptance Criteria

### EVAL-FB-01 — Preserve grader evidence
WHEN the workspace collector reads a valid grading.json
THEN it SHALL preserve every expectation text, pass state, evidence, configuration, eval ID, subject, kind, and source path.

### EVAL-FB-02 — Deterministic insights
WHEN report data contains candidate and baseline outcomes
THEN the report SHALL classify regression, no-improvement, and improvement signals deterministically from pass-rate delta and failed candidate expectations.

### EVAL-FB-03 — Actionable recommendations
WHEN a candidate expectation fails
THEN the report SHALL emit a prioritized recommendation containing severity, subject, failed expectation, supporting evidence, configuration, eval ID, source provenance, and a concrete next action.

### EVAL-FB-04 — Safe standalone HTML
WHEN feedback contains HTML or script-like text
THEN all feedback fields SHALL be HTML-escaped and the standalone report SHALL not execute injected markup.

### EVAL-FB-05 — Empty and malformed states
WHEN no valid feedback exists or a grading file is malformed
THEN report generation SHALL continue, SHALL show an explicit no-feedback state, and SHALL retain valid results from other files.

### EVAL-FB-06 — Discoverable final output
WHEN `--report` completes
THEN the generated report SHALL contain a Feedback, Insights & Recommendations section in the same `dist/evals/report/index.html` output as scores and trends.

## Non-goals
- LLM-generated recommendations during report generation.
- Mutating harness files automatically.
- Replacing raw grading.json evidence.
