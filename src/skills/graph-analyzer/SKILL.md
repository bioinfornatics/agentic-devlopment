---
name: graph-analyzer
description: >
  Reconstruct and compare the documented, configured, and executed graphs of an
  agentic harness. Use during investigation and planning to identify critical
  paths, cost hotspots, and graph divergences. Do not use for implementation.
---

# Graph analysis

A harness has three graph representations that often diverge:

| Layer | Source | How to read |
|---|---|---|
| **Documented** | README, AGENTS.md, diagrams | Intended design |
| **Configured** | Recipe YAML, plugin hooks.json, agent.md | What will run |
| **Executed** | Beads events, session logs, hook outputs | What actually ran |

Divergence between layers is a defect source. Prioritise finding it.

## Execution graph — what to reconstruct

```
Recipe
  ├── invokes Controller (session, max_turns, max_tool_rep)
  │     ├── loads Skills (name → SKILL.md from ~/.agents/skills/)
  │     ├── delegates → Researcher session  (summon)
  │     ├── delegates → Builder session     (summon)
  │     └── delegates → Verifier session    (summon)
  │
  ├── triggers Hooks (all installed plugins, per event)
  │     ├── PreToolUse  → prevent-catastrophe, loop-gate, budget-tracker
  │     ├── PostToolUse → beads-telemetry, loop-breaker, budget-tracker
  │     └── SessionEnd  → beads-telemetry, budget-tracker
  │
  ├── calls guard → harness-manager/dist/loop-transition-guard.js
  │     input: Beads snapshot JSON
  │     output: {allowed, transition, reason}
  │
  └── writes State → Beads (sole durable store)
```

## Critical path identification

A node is on the critical path if it is on every execution trajectory.
Identify critical nodes by checking:

1. Is the node called unconditionally?
2. Is the node's output required before any branch?
3. Does the node read or write shared state?

For each critical node, measure:
- Input context size (tokens approximated by char count / 4).
- Output size.
- Model used (session model vs premium).
- Number of tool calls.
- Retry count.

## Reading the configured graph

```sh
# What hooks fire and in what order
for p in ~/.agents/plugins/*/hooks/hooks.json; do
  echo "--- $(basename $(dirname $(dirname $p))) ---"
  jq -r '.hooks | to_entries[] | .key + ": " + (.value | length | tostring) + " rules"' "$p"
done

# What model each agent uses
grep -h "^model:" src/agents/*.md

# What max_turns each recipe allows
for r in src/recipes/*.yaml; do
  python3 -c "import yaml; d=yaml.safe_load(open('$r')); print('$(basename $r):', d.get('settings',{}).get('max_turns'), 'turns')"
done
```

## Reading the executed graph

```sh
# Beads events for a run (lifecycle telemetry)
bd list --type=event --json | jq '[.[] | {id, title, status, created_at}] | sort_by(.created_at)'

# Session tool calls from loop-breaker counters
ls ${XDG_RUNTIME_DIR:-/tmp}/goose-budget/

# Session stats from budget-tracker archive
cat ~/.local/share/goose-budget/sessions.jsonl | jq .
```

## Divergence checklist

After reconstructing all three layers, check:

- [ ] Every recipe reference points to an existing file (no phantom paths).
- [ ] Every hook event name matches the Goose HookEvent enum exactly.
- [ ] Every skill loaded by an agent exists in `~/.agents/skills/`.
- [ ] The guard script path in recipe instructions is correct.
- [ ] No agent references a model alias that does not exist on the configured provider.
- [ ] No sub-agent is created within a sub-agent (depth > 1).
- [ ] Beads events are present for the last executed run.

## Cost hotspot identification

Rank nodes by expected cost contribution:

```
cost_rank = model_cost_per_token × (input_tokens + output_tokens) × retry_multiplier
```

Hotspots to address first:
1. Controller sessions with large instructions blocks (>1 000 words).
2. Nodes that run frontier models by default.
3. Nodes that load entire files instead of targeted symbols.
4. Nodes that are retried without a changed hypothesis.
5. Nodes on the critical path that could be replaced by a deterministic check.
