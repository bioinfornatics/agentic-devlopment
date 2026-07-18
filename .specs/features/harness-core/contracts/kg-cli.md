# Contract - @harness/kg CLI

Type: CLI API | Implementation: apps/kg/dist/cli.js

## Commands

| Command | Flags | Output | Side effects |
|---|---|---|---|
| bootstrap | --product DIR, --dry-run | Added N records | Writes .knowledge/memory.jsonl |
| reason | --rules, --dry-run | Derived N facts | Writes .knowledge/derived.jsonl |
| pipeline | none | bootstrap + reason | Both files updated |
| visualize | none | opens dist/kg/index.html | None |
| rules | none | rule names list | None |

## Data Formats

memory.jsonl (one record per line):
  entity: { type, name, entityType, observations[] }
  relation: { type, from, to, relationType }

derived.jsonl (one record per line — two record kinds):
  entity: { type: entity, name, entityType: derived_status, derived: true, observations[] }
    — one per unique status node (e.g. "status:test-gap")
  relation:
    HAS_STATUS:        { type: relation, from, to, relationType: HAS_STATUS,
                         derived: true, rule, confidence, status_value, reason, inferred_at }
    TRANSITIVELY_USES: { type: relation, from, to, relationType: TRANSITIVELY_USES,
                         derived: true, rule: "R4:transitive-skill", confidence: 0.9, inferred_at }

  Rules that emit HAS_STATUS: R1, R2, R3, R5, R6
  Rules that emit other relation types: R4 (TRANSITIVELY_USES)

## Idempotence

bootstrap run twice: 0 new (up to date)
reason run twice: same output (fixed point)
