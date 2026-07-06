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

## Automatic agent routing

When a recipe or session has the `summon` extension enabled, the LLM can
discover and route to named agents dynamically — no hard-coded list required.

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