# Spec: Layered Evaluation Integrity

> Status: Active
> Created: 2026-07-21
> Scope: agentic-devlopment-2q6b

## Intent
Ensure layered scores compare the intended harness layers using complete, same-scenario evidence from the exact layered run.

## Acceptance Criteria

### EVAL-INT-01 — Execute the recipe layer
WHEN a recipe candidate configuration runs
THEN Goose SHALL receive the resolved recipe through `--recipe`
AND the task prompt SHALL NOT simulate the recipe by merely preloading its agents and skills.

### EVAL-INT-02 — Exact-run provenance
WHEN a layered score is computed
THEN the runner SHALL read the content hash recorded beneath that layered run's subject directory
AND SHALL NOT substitute the latest canonical history hash.

### EVAL-INT-03 — Paired numeric evidence
WHEN either side of an eval ID has unavailable or non-numeric grading
THEN that eval ID SHALL be excluded from both sides
AND only candidate-minus-baseline pairs sharing the same eval ID SHALL contribute to the subject delta.

### EVAL-INT-04 — Honest denominator
WHEN a layer completes
THEN its persisted and emitted subject count SHALL equal subjects with at least one valid paired scenario
AND incomplete subjects SHALL NOT inflate the denominator.

### EVAL-INT-05 — Complete resume
WHEN resume inspects a subject
THEN it SHALL consider the subject complete only if every expected eval/config has a numeric grading
AND null, missing, or partial matrices SHALL be rerun.

### EVAL-INT-06 — Recipe source resolution
WHEN an eval subject names a worker subrecipe such as `amend-spec`
THEN source resolution and hashing SHALL locate `.goose/recipes/subrecipes/<name>.yaml`
AND missing subjects SHALL fail rather than silently receiving the empty-content hash.

## Non-goals
- Changing harness behavior to compensate for provider failures.
- Treating one corrected run as statistical significance.
- Automatically weakening grader expectations.
