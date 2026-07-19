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
THEN every top-level recipe file in `.goose/recipes/*.yaml` has a corresponding eval JSON with 3 scenarios

### AC-EVAL-03 — Grader full coverage
WHEN grader runs
THEN it uses events.jsonl transcript (not stdout tail) so early tool calls are visible

### AC-EVAL-04 — Layer-delta agent eval

WHEN `run-harness-ab-suite.py --kind agents --mode layer-delta` runs
THEN each agent shows `with_agent+skills` pass_rate ≥ `skills_only` pass_rate
AND the `without_agent` baseline injects the supporting skills text (Layer 1) into both conditions
AND globally installed skills are hidden during the run via `temporarily_hidden_dirs`

### AC-EVAL-05 — Layer-delta recipe eval

WHEN `run-harness-ab-suite.py --kind recipes --mode layer-delta` runs
THEN each recipe shows `with_recipe+agents+skills` pass_rate ≥ `agents+skills_only` pass_rate
AND the `without_recipe` baseline injects the supporting agents + skills text (Layer 2) into both conditions

### AC-EVAL-06 — Layer declarations in eval JSON

WHEN an agent or recipe eval JSON is loaded
THEN every scenario has a `"skills"` array (agents) or `"agents"` + `"skills"` arrays (recipes)
AND each declared skill/agent exists under `.agents/skills/` or `.agents/agents/`

## Non-goals

- No parallel eval execution at scenario level (only at skill/recipe level)
- No automated enforcement of positive layer-delta on every commit (gate is manual)


### AC-EVAL-07 — Generative-driven design evaluation

WHEN a design or UX eval scenario requires exploration
THEN the enhanced condition SHALL generate at least two viable options before selecting one
AND the selection SHALL compare trade-offs against explicit goals, constraints, and acceptance criteria
AND validation SHALL include human, rubric, browser, accessibility, or judge evidence rather than preference-only prose.
