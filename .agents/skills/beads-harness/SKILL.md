---
name: beads-harness
description: >
  Beads operating manual for agents: prime, ready/claim/close, dependencies, memory, molecules, wisps, gates, and Dolt sync.
metadata:
  version: 1.0.0
---

# Beads Harness

Use Beads as the durable scheduler and audit log for agentic development.

## Core commands

```bash
bd prime                  # inject workflow + memories
bd ready --json           # claimable work
bd blocked --json         # blocked work and blockers
bd show <id> --json       # issue detail
bd update <id> --claim    # atomic claim
bd close <id> --reason "Done"
bd create "Title" -t task -p 2 --json
```

## Dependency semantics

## Selection discipline

When selecting work:

1. Run `bd prime` and `bd ready --json`.
2. If claimable work exists, claim exactly one issue with `bd update <id> --claim --json` before edits.
3. If no claimable work exists, say so explicitly, do not pretend a claim happened, and either stop or create a scoped issue only when the user asked for durable work.
4. Verify state with `bd show <id> --json` or a ready/blocked query before reporting success.

Keep Beads operations bounded. Once the requested Beads state is created, verified, and reported, stop.

`bd dep add B A` means **B needs A**. Use requirement language. Verify with `bd blocked`.

Blocking dependencies: `blocks`, `parent-child`, `conditional-blocks`, `waits-for`.
Non-blocking links: `related`, `discovered-from`, `replies-to`.

## Memory

```bash
bd remember "fact" --key stable-key
bd memories <keyword>
bd recall <key>
bd forget <key>
```

Do not create `MEMORY.md` files.

## Memory as navigation index

Prefer pointer memories over content memories to save tokens:

```bash
bd remember "Testing: canonical source is AGENTS.md#validation; read before changing tests; invariant: use the project default gate." --key testing-policy-pointer
```

A good pointer memory says:

```text
topic -> canonical file/section -> when to read -> one-line invariant
```

Do not store long documentation in memory. Update docs and remember a short pointer.

## Molecules and wisps

```bash
bd formula list
bd cook <formula> --dry-run
bd mol pour <proto-or-formula> --var k=v    # durable work
bd mol wisp <proto-or-formula> --var k=v    # ephemeral work
bd mol bond A B                             # compose graphs
bd mol squash <id> --summary "..."          # digest/persist
bd mol burn <id>                            # discard
bd mol wisp gc --dry-run
```

Use mols for durable feature work. Use wisps for patrols, diagnostics, temporary operations, and release runs where a digest is enough.

## Gates

```bash
bd gate create --blocks <issue> --type gh:run --await-id <run-id>
bd gate check --type gh:run
bd gate resolve <gate-id> --reason "passed"
```

Use gates for async waits instead of keeping an agent idle.

## Planning

Load this section when acting as a Beads planner. It is the canonical home for
planning methodology; agents and subrecipes load it rather than duplicating it.

### Four-Phase Planning Protocol

#### Phase 1 — Orient
1. `bd prime` — load workflow context and memories.
2. `bd list --json` — scan all open issues for related work.
3. `bd ready --json` — identify what is already claimable.
4. Search issue titles and descriptions for keywords matching the goal.
5. **Duplicate found** → report the bead ID, propose `bd dep add`, and stop.
6. **No duplicate** → proceed and list all keyword queries run.

#### Phase 2 — Decompose
1. Break the goal into milestones (epics) and atomic tasks.
2. Identify hard dependencies: which items must complete before others start.
3. Mark discovered follow-up work with `--deps discovered-from:<id>`.
4. Classify each item: `task` / `bug` / `feature` / `decision` / `chore` / `epic`.
5. Assign priorities: 1 (critical blocker) → 5 (nice-to-have).

#### Phase 3 — Graph
1. Output the dependency graph as a table first (visual sanity check).
2. Output exact `bd` commands in dependency order — parents first, children after.
3. Annotate every command with `# [reason this bead exists]`.
4. Sanity-check: every leaf has a parent; no cycles; no orphan discovered-work beads.

#### Phase 4 — Gates
1. For each milestone: define acceptance criteria + validation command + done signal.
2. Identify beads requiring `bd gate` (CI waits, human approval, external signals).
3. Recommend a molecule only if this workflow repeats across two or more projects.

### Command Reference

```bash
bd create "Title" --issue_type task -p 2 --json           # atomic task
bd create "Title" --issue_type epic -p 1 --json           # milestone epic
bd create "Title" --issue_type decision -p 2 --json       # ADR / decision bead
bd dep add <child-id> <parent-id>                         # child requires parent
bd create "Title" --deps discovered-from:<parent-id>      # discovered follow-up
bd update <id> --acceptance "criteria text"               # attach acceptance criteria
bd gate <id> --signal "CI green on branch X"              # register async gate
```

### Duplicate Check Protocol

| Situation | Action |
|---|---|
| Exact title match found | Report bead ID; do not create; propose `bd dep add` |
| Partial / keyword match | Report match; ask for clarification before creating |
| No match found | Proceed; list all checked keyword queries in output |
| Match found but closed | Create new with `--deps discovered-from:<old-id>` |

### Dependency Ordering Rules

1. Epics must be created before their child tasks.
2. Decision beads (ADRs) must precede every task they constrain.
3. Infrastructure and setup beads must precede feature beads that depend on them.
4. Discovered follow-up beads are always created last with `--deps discovered-from`.

### Prohibited Planning Actions

- Never create a bead without completing the duplicate check first.
- Never use markdown TODO lists as planning output — Beads issues only.
- Never store the plan itself in Beads memory — plans belong in issues, facts in memory.
- Never begin implementation — output graph and commands only.
- Never create more than one epic per goal without explicit user request.
- Never add fake dependencies to make the graph appear more sophisticated.

