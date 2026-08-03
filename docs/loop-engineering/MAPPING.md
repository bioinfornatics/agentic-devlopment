# Loop Engineering — Primitive Mapping

Mapping des 7 étapes du loop-engineering (`loop-engineering.yaml`) vers les primitives Goose actives.

## Table de correspondance

| Étape | Recipe | Agent | Skill | Plugin |
|---|---|---|---|---|
| **00 Trigger** | `loop-engineering` (entrée) | — | — | `beads-telemetry` (cycle de session) |
| **01 Planner** | `research` (sous-boucle) | `repository-researcher` | `task-framing` | — |
| **02 Builder** | `implement` (sous-boucle) | `change-builder` ou `change-builder-premium` | `task-framing` | `prevent-catastrophe`, `loop-breaker` |
| **03 Independent Verifier** | `verify` (sous-boucle) | `independent-verifier` ou `independent-verifier-premium` | `evidence-verification` | `loop-gate` |
| **04 Memory** | — | *(inline contrôleur)* | `loop-control` (Beads control plane) | `beads-telemetry` |
| **05 Manager** | — | *(inline contrôleur)* | `loop-control` (priorité, no-progress) | — |
| **06 Controller** | `loop-engineering` (décision finale) | — | `loop-control` (7 transitions) | `beads-telemetry` (fin de session) |

Les sept transitions contrôleur actives sont `CONTINUE`, `REWORK`, `REPLAN`, `WAIT`, `COMPLETE`, `ESCALATE` et `ABORT`.

Une invocation est un incrément borné: zéro ou une tâche Builder, puis une vérification indépendante fraîche si le build a eu lieu, Memory/Manager/Controller inline, une seule transition, puis sortie. Le contrôleur appelle node src/app/harness-manager/dist/loop-transition-guard.js avant délégation et avant persistance finale avec les champs Beads durables et une heure UTC explicite; un refus est autoritaire. WAIT sort sans polling, et une reprise scheduler/utilisateur conserve les compteurs.

## Escalade agents (Builder + Verifier)

`rework_count` 0–1 utilise les agents standard; 2–3 utilise les variantes premium; ≥ 4 produit `ABORT` sans nouveau tier.

## Plugins actifs et responsabilités

| Plugin | Domaine | Hooks enregistrés |
|---|---|---|
| `prevent-catastrophe` | Sécurité des commandes shell | PreToolUse |
| `loop-gate` | Gate HAR-01 `env:reviewed` | PreToolUse |
| `beads-telemetry` | Télémétrie générique | SessionStart, SessionEnd, Stop, UserPromptSubmit, PostToolUse, PostToolUseFailure |
| `loop-breaker` | Arrêt après échecs outils consécutifs | PostToolUse, PostToolUseFailure |

Inventaire actif: **4 plugins**, **10 enregistrements de hooks** et **7 transitions contrôleur**. Les occurrences sont comptées à partir des clés de `.agents/plugins/*/hooks/hooks.json`; deux plugins sur le même événement comptent comme deux enregistrements.

## Note sur les étapes 04 Memory et 05 Manager

Ces étapes sont intentionnellement gérées inline dans la session contrôleur de `loop-engineering.yaml`: Memory persiste l'état, la chronologie et les preuves dans Beads; Manager mesure le progrès et choisit la tâche suivante. Cette décision évite deux délégations à faible complexité cognitive.

## Budget token estimé — 4 plugins simultanés

| Plugin actif | Hooks injectés | Token overhead estimé |
|---|---:|---:|
| `prevent-catastrophe` | 1 | ~800 tokens |
| `loop-gate` | 1 | ~600 tokens |
| `beads-telemetry` | 6 | ~300 tokens |
| `loop-breaker` | 2 | ~400 tokens |
| **Total** | **10 hooks** | **~2 100 tokens** |

> Signal SOTA: 10 plugins peuvent approcher 40k tokens. Maintenir le nombre actif ≤ 6 et l'overhead total ≤ 5k tokens.