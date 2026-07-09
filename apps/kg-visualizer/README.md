# @harness/kg-visualizer — Goose App MCP Server

Serveur MCP qui expose le Knowledge Graph comme application Goose native.
Utilise Cytoscape.js + fcose pour un force-directed graph interactif.

## Statut — extension MCP custom (non builtin)

Ce package est une **extension MCP personnalisée** du harness.
**Pas** une app builtin Goose — c'est un serveur MCP stdio qu'on déclare dans la config.

| Extension | Type | Source |
|---|---|---|
| `apps` | builtin upstream (AAIF/goose) | Génère des apps HTML via LLM (`create_app(prd)`) |
| `kg-visualizer` | **custom MCP** (ce package) | Expose `show_kg_visualizer` tool → Cytoscape.js HTML |

## Fonctionnement

Ce serveur MCP expose le tool `show_kg_visualizer` :
- Lit `.knowledge/memory.jsonl` (faits assertés) + `.knowledge/derived.jsonl` (faits inférés)
- Encode le JSONL en base64 (compatible sandbox Goose Apps)
- Retourne un document HTML Cytoscape.js+fcose
- Goose l'affiche dans une fenêtre Apps native (extension `apps`)

## Visualisation

- **Nœuds solides** — faits assertés (memory.jsonl)
- **Bord pointillé orange** — faits inférés (derived.jsonl)
- **Nœuds rouges** — status dérivés (test-gap, not-implemented, blocked)
- **Arêtes orange pointillées** — relations inférées par les règles

## Code couleur

| Couleur | Type d'entité |
|---|---|
| Bleu | `harness:recipe` |
| Violet | `harness:skill` |
| Vert | `harness:agent` |
| Orange | `epic` |
| Rouge clair | `feature` |
| Vert clair | `acceptance_criterion` |
| Cyan | `test` |
| Violet clair | `code_file` |
| Rouge vif | `derived_status` (gap/blocked) |