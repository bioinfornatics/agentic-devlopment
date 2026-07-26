# Loop Engineering — Primitive Mapping

Mapping des 7 étapes du loop-engineering (`loop-engineering.yaml`) vers les primitives Goose actives.

## Table de correspondance

| Étape | Recipe | Agent | Skill | Plugin |
|---|---|---|---|---|
| **00 Trigger** | `loop-engineering` (entrée) | — | — | `loop-telemetry` (SessionStart, UserPromptSubmit) |
| **01 Planner** | `research` (sous-boucle) | `repository-researcher` | `task-framing` | — |
| **02 Builder** | `implement` (sous-boucle) | `change-builder` → `change-builder-premium` (rework_count ≥ 2) | `task-framing` | `prevent-catastrophe` (guard-shell), `loop-gate` (HAR-01), `loop-breaker` (échecs répétés), `loop-trace` (traces) |
| **03 Verifier** | `verify` (sous-boucle) | `independent-verifier` → `independent-verifier-premium` (rework_count ≥ 2) | `evidence-verification` | `loop-gate` (HAR-01), `loop-trace` (traces) |
| **04 Memory** | — | *(inline contrôleur)* | `loop-control` (beads-control-plane) | `beads-telemetry` (PostToolUse), `loop-telemetry` (lifecycle) |
| **05 Manager** | — | *(inline contrôleur)* | `loop-control` (priorité, no-progress) | — |
| **06 Controller** | `loop-engineering` (décisions finales) | — | `loop-control` (6 transitions) | `loop-telemetry` (Stop, SessionEnd) |

## Escalade agents (Builder + Verifier)

```
rework_count 0–1  →  change-builder / independent-verifier          (modèle standard)
rework_count 2–3  →  change-builder-premium / independent-verifier-premium  (gpt-5.6-sol)
rework_count ≥ 4  →  ABORT  ✋  (aucun tier restant)
```

## Plugins actifs et responsabilités

| Plugin | Domaine | Hooks |
|---|---|---|
| `prevent-catastrophe` | Sécurité — bloque rm -rf, dd, fork bomb, sudo | PreToolUse (shell) |
| `loop-telemetry` | Télémétrie loop-aware — enregistre événements si label `loop-engineering` | SessionStart, SessionEnd, Stop, UserPromptSubmit, PostToolUse, PostToolUseFailure |
| `loop-gate` | Gate HAR-01 — bloque `bd close` sans label `env:reviewed` | PreToolUse (shell) |
| `beads-telemetry` | Télémétrie générique — tous projets (pas de filtre label) | PostToolUse |
| `loop-breaker` | Brise-boucle — STOP après 4 `PostToolUseFailure` consécutives | PostToolUse, PostToolUseFailure |
| `loop-trace` | Traçage structuré — JSONL par session dans `~/.local/state/goose/logs/loop-trace/` | SessionStart, SessionEnd, PostToolUse, PostToolUseFailure |

## Note sur les étapes 04 Memory et 05 Manager

Ces étapes sont **intentionnellement gérées inline** dans la session contrôleur de `loop-engineering.yaml` :
- **Memory** : le contrôleur persiste état, chronologie, faits et preuves dans les commentaires/métadonnées Beads sans sous-agent dédié.
- **Manager** : le contrôleur inspecte le backlog, mesure le progrès et sélectionne la prochaine tâche sans délégation.

Ce choix réduit la latence et le coût token pour ces deux étapes à faible complexité cognitive. Un agent dédié serait justifié si la complexité de gestion de backlog augmente significativement.

## Budget token estimé — 6 plugins simultanés

| Plugins actifs | Hooks injectés | Token overhead estimé |
|---|---|---|
| `prevent-catastrophe` | 1 | ~800 tokens (guard-shell instructions) |
| `loop-gate` | 1 | ~600 tokens (gate-reviewed instructions) |
| `loop-telemetry` | 6 | ~400 tokens (hook stubs) |
| `beads-telemetry` | 1 | ~300 tokens |
| `loop-breaker` | 2 | ~400 tokens |
| `loop-trace` | 4 | ~500 tokens |
| **Total** | **15 hooks** | **~3 000 tokens** |

> ⚠️ Signal SOTA : 10 plugins = ~40k tokens. 6 plugins ciblés ≈ 3k tokens — acceptable. Surveiller si d'autres plugins s'ajoutent.
