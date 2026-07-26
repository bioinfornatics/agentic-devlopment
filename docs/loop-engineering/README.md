# Loop Engineering

Documentation versionnée d'une boucle d'ingénierie récursive en six étapes :

1. **Planificateur** — stratégie et découpage de l'objectif.
2. **Builder** — exécution du plan et production d'un résultat concret.
3. **Vérificateur** — comparaison du résultat avec les critères de succès.
4. **Mémoire** — conservation des faits, décisions, réussites et échecs.
5. **Gestionnaire** — priorisation du travail restant.
6. **Contrôleur** — révision de la méthode et relance du cycle.

## Organisation

```text
loop-engineering/
├── README.md
├── Makefile
├── diagrams/
│   ├── index.puml
│   ├── planner.puml
│   ├── builder.puml
│   ├── verifier.puml
│   ├── memory.puml
│   ├── manager.puml
│   └── controller.puml
├── includes/
│   ├── theme.iuml
│   ├── loop-nodes.iuml
│   ├── common-artifacts.iuml
│   └── legend.iuml
├── stages/
│   ├── planner.md
│   ├── builder.md
│   ├── verifier.md
│   ├── memory.md
│   ├── manager.md
│   └── controller.md
├── generated/
│   └── .gitkeep
└── scripts/
    └── render.sh
```

## Conventions

- **`.puml`** : diagrammes complets et directement rendables.
- **`.iuml`** : fragments inclus, thèmes, macros et artefacts partagés.
- **`.md`** : documentation détaillée de chaque étape.
- **`.svg`** : format de publication recommandé, car il conserve les liens.

## Génération

### Avec PlantUML installé localement

```bash
make render
```

ou :

```bash
./scripts/render.sh
```

### Avec Docker ou Podman

```bash
make render-container
```

Les fichiers SVG sont générés dans `generated/`.

## Navigation

Le diagramme global `generated/index.svg` contient des liens relatifs vers les vues détaillées. Chaque vue détaillée contient un lien de retour vers le diagramme global et un lien vers la documentation Markdown correspondante.

## Validation

```bash
make check
```

Cette commande vérifie que tous les fichiers PlantUML sont analysables sans générer d'image.
