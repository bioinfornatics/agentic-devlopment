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

Canonical skill evaluations live in `evals/skills/`. Each packaged skill also carries a mirrored `references/evals.json` so evaluation scenarios travel with the skill; update the canonical eval first, refresh the mirror, then keep each `SKILL.md` minimal enough to pass the observed scenarios.
