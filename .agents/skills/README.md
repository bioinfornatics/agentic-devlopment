# Goose Skills — Optimized Agentic Harness

This directory was rewritten as a compact skill library for Goose + Beads.

## Agent ↔ Skill relationship

Agents are thin operating protocols (130–180 lines); skills hold the methodology depth. Each agent loads 1–2 skills via `load skill: <name>` at runtime:

| Agent | Skills loaded |
|---|---|
| harness-orchestrator | agentic-dev-harness, goose-orchestration, beads-harness |
| codebase-researcher | agentic-dev-harness, goose-orchestration |
| beads-planner | beads-harness, agentic-dev-harness |
| product-owner | sdd, agentic-dev-harness |
| architect | agentic-dev-harness, sdd |
| tdd-guide | agentic-dev-harness, systematic-debugging |
| implementation-worker | agentic-dev-harness, beads-harness |
| review-critic | code-review |
| principal-engineer | agentic-dev-harness, code-review |
| qa-automation | agentic-dev-harness, webapp-testing, systematic-debugging |
| ui-ux-auditor | ui-ux-quality, webapp-testing |

## Core skills

- `agentic-dev-harness` — master operating model.
- `beads-harness` — Beads commands and durable task graph semantics.
- `goose-orchestration` — Goose extensions, recipes, subrecipes, subagents, Summon.
- `sdd` — product engineering governance loop.
- `code-review` — review methodology.
- `ui-ux-quality` — unified UI/UX quality framework.
- `webapp-testing` — browser verification method.

Old copies are available in `~/.agents/skills.old`.

## Evaluations

Skill evaluations live outside the production skill packages in `evals/skills/`. Build or update those evals before expanding skill instructions, then keep each `SKILL.md` minimal enough to pass the observed scenarios.
