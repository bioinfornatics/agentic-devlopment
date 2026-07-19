# Graph Query Results

Format: JSON-LD. Import: load `current-state-graph.jsonld` as JSON; nodes have `id/type/name`, relationships have `source/type/target`.

| Query | Result |
|---|---|
| List all agents and loaded skills | 13 agents; see responsibility-matrix.md |
| List all recipes and involved agents | see recipe-invocation-map.md |
| Find skills unused by parsed agent loads | design-critique-case-studies, gdd, skill-creator, wcag-accessibility-audit |
| Find agents unused by parsed recipe load-agent |  |
| Find recipe paths bypassing verification | blocked: requires full semantic runtime path and Beads evidence |
| Find self-review paths | no direct parsed self-review relation; blocked for runtime confirmation |
| Find cycles in recipe invocation | no cycle detected in parsed top-level subrecipe edges; semantic cycles not fully evaluated |
| Compare current and target graphs | see graph-diff.md |

Metrics: nodes=87, edges=166. High-centrality expected nodes: orchestrator, sdd, agentic-devlopment, harness-judge. Interpretation blocked by incomplete runtime usage evidence.
