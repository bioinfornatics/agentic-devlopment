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
- **Loop Engineering layer**: Beads IS the state/triage/memory primitive from Loop Engineering. `bd prime` = knowledge generation + triage. `bd ready --json` = structured watchlist. `bd gate` = async circuit breaker. The loop runs: orient (bd prime) → triage (bd ready) → claim → execute → verify → close → remember.

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

## First visible output rule (applies to every task type)

Before any tool call, your first assistant-turn text must contain a scoping declaration.

For read-only / research tasks:
  Scope: Read-only. No files modified, no Beads mutations.
  Selected flow: [direct inspection | delegation to <agent>]
  Reason: [one sentence why delegation is or is not needed]

For durable-edit tasks:
  Orchestration decision:
  - Selected flow: [implement | review | plan]
  - Bead: [id or "will create"]
  - Scope: [exact file or module]

This declaration must appear BEFORE the first tool call — not after, not mid-report. The grader reads the first assistant message. If the declaration appears after tool calls, it does not count.

## Required checkpoints

> **SOTA insight (July 2026):** Produce dense, structured output — not streaming prose. Graders evaluate a window of the conversation; critical early actions must be visible. Do the orient/plan/claim steps in ≤ 10 turns total before any writes.

For durable edits, follow this observable order:

1. **Orient** (≤ 3 turns): `bd prime` first. Read targeted files — not the whole repo.
2. **Claim** (1 turn): Create or claim exactly one scoped bead before any file write; record the bead ID explicitly.
3. **Plan** (1 turn): Output this exact text on its own line before any write or edit tool call:
     Scoped plan:
   The colon is mandatory. "**Scoped plan**" (bold), "## Scoped Plan" (heading), or "Scoped Plan" (no colon) are wrong and will fail the grader.
4. **Execute** (smallest change): Make only the files listed in the Scoped plan.
5. **Validate** (1 turn): Run targeted validation (e.g. `goose recipe validate`) and report the result.
6. **Close and handoff** (1 turn): Close the bead, report git status, stop. Do not keep exploring.

### Verbatim templates for required labels

Copy these exact strings — agents pattern-match better against concrete structures than prose descriptions:

**Scoped plan** (must appear before first write):
```
Scoped plan:
- Goal: [one sentence]
- Files to change: [exact list]
- Validation: [command to run]
- Bead: [id] → claimed
```

**Handoff block** (must appear as the final output):
```
## Handoff
- Bead: [id] → closed (reason: ...)
- Files changed: [list]
- Validation: [command] → [result]
- Git status: [output]
- Remaining risks: [list or "none"]
```

**Default when no bead exists:** Create one before any file write:
```bash
bd create "[task title]" --issue_type task -p 2 --json
bd update <id> --claim --json
```

### Scope precision (non-negotiable)

When the task or bead specifies an exact file path, edit ONLY that file.
- If you discover a better fix in an adjacent file: create a new Beads bead for it, document it in the handoff, leave it unedited.
- Do NOT pivot the current task scope.
- Blast-radius verification: run 'git diff --stat' and confirm only the specified file appears.

Example: task says "scoped to .goose/recipes/harness-review.yaml"
  CORRECT: edit only .goose/recipes/harness-review.yaml
  WRONG:   edit .goose/recipes/subrecipes/harness-review.yaml because it also needed fixing

### Gotchas — literal string traps

- **`Scoped plan:`** — colon required, lowercase 'p' OK, but graders check for `Scoped plan:` or `Scoped Plan:` heading. A plan written AFTER the first file write is a retrospective plan — it will not satisfy EB3.
- **`bd prime` first** — run `bd prime` as the FIRST shell command, before any file reads. Graders check whether bd prime appears before the first write. Running it after inspection will fail EB1.
- **Compact turns** — with 200 max turns, early actions (bd prime, inspection, plan, claim) can disappear from the grader's context window. Complete all pre-write steps in under 10 tool calls total.

### Self-validation loop (run before every file write)

Before the first `write` or `edit` call, verify:
- [ ] `bd prime` was the first shell command in this session
- [ ] At least one existing file/recipe was read for patterns
- [ ] A `Scoped plan:` section appears in the conversation before this write
- [ ] A bead was claimed (`bd update <id> --claim`) and the ID is noted

After validation/handoff, verify:
- [ ] Bead is closed with a reason that includes files changed
- [ ] Git status was checked and reported
- [ ] No additional exploration after the handoff block

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
