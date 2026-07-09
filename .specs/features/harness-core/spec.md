# Spec: Harness Core — Recipes, Skills, Agents

> Status: Retro-spec (brownfield) — implementation predates this spec.
> Created: 2026-07-09
> Scope: feat-recipe-ecosystem · feat-skill-library · feat-agent-roster

## Context

The agentic development harness provides a composable SDD+Beads+Goose toolchain.
This spec documents acceptance criteria derived from the implemented system.

## Acceptance Criteria

### AC-RECIPE-01 — Recipe validation
WHEN `goose recipe validate` runs on all 12 top-level recipes
THEN all return "valid" with 0 failures

### AC-RECIPE-02 — Recipe workflow structure
WHEN a recipe is invoked
THEN it emits First Visible Output before any tool call
AND it loads the relevant skill (via `load skills <name>`)
AND it delegates to the correct agent (via `load agent <name>`)

### AC-SKILL-01 — Skill discoverability
WHEN `goose skills list` runs
THEN all 14 project skills are visible

### AC-SKILL-02 — Skill self-validation
WHEN an agent loads a skill
THEN the skill contains a self-validation checklist (- [ ] items)
AND the skill starts with a Knowledge Generation step

### AC-AGENT-01 — Agent format compliance
WHEN agents are loaded from .agents/agents/
THEN all 12 agents have: Prompt Defense Baseline, Operating Process, Output Format, Remember mantra

## Non-goals

- No performance benchmarks on recipe execution time
- No multi-user or concurrent session support
