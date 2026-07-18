# AGENTS.md — Agentic Development Harness

README for agents working on this project. Child `AGENTS.md` files override these rules for their subdirectory.

## Setup

```bash
./scripts/install.sh          # install recipes/skills/agents into ~/.config/goose/
goose skills list             # verify 17+ domain skills visible
goose recipe validate .goose/recipes/dev.yaml  # spot-check a recipe
```

## Build

```bash
./scripts/build-docs.sh       # build HTML docs + KG pipeline
cd apps && pnpm install && pnpm build   # build TypeScript apps
```

## Harness layer model

Skills, agents, and recipes form a stacked hierarchy. Each layer adds structure on top of the one below:

```
Layer 0  nothing          plain Goose, no project content
Layer 1  skills           SKILL.md text injected into prompt — reusable methodology
Layer 2  agents + skills  agent spec gives persona; skill gives methodology
Layer 3  recipes          recipe orchestrates agents + skills into a named workflow
```

A/B evaluation measures the **marginal value** of each layer:

| Kind | Comparison | Default eval mode |
|------|-----------|-------------------|
| Skills | Layer 1 vs Layer 0 (skill vs nothing) | `with-without` |
| Agents | Layer 2 vs Layer 1 (agent+skills vs skills only) | `layer-delta` |
| Recipes | Layer 3 vs Layer 2 (recipe+agents+skills vs agents+skills) | `layer-delta` |

Full eval reference: `docs/15-skill-evaluations.md`

## What to load for maintenance work

Use this table when the task is to **maintain or extend** the harness itself.

| Task | Load skills | Agent pattern | Validate / test |
|------|------------|---------------|-----------------|
| Edit a skill `SKILL.md` | `code-review` | `review-critic` | `node apps/eval-hub/dist/index.js --run --layers skills --subjects <name> --ambient-goose --workers 5` |
| Add a new skill | `code-review`, `sdd` | `review-critic` → `architect` | Create `evals/skills/<name>.json` (3 scenarios); run suite |
| Edit an agent `.md` | `code-review` | `review-critic` | `node apps/eval-hub/dist/index.js --run --layers agents --subject <name> --ambient-goose` |
| Add a new agent | `code-review`, `sdd` | `review-critic` → `architect` | Create `evals/agents/<name>.json` with `"skills"` field (Layer 1 baseline); follow AD-001 |
| Edit a recipe `.yaml` | `code-review` | `review-critic` | `goose recipe validate <file>` then `node apps/eval-hub/dist/index.js --run --layers recipes --subject <name> --ambient-goose` |
| Add a new recipe | `code-review`, `sdd` | `review-critic` → `architect` | Follow AD-001; create `evals/recipes/<name>.json` with `"agents"` + `"skills"` fields |
| Edit specs `.specs/` | `sdd` | `architect` | `node apps/kg/dist/cli.js pipeline` after every structural change |
| Edit docs `docs/` | `code-review` | `review-critic` | `./scripts/build-docs.sh` |

## Generated documentation (AD-002)

Key sections in `README.md` and `docs/15-skill-evaluations.md` are **auto-generated**
from the actual files on disk — not maintained by hand. Running the generator is part
of every structural change workflow.

```bash
python3 scripts/generate-tables.py   # regenerate all marked sections
python3 scripts/check-consistency.py # verify counts and wiring
```

The pre-commit hook (`.git/hooks/pre-commit`) runs both automatically (source: `.agents/plugins/harness-consistency/scripts/pre-commit.sh`).
Install once: `./scripts/install-git-hooks.sh` (copies from plugin dir)

Generated sections (marked `<!-- BEGIN/END GENERATED: <section> -->`):

| Section | File | Source |
|---------|------|--------|
| `skills-table` | `README.md` | `.agents/skills/*/SKILL.md` |
| `agents-table` | `README.md` | `.agents/agents/*.md` |
| `eval-skills/agents/recipes` | `docs/15-skill-evaluations.md` | `evals/*/` |

**Do not edit generated sections by hand.** Edit the source files and re-run the generator.

---

## Change impact rules (CRUD)

Every structural change has downstream files that **must stay in sync**.
Run `python3 scripts/check-consistency.py` after any change to verify.
These rules encode every drift discovered in the project history.

### Skill added or removed

```
.agents/skills/<name>/SKILL.md                        ← the skill itself
→ python3 scripts/generate-tables.py                  regenerates README + eval map (AD-002)
→ docs/getting-started.md                             skill count in setup block  (manual)
→ .specs/architecture.md                              skill count in System Map   (manual)
→ .specs/features/harness-core/spec.md               AC-SKILL-01 table row       (manual)
→ evals/skills/<name>.json                            3 eval scenarios (normal/difficult/very_difficult)
→ node apps/kg/dist/cli.js pipeline
```

If referenced by agents, also update those agents' `load skill:` lines and their eval JSON `"skills"` fields.

### Agent added or removed

```
.agents/agents/<name>.md                              ← the agent itself
→ python3 scripts/generate-tables.py                  regenerates README + eval map (AD-002)
→ .specs/features/harness-core/spec.md               AC-AGENT-01 table row       (manual)
→ evals/agents/<name>.json                            eval file with "skills" field (Layer 1 baseline)
→ node apps/kg/dist/cli.js pipeline
```

Also: any recipe that delegates to this agent → update its eval JSON `"agents"` field.

### Recipe added, wiring changed, or removed

```
.goose/recipes/<name>.yaml                            ← the recipe itself
→ goose recipe validate .goose/recipes/<name>.yaml   MUST pass before proceeding
→ python3 scripts/generate-tables.py                  regenerates README + eval map (AD-002)
→ .specs/features/harness-core/spec.md               AC-RECIPE-01 list + AC-RECIPE-02 wiring row  (manual)
→ USE_CASES.md                                        chapter map row                              (manual)
→ evals/recipes/<name>.json                           eval file with "agents" + "skills" fields
→ docs/getting-started.md                             slash commands table (if new slash command)   (manual)
→ node apps/kg/dist/cli.js pipeline
```

Wiring-only change (skills/agents the recipe loads):
→ `goose recipe validate` first, then update AC-RECIPE-02 row + eval JSON fields only.

### Architecture decision added (STATE.md)

```
.specs/STATE.md                                       ← AD-NNN entry
→ .specs/features/harness-core/spec.md               reference from affected ACs
→ AGENTS.md                                           if the decision changes authoring rules (this file)
```

## Recipe authoring — AD-001

Every recipe **MUST** follow one of three patterns (full decision record: `.specs/STATE.md` → AD-001):

| Pattern | Recipes | Rule |
|---------|---------|------|
| **Specialist** | `review`, `implement`, `explore`, `plan`, `spec`, `design`, `discover`, `release`, `verify` | `load agent <specialist>` in-session. The session **is** the specialist. |
| **Orchestration** | `dev`, `sdd` | `load agent orchestrator` in-session. ALL specialists are summoned as isolated sub-sessions via `delegate`. |
| **Skill-only** | `remember` | Load skills only. No `load agent`. |

**Critical distinction:**
- `load agent X` — agent spec injected into the current session; the session *becomes* the agent.
- `delegate X` / Summon — agent spawned as a separate isolated session; parent session stays lean.

**Invariants:**
- Never load `orchestrator` alongside a specialist agent in the same session.
- A recipe's `"agents"` field in its eval JSON lists **only in-session** agents, not summoned ones.
- Validate every recipe edit: `goose recipe validate <file>`

## Testing

```bash
# Skills A/B evals — full suite (parallel, 5 workers)
node apps/eval-hub/dist/index.js --run --layers skills --continue-on-failure --ambient-goose --workers 5

# Single skill
node apps/eval-hub/dist/index.js --run --layers skills --subjects code-review --ambient-goose

# Agents A/B evals — layer-delta mode (agent+skills vs skills only)
node apps/eval-hub/dist/index.js --run --layers agents --continue-on-failure --ambient-goose --workers 5

# Recipes A/B evals — layer-delta mode (recipe+agents+skills vs agents+skills)
node apps/eval-hub/dist/index.js --run --layers recipes --continue-on-failure --ambient-goose --workers 5

# KG pipeline smoke test
node apps/kg/dist/cli.js bootstrap --dry-run
node apps/kg/dist/cli.js reason --rules
```

## Repository structure

```
.agents/agents/      # 12 named Goose agents (Summon + load agent)
.agents/skills/      # 18 domain skills + skill-creator tooling
.goose/recipes/      # 12 top-level recipes + 7 subrecipes
.specs/features/     # SDD specs — one spec.md per feature
.specs/STATE.md      # Architecture Decision Records (AD-NNN)
.knowledge/          # KG memory (memory.jsonl + derived.jsonl)
apps/kg/             # @harness/kg — TypeScript KG toolkit CLI
apps/kg-visualizer/  # @harness/kg-visualizer — Goose App MCP server
scripts/             # Harness-level scripts (install, build, consistency, hooks)
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
- **SDD loop** — spec (`.specs/features/*/spec.md`) before implementation. Claim bead before file write.
- **Specs** — WHEN/THEN/SHALL format, [FEAT]-NN IDs, stored in `.specs/features/[feature]/spec.md`.
- **KG** — run `node apps/kg/dist/cli.js pipeline` after every structural change to agents/skills/recipes.
- **Skills** — methodology in `SKILL.md`, not in recipes. Load with `load skills <name>`.
- **Recipes** — workflow verbs as names (`dev`, `review`, `implement`, `verify`…). Validate after every edit. Follow AD-001.
- **Evals** — agents and recipes default to `--mode layer-delta`; skills default to `--mode with-without`.

## Slash commands

`/dev` `/discover` `/spec` `/explore` `/plan` `/implement` `/review` `/verify` `/design` `/sdd` `/release` `/remember`

## Validation checklist (before committing)

```bash
# 1. Recipe validation
find .goose/recipes -name '*.yaml' | xargs -I{} goose recipe validate {}

# 2. Consistency check (counts, wiring, eval JSON fields)
python3 scripts/check-consistency.py

# 3. Skills visible
goose skills list | grep -c '|'           # expect 19+

# 4. KG smoke test
node apps/kg/dist/cli.js bootstrap --dry-run

# 5. Repo state
git status --short                         # expect clean or only expected changes
```
