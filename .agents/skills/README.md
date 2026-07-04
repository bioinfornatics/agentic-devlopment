# Goose Skills — Optimized Agentic Harness

This directory was rewritten as a compact skill library for Goose + Beads.

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
