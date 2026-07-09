# Harness Apps — pnpm monorepo TypeScript

Applications du harness agentic SDD. Chaque app est un package TypeScript autonome.

## Structure

```
apps/
  kg/                 # @harness/kg — KG toolkit CLI
  kg-visualizer/      # @harness/kg-visualizer — Goose App MCP server
```

## Quick start

```bash
cd apps
pnpm install          # installe tous les workspaces

pnpm kg:bootstrap     # → .knowledge/memory.jsonl
pnpm kg:reason        # → .knowledge/derived.jsonl
pnpm kg:pipeline      # bootstrap + reason
pnpm dev              # kg-visualizer MCP server (Goose Apps)
```

## Documentation par app

| App | README | INSTALL | AGENTS |
|---|---|---|---|
| `@harness/kg` | [README](kg/README.md) | [INSTALL](kg/INSTALL.md) | [AGENTS](kg/AGENTS.md) |
| `@harness/kg-visualizer` | [README](kg-visualizer/README.md) | [INSTALL](kg-visualizer/INSTALL.md) | [AGENTS](kg-visualizer/AGENTS.md) |

## Références

- `docs/kg-lifecycle.md` — Cycle de vie du KG (initiation, maintenance, auto-alimentation)
- `docs/knowledge-graph.md` — Modèle sémantique SDD (types, relations, règles, patterns de traversal)
- `docs/kg-visualization-framework-research.md` — Benchmark frameworks (Cytoscape.js recommandé)
- `.agents/skills/knowledge-graph/SKILL.md` — Skill KG pour les agents Goose
