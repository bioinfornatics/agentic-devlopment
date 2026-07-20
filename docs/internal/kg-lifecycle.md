# KG Lifecycle — Initiation, Maintenance, Auto-alimentation

> Comment un Knowledge Graph naît, vit, et s'alimente automatiquement
> dans le contexte du développement agentique SDD+Beads.

---

## Vue d'ensemble — 3 couches, 3 modes d'alimentation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  A-BOX  — Faits assertés  (.knowledge/memory.jsonl)                    │
│                                                                         │
│  Harness layer    Auto ← `node apps/kg/dist/cli.js bootstrap`          │
│  (recipes/skills/         (git hook + build-docs.sh)                   │
│   agents/docs)       ← Déclenché à chaque commit harness               │
│                                                                         │
│  Product layer    Semi-auto ← Recipe checkpoints MCP (implement/spec/  │
│  (features/ACs/         review/discover) via create_entities            │
│   code_files/tests)   Manuel ← bd create + node apps/kg/dist/cli.js bootstrap --product │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  T-BOX  — Faits inférés  (.knowledge/derived.jsonl)                    │
│                                                                         │
│  Auto ← `node apps/kg/dist/cli.js reason`                             │
│       (git hook post-commit, build-docs.sh, CI)                        │
│  6 règles: R1-R6 (forward chaining jusqu'au point fixe)                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  VISUALISATION  (dist/kg/index.html)                                   │
│                                                                         │
│  Auto ← build-docs.sh copie les deux JSONL dans dist/                 │
│  Manuel ← VS Code task "KG: Bootstrap + Reason + Visualize"            │
│  Futur ← Goose App (KG-08, P4)                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Initiation — démarrage from scratch

### Pour le harness lui-même

```bash
# Une seule commande — lit agents/ skills/ recipes/ docs/ → memory.jsonl
node apps/kg/dist/cli.js bootstrap

# Résultat: .knowledge/memory.jsonl avec:
# 12 agents, 14 skills, 12 recipes, docs → entités harness:*
```

### Pour un nouveau produit (utiliser le harness pour développer X)

```bash
# Phase 1 — créer le répertoire KG du projet
mkdir -p .knowledge

# Phase 2 — bootstrapper les entités harness (toolchain)
node apps/kg/dist/cli.js bootstrap

# Phase 3 — ajouter les entités produit initiales (via /discover)
/discover "User authentication with OAuth Google"
# → discover.yaml crée automatiquement:
#   create_entities(epic: login-oauth, feature: oauth-google)
#   create_relations(feature DECOMPOSES_INTO epic)

# Phase 4 — raisonner (inférer les gaps initiaux)
node apps/kg/dist/cli.js reason
# → derived.jsonl: feature oauth-google → HAS_STATUS not-decomposed (pas de user_story)

# Phase 5 — visualiser
xdg-open dist/kg/index.html  # ou VS Code task "KG: Bootstrap + Reason + Visualize"
```

**État initial du KG :** entités assertées + faits inférés (tous les gaps visibles dès le départ).

---

## 2. Maintenance — comment le KG reste synchronisé

### Couche harness — synchronisation automatique via git hook

```bash
# .git/hooks/post-commit (installé par scripts/install.sh)
#!/bin/bash
node apps/kg/dist/cli.js bootstrap --dry-run > /dev/null 2>&1 && node apps/kg/dist/cli.js pipeline
```

**Déclenchement :** chaque `git commit` sur le harness → KG automatiquement à jour.
**Idempotent :** `node apps/kg/dist/cli.js bootstrap` ne duplique pas les entités existantes (KG-03).

### Couche produit — via les recipe checkpoints

Chaque phase SDD écrit dans le KG via le MCP `knowledgegraphmemory` :

| Phase | Recette | Ce qui est écrit |
|---|---|---|
| **discover** | discover.yaml | epic + feature entities + DECOMPOSES_INTO |
| **spec** | subrecipes/spec.yaml | acceptance_criterion entities + HAS_CRITERION + LOCATED_IN spec_file |
| **plan** | plan.yaml | bead entity + TRACKS user_story |
| **implement** | subrecipes/implement.yaml | component/api_endpoint + IMPLEMENTED_IN code_file + IMPLEMENTS user_story |
| **review** | subrecipes/review.yaml | search_nodes pour gap detection + observation "reviewed:date" |

**Condition :** l'extension `knowledgegraphmemory` doit être active dans la session.

### Couche inférée — régénération automatique

```bash
# À chaque changement de memory.jsonl
node apps/kg/dist/cli.js reason
# → re-calcule derived.jsonl en ~0.1s (forward chaining, 117 entités = instant)
```

---

## 3. Auto-alimentation — les 5 mécanismes

### Mécanisme 1 — Git hook post-commit (harness layer)

```bash
# .git/hooks/post-commit
node apps/kg/dist/cli.js pipeline
```

**Ce qui se passe :** chaque commit sur agents/, skills/, recipes/ → harness:agent, harness:skill,
harness:recipe entities se mettent à jour (nouvelles, renommées, supprimées).

### Mécanisme 2 — Recipe checkpoints MCP (product layer)

Quand un agent exécute une recette, il appelle les outils MCP :
```
load skills knowledge-graph
create_entities [{name:"LoginButton", entityType:"component", observations:[...]}]
create_relations [{from:"LoginButton", to:"src/components/LoginButton.tsx", relationType:"IMPLEMENTED_IN"}]
```
**Automatique :** déclenché à la fin de chaque phase SDD par les subrecipes.

### Mécanisme 3 — Agents avec KG orientation

Trois agents interrogent et enrichissent le KG pendant leur travail :

| Agent | Action KG |
|---|---|
| `implementation-worker` | `open_nodes([FEAT]-NN)` → lit le contexte → cite ACs dans les tests |
| `review-critic` | `search_nodes('[FEAT]-')` → détecte gaps → ajoute comme findings |
| `product-owner` | `search_nodes(feature)` → gap analysis → recommande bd create |

### Mécanisme 4 — bd close → observation KG

Quand un bead se ferme, une observation peut être ajoutée :
```bash
# Dans le checkpoint de fermeture (à intégrer dans close workflow)
add_observations [{entityName:"feat-login-oauth", observations:["bead:proj-abc closed 2026-07-09"]}]
```

### Mécanisme 5 — build-docs.sh pipeline complet

```bash
# scripts/build-docs.sh (fin du script)
node apps/kg/dist/cli.js bootstrap    # refresh harness layer
node apps/kg/dist/cli.js reason       # re-infer derived facts
cp apps/kg-visualizer/src/app.html dist/kg/index.html  # update visualizer
```

**Déclenché :** `./scripts/build-docs.sh` ou VS Code task "Harness: Build Documentation".

---

## 4. Cycle de vie complet — timeline d'un développement produit

```
JOUR 1 — Initiation
  node apps/kg/dist/cli.js bootstrap → harness layer
  /discover "feature X"              → epic + feature entities créés
  node apps/kg/dist/cli.js reason    → gaps inférés: not-decomposed, not-implemented

SPRINT 1 — Spec + Plan
  /spec "feature X"                  → ACs [FEAT]-01..05 créés dans KG
  node apps/kg/dist/cli.js reason    → R1: 5 ACs → HAS_STATUS test-gap
  /plan "feature X"                  → beads TRACKS user_stories

SPRINT 2 — TDD + Implement
  /implement bead-xxx                → RED test créé: test entity + LOCATED_IN code_file
  node apps/kg/dist/cli.js reason    → R1: AC test-gap SE FERME si VALIDATES ajouté
  /implement bead-yyy                → component + IMPLEMENTED_IN + IMPLEMENTS
  node apps/kg/dist/cli.js reason    → R3: not-implemented SE FERME pour cette feature

SPRINT 3 — Review + Verify
  /review                            → search_nodes gaps → findings générés
  /verify                            → add_observations "status:passing"
  node apps/kg/dist/cli.js reason    → toutes les règles ré-évaluées

RELEASE
  build-docs.sh                      → KG complet + visualiser à jour
  Visualiseur dist/kg/index.html     → graphe final: asserté (solide) + inféré (pointillé)
```

---

## 5. Ce qui est déjà en place vs ce qui manque

| Mécanisme | État |
|---|---|
| `node apps/kg/dist/cli.js bootstrap` (harness layer) | ✅ Opérationnel |
| `node apps/kg/dist/cli.js reason` (6 règles, forward chaining) | ✅ Opérationnel |
| Recipe checkpoints (implement/spec/review/discover) | ✅ Intégrés dans subrecipes |
| Agent KG orientation (review-critic/implementation-worker/product-owner) | ✅ Intégrés |
| Visualiseur (D3.js, asserté+inféré) | ✅ dist/kg/index.html |
| **Git hook post-commit** | ❌ À installer (scripts/install.sh à mettre à jour) |
| **bd close → KG observation** | ❌ Pas encore automatique |
| **`node apps/kg/dist/cli.js bootstrap --product`** (scan src/) | ✅ Flag disponible, usage manuel |
| **Goose App visualiseur** (KG-08) | 🔓 Backlog P4 |
| **Règle R4 et R6** (transitivity, undeclared skill) | ✅ Codées, 0 trigger actuel (données insuffisantes) |
