# Spec: Evaluation Suite

> Status: Retro-spec (brownfield) — implementation predates this spec.
> Created: 2026-07-09
> Scope: feat-eval-suite

## Context

A/B evaluation framework comparing agent behavior with vs without skills/recipes loaded.

## Acceptance Criteria

### AC-EVAL-01 — Positive skill delta
WHEN `run-skill-ab-suite.py` runs on all skill evals
THEN every skill shows with_skill pass_rate ≥ without_skill pass_rate (no negative deltas)

### AC-EVAL-02 — Recipe eval coverage
WHEN recipe evals are listed
THEN all 12 top-level recipes have a corresponding eval JSON with 3 scenarios

### AC-EVAL-03 — Grader full coverage
WHEN grader runs
THEN it uses events.jsonl transcript (not stdout tail) so early tool calls are visible

## Non-goals

- No parallel eval execution at scenario level (only at skill/recipe level)
