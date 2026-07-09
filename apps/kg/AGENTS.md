# Agents — @harness/kg

Description des agents Goose et recettes qui interagissent avec ce toolkit.

## Agents qui utilisent le KG

| Agent | Action | Quand |
|---|---|---|
| `implementation-worker` | `open_nodes([FEAT]-NN)` — contexte AC avant de coder | Début de chaque phase implement |
| `review-critic` | `search_nodes('[FEAT]-')` — AC sans test → MEDIUM finding | Avant de lister les findings |
| `product-owner` | `search_nodes(type=feature)` — gap analysis backlog | Fin de chaque revue backlog |

## Recettes qui écrivent dans le KG

| Recette/Subrecipe | Phase | Ce qui est écrit |
|---|---|---|
| `discover.yaml` | discover | `create_entities` epic + feature + `DECOMPOSES_INTO` |
| `subrecipes/spec.yaml` | spec | `create_entities` acceptance_criterion + `HAS_CRITERION` + `LOCATED_IN` spec_file |
| `subrecipes/implement.yaml` | implement | `create_entities` component/api_endpoint + `IMPLEMENTED_IN` code_file + `IMPLEMENTS` user_story |
| `subrecipes/review.yaml` | review | `search_nodes` ACs → gaps = MEDIUM findings |

## Extension MCP requise

```yaml
# ~/.config/goose/config.yaml
knowledgegraphmemory:
  enabled: true
  cmd: npx   # wrapper per-project
  # OU directement:
  cmd: npx
  args: [-y, "@modelcontextprotocol/server-memory"]
  envs:
    MEMORY_FILE_PATH: /path/to/.knowledge/memory.jsonl
```

## Skill associé

Charger le skill avant d'utiliser les outils KG :
```
load skills knowledge-graph
```

Le skill est dans `.agents/skills/knowledge-graph/SKILL.md`.
Il décrit le modèle sémantique (types d'entités, relations, règles R1-R10),
les patterns de traversal et le protocole CRUD par phase SDD.

## Lifecycle du KG

Voir `docs/kg-lifecycle.md` pour le cycle complet :
initiation → maintenance → auto-alimentation (5 mécanismes).
