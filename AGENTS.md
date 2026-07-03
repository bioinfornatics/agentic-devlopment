# Agent Instructions — Agentic Development Harness

This repository packages a portable Goose + Beads harness. Treat it as operational infrastructure for agentic software development.

## Purpose

Maintain a clean, small, composable harness:

```text
Goose runtime + Beads durable control plane + SDD method
```

- Goose supplies extensions, skills, recipes, subrecipes, sessions, and subagents.
- Beads supplies durable issues, dependencies, gates, molecules/wisps, memory, and handoffs.
- SDD supplies the development loop: spec → graph → TDD → implementation → review → verification.

## Repository layout

```text
.agents/agents/       # Named Summon subagents
.agents/skills/       # Goose skills
.goose/               # Reserved for project-local Goose config if needed
.goose/recipes/       # Goose recipes and subrecipes
```

## Editing rules

1. Keep skills compact. Put durable methodology in skills, not duplicated in every recipe.
2. Keep recipes as routing/workflow wrappers. Do not paste long references into recipes.
3. Put specialized reusable worker flows in `.goose/recipes/subrecipes/`.
4. Use named agents for role/persona specialization only.
5. Do not reintroduce PEAF naming. The method is now **SDD**.
6. Prefer explicit `extensions` blocks so recipe capabilities are predictable.
7. If a recipe needs delegation, include platform extension `summon` unless `sub_recipes` auto-injection is sufficient.
8. Validate every changed recipe.
9. Keep Beads memory usage guarded: facts only, no tasks, no secrets; see `docs/14-memory.md`.

## Validation

Build docs after documentation changes:

```bash
./scripts/build-docs.sh
```

After changing recipes:

```bash
find .goose/recipes -name '*.yaml' -print -exec goose recipe validate {} \;
```

After changing skills:

```bash
goose skills list
```

Smoke render important recipes:

```bash
goose run --recipe ./.goose/recipes/harness-master.yaml \
  --params task="smoke test" \
  --render-recipe
```

## Install/update local Goose config

To install this repository's harness into the active Goose config:

```bash
./install.sh
```

PowerShell:

```powershell
./install.ps1
```

The install scripts must keep slash command idempotence: rerunning install should replace the managed `/harness`, `/review`, `/sdd`, etc. mappings, not append duplicates.

Manual copy remains possible:

```bash
mkdir -p ~/.config/goose ~/.agents
cp -a .goose/recipes ~/.config/goose/recipes
cp -a .agents/skills ~/.agents/skills
cp -a .agents/agents ~/.agents/agents
```

Use backups if replacing existing personal configuration.

## Beads usage for work on this harness

If this repository is Beads-enabled, use Beads for durable tracking:

```bash
bd prime
bd ready --json
bd update <id> --claim --json
bd close <id> --reason "Done" --json
```

Create follow-up work with:

```bash
bd create "Title" -t task -p 2 --deps discovered-from:<parent-id> --json
```

Do not use markdown TODO files as a durable issue tracker.

## Code review command

For read-only review of current changes:

```bash
goose run --recipe harness-review \
  --params task="review current diff" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Focus on correctness, maintainability, recipe validity, and harness coherence."
```

## Handoff expectations

When finishing changes, report:

- files changed;
- recipes validated;
- skills visible via `goose skills list` if relevant;
- install/update commands run or recommended;
- remaining risks or follow-up beads.
