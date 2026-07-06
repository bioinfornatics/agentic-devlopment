---
name: goose-orchestration
description: >
  Goose orchestration manual: extensions, recipes, subrecipes, subagents, Summon load/delegate, skills, sessions, and guardrails.
metadata:
  version: 1.0.0
---

# Goose Orchestration

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
load(source: "beads-harness")
load(source: "harness-research")
```

Delegate:

```text
delegate(instructions: "Research X read-only", async: true)
delegate(source: "harness_review", parameters: { task: "bd-123" })
delegate(source: "reviewer", instructions: "Review this diff")
```

Collect async result:

```text
load(source: "<task_id>")
load(source: "<task_id>", peek: true)
load(source: "<task_id>", cancel: true)
```

## Agent and Subrecipe Routing Table

This is the **canonical routing reference** for the harness.
Load this skill before any delegation decision.
Call `load()` to confirm agent availability at runtime — descriptions you see
there must match the "Invoke when" column below.

### Named agents — `delegate(source: "<name>", instructions: "…")`

| Agent | Role | Invoke when | Do NOT invoke when |
|---|---|---|---|
| `harness-orchestrator` | SDD+TDD loop coordinator | Multi-step, multi-agent, multi-phase work | Single-scope task; standalone research |
| `product-owner` | PRD + acceptance criteria, 100-pt quality gate | Start of any feature or initiative | Implementation, architecture, bug fixes |
| `architect` | System design, ADRs, trade-off analysis | Technology decision or system boundary touched | Implementation or tactical code review |
| `beads-planner` | Beads dependency graph, exact `bd` commands | Goal spans >1 file/session/agent; no issues exist | Issues already exist and are claimable |
| `codebase-researcher` | Read-only architecture mapper | Map blast radius; gather pre-planning evidence | Anything requiring writes |
| `tdd-guide` | RED→GREEN→REFACTOR + 80% coverage gate | Before any new feature implementation or bug fix | Research, planning, or review phases |
| `implementation-worker` | Scoped bead coding with TDD | Bead is claimed and ready for coding | Planning, architecture, or review |
| `review-critic` | Confidence-filtered code review + Beads hygiene | After any implementation; before closing bead | Planning or architecture decisions |
| `principal-engineer` | Blast radius, breaking changes, escalation | Shared infra touched; public API changed; 2+ BLOCKs | Routine review (use review-critic first) |
| `qa-automation` | Full test pipeline: unit + integration + E2E + CI | After implementation is complete | Before implementation exists |
| `ui-ux-auditor` | WCAG 2.2 AA + UX + browser evidence | After any UI change | Backend-only or CLI-only changes |

### Subrecipes — structured, isolated sessions, typed parameters

| Subrecipe | Role | Prefer over named agent when |
|---|---|---|
| `harness_research` | Read-only codebase + Beads research | Headless/CLI invocation; typed params needed |
| `harness_plan` | Goal → Beads dependency graph | CLI planning run outside a session |
| `harness_implement` | Scoped bead coding with handoff | CLI implementation run |
| `harness_review` | Code + tests + Beads hygiene | CLI review run; JSON response schema needed |
| `harness_web_test` | Playwright + accessibility | CLI browser verification run |
| `harness_release` | Gated release + CI waits | Release workflow from CLI |

### Routing decision algorithm

```
1. call load()                     → read live agent names + descriptions
2. match user intent               → "Invoke when" column above
3. single intent, clear match      → delegate to that agent directly
4. multi-intent or unclear         → delegate to harness-orchestrator
5. emit Orchestration decision     → before every delegate() call
6. parallel read-only work         → async: true + load(source: "<task_id>")
7. write work                      → one writer per file/module, no overlap
```

### Agent vs subrecipe selection

| Criterion | Named agent | Subrecipe |
|---|---|---|
| Invocation context | Inside a Goose session | CLI / headless recipe run |
| Parameter style | Free-form instructions | Typed key=value params |
| Parent context sharing | Yes — carries over | No — isolated session |
| Discovery | `load()` at runtime | `sub_recipes` block |

---

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
    │        delegate(source: "harness_review", parameters: {task: "…"})
    │
    └─ Specialist role (free-form, in-session context sharing)?
           → named agent via Summon
             delegate(source: "review-critic", instructions: "…")
```

### When to prefer agents over subrecipes

| Use subrecipe when | Use named agent when |
|---|---|
| Fixed parameter schema (task, repo_path) | Free-form instruction with rich context |
| Fully isolated session preferred | Parent context (bead IDs, files) must carry over |
| Headless / CLI invocation | Invoked from inside an orchestrated session |
| Structured JSON response schema needed | Narrative or markdown output expected |

### Orchestration decision block (emit before every delegate())

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


## Subagent constraints

- Isolated context and session.
- Inherits parent extensions unless restricted.
- Cannot spawn subagents.
- Cannot manage extensions/schedules.
- Default max turns: 25 unless overridden by `max_turns`, recipe settings, or `GOOSE_SUBAGENT_MAX_TURNS`.

## Recipe design rules

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

Finish with a compact `Delegation audit` summarizing workers used or why none were used. Stop once the requested orchestration plan or synthesis is complete.

- Put durable methodology in skills, not repeated in every recipe.
- Put workflow routing in recipes.
- Put specialized repeatable units in subrecipes.
- Use response schemas for automation.
- Include `summon` explicitly when a recipe has an `extensions` block and needs delegation.