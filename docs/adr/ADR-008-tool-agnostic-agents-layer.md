# ADR-008 : Couche `.agents/` outil-agnostique comme source canonique

Skills, plugins et agents vivent dans `.agents/` (outil-agnostique), pas dans `.goose/`. L'outil `npx skills add` crée des liens symboliques vers les répertoires outil-spécifiques (`.goose/skills/`, `.claude/skills/`, etc.). Les recettes seules restent dans `src/recipes/` (source; `.goose/recipes/` at runtime) car leur format YAML est spécifique à Goose.

## Considered Options

- **Tout dans `.goose/`** — simple, mais lie tous les artefacts à Goose. Impossible de réutiliser skills et agents avec Claude, Codex, ou tout futur outil.
- **`.agents/` canonique + symlinks** — retenu. Un seul endroit de vérité, distribution multi-outils via `npx skills add`.

## Consequences

- Un nouveau contributeur installe les skills avec `npx skills add`, pas en modifiant `~/.config/goose/config.yaml`.
- Goose découvre les artefacts en scannant deux niveaux : `~/.agents/` (utilisateur) puis `<project>/.agents/` (projet) — espace projet prioritaire.
- Les artefacts sont référencés par **nom uniquement**, jamais par chemin.
- Les recettes (`src/recipes/` (source; `.goose/recipes/` at runtime)) restent outil-spécifiques et ne sont pas distribuées via ce mécanisme.