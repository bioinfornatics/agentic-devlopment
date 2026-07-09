# Design - Harness Core

Status: Active | Refs: spec.md, STATE.md

## Architecture

Recipes load Skills, delegate to Agents, and create KG entities.
Beads tracks work via Dolt git-synced database.
KG stores harness + product entities with reasoning rules.

## Data Flow

/discover -> product-owner -> spec.md + Beads stories
/plan -> beads-planner -> Beads dependency graph
/implement -> implementation-worker -> code + KG IMPLEMENTED_BY
/review -> review-critic -> APPROVE or BLOCK
/verify -> qa-automation -> test entities VALIDATES AC entities

## Components

| Component | Location |
|---|---|
| Recipe executor | .goose/recipes/*.yaml |
| Skill pack | .agents/skills/NAME/SKILL.md |
| Named agent | .agents/agents/NAME.md |
| KG CLI | apps/kg/dist/cli.js |
| KG MCP server | apps/kg-visualizer/dist/server.js |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| KG drift | High | Post-commit hook + subrecipe checkpoints |
| Grader truncation | Medium | events.jsonl transcript for grader |
| Skill bloat | Medium | Progressive disclosure via references/ |