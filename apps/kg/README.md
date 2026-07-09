# @harness/kg — Knowledge Graph Toolkit

CLI TypeScript pour gérer le Knowledge Graph du harness SDD+Beads.

## Installation

```bash
cd apps/kg
pnpm install
pnpm build
```

## Commandes

```bash
node dist/cli.js bootstrap          # Scan harness → .knowledge/memory.jsonl
node dist/cli.js bootstrap --dry-run
node dist/cli.js bootstrap --product src/   # + code_file entities

node dist/cli.js reason             # Forward chaining → .knowledge/derived.jsonl
node dist/cli.js reason --rules     # Lister les règles actives
node dist/cli.js reason --dry-run

node dist/cli.js pipeline           # bootstrap + reason en séquence
node dist/cli.js visualize          # xdg-open dist/kg/index.html
```

Ou via workspace :

```bash
cd apps && pnpm kg:bootstrap
pnpm kg:reason
pnpm kg:pipeline
```

## Architecture

```
src/
  types.ts      Entity | Relation | KG | parseJSONL | makeRel | makeStatus
  bootstrap.ts  Scan .agents/ + .goose/recipes/ + docs/ → memory.jsonl (idempotent)
  reason.ts     5 règles forward chaining (R1-R5) → derived.jsonl
  cli.ts        Point d'entrée CLI
```

## Règles de raisonnement

| Règle | Condition | Inférence |
|---|---|---|
| R1 | AC sans test VALIDATES | HAS_STATUS test-gap |
| R2 | feature sans REFINED_INTO user_story | HAS_STATUS not-decomposed |
| R3 | feature sans IMPLEMENTS incoming | HAS_STATUS not-implemented |
| R4 | recipe USES_SKILL s1, s1 LOADS s2 | TRANSITIVELY_USES s2 |
| R5 | epic dont toutes features not-implemented | HAS_STATUS blocked |

## Sortie

- `.knowledge/memory.jsonl` — faits assertés (A-Box)
- `.knowledge/derived.jsonl` — faits inférés (T-Box) avec provenance (rule, confidence, inferred_at)
