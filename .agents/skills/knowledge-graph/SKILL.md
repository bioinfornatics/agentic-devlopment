---
name: knowledge-graph
description: >
  Knowledge Graph MCP for SDD product development. Load to create entities, relations and
  observations, query the graph, and detect coverage gaps across the full buildtime chain.
  Use during any SDD phase to record and traverse product artifacts.
metadata:
  version: 1.0.0
---

# Knowledge Graph — SDD Semantic Memory

Load this skill when you need to read or write the project KG (`.knowledge/memory.jsonl`).
The KG MCP server exposes 9 tools: `create_entities`, `create_relations`, `add_observations`,
`delete_entities`, `delete_relations`, `delete_observations`, `read_graph`, `search_nodes`, `open_nodes`.

---

## 1. Orient first

Before reading or writing:
```
search_nodes("<domain keyword>")   # find existing entities
```
Never create duplicate entities. If an entity exists, use `add_observations` to enrich it.

---

## 2. Two namespaces

| Namespace | entityType prefix | What it models |
|---|---|---|
| **harness:** | `harness:recipe`, `harness:skill`, `harness:agent`, `harness:doc` | The SDD toolchain |
| **product** | `epic`, `feature`, `user_story`, `acceptance_criterion`, `component`, `api_endpoint`, `data_model`, `test`, `code_file`… | What you are building |

---

## 3. Buildtime vs runtime

Only **buildtime** entities belong in the KG (specs, code, contracts, tests).
**Never** add runtime entities (log lines, HTTP responses, DB rows, user sessions).

| Buildtime ✅ | Runtime ❌ |
|---|---|
| spec.md, code file, test, schema | Log entry, session token, HTTP call |
| acceptance criterion | Test execution result (→ add observation only) |
| api_endpoint contract (OpenAPI) | Live HTTP request |

---

## 4. Entity types and mandatory observations

```
epic              observations: scope, status, description
feature           observations: scope, layer (frontend|api|backend|data), status
user_story        observations: scope, "as a … I want … so that …"
acceptance_criterion  observations: scope, "criterion: WHEN … THEN …", status
component         observations: scope=buildtime, layer=frontend, "atomic_level: Atom|Molecule|Organism|Template", file
api_endpoint      observations: scope=buildtime, layer=api, method, path, file
data_model        observations: scope=buildtime, layer=backend|data, file
test              observations: scope=buildtime, file, "covers: [FEAT]-NN"
code_file         observations: scope=buildtime, "path: src/…"
spec_file         observations: scope=buildtime, "path: .specs/features/…/spec.md"
harness:recipe    observations: scope=buildtime, namespace=harness, file, slash
harness:skill     observations: scope=buildtime, namespace=harness, file
harness:agent     observations: scope=buildtime, namespace=harness, file
```

**Rule R9** (mandatory): every buildtime entity with a file MUST have
`IMPLEMENTED_IN` | `LOCATED_IN` | `DEFINED_IN` pointing to a `code_file` or `spec_file`.

---

## 5. Relations (active voice)

```
epic              DECOMPOSES_INTO     feature
feature           REFINED_INTO        user_story
user_story        HAS_CRITERION       acceptance_criterion
acceptance_criterion ANCHORS          test           ← spec-anchored rule
test              VALIDATES           acceptance_criterion
component         IMPLEMENTS          user_story
api_endpoint      IMPLEMENTS          user_story
api_endpoint      RETURNS             data_model
component         EXTENDS             component      ← Atomic Design hierarchy
component         IMPLEMENTED_IN      code_file      ← chain closure
api_endpoint      IMPLEMENTED_IN      code_file
test              LOCATED_IN          code_file
user_story        TRACED_IN           spec_file
decision          GOVERNS             component
bead              TRACKS              user_story
harness:recipe    USES_SKILL          harness:skill
harness:recipe    DELEGATES_TO        harness:agent
harness:agent     LOADS               harness:skill
harness:doc       DESCRIBES           harness:recipe
```

---

## 6. CRUD protocol by SDD phase

### discover
```
create_entities([{name:"<epic-slug>",entityType:"epic",observations:["scope:buildtime","status:planning"]}])
create_entities([{name:"<feature-slug>",entityType:"feature",observations:["scope:buildtime","layer:…","status:todo"]}])
create_relations([{from:"<feature>",to:"<epic>",relationType:"DECOMPOSES_INTO"}])
```

### spec
```
create_entities([{name:"[FEAT]-01",entityType:"acceptance_criterion",
  observations:["scope:buildtime","criterion:WHEN … THEN system SHALL …","status:pending"]}])
create_relations([{from:"<user_story>",to:"[FEAT]-01",relationType:"HAS_CRITERION"}])
create_relations([{from:"[FEAT]-01",to:"<spec_file>",relationType:"LOCATED_IN"}])
```

### plan
```
create_entities([{name:"<bead-id>",entityType:"bead",observations:["scope:buildtime","bead_id:<id>"]}])
create_relations([{from:"<bead-id>",to:"<user_story>",relationType:"TRACKS"}])
```

### implement
```
create_entities([{name:"<component>",entityType:"component",
  observations:["scope:buildtime","layer:frontend","atomic_level:Molecule","file:src/…"]}])
create_entities([{name:"src/…/file.tsx",entityType:"code_file",observations:["scope:buildtime","path:src/…/file.tsx"]}])
create_relations([{from:"<component>",to:"src/…/file.tsx",relationType:"IMPLEMENTED_IN"}])
create_relations([{from:"<component>",to:"<user_story>",relationType:"IMPLEMENTS"}])
```

### review — gap queries
```
search_nodes("acceptance_criterion")   # find all ACs
# filter manually: those without ANCHORS relation = missing tests
search_nodes("[FEAT]-")                # find ACs by feature prefix
open_nodes(["[FEAT]-01","test_FEAT_01_desc"])  # verify spec-anchored link
```

### verify
```
add_observations([{entityName:"test_FEAT_01_desc",observations:["status:passing","ci_run:2026-07-09"]}])
```

---

## 7. Traversal patterns (query cookbook)

| Goal | Query |
|---|---|
| Blast radius of a feature change | `open_nodes(["<feature>"])` → follow DECOMPOSES_INTO + IMPLEMENTS + IMPLEMENTED_IN |
| File list to edit for data model change | `open_nodes(["<data_model>"])` → MAPS_TO → IMPLEMENTED_IN → code_file |
| ACs without tests (TDD gap) | `search_nodes("acceptance_criterion")` → filter: no entity whose name is in an ANCHORS relation |
| Features without user stories | `search_nodes("feature")` → filter: no REFINED_INTO outgoing |
| Harness blast radius (recipe renamed) | `search_nodes("<recipe-name>")` → DESCRIBES from harness:doc |
| Context before coding | `open_nodes(["[FEAT]-NN"])` → criterion + spec + existing tests |

---

## 8. Gotchas

- **Never create runtime entities** — logs, sessions, HTTP calls, DB rows
- **Duplicate check first** — `search_nodes` before `create_entities`
- **R9 mandatory** — every code entity needs `IMPLEMENTED_IN` or `LOCATED_IN`
- **Active voice relations** — IMPLEMENTS not implemented_by
- **[FEAT]-NN format** — acceptance criteria must follow `[A-Z]+-\d+` naming
- **Visualize** — drag `.knowledge/memory.jsonl` onto https://memviz.herich.tech

## Beads loop
For Beads workflow commands, load skill: `beads-harness`.

---

## Correction — Goose `memory` builtin vs KG externe

Le **memory builtin Goose** (`enabled: true` dans config) expose :
```
remember_memory(category, data, tags, is_global)  # écrire
retrieve_memories(category, is_global)             # lire  
remove_memory_category(category, is_global)        # supprimer catégorie
remove_specific_memory(category, memory_content, is_global)
```

Stockage : `.goose/memory/<category>.txt` (local) — chargé automatiquement en session.

**Ce n'est PAS un graphe** — aucune relation, aucun traversal. Utiliser pour:
- Mémoire de session SDD (phase courante, AC IDs, decisions)
- Préférences projet (runners de tests, conventions de nommage)
- Résumés des entités clés (agents → rôle, recipes → slash)

**Le graphe propre** (`.knowledge/memory.jsonl` + `create_entities` / `search_nodes`) reste disponible via `knowledgegraphmemory` si activé, mais n'est PAS natif Goose.

### Catégories recommandées pour SDD

```
remember_memory("harness/agents",  "review-critic: ...",  ["agent"],   false)
remember_memory("harness/recipes", "review: /review ...", ["recipe"],  false)
remember_memory("product/features","AUTH-login: status=spec-done ...",["feature"],false)
remember_memory("sdd/phase",       "current=implement, bead=proj-abc",["sdd"],   false)
remember_memory("sdd/gaps",        "AC AUTH-03: no test yet",          ["gap"],   false)
```

