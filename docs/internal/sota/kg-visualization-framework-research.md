# KG Visualization Framework Research — 2025-2026

> Recherche effectuée le 2026-07-09 — données live GitHub/npm/bundlephobia.

## Quick Comparison

| Framework | Stars | Bundle (gzip) | License | npm/month | Issues |
|---|---|---|---|---|---|
| **D3.js v7** (actuel) | 113k | 89 KB | ISC | 62.8M | bas |
| **Cytoscape.js** ⭐ | 11k | 131 KB | MIT | 43.3M | **13** |
| **Sigma.js v3** | 12k | 37 KB (+graphology) | MIT | 991K | **28** |
| vis-network | 3.6k | 108 KB | Apache-2.0 | 2.6M | 410 |
| force-graph (2D) | — | 55 KB | MIT | 2.6M | — |
| 3d-force-graph | 6k | 335 KB | MIT | 1.1M | 250 ⚠️ |
| G6 v5 (Ant) | 12k | 390 KB | MIT | 1.1M | 331 ⚠️ |
| WebCola | 2k | — | MIT | 914K | ❌ 2018 |

## Semantic KG Feature Matrix

| Feature | D3 | **Cytoscape** | Sigma v3 | vis-network |
|---|---|---|---|---|
| Directed arrows | DIY | ✅ | ✅ | ✅ |
| **Edge relation labels** | DIY | ✅ natif | Custom | ✅ natif |
| **Node type shapes/CSS** | DIY | ✅ riche (CSS-like) | Custom programs | ✅ bon |
| Layout sémantique | d3-force | **fcose ⭐** | ForceAtlas2 | Barnes-Hut |
| Single `<script>` embed | ✅ | ✅ | ⚠️ ESM only | ✅ |
| Compound/cluster | DIY | ✅ | ❌ | ❌ |
| 3D | ❌ | ❌ | ❌ | ❌ |

## Recommandation

### 🥇 Cytoscape.js + cytoscape-fcose (pour notre cas, ~200 nœuds)

**Pourquoi il gagne :**
- Conçu pour les KG bioinformatiques — nodes typés, arêtes labelisées, compound nodes
- Embed trivial (2 balises script CDN, pas de bundler)
- **fcose layout** (Fast Constrained Spring Embedder) — layout beaucoup plus lisible que d3-force
- **Seulement 13 issues ouvertes** — maintenance la plus saine du groupe
- Style CSS-like par type d'entité : `node[type="harness:recipe"]`

```html
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.34.0/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js"></script>
```

```javascript
cytoscape.use(cytoscapeFcose);
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: nodes_and_edges,
  style: [
    { selector: 'node[entityType="harness:recipe"]',
      style: { 'background-color': '#4299e1', label: 'data(name)' }},
    { selector: 'node[entityType="feature"]',
      style: { 'background-color': '#fc8181', shape: 'round-rectangle' }},
    { selector: 'edge',
      style: { label: 'data(relationType)', 'curve-style': 'bezier',
               'target-arrow-shape': 'triangle', 'font-size': 9 }}
  ],
  layout: { name: 'fcose', quality: 'proof', animate: true }
});
```

### 🥈 Sigma.js v3 + Graphology (si >500 nœuds, WebGL requis)
- Renderer WebGL — 1000+ nœuds sans effort
- ForceAtlas2 — standard académique pour les KG
- ESM only — vérifier sandbox Goose Apps (Chromium 89+ supporte importmaps)
- Released avril 2026, 28 issues — très sain

### ❌ Non recommandés
- **WebCola direct** : abandonné 2018. Utiliser `cytoscape-cola` plugin.
- **G6 v5 (Ant)** : 1.4 MB, 331 issues, docs en chinois
- **3d-force-graph** : 1.28 MB, 250 issues — justifié seulement si 3D est une exigence UX
- **Three.js brut** : aucune primitive graphe — construire Cytoscape from scratch

## Migration D3 → Cytoscape

| Aspect | D3 actuel | Cytoscape |
|---|---|---|
| Format données | `{nodes:[], links:[]}` | `{nodes:[{data:{id,name,entityType}}], edges:[{data:{source,target,relationType}}]}` |
| Styling | Attributs SVG | Sélecteurs CSS-like `node[type="X"]` |
| Layout | `d3.forceSimulation()` | `layout: { name: 'fcose' }` |
| Événements | `.on('click', d=>...)` | `cy.on('tap', 'node', cb)` |
| **Effort estimé** | | **2–4h** pour un viewer 200 nœuds |

## Recommandation pour KG-08 (Goose Apps)

Utiliser **Cytoscape.js + fcose** comme base de `scripts/kg-visualizer.html` v2 :
- 2 CDN scripts, pas de bundler → compatible Goose Apps sandbox
- Styling par `entityType` → notre taxonomie harness/product est directement mappable
- Remplacement de notre D3 custom par une API sémantique de haut niveau

Bead associé: KG-08 (P4) — activer extension apps + recréer visualiseur en Cytoscape.
