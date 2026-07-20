# Internal Documentation

Documentation for harness contributors and maintainers.

> ⚠️ **Not for new users.** Start with [START-HERE.md](../START-HERE.md)

## Contents

| Document | Topic |
|----------|-------|
| [14-memory.md](14-memory.md) | Beads memory system |
| [15-skill-evaluations.md](15-skill-evaluations.md) | A/B evaluation suite |
| [16-eval-analysis.md](16-eval-analysis.md) | Eval result analysis |
| [knowledge-graph.md](knowledge-graph.md) | KG semantic model |
| [kg-lifecycle.md](kg-lifecycle.md) | KG maintenance |
| [llm-as-a-judge.md](llm-as-a-judge.md) | Judge patterns |
| [Goose_Orchestration.md](Goose_Orchestration.md) | Orchestration internals |
| [Allowed_tools.md](Allowed_tools.md) | Tool permissions |

## Research (SOTA)

| Document | Topic |
|----------|-------|
| [sota/sota-knowledge-base.md](sota/sota-knowledge-base.md) | Research synthesis |
| [sota/sdd-sota-research-2025.md](sota/sdd-sota-research-2025.md) | SDD research |
| [sota/agent-system-prompt-best-practices.md](sota/agent-system-prompt-best-practices.md) | Prompt engineering |
| [sota/orchestration-enhancement-plan.md](sota/orchestration-enhancement-plan.md) | Future improvements |

## Maintenance Tasks

```bash
# Regenerate tables
python3 scripts/generate-tables.py

# Check consistency
python3 scripts/check-consistency.py

# Run evals
node apps/eval-hub/dist/index.js --run --layers skills

# KG pipeline
node apps/kg/dist/cli.js pipeline
```
