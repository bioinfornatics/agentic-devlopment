---
name: beads
description: >
  Load when managing tasks, dependencies, or work state that must persist across
  sessions. Provides all Beads commands: bd prime (orient and triage), bd create /
  bd update --claim / bd close (task CRUD), bd dep add (dependency graph),
  bd gate (async circuit breaker for CI/human/timer waits), bd remember
  (cross-session memory with pointer format). Use whenever starting a non-trivial
  task, orchestrating multi-step work, needing to track durable state, or recording
  discoveries for future sessions. The canonical task tracker for all harness work.
  Do NOT use for sessions with no durable task tracking needed, or in projects that have not adopted the Beads task tracker.
metadata:
  version: 1.0.0
---

# Beads Harness

Canonical Beads reference. All other skills that use Beads load this skill instead of duplicating commands.
Use Beads as the durable scheduler and audit log for agentic development.

## Knowledge generation — orient first

Before any planning or memory operation, generate context:
1. Run `bd prime` — loads workflow context, memories, and active issues.
2. Run `bd ready --json` — identifies claimable work.
3. Run `bd blocked --json` — reveals current blockers.
4. Scan issue titles and descriptions for keywords matching your goal.

Only after this context is loaded: proceed with planning, memory writes, or delegation.

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

## Beads as Loop Engineering state layer

Beads replaces Loop Engineering's STATE.md + triage + memory with a durable, dependency-aware, git-synced alternative:

| Loop Engineering need                | Beads command                                        |
|--------------------------------------|------------------------------------------------------|
| Triage — what to work on now         | `bd prime` + `bd ready --json`                       |
| Task progress — claim, update, close | `bd update <id> --claim` → work → `bd close <id>`    |
| Human inbox — what is blocked        | `bd blocked --json`                                  |
| Memory — cross-session facts         | `bd remember "..." --key <key>`                      |
| Attempt cap — escalate after N fails | comment count on bead + `bd update --status blocked` |
| Dependency graph                     | `bd dep add B A` (B needs A)                         |
| Async gate                           | `bd gate <id> --signal "CI green"`                   |
| Resolved / pruned                    | `bd close <id> --reason "..."`                       |

## Dependency semantics

When adding a dependency, state the direction explicitly:
- `bd dep add B A` means "B depends on A" — B cannot start until A closes.
- Use `--type blocks` for hard blockers, `--type related` for soft informational links, `--type discovered-from` for follow-up work found during a task.
- Never add circular dependencies — bd validates and rejects them.

Naming convention for dependency types:
| Type | Meaning |
|---|---|
| `blocks` (default) | B cannot start until A is closed |
| `related` | informational link; does not block |
| `discovered-from` | B was found while working on A |
| `partOf` | B is a sub-task of epic A |

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

### Exact pointer format (copy this template — agents pattern-match against concrete structures)

```bash
bd remember "<Topic>: canonical source is <file>#<section>; read when <trigger>; invariant: <one-line rule>." \
  --key <kebab-case-key>
```

**Verbatim example — copy the sentence structure exactly:**

```bash
bd remember "Release checklist: canonical source is docs/10-release-readiness.md; read when preparing a release; invariant: never copy checklist content into memory." \
  --key release-checklist-pointer
```

### Gotchas

- **"read when" not "read before"** — the trigger phrase must start with "read when <context>", not "read before <action>". The evaluator checks this exact wording.
- **Under 250 characters** — count before storing. The example above is ~130 chars.
- **Include `#section` if the file has named headings** — prefer `docs/file.md#release-checklist` over just `docs/file.md` when a specific section is the target.
- **Never use "read always"** — every pointer must name a specific trigger condition.

### Self-validation checklist (run before finalising any memory store)

Before calling `bd remember`, verify:
- [ ] Value starts with a topic, then "canonical source is", then file path
- [ ] Contains "read when <trigger>" (not "read before", not "read always")
- [ ] Contains "invariant: <one-line rule>"
- [ ] The total value is under 250 characters
- [ ] No checklist content, documentation body, or long prose in the value
- [ ] Key is kebab-case and describes the topic (not the file name)

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

| Situation               | Action                                              |
|-------------------------|-----------------------------------------------------|
| Exact title match found | Report bead ID; do not create; propose `bd dep add` |
| Partial / keyword match | Report match; ask for clarification before creating |
| No match found          | Proceed; list all checked keyword queries in output |
| Match found but closed  | Create new with `--deps discovered-from:<old-id>`   |

### Dependency Ordering Rules

1. Epics must be created before their child's tasks.
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

## Progressive disclosure

This skill's core commands are always in context. Load deeper references only when needed:
- Detailed dependency semantics → already in `## Dependency semantics` above
- Memory pointer format → already in `## Memory` above with verbatim template
- Planning protocol → already in `## Planning` above
- Molecules/wisps/gates → already in `## Molecules` and `## Gates` above
- End-of-session close protocol, `bd close` with full handoff, or session checkpoint → load `references/session-close.md`

For Loop Engineering context (scheduling, circuit breakers, multi-loop coordination):
- Load `docs/sota-knowledge-base.md#12` — Beads as Loop Engineering state layer
- Load `docs/sota-knowledge-base.md#11` — Loop Engineering patterns

## Lessons layer — pointer memories as crystallized Reflexion

Failed tests, grader failures, SPEC_DEVIATIONs, and surviving mutants are captured as
Beads pointer memories after diagnosis. This is the harness Reflexion layer.

### Key conventions
- Keys: lesson-<domain>-<NNN> (e.g., lesson-sdd-001, lesson-beads-001)
- Status in value: [candidate] or [confirmed: features X, Y]
- Load at session start: `bd memories --query lesson`

### Example
    bd remember "Pointer memories use 'read when' not 'read before' [confirmed: sdd-eval-0, adh-eval-2]." \
      --key lesson-sdd-001
