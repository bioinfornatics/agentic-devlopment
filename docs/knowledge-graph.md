# Knowledge Graph pour développement produit digital avec SDD

> Analyse SOTA — juillet 2026
> Référence : MCP Memory Server (@modelcontextprotocol/server-memory), memory-visualizer (mjherich)

---

## 1. Distinction fondamentale : buildtime vs runtime

Le problème ux/ui rencontré illustre une confusion classique : certains concepts
existent **avant** le déploiement (buildtime), d'autres **pendant** l'exécution (runtime),
et certains ont les deux facettes.

```
BUILDTIME                          RUNTIME
─────────────────────────────────  ─────────────────────────────────
Spécification                      Requête HTTP
Code source                        Instance de session
Schéma de base de données          Ligne de données
Contrat API (OpenAPI)              Appel API réel
Composant React (source)           DOM rendu dans le browser
Migration                          État de la base
Test (code)                        Résultat d'exécution du test
Configuration                      Valeur au runtime
UX wireframe                       Flux utilisateur réel
UI component (code)                Composant rendu + interaction live
```

**Règle KG :** Les entités buildtime sont **stables** (fichiers, specs, contrats).
Les entités runtime sont **volatiles** (logs, sessions, instances) — elles n'ont
**pas leur place dans le KG projet**, mais dans des systèmes d'observabilité (Prometheus,
DataDog, traces).

**Exception :** Les _artefacts de runtime capturés_ (screenshots de tests, résultats
d'évaluation, rapports de couverture) peuvent avoir une représentation buildtime dans le KG.

---

## 2. Architecture layers d'un produit digital

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND                                        [buildtime+runtime]
│  ui_screen  →  component (Atomic)  →  api_client
│                   Atom→Molecule→Organism→Template→Page
├─────────────────────────────────────────────────────────────────┤
│  API / BFF                                       [buildtime contract]
│  api_endpoint  →  middleware  →  auth_scheme
│  (OpenAPI spec = buildtime ; appel HTTP = runtime)
├─────────────────────────────────────────────────────────────────┤
│  BACKEND / DOMAIN                                [buildtime]
│  domain_service  →  use_case  →  repository
│                         ↓
│                    data_model (entité domaine)
├─────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                      [buildtime schema]
│  migration  →  schema  →  index
│  (données réelles = runtime → hors KG)
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Modèle de données — deux namespaces

### 3A. Harness KG (l'outil de développement)

```
entityType    examples                    scope
──────────────────────────────────────────────
harness:recipe      dev, review, verify   buildtime
harness:subrecipe   subrecipes/implement  buildtime
harness:skill       code-review, sdd      buildtime
harness:agent       review-critic         buildtime
harness:eval        evals/recipes/review  buildtime
harness:fixture     install-missing.py    buildtime
harness:doc         docs/02-code-review   buildtime
```

### 3B. Product KG (ce qu'on construit avec le harness)

```
entityType          scope       description
─────────────────────────────────────────────────────────
epic                buildtime   initiative produit majeure
feature             buildtime   fonctionnalité user-facing
user_story          buildtime   GIVEN/WHEN/THEN avec rôle
acceptance_criterion buildtime  [FEAT]-NN, précis et testable
decision            buildtime   ADR : choix + alternatives + conséquences
spec                buildtime   .specs/features/*/spec.md
bead                buildtime   Beads issue (lien SDD↔code)

── Architecture Frontend ──
ui_screen           buildtime   page/vue (LoginPage, Dashboard)
component           buildtime   Atomic: Atom|Molecule|Organism|Template
api_client          buildtime   service d'accès API côté frontend

── Architecture API ──
api_endpoint        build+run   contrat=buildtime, appel=runtime
api_contract        buildtime   OpenAPI/GraphQL schema
middleware          buildtime   auth, logging, rate-limiting
auth_scheme         buildtime   JWT|OAuth|session

── Architecture Backend ──
domain_service      buildtime   cas d'usage métier
use_case            buildtime   orchestration des services
repository          buildtime   accès données (interface)
data_model          buildtime   entité domaine / schéma

── Data Layer ──
schema              buildtime   structure de table/collection
migration           buildtime   script de migration

── Tests ──
test                buildtime   code de test (unit/integration/e2e)
test_result         build+run   résultat capturé (artefact de CI)

── Documentation produit ──
doc_product         buildtime   README feature, guide utilisateur
```

---

## 4. Relations (active voice — verbe présent)

### Relations SDD (processus)
```
epic              DECOMPOSES_INTO     feature
feature           REFINED_INTO        user_story
user_story        HAS_CRITERION       acceptance_criterion
acceptance_criterion ANCHORS          test                ← spec-anchored rule
test              VALIDATES           acceptance_criterion
bead              TRACKS              user_story
bead              TRACKS              feature
spec              FORMALIZES          feature
spec              CONTAINS            acceptance_criterion
decision          SUPERSEDES          decision            ← ADR évolution
phase             PRODUCES            acceptance_criterion
phase             CONSUMES            spec
```

### Relations Architecture Frontend
```
ui_screen         CONTAINS            component
ui_screen         CALLS               api_endpoint
component         EXTENDS             component           ← Atom→Molecule
component         IMPLEMENTS          user_story
component         USES                data_model          ← props/state
api_client        INVOKES             api_endpoint
```

### Relations Architecture API
```
api_endpoint      RETURNS             data_model
api_endpoint      REQUIRES            auth_scheme
api_endpoint      APPLIES             middleware
api_endpoint      IMPLEMENTS          user_story
api_contract      SPECIFIES           api_endpoint
```

### Relations Architecture Backend
```
domain_service    ORCHESTRATES        use_case
use_case          READS               repository
use_case          WRITES              repository
repository        MAPS_TO             data_model
repository        USES                schema
migration         EVOLVES             schema
data_model        REFERENCES          data_model          ← FK / association
```

### Relations Documentation
```
doc_product       DOCUMENTS           feature
doc_product       DOCUMENTS           component
doc_product       DOCUMENTS           api_endpoint
test              COVERS              acceptance_criterion ← avec [FEAT]-NN ID
```

### Relations Buildtime/Runtime boundary
```
test              EXERCISES           api_endpoint        ← test d'intégration
test              RENDERS             component           ← test de composant
test_result       CAPTURES            test                ← résultat CI
```

### Relations Cross-layer (harness ↔ produit)
```
feature           DISCOVERED_BY       harness:recipe
spec              WRITTEN_WITH        harness:skill
user_story        PLANNED_WITH        harness:recipe
component         IMPLEMENTED_WITH    harness:recipe
acceptance_criterion VERIFIED_BY      harness:recipe
test              AUTHORED_WITH       harness:skill
```

---

## 5. Parcours du graphe — traversal patterns

### Pattern 1 : De l'intention au code (top-down)
```
epic → DECOMPOSES_INTO → feature
  → REFINED_INTO → user_story
    → HAS_CRITERION → acceptance_criterion
      → ANCHORS → test (code)
      → IMPLEMENTS → component (code)
      → IMPLEMENTS → api_endpoint (contrat)
```
**Usage :** "Qu'est-ce que change si cet epic évolue ?" Blast radius complet.

### Pattern 2 : Du code à la valeur (bottom-up)
```
component → IMPLEMENTS → user_story
  → REFINED_INTO → feature (parent)
    → DECOMPOSES_INTO → epic (intent)
```
**Usage :** "Quel besoin métier ce composant sert-il ?"

### Pattern 3 : Gap analysis (coverage)
```
search(type=acceptance_criterion)
  → filter: ANCHORS → test = ∅   # ACs sans test
search(type=feature)
  → filter: REFINED_INTO → user_story = ∅  # features sans story
search(type=api_endpoint)
  → filter: api_contract = ∅  # endpoints sans spec OpenAPI
search(type=component, subtype=Atom)
  → filter: EXTENDS = ∅  # atoms non réutilisés
```

### Pattern 4 : Impact d'un changement
```
# "Qui est impacté si data_model:User change ?"
open_nodes(["User"]) → toutes les relations sortantes
  → repository:UserRepository (MAPS_TO)
  → api_endpoint:GET/users (RETURNS)
  → component:UserCard (USES)
  → test:test_user_schema (VALIDATES)
```

### Pattern 5 : Traçabilité buildtime → runtime
```
# "Quels tests couvrent ce endpoint ?"
open_nodes(["POST /auth/oauth/callback"])
  → test EXERCISES api_endpoint   # tests d'intégration
  → acceptance_criterion ANCHORS test
  → user_story HAS_CRITERION acceptance_criterion
```

### Pattern 6 : Vue architecture cross-layers
```
# "Comment la feature Login traverse toutes les couches ?"
feature:login-oauth
  → component:LoginForm (IMPLEMENTS)
  → api_endpoint:POST/auth/oauth/callback (IMPLEMENTS)
  → domain_service:OAuthService (via api_endpoint)
  → repository:UserRepository (READS via domain_service)
  → data_model:User (MAPS_TO)
```

### Pattern 7 : Buildtime/runtime boundary check
```
# "Quels contrats API ont des tests runtime ?"
search(type=api_endpoint)
  → filter: test EXERCISES api_endpoint ≠ ∅   # couvert
  → filter: test EXERCISES api_endpoint = ∅   # non couvert
```

---

## 6. Règles du KG

### Règles d'intégrité
```
R1. acceptance_criterion.name MUST match [A-Z]+-\d+ (ex: AUTH-01)
R2. test.name MUST contain the acceptance_criterion.name it ANCHORS
R3. acceptance_criterion MUST have at least one precise outcome observation
R4. api_endpoint MUST specify: method, path, layer=api, scope=buildtime|runtime
R5. component MUST specify: atomic_level=Atom|Molecule|Organism|Template|Page
R6. decision MUST have observations: context, decision, consequences, status
R7. spec entity name MUST match path .specs/features/*/spec.md
R8. runtime entities (log, session, HTTP response) MUST NOT be in product KG
```

### Règles de naming
```
Entities : kebab-case pour features/components/endpoints
           UPPER-NN pour acceptance criteria (AUTH-01)
           Title Case pour epics/screens (LoginPage)
Relations : UPPER_SNAKE_CASE, active voice, présent

Valid:   LoginButton, AUTH-01, POST /auth/callback, UserRepository
Invalid: login_button, auth01, auth/callback, user-repository
```

---

## 7. Limitations du MCP Memory Server

| Limite | Impact | Gravité |
|---|---|---|
| **Pas de typage fort** | entityType est une string libre, facile d'être inconsistant | ⚠️ Modéré |
| **Recherche texte seul** | search_nodes = full-text, pas de traversal "find all reachable from X" | ⚠️ Modéré |
| **Pas d'algorithmes graphe** | Pas de shortest path, cycle detection, connected components | ⚠️ Modéré |
| **Pas d'agrégation** | Impossible de compter, grouper, sommer | ⚠️ Modéré |
| **Pas de schema enforcement** | Peut créer des relations orphelines, des cycles | ⚠️ Modéré |
| **Pas de transactions** | Mises à jour non atomiques | ⚠️ Modéré |
| **Pas de versioning** | Pas de requêtes temporelles "état au 2026-07-01" | ⚠️ Modéré |
| **read_graph = tout charger** | Lent si KG > 10k entités | ❌ Bloquant au scale |
| **Fichier unique JSONL** | Pas d'isolation multi-projet native | ❌ Bloquant si multi-projet |

---

## 8. Alternatives quand les limites sont atteintes

### Niveau 1 — Contournements dans MCP Memory

| Limite | Contournement |
|---|---|
| Pas de traversal | Python + NetworkX : charger le JSONL, requêtes graph via nx.descendants() |
| Pas de schema | Skill knowledge-graph avec règles de nommage + checklist de validation |
| Pas de versioning | Observation "snapshot: 2026-07-09 state=X" — filtre dans search |
| Multi-projet | MEMORY_FILE_PATH distinct par projet (variable d'env) |
| Agrégation | Python post-processing sur read_graph JSON |

### Niveau 2 — Dolt comme KG SQL (déjà installé !)

**Insight clé :** Dolt est déjà utilisé pour Beads. C'est un **SQL database avec Git semantics**.
On peut y stocker le KG avec :

```sql
-- Tables KG dans Dolt
CREATE TABLE entities (
  name TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  scope TEXT CHECK(scope IN ('buildtime','runtime','both')),
  layer TEXT CHECK(layer IN ('epic','story','frontend','api','backend','data','test','doc')),
  namespace TEXT CHECK(namespace IN ('harness','product'))
);

CREATE TABLE observations (
  entity_name TEXT REFERENCES entities(name),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE relations (
  from_entity TEXT REFERENCES entities(name),
  to_entity   TEXT REFERENCES entities(name),
  relation_type TEXT NOT NULL,
  PRIMARY KEY (from_entity, to_entity, relation_type)
);
```

**Avantages Dolt :**
- Requêtes SQL complètes (JOIN, GROUP BY, WITH RECURSIVE pour traversal)
- Foreign keys = intégrité référentielle
- Git history = requêtes temporelles (état au commit X)
- Branches = KG sur feature branch, merge au close
- Déjà configuré dans le harness (via Beads)
- bd dolt push = synchronisation

**Traversal récursif en SQL :**
```sql
-- "Tous les composants nécessaires pour la feature AUTH"
WITH RECURSIVE tree AS (
  SELECT name FROM entities WHERE name = 'login-oauth'
  UNION ALL
  SELECT r.to_entity FROM relations r
  JOIN tree t ON r.from_entity = t.name
  WHERE r.relation_type IN ('DECOMPOSES_INTO','REFINED_INTO','IMPLEMENTS')
)
SELECT * FROM tree JOIN entities USING(name);
```

### Niveau 3 — Solutions spécialisées (si scale)

| Solution | Usage | Avantage |
|---|---|---|
| **Falkordb** | KG haute performance Redis-based | Cypher + MCP native |
| **Neo4j** | KG transactionnel complet | Cypher, APOC, bloom visualizer |
| **ArangoDB** | Multi-modèle (graph + document) | AQL, transactions |
| **DuckDB** | OLAP sur KG (analytics) | Requêtes complexes ultra-rapides |
| **Kuzu** | Graph embarqué | Cypher, embeddable |

---

## 9. Approche recommandée pour le harness SDD

### Architecture hybride à 3 couches

```
Session     MCP Memory KG          ← rapide, in-context, read_graph en ~100ms
             (JSONL local)           search_nodes + create/delete pour CRUD live

Durable     Dolt (via Beads)        ← persistant, SQL, git-synced, multi-session
             (SQL tables)            WITH RECURSIVE pour traversal complexe
                                     bd dolt push = sauvegarde + partage

Visualisé   memory-visualizer       ← https://memviz.herich.tech
             (D3.js + JSON upload)   charger le JSONL, explorer entities/relations
```

### Flux d'utilisation

```
1. Début de session :
   → Charger le KG via MCP (read_graph ou open_nodes ciblé)
   → Orienter l'agent sur les entités pertinentes

2. Pendant la session (SDD phases) :
   → create_entities + create_relations pour les nouveaux artefacts
   → add_observations pour les faits découverts
   → search_nodes pour blast radius et propagation

3. Fin de session :
   → Synchroniser le JSONL vers Dolt (export + import SQL)
   → bd dolt push pour persistance cross-session

4. Analyse et visualisation :
   → Charger le JSONL dans memviz.herich.tech
   → Filtrer par type d'entité (feature / component / test)
   → Identifier les gaps (nœuds sans relations ANCHORS, IMPLEMENTS)
```

---

## 10. Intégration dans les flows et checklists SDD

### Checkpoint KG par phase

```markdown
## Phase discover → KG
- [ ] create_entity(epic, feature) avec scope=buildtime
- [ ] add_observation(feature, "layer: frontend|api|backend|data")
- [ ] create_relation(epic DECOMPOSES_INTO feature)

## Phase spec → KG  
- [ ] create_entity(acceptance_criterion, [FEAT]-NN)
- [ ] create_entity(spec, ".specs/features/*/spec.md")
- [ ] create_relation(spec FORMALIZES feature)
- [ ] create_relation(user_story HAS_CRITERION acceptance_criterion)

## Phase plan → KG
- [ ] add_observation(bead, "bead_id: proj-xxx")
- [ ] create_relation(bead TRACKS user_story)

## Phase TDD → KG
- [ ] create_entity(test, "test_FEAT_NN_description")
- [ ] create_relation(test VALIDATES acceptance_criterion)
  ← Spec-Anchored Rule vérifiable : acceptance_criterion ANCHORS test

## Phase implement → KG
- [ ] create_entity(component|api_endpoint|domain_service...)
- [ ] create_relation(component IMPLEMENTS user_story)
- [ ] add_observation(component, "atomic_level: Atom|Molecule...")
- [ ] add_observation(component, "scope: buildtime, layer: frontend")

## Phase review → KG
- [ ] search_nodes(acceptance_criterion) → filter ANCHORS test = ∅ → gaps
- [ ] search_nodes(component) → filter IMPLEMENTS = ∅ → code orphelin

## Phase verify → KG
- [ ] add_observation(test, "status: passing, ci_run: 2026-07-09")
- [ ] Mettre à jour test_result si CI capturé
```

### Requêtes KG dans les agents

```
implementation-worker avant de coder :
  search_nodes("[FEAT]-NN") → voir le contexte complet (story, spec, test RED)

review-critic avant de reviewer :
  search_nodes("feature:login-oauth") → voir tous les ACs + tests attendus

tdd-guide avant d'écrire le test :
  open_nodes(["AUTH-01"]) → voir les observations de l'AC (WHEN/THEN/SHALL précis)

architect sur un ADR :
  search_nodes("decision") → voir les décisions existantes + what they GOVERN

product-owner sur le backlog :
  search_nodes(type=acceptance_criterion, filter: ANCHORS=∅) → ACs sans test
  search_nodes(type=feature, filter: REFINED_INTO=∅) → features non spécifiées
```
