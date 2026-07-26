# Query cookbook

Adapt these patterns to the available graph backend.

## Inventory and coverage

- List agents and loaded skills: agent → `LOADS_SKILL` → skill.
- List agents and responsibilities: agent → `HAS_RESPONSIBILITY` → responsibility.
- List recipes and involved agents: recipe → `INVOLVES_AGENT` → agent.
- List recipes and delegated tasks: recipe → `DELEGATES_TASK` → task.
- Find unused skills: active skills with no incoming `LOADS_SKILL`, `REQUIRES_SKILL`, or recipe-use relation.
- Find unused agents: active agents with no incoming `INVOLVES_AGENT`, `ASSIGNED_TO`, or participation relation.
- Find recipes without lifecycle phases: active recipes with no `IMPLEMENTS_PHASE` relation.
- Find topics without skill or agent coverage.

## Integrity and gap queries

- Responsibilities without accountable owners.
- Delegated tasks without assigned agents or required skills.
- Agents loading skills unrelated to their topics or responsibilities.
- Responsibilities unsupported by loaded skills.
- Artifacts without consumers.
- Recipes involving an agent but consuming no output from it.
- Gates without verification methods or evidence.
- Review paths where author and approver are the same agent.
- Recipe invocation cycles and bypass paths around mandatory verification.

## Blast radius

- Skill removal: incoming agent loads, task requirements, recipe loads, topics, artifacts, and downstream paths.
- Agent removal: recipe involvement, assigned tasks, responsibilities, artifacts, reviews, handoffs, and gates.
- Recipe removal: phases, delegated tasks, artifacts, transitions, Beads operations, and callers.
- Data-model change: model → API mappings → implementations → tests → criteria.

## Current and target comparison

Compare nodes and relations by stable ID and `graph_view`. Report additions, removals, renames, merges, splits, ownership changes, topic changes, and orchestration-path changes.

## End-to-end traversal

Traverse:

```text
intent → phase → recipe → delegated task → agent → responsibility
→ skill → topic → artifact → consumer → verification → gate
→ work completion → next phase
```

Flag missing nodes, dead ends, unbounded cycles, implicit-only handoffs, and paths without evidence.
