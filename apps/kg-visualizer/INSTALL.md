# Installation — @harness/kg-visualizer

## Prérequis

| Outil | Version |
|---|---|
| Node.js | 22+ |
| pnpm | 10+ |
| @modelcontextprotocol/sdk | 1.29+ (installé via dependencies) |

## Build

```bash
cd apps/kg-visualizer
pnpm install
pnpm build     # compile src/server.ts → dist/server.js
```

## Ajouter à Goose

```yaml
# ~/.config/goose/config.yaml
extensions:
  kg-visualizer:
    enabled: true
    type: stdio
    name: KG Visualizer
    description: Goose App — Knowledge Graph Cytoscape.js (KG-08)
    cmd: node
    args:
    - /abs/path/apps/kg-visualizer/dist/server.js
    timeout: 300
```

Puis dans une session Goose :
```
Show me the knowledge graph
```
Ou avec filtre :
```
Show me the knowledge graph filtered to features
```

## Alternative sans Goose Apps

Ouvrir `dist/kg/index.html` directement (D3.js standalone) :
```bash
xdg-open dist/kg/index.html
# Glisser .knowledge/memory.jsonl dans la page
```
## Activer via l'extension apps builtin

En plus du MCP server, l'extension `apps` builtin (Goose 1.37) est activée :

```yaml
# ~/.config/goose/config.yaml
extensions:
  apps:
    enabled: true   # ← Goose builtin app creator + renderer
  kg-visualizer:
    enabled: true   # ← Notre MCP server
    cmd: node
    args: [/abs/path/apps/kg-visualizer/dist/server.js]
```

Dans une session Goose :
```
Show me the knowledge graph    # → invoque show_kg_visualizer (MCP)
Create an app from apps/kg-visualizer-app/app.html   # → apps builtin
```
