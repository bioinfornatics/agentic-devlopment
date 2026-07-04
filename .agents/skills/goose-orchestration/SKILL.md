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

## Subagent constraints

- Isolated context and session.
- Inherits parent extensions unless restricted.
- Cannot spawn subagents.
- Cannot manage extensions/schedules.
- Default max turns: 25 unless overridden by `max_turns`, recipe settings, or `GOOSE_SUBAGENT_MAX_TURNS`.

## Recipe design rules

- Put durable methodology in skills, not repeated in every recipe.
- Put workflow routing in recipes.
- Put specialized repeatable units in subrecipes.
- Use response schemas for automation.
- Include `summon` explicitly when a recipe has an `extensions` block and needs delegation.
