# AGENTS.md — Agentic Development Harness

README for agents working on this project. Child `AGENTS.md` files override these rules for their subdirectory.

## Setup

```bash
./scripts/install.sh          # install recipes/skills/agents into ~/.config/goose/
goose skills list             # verify 14+ skills visible
goose recipe validate .goose/recipes/dev.yaml  # spot-check a recipe
```

## Build

```bash
./scripts/build-docs.sh       # build HTML docs + KG pipeline
cd apps && pnpm install && pnpm build   # build TypeScript apps
```

## Testing

```bash
# Skill A/B evals (slow — 1-2h full suite)
python3 scripts/run-skill-ab-suite.py --continue-on-failure --ambient-goose --max-workers 3

# Single skill
python3 scripts/run-skill-ab-suite.py --skills code-review --ambient-goose

# Recipe / agent evals
python3 scripts/run-harness-ab-suite.py --kind recipes --ambient-goose

# KG pipeline smoke test
node apps/kg/dist/cli.js bootstrap --dry-run
node apps/kg/dist/cli.js reason --rules
```

## Repository structure

```
.agents/agents/      # 12 named Goose subagents (Summon)
.agents/skills/      # 14 Goose skills (loaded by recipes/agents)
.goose/recipes/      # 12 top-level recipes + 7 subrecipes
.specs/features/     # SDD specs — one spec.md per feature
.knowledge/          # KG memory (memory.jsonl + derived.jsonl)
apps/kg/             # @harness/kg — TypeScript KG toolkit CLI
apps/kg-visualizer/  # @harness/kg-visualizer — Goose App MCP server
scripts/             # Build, eval, install Python scripts
docs/                # Use-case playbooks and reference docs
evals/               # A/B eval scenarios (skills/, agents/, recipes/)
```

## Code style

- **TypeScript** (apps/) — strict mode, NodeNext modules, pnpm
- **Python** (scripts/) — 3.14+, no type annotations required
- **Markdown** (docs/, .specs/, .agents/) — no line length limit, GFM
- **YAML** (recipes) — validate with `goose recipe validate` after every edit

## Key conventions

- **Tasks** — use `bd create` / `bd update --claim` / `bd close`. Never markdown TODO files.
- **No sudo** — find user-space alternative or elicit from user.
- **SDD loop** — spec (.specs/features/*/spec.md) before implementation. Claim bead before file write.
- **Specs** — WHEN/THEN/SHALL format, [FEAT]-NN IDs, stored in .specs/features/[feature]/spec.md.
- **KG** — update .knowledge/memory.jsonl via `node apps/kg/dist/cli.js pipeline` after structural changes.
- **Skills** — methodology in SKILL.md, not in recipes. Load with `load skills <name>`.
- **Recipes** — workflow verbs as names (dev, review, implement, verify…). Validate after every edit.

## Slash commands

`/dev` `/discover` `/spec` `/explore` `/plan` `/implement` `/review` `/verify` `/design` `/sdd` `/release` `/remember`

## Validation checklist (before committing)

```bash
find .goose/recipes -name '*.yaml' | xargs -I{} goose recipe validate {}
goose skills list | grep -c '|'           # expect 19+
node apps/kg/dist/cli.js bootstrap --dry-run
git status --short                         # expect clean or only expected changes
```
