# Harness Apps — pnpm monorepo TypeScript

| App | Tech | Description |
|---|---|---|
| `kg/` | TypeScript + Node 22 | KG toolkit CLI — bootstrap + reason |
| `kg-visualizer/` | TypeScript + MCP SDK 1.29 | Goose App — Cytoscape.js KG visualization |

```bash
cd apps && pnpm install
pnpm kg:bootstrap    # → .knowledge/memory.jsonl
pnpm kg:reason       # → .knowledge/derived.jsonl
pnpm kg:pipeline     # both
pnpm dev             # kg-visualizer MCP server
```
