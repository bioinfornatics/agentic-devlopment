# Installation — @harness/kg

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 22+ |
| pnpm | 10+ |
| TypeScript | 5.5+ (installé via devDependencies) |

## Étapes

```bash
# Depuis la racine du repo
cd apps/kg
pnpm install   # installe typescript + @types/node
pnpm build     # compile src/ → dist/

# Vérifier
node dist/cli.js --help
```

## Intégration dans le repo

Le `post-commit` hook git exécute automatiquement le pipeline :
```bash
# .git/hooks/post-commit
node apps/kg/dist/cli.js bootstrap
node apps/kg/dist/cli.js reason
```

## Configuration VS Code

Tâches disponibles (Ctrl+Shift+P → Run Task) :
- `KG: Bootstrap harness KG`
- `KG: Reason (forward chaining → derived.jsonl)`
- `KG: Full Pipeline (bootstrap → reason → visualize)`

## Variables d'environnement

Aucune variable requise. Le CLI résout `REPO_ROOT` depuis `import.meta.url`.
Les fichiers KG sont toujours dans `<repo>/.knowledge/`.
