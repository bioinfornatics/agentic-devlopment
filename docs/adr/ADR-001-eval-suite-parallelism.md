# ADR-001: Parallélisation de la suite d'évaluation des skills

**Status:** Proposed  
**Date:** 2026-07-08  
**Décision:** Différée — documenter pour décider plus tard

---

## Contexte

La suite d'évaluation A/B des skills (`run-skill-ab-suite.py`) est entièrement séquentielle :

```
Suite (8 skills)
  └── Eval (3 scénarios × 2 configs = 6 runs Goose par skill)
        └── 1 Goose process bloquant, 60–200s par run
```

Durée actuelle : **8 skills × ~15 min ≈ 120 min** pour une suite complète.

---

## Problème

Avec l'extension du harness (nouvelles skills, nouveaux scénarios), le temps de suite augmente linéairement. Une suite complète dépasse déjà 2h. La commande `--skills X Y` permet de re-tester un sous-ensemble, mais n'accélère pas un run complet.

---

## Décision proposée : Niveau 1 uniquement — skills en parallèle

Trois niveaux sont candidats. Un seul est retenu pour l'instant.

### Niveau 1 — Skills en parallèle (RETENU, non implémenté)

**Principe :** `run-skill-ab-suite.py` soumet chaque skill dans un `ProcessPoolExecutor`. Chaque worker exécute `run-skill-ab-eval.py` (inchangé). Le thread principal agrège les résultats via `as_completed()`.

```
Suite (thread principal)
  ├── submit(skill=agentic-dev-harness) → worker process  ┐
  ├── submit(skill=beads-harness)       → worker process  ├─ max_workers=3
  ├── submit(skill=code-review)         → worker process  ┘
  │
  ├── as_completed(future):        ← séquentiel (thread principal)
  │     afficher stdout en bloc    ← lisible, pas d'interleaving
  │     écrire DB                  ← séquentiel ✅ pas de lock
  │
  └── build_suite_index()          ← après tous les futures
```

**Gain estimé :** 120 min → ~40 min avec `max_workers=3`.

**Interface :**
```bash
python3 scripts/run-skill-ab-suite.py \
  --max-workers 3    # défaut=3 ; 1=séquentiel (rétrocompatible)
  --continue-on-failure
```

### Niveau 2 — Scénarios en parallèle (DIFFÉRÉ)

**Raison du report :** `benchmark.json` est produit après tous les scénarios d'un skill — nécessite refactoring de l'agrégation. SQLite concurrent au niveau scénario → locks probables. Complexité élevée pour un gain de ~50% par skill (déjà couvert par le niveau 1).

### Niveau 3 — Configs en parallèle (DIFFÉRÉ)

**Raison du report :** Gain marginal (~25% du total) après niveau 1. Rapport complexité/bénéfice défavorable.

---

## Analyse des risques

| Risque | Niveau | Mitigation |
|---|---|---|
| SQLite concurrent | ⚠️ Modéré | Écriture DB dans `as_completed()` (séquentiel) — aucun writer simultané |
| Rate limit API (Anthropic) | ⚠️ Modéré | `max_workers=3` par défaut, configurable ; ~50 req/min autorisées |
| RAM / CPU | ⚠️ Faible | 3 Goose simultanés ≈ 1.5 GB RAM — acceptable sur station de dev |
| stdout illisible | ✅ Géré | stdout capturé par worker, affiché en bloc une fois le skill terminé |
| Collision filesystem | ✅ Aucun | `git archive | tar -x` vers répertoires distincts par skill |
| Tracabilité DB | ✅ Préservée | `run_id`, `scenario_hash`, timestamps — indépendants de l'ordre |
| Rétrocompatibilité | ✅ Garantie | `--max-workers 1` = comportement séquentiel identique à l'actuel |

---

## Impact sur le code

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `scripts/run-skill-ab-suite.py` | ~40 lignes — `ProcessPoolExecutor`, boucle `as_completed`, argument `--max-workers` |

### Fichiers inchangés

| Fichier | Raison |
|---|---|
| `scripts/run-skill-ab-eval.py` | Unité de travail par skill — reste séquentiel en interne |
| `scripts/eval_utils.py` | Écriture DB déjà isolée par skill |
| `scripts/analyze-skill-eval-results.py` | Post-traitement — inchangé |
| `scripts/build-eval-report.py` | Inchangé |
| VSCode tasks / JetBrains `.run/` | Invoquent la suite — inchangés |

---

## Pseudo-code d'implémentation

```python
# run-skill-ab-suite.py — changement localisé

from concurrent.futures import ProcessPoolExecutor, as_completed

def run_one_skill(skill: str, argv: list[str]) -> tuple[str, int, str, str]:
    """Worker: exécute run-skill-ab-eval.py pour un skill, retourne stdout capturé."""
    cmd = [sys.executable, str(ROOT / "scripts" / "run-skill-ab-eval.py"),
           "--skill", skill, *argv]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return skill, proc.returncode, proc.stdout, proc.stderr

def main():
    # ... parsing args ...
    max_workers = args.max_workers  # nouveau flag, défaut=3

    results: dict[str, dict] = {}

    with ProcessPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(run_one_skill, skill, forwarded_argv): skill
                   for skill in skills}

        for future in as_completed(futures):
            skill = futures[future]
            skill_rc, skill_out, skill_err = future.result()[1:]

            # Affichage en bloc — lisible, pas d'interleaving
            print(f"== Completed skill eval suite item: {skill} ==", flush=True)
            print(skill_out, flush=True)

            results[skill] = {"returncode": skill_rc, "workspace": ...}

            # Écriture DB séquentielle (thread principal)
            record_eval_run(db_path=args.history_db, skill=skill, ...)

    # Suite index comme avant
    build_suite_index(results, ...)
```

---

## Critères de décision future

Implémenter quand :
- [ ] La suite complète dépasse régulièrement **90 min** (seuil de douleur)
- [ ] Le nombre de skills dépasse **12** (durée linéaire insoutenable)
- [ ] Un CI auto-trigger est mis en place (latence critique)
- [ ] Les rate limits API ont été vérifiés empiriquement sur 3 skills simultanés

Ne pas implémenter si :
- La suite est déjà couverte par des runs partiels (`--skills`) au quotidien
- Le budget API ne supporte pas 3× la consommation actuelle
- Une session de dev ne tourne qu'une ou deux skills à la fois

---

## Tracabilité

Bead de backlog : à créer si la décision est de mettre en œuvre.  
Auteur de l'analyse : session 2026-07-08.  
Skill eval files concernés : tous les `evals/skills/*.json`.

---

## Addendum — Analyse bases de données embarquées (2026-07-08)

*Suite à l'article Kestra : [Embedded Databases in 2026](https://kestra.io/blogs/embedded-databases)*

### Contexte de la recherche

La parallelisation du niveau 1 (skills en //) est bloquée par le risque de lock SQLite concurrent.
L'article Kestra couvre DuckDB, SQLite, Polars, chDB. Analyse de leur pertinence pour notre cas.

### Découverte critique : evaluation.db est en mode DELETE, pas WAL

```
PRAGMA journal_mode → ('delete',)   # mode par défaut — lock exclusif à chaque write
```

En mode DELETE, chaque écriture pose un verrou exclusif sur le fichier entier.
En mode **WAL** (Write-Ahead Logging), les écritures sont sérialisées automatiquement
avec retry — plusieurs processus peuvent écrire sans erreur.

### Simulation prouvant que SQLite WAL suffit

Test : 3 skills en parallèle, 15 rows chacun, avec timeout=30s :

```
errors : none
rows   : 45/45 attendus
temps  : 0.15s / 0.33s / 0.58s   ← sérialisation transparente
```

### Matrice candidates (article Kestra)

| DB | Concurrent writes multi-process | Migration | Verdict pour ce besoin |
|---|---|---|---|
| **SQLite WAL** | ✅ sérialisé + retry, 0 erreurs prouvées | 0 — juste `PRAGMA journal_mode=WAL` | **Solution immédiate** |
| **DuckDB** | ❌ même limite single-writer | Modérée (SQL-compatible) | Non — meilleur pour l'analyse, pas les writes |
| **Polars** | ❌ pas de persistance | Élevée | Hors sujet |
| **Dolt** | ✅ via branches puis merge | Élevée | Surdimensionné pour 3 writers |
| **chDB** | ❌ analytics-only | Très élevée | Hors sujet |

### Révision de l'analyse des risques

| Risque (v1) | Réévaluation |
|---|---|
| SQLite concurrent → OperationalError | ✅ Résolu par WAL + timeout=30s — aucune migration |
| DuckDB comme alternative | ❌ Même contrainte single-writer — non pertinent pour écriture // |
| DuckDB pour l'analyse | ✅ Pertinent pour accélérer analyze-skill-eval-results.py (OLAP) — backlog séparé |

### Simplification de l'implémentation

Le changement SQLite WAL est **2 lignes** dans `eval_utils.py` :

```python
def init_history_db(db_path: Path) -> None:
    with sqlite3.connect(db_path) as db:
        db.execute("PRAGMA journal_mode=WAL")   # ← ligne 1 : activer WAL
        db.execute("PRAGMA busy_timeout=30000") # ← ligne 2 : retry 30s
        # ... reste identique
```

Avec ce seul changement, la parallélisation niveau 1 est débloquée sans migration de base.

### DuckDB — usage alternatif (backlog séparé)

DuckDB serait pertinent pour remplacer les queries d'analyse sur `evaluation.db` :
- `analyze-skill-eval-results.py` : GROUP BY, JOIN complexes → 10-100× plus rapide en DuckDB
- `build-eval-report.py` : agrégation des 851+ feedback rows → vectorisé

Cela ne change pas la DB d'écriture (SQLite reste) mais accélère la phase de lecture.
Candidat pour un ADR séparé.

### Critères de décision mis à jour

L'implémentation niveau 1 est recommandée dès que :
- [ ] La suite complète dépasse 90 min régulièrement
- [x] **SQLite WAL est prouvé suffisant** (simulation 2026-07-08)
- [ ] Rate limits API vérifiés empiriquement sur 3 skills simultanés
- [ ] `max_workers` ajouté à VSCode tasks / .run configs

