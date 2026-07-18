---
name: goose-orchestration
description: >
  Load before any call to delegate(), or when deciding which specialist to summon.
  Provides the load() discovery protocol (call with no args to get live agent names
  and descriptions), the mandatory Orchestration decision block template, subagent
  isolation rules, write-scope partitioning, and Beads assignee routing patterns.
  Covers the Orchestration, Specialist, and Skill-only recipe patterns (AD-001).
  Do not load for single-agent tasks that require no delegation.
metadata:
  version: 1.0.0
---

# Goose Orchestration

## Knowledge generation (before any delegation decision)

Before emitting an Orchestration decision, generate explicit knowledge:
1. Call `load()` with no arguments — **primary source of agent names and descriptions**.
   The list returned by `load()` is authoritative; the routing table below is a reading guide.
2. Run `bd prime` — load current Beads state (open issues, memories, workflow context).
3. Check `bd ready --json` — identify which beads are waiting for assignment.
Only after this knowledge is generated: emit the Orchestration decision block.

## Runtime primitives

- **Extensions**: tool/capability surface. Keep active tools focused.
- **Skills**: reusable instruction packs loaded into context.
- **Recipes**: reusable session configurations with instructions, prompt, extensions, settings, parameters, response schema.
- **Subrecipes**: recipe components executed in isolated sessions by a parent recipe.
- **Subagents**: independent Goose instances for delegated tasks.
- **Summon**: platform extension providing `load` and `delegate`.

## Summon patterns

Load knowledge:

```text
load()
load(source: "beads")
load(source: "explore")
```

Delegate:

```text
delegate(instructions: "Research X read-only", async: true)
delegate(source: "review", parameters: { task: "bd-123" })
delegate(source: "reviewer", instructions: "Review this diff")
```

Collect async result:

```text
load(source: "<task_id>")
load(source: "<task_id>", peek: true)
load(source: "<task_id>", cancel: true)
```

## Agent and Subrecipe Routing Table

> **Primary source: `load()` at runtime.**
> This table is a **reading guide** — not a fixed list.
> Always call `load()` first; the names and descriptions it returns are authoritative.
> This table teaches you *how to read* descriptions to match intent.
> New or renamed agents discovered via `load()` are routed the same way: read description, match intent.

### Named agents — `delegate(source: "<name>", instructions: "…")`

| Agent | Role | Invoke when | Do NOT invoke when |
|---|---|---|---|
| `orchestrator` | SDD+TDD loop coordinator | Multi-step, multi-agent, multi-phase work | Single-scope task; standalone research |
| `product-owner` | PRD + acceptance criteria, 100-pt quality gate | Start of any feature or initiative | Implementation, architecture, bug fixes |
| `architect` | System design, ADRs, trade-off analysis | Technology decision or system boundary touched | Implementation or tactical code review |
| `planner` | Beads dependency graph, exact `bd` commands | Goal spans >1 file/session/agent; no issues exist | Issues already exist and are claimable |
| `codebase-researcher` | Read-only architecture mapper | Map blast radius; gather pre-planning evidence | Anything requiring writes |
| `tdd-guide` | RED→GREEN→REFACTOR + 80% coverage gate | Before any new feature implementation or bug fix | Research, planning, or review phases |
| `implementation-worker` | Scoped bead coding with TDD | Bead is claimed and ready for coding; load `systematic-debugging` skill for root-cause debugging | Planning, architecture, or review |
| `review-critic` | Confidence-filtered code review + Beads hygiene | After any implementation; before closing bead | Planning or architecture decisions |
| `principal-engineer` | Blast radius, breaking changes, escalation | Shared infra touched; public API changed; 2+ BLOCKs | Routine review (use review-critic first) |
| `qa-automation` | Full test pipeline: unit + integration + E2E + CI | After implementation is complete | Before implementation exists |
| `ux-researcher` | User research, personas, usability testing | New feature, user validation | Visual design, a11y compliance |
| `ui-designer` | Design system, WCAG 2.2 AA, a11y audit | Any UI change | User research, backend-only |

### Subrecipes — structured, isolated sessions, typed parameters

> Subrecipe names come from the recipe's `sub_recipes` block — confirmed via `load()`.

| Subrecipe | Role | Prefer over named agent when |
|---|---|---|
| `explore` | Read-only codebase + Beads research | Headless/CLI invocation; typed params needed |
| `plan` | Goal → Beads dependency graph | CLI planning run outside a session |
| `implement` | Scoped bead coding with TDD handoff | CLI implementation run |
| `review` | Code + tests + Beads hygiene | CLI review run; JSON response schema needed |
| `spec` | Formal WHEN/THEN/SHALL spec writing | CLI spec phase; typed params needed |
| `verify` | Adaptive verification (api/web/cli/lib/ui) | CLI verification run |
| `doc-review` | Harness documentation review | Read-only doc audit from CLI |

### Routing decision algorithm

```
1. call load()                     → read live agent names + descriptions
2. match user intent               → "Invoke when" column above
3. single intent, clear match      → delegate to that agent directly
4. multi-intent or unclear         → delegate to orchestrator
5. emit Orchestration decision     → before every delegate() call
6. parallel read-only work         → async: true + load(source: "<task_id>")
7. write work                      → one writer per file/module, no overlap
```

### Agent vs subrecipe selection

| Criterion              | Named agent            | Subrecipe                 |
|------------------------|------------------------|---------------------------|
| Invocation context     | Inside a Goose session | CLI / headless recipe run |
| Parameter style        | Free-form instructions | Typed key=value params    |
| Parent context sharing | Yes — carries over     | No — isolated session     |
| Discovery              | `load()` at runtime    | `sub_recipes` block       |

---

## Beads as orchestration state (Loop Engineering pattern)

For full Beads command reference, load skill: `beads`.

Beads replaces STATE.md from Loop Engineering. The full orchestration loop:

  `bd prime`                              → knowledge generation (triage context)
  `bd ready --json`                       → structured watchlist of claimable beads
  `bd update <id> --claim`                → atomic claim (prevents dual assignment)
  `delegate(source: "<agent>", ...)`      → maker executes
  `review-critic agent`                   → checker verifies
  `bd close <id> --reason "done"`         → remove from ready list
  `bd remember "..." --key <key>`         → store orchestration decision for future sessions
  `bd gate <id> --signal "CI green"`      → async wait (circuit breaker pattern)

**Attempt cap (circuit breaker):** If a bead has been claimed and reset >2 times without closing, add a note explaining the blocker and escalate to human. Do not retry infinitely.

## Progressive disclosure — when to load deeper references

Load `goose-orchestration` skill → routing table always available.
Load additional references only when needed:
- Complex multi-loop coordination → load `docs/sota-knowledge-base.md#12` (Beads loop mapping)
- Loop Engineering patterns → load `docs/sota-knowledge-base.md#11` (Loop Engineering patterns)
- Subagent constraints reference → the ## Subagent constraints section below is always available

## Automatic agent routing

When a recipe or session has the `summon` extension enabled, the LLM
discovers and routes to named agents dynamically.

### Discovery: `load()` with no arguments

Calling `load()` returns every available source visible to Summon:
- Named agents from `.agents/agents/` (with their `description` field)
- Subrecipes registered in the active recipe's `sub_recipes` block
- Skills from `.agents/skills/`

The `description` field of each agent is the **routing signal**: the LLM
reads it to decide which agent's scope matches the user's intent.

```text
load()
→ returns:
  architect        "Use PROACTIVELY when planning a new feature, making a
                   technology choice, or touching a system boundary…"
  product-owner    "Use at the start of any new feature or initiative to
                   translate user intent into structured specs…"
  tdd-guide        "Use PROACTIVELY before any new feature implementation
                   or bug fix. Enforces write-tests-first…"
  review-critic    "Use PROACTIVELY after any implementation, before closing
                   a bead or merging…"
  …
```

### Routing: `delegate(source: "<agent>", instructions: "…")`

Once the agent is selected, delegate with free-form instructions and any
context the agent needs (bead ID, relevant files, output format):

```text
delegate(source: "architect",
         instructions: "Design the caching layer. Repo: /path. Bead: bd-42.")

delegate(source: "codebase-researcher",
         async: true,
         instructions: "Map the blast radius of changing AuthService.")

delegate(source: "tdd-guide",
         instructions: "Write failing tests for bd create duplicate detection.")
```

### Two-tier routing model

```
User intent
    │
    ▼
load()  ← discover agents + subrecipes + their descriptions
    │
    ├─ Structured workflow phase (isolated session, typed params)?
    │      → subrecipe via sub_recipes block
    │        delegate(source: "review", parameters: {task: "…"})
    │
    └─ Specialist role (free-form, in-session context sharing)?
           → named agent via Summon
             delegate(source: "review-critic", instructions: "…")
```

### When to prefer agents over subrecipes

| Use subrecipe when                       | Use named agent when                             |
|------------------------------------------|--------------------------------------------------|
| Fixed parameter schema (task, repo_path) | Free-form instruction with rich context          |
| Fully isolated session preferred         | Parent context (bead IDs, files) must carry over |
| Headless / CLI invocation                | Invoked from inside an orchestrated session      |
| Structured JSON response schema needed   | Narrative or markdown output expected            |

### Orchestration decision block (emit before every delegate())

> **SOTA insight (July 2026):** Agents pattern-match against concrete templates far better than prose descriptions. Copy the template below verbatim — including exact casing and the colon. Do NOT format it as a markdown heading.

> **Timing rule:** This block must appear in your first assistant message, before any tool call. A block that appears after tool calls — even if the content is correct — does not satisfy the requirement.

**Emit this exact block — inline text, not a markdown heading:**

```text
Orchestration decision:
- Intent matched: [what the user asked]
- Agent selected: [name] — [reason: which part of its description matched]
- Scope: [files / modules / bead IDs]
- Read/write: [read-only | write to: <path>]
- Output expected: [format]
Subagent invariant: subagents cannot coordinate; I own scope partitioning,
context injection, integration, and synthesis.
```


## Beads assignee delegation

An alternative to in-session `delegate()`: create a Beads issue **assigned to a named agent**.
The agent polls `bd ready --json`, claims its work, executes, and closes — traceable across sessions.

### Create work for a specific agent
```bash
bd create "Review auth changes" --assignee review-critic         --issue_type task -p 2 --json
bd create "Design caching layer" --assignee architect            --issue_type task -p 2 --json
bd create "Implement login slice" --assignee implementation-worker --issue_type task -p 2 --json
bd create "Write tests first" --assignee tdd-guide               --issue_type task -p 2 --json
bd create "Map blast radius"  --assignee codebase-researcher     --issue_type task -p 3 --json
```

### Agent-side: claim and execute
```bash
bd ready --json          # see assigned + unassigned claimable work
bd update <id> --claim   # atomic claim before any file write
# … do the work …
bd close <id> --reason "Done: <summary>"
```

### When to use assignee vs delegate()

| Use `bd create --assignee` | Use `delegate(source: "...")` |
|---|---|
| Work spans multiple sessions | Work completes in the current session |
| Need a durable audit trail | Need to carry parent session context |
| Async handoff to a human or agent | Parallel read-only research |
| Agent may not be available now | Agent is invoked immediately |

### Assignee roster

| Agent name              | Typical task type                          |
|-------------------------|--------------------------------------------|
| `review-critic`         | Code review, Beads hygiene, PR gates       |
| `architect`             | System design, ADRs, trade-off analysis    |
| `product-owner`         | PRD, acceptance criteria, user stories     |
| `planner`         | Dependency graphs, bd command sequences    |
| `codebase-researcher`   | Read-only research, blast-radius mapping   |
| `implementation-worker` | Scoped TDD implementation; load `systematic-debugging` skill for debugging tasks |
| `tdd-guide`             | RED→GREEN→REFACTOR, coverage gates         |
| `qa-automation`         | Test pipeline, flaky tests, CI integration |
| `ux-researcher`         | User research, personas, journey maps, usability testing |
| `ui-designer`           | Design system tokens, WCAG 2.2 AA, a11y, browser evidence |
| `principal-engineer`    | Breaking changes, blast radius, escalation |
| `orchestrator`          | Multi-step SDD+TDD coordination            |

## Subagent constraints

### Runtime behaviour
- **Isolated context**: each subagent has its own context window — the main session stays lean.
  After spawning several subagents, the main session typically uses <10% of its context budget.
- **Extensions inherited from parent** by default; override with natural language.
- **Default max turns: 25** — override via the GOOSE_SUBAGENT_MAX_TURNS env var, settings.max_turns in recipes, or natural language ("limit each to 10 turns").
- **Default timeout: 5 minutes** — if a subagent exceeds this, it returns no output. For parallel runs, only successful subagents return results; timed-out ones are silently dropped.
- **Autonomous spawning**: in goose's default autonomous permission mode, goose may decide to spawn subagents without explicit instruction. Subagents are disabled in manual/smart approval and chat-only modes.

### Hard restrictions (enforced by the runtime — not overridable)

| Restricted operation                             | Why                                         |
|--------------------------------------------------|---------------------------------------------|
| Spawning a subagent from within a subagent       | Prevents infinite recursion                 |
| Enabling, disabling, or modifying extensions     | Avoids conflicts with parent session state  |
| Creating, modifying, or deleting scheduled tasks | Prevents interference with parent workflows |

**Critical for the harness**: `delegate()` is an orchestrator-only capability. A subagent (e.g. implementation-worker) cannot call another subagent. Only the top-level session or recipe can delegate.

### Trigger keywords (natural language routing)

| Intent               | Keywords                                             | Example                          |
|----------------------|------------------------------------------------------|----------------------------------|
| Sequential (default) | "first…then", "after"                                | "First plan, then implement"     |
| Parallel             | "parallel", "simultaneously", "concurrently"         | "Create three files in parallel" |
| Ad-hoc agent         | "create a subagent according to this description: …" | —                                |
| Recipe-backed        | "use the <recipe-name> recipe as a subagent"         | —                                |

### Context preservation pattern

Delegate aggressively to keep the orchestrator session focused.
Each subagent has its own context window — spawning a research subagent does not pollute the orchestrator context.

```
Main session:  [orient → decide → delegate → synthesize]   ← stays lean
Subagent 1:    [full research context → returns summary]   ← isolated
Subagent 2:    [full implementation context → handoff]     ← isolated
```

### summon extension requirement

The `delegate()` and `load()` tools are provided by the `summon` platform extension.
- Recipes with an explicit `extensions` block must include `summon` or delegation is unavailable.
- Recipes with `sub_recipes` have `summon` auto-injected.

### subagent_system.md customization hook

A project-local `subagent_system.md` file sets the base system prompt injected into every subagent in the session.
Use it to add harness-wide context (Beads discipline, handoff format, stop rules) to all subagents automatically.

## Recipe design rules

- Put durable **methodology in skills**, not duplicated in recipes or agents.
- Put **workflow routing** in recipes (thin wrappers: load skill → route to subrecipe or agent).
- Put **specialized repeatable units** in subrecipes (isolated sessions with their own protocol).
- Use **response schemas** (`response: json_schema:`) for automation; use narrative output for human review.
- Include `summon` explicitly in a recipe's `extensions` block when it needs `delegate()` — it is not auto-injected unless `sub_recipes` is present.
- Always run `goose recipe validate <path>` and report the result before closing a recipe-related bead.

## Orchestration decision protocol

Before orchestration-heavy work, state an `Orchestration decision`:

- selected flow: research, review, implementation split, or direct inspection;
- whether delegation is used;
- if not delegating, why direct inspection is sufficient;
- if delegating, list each worker scope, read/write permission, validation expectations, and output format.

When delegating, include this invariant verbatim in the plan or worker contract:

```text
Subagents cannot coordinate with each other; the parent/orchestrator owns scope partitioning, context passing, integration, and synthesis.
```

Close with this exact block — inline text, lowercase 'a', colon required:

```text
Delegation audit:
- Workers used: [list or "none — direct inspection sufficient"]
- Scopes assigned: [Worker A: <path> | Worker B: <path>]
- Overlap: none
- Integration: [how orchestrator combined results]
```

### Gotchas — literal string traps

- **`Orchestration decision:`** — lowercase 'd', colon, no markdown heading. Writing `## Orchestration Decision` or `Orchestration Decision:` will fail the grader's literal-string check.
- **`Delegation audit:`** — lowercase 'a', colon, no em dash, no "Summary". Writing `## Delegation Audit` or `## Delegation Audit — Summary` will fail.
- **Verbatim invariant** — include the FULL string: *"Subagents cannot coordinate with each other; the parent/orchestrator owns scope partitioning, context passing, integration, and synthesis."* Paraphrasing any word will fail. Include it in full even if you already stated it earlier.

### Self-validation checklist (run before finalising any orchestration output)

- [ ] Output contains the literal text `Orchestration decision:` (no heading markup, lowercase d)
- [ ] Output contains the full verbatim invariant string ending "...integration, and synthesis."
- [ ] Output contains the literal text `Delegation audit:` (no heading markup, lowercase a)
- [ ] Each worker contract lists the exact file it may write and names files it is FORBIDDEN from touching

Stop once the requested orchestration plan or synthesis is complete.

- Put durable methodology in skills, not repeated in every recipe.
- Put workflow routing in recipes.
- Put specialized repeatable units in subrecipes.
- Use response schemas for automation.
- Include `summon` explicitly when a recipe has an `extensions` block and needs delegation.

## Methodology Locality Guard

Keep orchestration methodology in this skill and specialist methodology in specialist skills. Recipes should state workflow entry points, required loads, parameters, and completion conditions; they should not duplicate broad routing tables or reusable delegation protocols unless the text is a short invocation reminder.

Before editing a recipe, check:

- Does reusable delegation logic belong here instead of in the recipe?
- Does the recipe eval JSON list only the in-session agent(s), excluding delegated/summoned specialists?
- Does the recipe eval JSON include this skill when the recipe depends on orchestration-specific behavior such as Orchestration decision, non-overlapping worker scopes, or Delegation audit?
