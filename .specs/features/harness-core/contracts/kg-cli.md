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

derived.jsonl (one record per line):
  { type: relation, from, to, relationType: HAS_STATUS,
    derived: true, rule, confidence, status_value, reason, inferred_at }

## Idempotence

bootstrap run twice: 0 new (up to date)
reason run twice: same output (fixed point)
