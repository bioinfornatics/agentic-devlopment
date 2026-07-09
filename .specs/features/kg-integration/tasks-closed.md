# Tasks - KG Integration (closed)

## Test Coverage Matrix

| Layer | Type | Status | Location |
|---|---|---|---|
| parseJSONL | Unit | PASS | apps/kg/src/reason.test.ts |
| RULES R1-R6 | Unit | PASS | apps/kg/src/reason.test.ts |
| bootstrap idempotence | Integration | PASS | apps/kg/src/harness.test.ts |
| KG pipeline e2e | Integration | PASS | apps/kg/src/harness.test.ts |
| MCP server load | Smoke | PASS | apps/kg-visualizer/src/server.test.ts |

## Completed Tasks

- [x] T1: types.ts (Entity, Relation, KG types)
- [x] T2: bootstrap.ts (scan harness -> memory.jsonl, idempotent)
- [x] T3: reason.ts (R1-R6 forward-chaining rules)
- [x] T4: cli.ts (CLI entry point)
- [x] T5: server.ts (MCP show_kg_visualizer)
- [x] T6: app.html (Cytoscape.js+fcose visualizer)
- [x] T7: 29 vitest tests
- [x] T8: knowledgegraphmemory extension in config
- [x] T9: post-commit git hook
- [x] T10: KG checkpoints in subrecipes
