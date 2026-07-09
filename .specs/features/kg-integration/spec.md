# Spec: Knowledge Graph Integration

> Status: Retro-spec (brownfield) — implementation predates this spec.
> Created: 2026-07-09
> Scope: feat-kg-integration (KG-01..KG-06)

## Context

MCP-based Knowledge Graph for SDD traceability: entities, relations, reasoning rules.

## Acceptance Criteria

### KG-01 — Extension activation
WHEN Goose starts in a project with .knowledge/
THEN knowledgegraphmemory extension is enabled
AND create_entities / search_nodes tools are available

### KG-02 — Skill availability
WHEN agent loads knowledge-graph skill
THEN semantic model (types, relations, rules) is in context
AND CRUD protocol per SDD phase is available

### KG-03 — Bootstrap idempotence
WHEN `node apps/kg/dist/cli.js bootstrap` runs twice
THEN second run reports "0 new (up to date)"

### KG-04 — Recipe checkpoints
WHEN implement/spec/review/discover subrecipes complete
THEN KG entities are created via MCP create_entities

### KG-05 — Agent gap detection
WHEN review-critic runs
THEN it queries KG for ACs without VALIDATES test
AND reports gaps as MEDIUM findings

### KG-06 — Visualization
WHEN `node apps/kg/dist/cli.js visualize` runs
THEN dist/kg/index.html opens with entity+relation graph

## Non-goals

- No OWL/SPARQL full reasoning (forward chaining rules R1-R6 only)
- No multi-user KG synchronization
### AC-KG-01 — Extension activation (corrected location)
WHEN goose starts in a project with .knowledge/
AND knowledgegraphmemory is enabled in config.yaml
THEN create_entities, search_nodes, open_nodes tools are available in the session

### AC-KG-02 — Subrecipe KG checkpoint
WHEN implement/spec/review/discover subrecipes complete a phase
THEN KG entities are created via MCP create_entities
AND relations (IMPLEMENTED_BY, HAS_CRITERION, etc.) are stored in memory.jsonl
