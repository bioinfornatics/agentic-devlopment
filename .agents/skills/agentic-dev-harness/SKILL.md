---
name: agentic-dev-harness
description: >
  Operate Goose and Beads as a unified agentic development harness: Goose runs tools/subagents/recipes;
  Beads persists tasks, dependencies, gates, memory, and handoffs.
metadata:
  version: 1.0.0
  evals: references/evals.json
---

# Agentic Development Harness

Use this skill when doing software development, planning, research, review, release, or multi-agent orchestration.

## Mental model

- **Goose runtime**: extensions = capabilities; skills = methods; recipes/subrecipes = repeatable workflows; subagents = isolated workers.
- **Beads control plane**: beads = durable work units; dependencies = execution graph; gates = async waits; molecules/wisps = reusable/ephemeral workflows; memories = cross-session facts.

## Operating loop

1. **Orient**: `bd prime`, `bd context`, `bd doctor quick`, `bd ready --json`.
2. **Select work**: claim or create a bead before durable edits.
3. **Plan graph**: encode ordering with `bd dep add <issue> <depends-on>`.
4. **Delegate safely**: parallelize read-only research; partition write tasks by files/modules.
5. **Execute small**: implement the minimum correct change with tests.
6. **Capture discoveries**: create linked beads using `discovered-from`.
7. **Gate async waits**: use `bd gate` for CI/human/timer waits.
8. **Close/handoff**: close completed beads, run gates, report git status and remaining risk.

## Delegation rules

- Use subagents for isolation, not for forgetting responsibility.
- Give each subagent explicit scope, allowed files, output format, and whether it may write.
- Same-file writes by multiple subagents are forbidden.
- Subagents cannot coordinate with each other; the parent synthesizes.
- Prefer `async: true` for independent research, then `load(task_id)`.

## Durable-state rules

- Do not use markdown TODOs as the source of truth.
- Use `bd remember --key` for durable facts; keep facts atomic and update stale memories.
- Use pointer memories to route future agents to canonical files/sections instead of injecting long content.
- Use beads comments/notes/acceptance fields rather than burying decisions in chat.

## Load next

For Beads commands, load `beads-harness`. For Goose orchestration, load `goose-orchestration`.
