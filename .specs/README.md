# Specs — Feature Specifications

Specs formelles au format SDD. Chaque feature a son propre répertoire.

## Localisation

```
.specs/features/<feature-name>/spec.md
```

## Features documentées

| Feature | Spec | Status |
|---|---|---|
| harness-core | [spec.md](features/harness-core/spec.md) | retro-spec |
| eval-suite | [spec.md](features/eval-suite/spec.md) | retro-spec |
| kg-integration | [spec.md](features/kg-integration/spec.md) | retro-spec |
| beads-workflow | [spec.md](features/beads-workflow/spec.md) | retro-spec |

## Créer une nouvelle spec

```bash
/spec "feature name"
# → crée automatiquement .specs/features/<name>/spec.md
# → enregistre le pointeur: bd remember "Spec for ...: canonical source is .specs/..."
```
