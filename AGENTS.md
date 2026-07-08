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
./scripts/install.sh
```

PowerShell:

```powershell
./scripts/install.ps1
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

## Agent definition format

All named agents in `.agents/agents/` follow this format contract (Goose Summon format):

```markdown
---
name: <kebab-role>
description: "<Title>. Use PROACTIVELY when X, Y. Do NOT invoke when Z."
---

## Universal tool constraints

These apply to **every agent** in every session, regardless of role:

- **No `sudo`** — never use privilege escalation. Find a user-space alternative or use elicitation to ask the user to run the privileged command themselves.
- **No arbitrary process kills** — only stop processes you explicitly started.
- **No busy-wait / sleep loops** — use condition-based waiting.
- **No tool auto-install with sudo** — if a required tool is missing, elicit from the user.

## Prompt Defense Baseline
[6 universal injection-guard lines — identical in every agent]

You are [rich identity — 2-3 sentences with values, scope, distinguishing trait].

## Your Role
- [4-6 specific bullets]

## When to Invoke
**Invoke:** X, Y.
**Do NOT invoke when:** Z.

## Operating Process
### Phase N: Name
1. numbered step

## [Domain Protocol]
[decision table / checklist / quality gate specific to this role]

## Common False Positives
- [named anti-patterns the agent must not do]

## Output Format
```markdown
## Section: ...
```

## Reference
For [X], load skill: `skill-name`.

**Remember**: [one-sentence prime directive in bold]
```

**Format rules:**
- `name` is required. `description` and `model` are optional — no other frontmatter keys.
- `model` sets the preferred model when the agent is delegated to (e.g., `claude-opus-4-5` for planning/architecture, `claude-sonnet-4-5` for review/execution).
- `description` is the Summon routing signal — must say when to invoke AND when not to
- Prompt Defense Baseline is universal and verbatim across all agents
- Operating Process uses numbered steps (not bullet lists) inside phases
- False Positives section is mandatory — anti-noise is as important as positive rules
- Target length: 130–180 lines per agent

## Agent invocation patterns

```
# @ mention (chat interfaces with mention picker)
@review-critic review the current diff

# Natural language
Use the architect agent to design the caching layer.

# Explicit delegation — isolated session, result returned to current conversation
Delegate to implementation-worker: implement bead agentic-devlopment-abc.

# Load into current session — injects agent instructions without spawning a new session
Load the codebase-researcher agent, then map the blast radius of changing AuthService.

# Programmatic (Summon extension)
delegate(source: "review-critic", instructions: "Review the diff. Return verdict.")

# Bead-as-delegation-contract — routing embedded in the bead itself
bd create "Review auth PR" \
  --assignee review-critic \
  --description "Load agent review-critic. Review src/auth/. Return verdict + findings." \
  --issue_type task -p 2 --json
# Then the orchestrator delegates by reading the bead:
#   delegate(source: "<assignee>", instructions: "bd task <id>: <description>")
```

**Load vs Delegate:**
- **Load** — injects the agent's instructions into the current conversation context. The current session adopts the agent's role.
- **Delegate** — runs the agent in an isolated session. The agent cannot see the full parent conversation; only the delegation instructions and its own agent file.
- **Bead-as-contract** — the bead `--assignee` names the target agent; the `--description` carries the load instruction and task details. Both must match. The orchestrator reads the bead and delegates to the assignee — no separate routing logic needed.

**Hard constraints (goose runtime, not overridable):**
- `delegate()` is only callable from the top-level session — subagents cannot spawn subagents.
- Subagents cannot enable/disable extensions or manage scheduled tasks.
- Default subagent timeout: **5 minutes**. Timed-out subagents return no output.
- In goose's default autonomous permission mode, goose may spawn subagents without explicit instruction.

**Context window principle:** each subagent has its own isolated context window. Delegate aggressively — the orchestrator stays lean while subagents absorb their own context cost.

## Named agent roster (11 agents)

### Orchestration + Research
- `harness-orchestrator` — lead orchestrator for the SDD+TDD loop
- `codebase-researcher` — read-only architecture mapper, safe to parallelize
- `beads-planner` — Beads dependency graph builder

### SDD Roles
- `product-owner` — PRD + acceptance criteria with 100-point quality gate
- `architect` — system design, ADRs, trade-off analysis

### TDD Roles
- `tdd-guide` — RED→GREEN→REFACTOR + 80% coverage gate
- `implementation-worker` — scoped bead implementation with TDD
- `qa-automation` — full test pipeline: unit/integration/E2E + CI

### Review + Quality
- `review-critic` — confidence-filtered code review with proof requirement
- `principal-engineer` — blast radius, breaking changes, escalation path
- `ux-researcher`        — User research, personas, journey maps, usability testing
- `ui-designer`          — Design system, WCAG 2.2 AA compliance, browser-evidence a11y audit
- `atomic-design`        — Brad Frost component hierarchy (Atoms/Molecules/Organisms/Templates)
- `cognitive-ux`         — Laws of UX, Gestalt, cognitive biases applied to interface design
- `agentic-ux`           — Agentic AI interface patterns, trust calibration, AI safety UX
- `design-systems-arch`  — Token W3C architecture, component library patterns, governance
- `frontend-blueprint`   — Structured design consultation (discovery → design direction → build)

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
