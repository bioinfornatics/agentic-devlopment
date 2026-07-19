# Graph query results

Graph format: JSON-LD with `@graph` nodes and `relations` array.

| Query | Result |
|---|---|
| List all agents and loaded skills | 13 agents represented; extracted skill links are in `current-state-graph.jsonld` `LOADS_SKILL` relations. |
| List all recipes and involved agents | 19 top-level recipes; involvement partially inferred from recipe prompt/load lines. |
| Find unused skills | No mechanical unused-skill failure in `check-consistency.py`; semantic orphan analysis flags no HIGH unused skill. |
| Find unused agents | No filesystem/eval orphan among 13 agents; stale Beads memory references obsolete agent names (HA-F002). |
| Find recipes without lifecycle phases | Harness utility recipes (`harness-audit`, `harness-review`, `harness-doc-review`, `harness-master`, `remember`) are cross-cutting exceptions. |
| Find self-review paths | No deterministic self-review path found; judge isolation is explicit in harness-audit contract. |
| Find artifacts without consumers | ExpertContribution/DecisionResolution schemas have intended consumers but missing enforceable storage/validation (HA-F006). |
| Find recipe paths bypassing verification | Core dev/sdd path includes review/verify/release gates; enforcement relies on labels and recipe instructions. |
| Find gates without verification evidence | Label gates documented; no live active Beads tasks to inspect. |
| Find all paths from intent to release | Discover → Clarify → Spec → Plan → TDD/Implement → Review → Verify → Release represented in `sdd-reference-model.md`. |
| Find cycles | No unbounded recipe invocation cycle detected from static subrecipe map. |
| Compare current and target | See `graph-diff.md`. |

## Metrics

- Node counts: skills=20, agents=13, top-level recipes=19, subrecipes=10, findings=6.
- Orchestration bottlenecks: `orchestrator` and `harness-judge` are intentionally central but require isolation and eval correctness.
- Gate coverage: deterministic validators exist for recipe YAML, consistency, KG smoke, and SPEC_DEVIATION scan.
