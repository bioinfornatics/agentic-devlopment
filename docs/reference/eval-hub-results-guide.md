# Eval-Hub — Guide d'interprétation des résultats

> Référence opérationnelle pour analyser un rapport `layered eval` et décider des actions suivantes.

---

## 1. Anatomie d'un run

```
dist/evals/layered/<TIMESTAMP>/
├── state.json                         ← résumé des 3 layers (status, avgDelta, n, elapsedMs)
├── agents/
│   ├── _integrity-v2/agents/
│   │   ├── manifest.json              ← paramètres du run (sujets, model, maxTurns…)
│   │   ├── report-state.json          ← rapport agrégé (validPairCount, excludedPairCounts…)
│   │   └── terminals/<hash>.json      ← un fichier par (sujet × evalId × side)
│   └── <subject>/<sourceHash>/eval-<N>/
│       ├── eval_metadata.json         ← titre, difficulté, hash
│       ├── agent_l1/run-1/            ← baseline (skill only)  → grading.json, timing.json
│       ├── agent_l2/run-1/            ← candidate (skill + agent) → grading.json, timing.json
│       └── repetition-0/
│           ├── baseline/              ← execution-result.json, goose-log-analysis.json
│           └── candidate/             ← execution-result.json, goose-log-analysis.json
├── integrity-report-agents.json       ← delta statistique final
└── integrity-report-agents.html       ← rendu HTML du rapport
```

---

## 2. Lecture rapide du terminal

```
Layer result: avg Δ = +19.0476  (7 subjects · 13m33s) [improvement]  ← L1 skills ✓
Layer result: avg Δ = +0.0000   (2 subjects · 18m34s) [no improvement] ← L2 agents ✗
⚠  EARLY STOP  L2 avg Δ = +0.0000 ≤ threshold 0
⏭  L3 recipes — early_stop
```

| Signal terminal | Interprétation |
|---|---|
| `avg Δ = +X.X` | Amélioration moyenne en points de pourcentage (pp) du candidat vs baseline |
| `[improvement]` | Δ > 0 — layer validée |
| `[no improvement]` | Δ ≤ 0 — layer échoue; L3 peut être skipped |
| `EARLY STOP` | Couche N a Δ ≤ threshold; couche N+1 sautée automatiquement |
| `result_missing × N` | N paires exclues du calcul — signal de problème de fond |
| `treatment_bootstrap_failed` | Le candidat a échoué à prouver le chargement de l'agent au runtime |

---

## 3. Hiérarchie des layers

| Layer | Comparaison | Baseline (control) | Candidate (test) |
|---|---|---|---|
| **L1 skills** | skill vs no-skill | `skill_l0` — aucun artefact | `skill_l1` — skill cible chargée |
| **L2 agents** | agent vs skill seul | `agent_l1` — skills uniquement | `agent_l2` — skills + agent |
| **L3 recipes** | recipe vs skill+agent | `recipe_l2` — skills+agents sans recette | `recipe_l3` — recette complète |

Un Δ ≥ 0 à L1 mais = 0 à L2 signifie : **les skills apportent de la valeur, mais l'agent (la couche d'orchestration) n'en ajoute pas**.

---

## 4. Diagnostic pas-à-pas

### 4.1 Vérifier `state.json`

```bash
jq . dist/evals/layered/<TS>/state.json
```

Chercher : `status`, `avgDelta`, `n`, `excludedPairCounts`.

### 4.2 Compter les exclusions et identifier leur type

```bash
jq '.excludedPairCounts' \
  dist/evals/layered/<TS>/agents/_integrity-v2/agents/report-state.json
```

| Code d'exclusion | Signification | Action |
|---|---|---|
| `result_missing` | Score null — goose a tourné mais le grader n'a pas scoré **ou** le traitement candidat a échoué | Vérifier `execution-result.json → failureReason` |
| `treatment_bootstrap_failed` | L'agent n'a pas pu être vérifié comme chargé au runtime | Vérifier `treatmentActivation.failedAgents` |
| `grader_invalid` | Le grader LLM n'a pas retourné de JSON parseable | Relancer ou vérifier le prompt du grader |
| `input_mismatch` | Hash du task payload différent entre runs | Fixture modifiée en cours de run |
| `provenance_mismatch` | Identifiants de provenance divergents | Re-run complet nécessaire |

### 4.3 Inspecter les terminals pour localiser les échecs

```bash
for f in dist/evals/layered/<TS>/agents/_integrity-v2/agents/terminals/*.json; do
  jq -r '[.subject, "eval", .evalId, .side, .status,
    (.exclusion // .grading.score // "?")] | @tsv' "$f"
done
```

### 4.4 Pour chaque candidat échoué, lire `execution-result.json`

```bash
jq -r '"status: \(.status)\nfailureReason: \(.failureReason // null)\nactivation: \(.treatmentActivation.status) — failedAgents: \(.treatmentActivation.failedAgents | @json)"' \
  dist/evals/layered/<TS>/agents/<subject>/<hash>/eval-0/repetition-0/candidate/execution-result.json
```

### 4.5 Vérifier le timing pour détecter `maxTurnsReached`

```bash
cat dist/evals/layered/<TS>/agents/<subject>/<hash>/eval-0/agent_l2/run-1/timing.json
```

`maxTurnsReached: true` avec `turnsUsed > maxTurns` : le baseline a épuisé ses tours. La limite est trop basse ou l'agent tourne en boucle.

---

## 5. Patterns de diagnostic communs

### Pattern A — `treatment_bootstrap_failed` sur certains agents

**Symptôme** : `failedAgents: ['independent-verifier']` dans `execution-result.json` bien que `execution-evidence.json` montre `status: materialized`.

**Mécanique** : `inspectTreatmentActivation` analyse le stream output et cherche une réponse `load(source: "<agent>")` contenant `"# Loaded: <agent> (agent)"` ou `"# Loaded Agent: <agent>"`. Si l'agent ne se charge pas explicitement via l'outil `load` au runtime, il échoue la vérification.

**Cause racine** : L'instruction système `load agent: X` active les directives de l'agent mais ne génère **pas** d'événement d'outil observable dans le stream. Le check `verified` exige un appel `load` **explicite** dans la session.

**Actions** :
1. Vérifier si l'agent appelle `load_skill` ou `load` dans ses propres instructions.
2. Si non, ajouter dans les instructions de l'agent : charger les skills requises explicitement via l'outil `load_skill`.
3. Vérifier que le nom de l'agent correspond exactement à ce que retourne `load(source: "independent-verifier")` — chercher `"# Loaded: independent-verifier (agent)"` ou `"# Loaded Agent: independent-verifier"` dans le stream.

### Pattern B — Δ = 0 sur paires valides

**Symptôme** : Scores identiques pour baseline et candidate (ex: 0.7417 / 0.7417).

**Causes possibles** :
- **Tâche trop simple** : le skill seul suffit à atteindre le plafond du grader — L'agent n'apporte rien de mesurable.
- **Tâche trop difficile** : ni baseline ni candidate ne la résolvent — plancher à zéro.
- **Grader aveugle au différentiel** : les critères d'évaluation ne testent pas ce que l'agent apporte.
- **L'agent réutilise exactement le comportement du skill** : instructions redondantes.

**Diagnostic** :
```bash
# Comparer les scores par eval_id et sujet
for f in dist/evals/layered/<TS>/agents/_integrity-v2/agents/terminals/*.json; do
  jq -r '[.subject, "eval", .evalId, .side,
    (.grading.score // "N/A"), (.grading.outcomes // "" | tostring)] | @tsv' "$f"
done | sort
```

Chercher : est-ce que tous les evalIds ont le même score ? Si oui → grader ou critères à revoir.

### Pattern C — `maxTurnsReached: true`

**Symptôme** : `turnsUsed > maxTurns`, `maxTurnsReached: true` dans `timing.json`.

**Impact** : La session s'est arrêtée avant de terminer. Le score reflète un travail incomplet.

**Actions** :
- Augmenter `maxTurns` dans `src/app/eval-hub/evals/agents/<subject>.json`.
- Vérifier dans `goose-log-analysis.json` les `warnings` de type `runtime_error` — présence de boucles d'outil ou de logs anormaux.

### Pattern D — Grand CI avec Δ = 0

**Symptôme** : `interval: [-84.7, +84.7]` avec n=2.

**Signification** : L'intervalle de confiance est énorme car n est trop petit. On ne peut **pas conclure** que l'agent est sans effet — on manque juste de données.

**Action** : Augmenter `repetitions` ou le nombre de sujets pour réduire l'intervalle. Un CI qui croise zéro mais est positif reste potentiellement intéressant.

---

## 6. Check-list après chaque run

```
[ ] state.json → tous les layers ont status: "done" ?
[ ] excludedPairCounts → zéro exclusion ?
[ ] Si result_missing > 0 → examiner execution-result.json pour failureReason
[ ] Si treatment_bootstrap_failed → vérifier les instructions de l'agent (load_skill explicite)
[ ] Si maxTurnsReached → ajuster maxTurns dans le fichier eval
[ ] Δ ≥ 0 à chaque layer ?
[ ] CI ne croise pas zéro de façon large ?
[ ] Si EARLY STOP → corriger la layer bloquante avant de relancer
```

---

## 7. Commandes utiles

```bash
# Run de base (tous les layers)
node src/app/eval-hub/dist/index.js kind=agents subjects=change-builder,error-analyzer,independent-verifier,repository-researcher mode=layer-delta repetitions=3 maxTurns=40 timeoutMs=900000 ambient=true

# Résumé rapide d'un run
jq -r '.layers | to_entries[] |
  [.key, .value.status, .value.avgDelta, .value.n,
   (.value.report.excludedPairCounts // {} | tojson)] | @tsv' \
  dist/evals/layered/<TS>/state.json \
  | while IFS="$(printf '\t')" read -r name status delta n excluded; do
      printf '%s: status=%s Δ=%+.4f n=%s excluded=%s\n' \
        "$name" "$status" "$delta" "$n" "$excluded"
    done

# Lister toutes les paires avec leur score
for f in dist/evals/layered/<TS>/agents/_integrity-v2/agents/terminals/*.json; do
  jq -r '[.subject, .evalId, .side, .status,
    (.grading.score // "exclu"), (.exclusion // null)] | @tsv' "$f"
done

# Taux de pass par eval par sujet
for f in dist/evals/layered/<TS>/agents/*/*/eval-*/agent_l2/run-1/grading.json; do
  relative=${f#dist/evals/layered/<TS>/agents/}
  subject=${relative%%/*}
  relative=${relative#*/}; relative=${relative#*/}
  eval_id=${relative%%/*}
  jq -r --arg subject "$subject" --arg eval_id "$eval_id" \
    '[$subject, $eval_id, "candidate:", (.summary | tostring)] | @tsv' "$f"
done
```

---

## 8. Interprétation statistique (rappel)

| Métrique | Signification |
|---|---|
| `pairMicro.meanDeltaPp` | Δ moyen sur toutes les paires (evalId × sujet) |
| `subjectMacro.meanDeltaPp` | Δ moyen par sujet puis moyenné |
| `interval [lower, upper]` | IC 95% par t-test apparié |
| `validPairCount` | Paires incluses dans le calcul |
| `result_missing` | Paires sans score — **ne comptent pas, faussent le résultat si nombreuses** |

> **Règle de décision** : Retenir la couche si `subjectMacro.meanDeltaPp > 0` ET `interval.lower > 0`.  
> Un Δ positif avec CI croisant zéro = signal faible, augmenter n.  
> Un Δ = 0 avec peu de paires valides = **résultat non-concluant**, pas un échec définitif.

---

## 9. Liens

- Source : `src/app/eval-hub/src/domains/execution/executionIntegrity.ts` — mécanisme `inspectTreatmentActivation`
- Architecture : `src/app/eval-hub/ARCHITECTURE.md`
- Evals definitions : `src/app/eval-hub/evals/agents/`, `src/app/eval-hub/evals/skills/`, `src/app/eval-hub/evals/recipes/`
- Rapport HTML : `dist/evals/layered/<TS>/integrity-report-agents.html`

---

## 10. Note sur `turnsUsed > maxTurns` (artefact de comptage)

`turnsUsed` dans `timing.json` compte **tous** les messages `role: assistant` dans le stream stdout — y compris ceux des sous-sessions déléguées (Orchestrator sub-agents). `maxTurns` gouverne uniquement la session racine.

**Exemple observé :** IV eval-0 baseline → `turnsUsed: 137`, `maxTurns: 40`  
→ root session ~40 turns + sub-agents collectivement ~97 turns

`maxTurnsReached: true` se déclenche à `turns >= maxTurns` (root boundary), mais le stream continue depuis les sous-sessions en vol. Ce comportement est documenté dans `src/app/eval-hub/REVIEW.md §2.1`.

**Interprétation :** ce n'est pas un bug fonctionnel. Ne pas confondre avec une session bloquée. Si la qualité du run est acceptable (grading non-null), ignorer cet artefact.

