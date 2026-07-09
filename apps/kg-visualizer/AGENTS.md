# Agents — @harness/kg-visualizer

## Tool MCP exposé

### `show_kg_visualizer`

**Description :** Affiche le Knowledge Graph comme force-directed graph interactif.

**Paramètre optionnel :**
```
filter: string   # Filtrer par entityType
                 # ex: "feature", "harness:recipe", "acceptance_criterion"
```

**Exemples d'invocation (dans Goose) :**
```
Show me the knowledge graph
Show me the knowledge graph filtered to features
Show the KG showing only harness:recipe nodes
```

## Quand l'utiliser

| Besoin | Requête Goose |
|---|---|
| Vue globale du harness | "Show me the knowledge graph" |
| Blast radius d'un skill | "Show KG filtered to harness:recipe then search for code-review" |
| Gaps de coverage | "Show KG filtered to acceptance_criterion" (nœuds rouges = gaps) |
| Features non implémentées | "Show KG filtered to feature" (rouge = not-implemented) |
| Architecture produit | "Show KG filtered to feature" → suivre DECOMPOSES_INTO |

## Agents qui pourraient l'invoquer

| Agent | Quand | Pourquoi |
|---|---|---|
| `harness-orchestrator` | Début de session | Vue d'ensemble de l'état du KG |
| `product-owner` | Gap analysis | Voir features/ACs sans test (rouge) |
| `review-critic` | Avant review | Contexte du graphe de la feature en cours |
| `architect` | Design phase | Vue de l'architecture existante |

## Relation avec @harness/kg

L'extension lit les fichiers produits par `@harness/kg` :
- `.knowledge/memory.jsonl` — bootstrap + recipe checkpoints MCP
- `.knowledge/derived.jsonl` — reasoning rules R1-R5

Le pipeline recommandé avant d'ouvrir le visualiseur :
```bash
node apps/kg/dist/cli.js pipeline   # ou: pnpm kg:pipeline depuis apps/
```
