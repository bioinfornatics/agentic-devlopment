---
name: agentic-dev-harness
description: >
  Operate Goose and Beads as a unified agentic development harness: Goose runs tools/subagents/recipes;
  Beads persists tasks, dependencies, gates, memory, and handoffs.
metadata:
  version: 1.0.0
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

## Tool constraints (universal — apply in every session)

- **Never use `sudo`** or any privilege-escalation command.
  If a task requires elevated privileges, stop and do one of:
  1. Find a user-space alternative (e.g., install to `~/.local` instead of `/usr/local`).
  2. If no alternative exists, use elicitation: tell the user *exactly* which command needs sudo and *why*, then wait for them to run it.
- **Never use `kill -9` on arbitrary PIDs** — only stop processes you explicitly started.
- **Never use `sleep` or busy-wait loops** — use condition-based waiting (`bd gate`, `waitForSelector`, `waitForResponse`).
- If a required tool is missing, use elicitation: state which tool is missing, why it is needed, and ask the user to install it — do not attempt to install it with sudo.

## Delegation rules

## Required checkpoints

For durable edits, follow this observable order:

1. Inspect targeted context and Beads state.
2. Create or claim exactly one scoped bead before file writes; record the bead ID.
3. Emit a user-visible `Scoped plan` section before the first mutating command. A retrospective plan in the final answer is not sufficient.
4. Make the smallest scoped change.
5. Run targeted validation for changed files.
6. Stop after validation, Beads update/close, git status, and handoff; do not keep exploring.

For read-only reviews:

- Do not mutate files, Beads, or memory.
- State the delegation decision: either name the read-only delegated scopes or say direct inspection is sufficient.
- Include `Proposed Beads follow-ups` with issue titles or non-executed `bd create ...` examples for important follow-up work.

Final handoff must include: bead ID/status, files changed, validation commands/results, git status, remaining risks, and follow-ups.

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
