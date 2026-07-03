# Goose Agentic Development Harness Recipes

This recipe library is intentionally small and composable.

## Primary entrypoints

- `harness-master` — choose this for most work. It routes to research, plan, implement, review, web-test, or release.
- `harness-research` — read-only codebase and Beads investigation.
- `harness-plan` — create/update a Beads-backed executable plan.
- `harness-implement` — implement a claimed/scoped bead.
- `harness-review` — review code, tests, and Beads hygiene.
- `harness-web-test` — Playwright/accessibility/UI verification.
- `harness-release` — gated release orchestration.
- `sdd-master` — product-engineering governance on top of the harness.
- `ui-ux-suite` — full UI/UX quality workflow.

## Why this rewrite

Goose supplies runtime capabilities: extensions, skills, recipes, subrecipes, subagents, sessions.
Beads supplies durable control: issues, dependencies, gates, molecules/wisps, memory, sync.
The harness combines them: Goose does the work; Beads remembers, schedules, gates, and audits it.

## Restore old files

User-provided backups:

- `~/.config/goose/recipe.old`
- `~/.agents/skills.old`
