# AGENTS.md — apps/kg-visualizer (@harness/kg-visualizer)

> Overrides root AGENTS.md for this directory. Language: TypeScript + MCP SDK 1.29.

## Setup

```bash
pnpm install    # install @modelcontextprotocol/sdk + zod + typescript
pnpm build      # tsc → dist/server.js
```

## Test

```bash
timeout 3 node dist/server.js 2>&1 || echo "server started (stdio — needs MCP client)"
# Expected: server starts and waits on stdin. 3s timeout is normal.
```

## MCP tool exposed

```
show_kg_visualizer(filter?: string)
# Reads .knowledge/memory.jsonl + derived.jsonl
# Returns: HTML Cytoscape.js+fcose force graph
# filter: entityType to show only (e.g. "feature", "harness:recipe")
```

## Code style

- `src/server.ts` — MCP server only. No HTML string embedding. Clean TypeScript.
- `src/app.html` — Cytoscape.js + fcose visualization. Pure HTML/JS.
  - Placeholders: `{{B64}}` (JSONL base64) and `{{FILTER}}` (JSON filter value)
  - server.ts reads this file and replaces placeholders at runtime
- Never embed JavaScript strings inside TypeScript template literals.

## Goose config (to enable as Goose App)

```yaml
# ~/.config/goose/config.yaml
extensions:
  kg-visualizer:
    enabled: true
    type: stdio
    name: KG Visualizer
    cmd: node
    args: [/abs/path/apps/kg-visualizer/dist/server.js]
```

## Editing the visualization

- Colors/layout → edit `src/app.html` (Cytoscape style array)
- KG data reading → edit `src/server.ts` `loadKG()`
- Run `pnpm build` then test via Goose: "Show me the knowledge graph"
