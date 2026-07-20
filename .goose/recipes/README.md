# Goose Agentic Development Harness Recipes

This recipe library is intentionally small and composable.

## Primary entrypoints

- `dev` — main entry point, routes to any specialist workflow.
- `sdd` — SDD loop orchestration (spec→plan→implement→verify).
- `harness-review` — unified quality gate (scope: code/docs/full, output: json/markdown).
- `harness-audit` — forensic audit with KG reasoning and independent judge.
- `harness-research` — read-only codebase and Beads investigation.
- `harness-plan` — create/update a Beads-backed executable plan.
- `harness-implement` — implement a claimed/scoped bead.
- `harness-web-test` — Playwright/accessibility/UI verification.
- `harness-release` — gated release orchestration.
- `ui-ux-suite` — full UI/UX quality workflow.

## Why this rewrite

Goose supplies runtime capabilities: extensions, skills, recipes, subrecipes, subagents, sessions.
Beads supplies durable control: issues, dependencies, gates, molecules/wisps, memory, sync.
The harness combines them: Goose does the work; Beads remembers, schedules, gates, and audits it.

## Restore old files

User-provided backups:

- `~/.config/goose/recipe.old`
- `~/.agents/skills.old`
