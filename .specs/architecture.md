# Architecture

Status: Active | ADRs: STATE.md

## System Map

Recipes (12 workflow verbs) load Skills (14 packs) and delegate to Agents (12 named).
Extensions: beads, knowledgegraphmemory, kg-visualizer.
State: Beads (Dolt git-synced) + KG (memory.jsonl + derived.jsonl).

## Component Contracts

| Component | Location                          | Contract                              |
|-----------|-----------------------------------|---------------------------------------|
| Recipe    | .goose/recipes/*.yaml             | YAML: name, description, instructions |
| Skill     | .agents/skills/NAME/SKILL.md      | Frontmatter + mandatory sections      |
| Agent     | .agents/agents/NAME.md            | name+description + 10-section body    |
| KG CLI    | apps/kg/dist/cli.js               | Node CLI: bootstrap, reason, pipeline |
| KG MCP    | apps/kg-visualizer/dist/server.js | MCP stdio: show_kg_visualizer         |

## Technology Decisions

See STATE.md for AD-NNN entries.

| Layer         | Technology        | Reason                             |
|---------------|-------------------|------------------------------------|
| Agent runtime | Goose 1.37 AAIF   | Open-source, extensible, Summon    |
| Task tracking | Beads + Dolt      | Git-synced, durable, queryable     |
| KG store      | MCP server-memory | Standard protocol, JSONL           |
| Apps          | TypeScript + pnpm | MCP SDK TS-first, Node 22          |
| Specs         | Markdown .specs/  | Human+agent readable, git-diffable |