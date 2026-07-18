# Goose Skills — Optimized Agentic Harness

This directory was rewritten as a compact skill library for Goose + Beads.

## Agent ↔ Skill relationship

Agents are thin operating protocols (130–180 lines); skills hold the methodology depth. Each agent loads 1–2 skills via `load skill: <name>` at runtime:

| Agent | Skills loaded |
|---|---|
| orchestrator | agentic-devlopment, goose-orchestration, beads |
| codebase-researcher | agentic-devlopment, goose-orchestration |
| planner | beads, agentic-devlopment |
| product-owner | sdd, agentic-devlopment |
| architect | agentic-devlopment, sdd |
| tdd-guide | agentic-devlopment, systematic-debugging |
| implementation-worker | agentic-devlopment, beads |
| review-critic | code-review |
| principal-engineer | agentic-devlopment, code-review |
| qa-automation | agentic-devlopment, webapp-testing, systematic-debugging |
| ux-researcher | ux-quality / ui-quality, webapp-testing |
| ui-designer   | ux-quality / ui-quality, webapp-testing |

## Core skills

- `agentic-devlopment` — master operating model.
- `beads` — Beads commands and durable task graph semantics.
- `goose-orchestration` — Goose extensions, recipes, subrecipes, subagents, Summon.
- `sdd` — product engineering governance loop.
- `code-review` — review methodology.
- `ux-quality / ui-quality` — unified UI/UX quality framework.
- `webapp-testing` — browser verification method.

Old copies are available in `~/.agents/skills.old`.

## Evaluations

Skill evaluations live outside the production skill packages in `evals/skills/`. Build or update those evals before expanding skill instructions, then keep each `SKILL.md` minimal enough to pass the observed scenarios.
| atomic-design        | standalone (jwilger CC0) |
| cognitive-ux         | standalone (phazurlabs) |
| agentic-ux           | standalone (phazurlabs) |
| design-systems-arch  | standalone (phazurlabs) |
| frontend-blueprint   | standalone (TLC CC-BY-4.0) |
