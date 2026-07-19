# Graph diff

| Change | Linked finding | Rationale | Verification |
|---|---|---|---|
| Change relations/metadata for .goose/recipes/harness-audit.yaml, evals/recipes/harness-audit.json | HA-F001 | Eval declares orchestrator/goose-orchestration in-session and treats harness_judge as isolated subrecipe evidence. | python3 scripts/check-consistency.py; inspect evals/recipes/harness-audit.json. |
| Change relations/metadata for Beads memory:harness-agents-pointer, .agents/agents/, README.md | HA-F002 | Memory points to live load()/README roster rather than embedding stale list. | bd recall harness-agents-pointer; load() roster comparison. |
| Change relations/metadata for README.md, AGENTS.md, .specs/features/harness-core/spec.md | HA-F003 | Single generated slash-command table with clear top-level vs internal/harness-only classification. | python3 scripts/check-consistency.py plus grep slash command tables. |
| Change relations/metadata for evals/recipes/amend-spec.json, docs/15-skill-evaluations.md, .goose/recipes/subrecipes/amend-spec.yaml | HA-F004 | Eval runner/docs explicitly support subrecipe subjects or move amend-spec under an eval category with path override. | node apps/eval-hub/dist/index.js --run --layers recipes --subjects amend-spec --ambient-goose (or dry-run if available). |
| Change relations/metadata for .goose/recipes/dev.yaml, .agents/skills/goose-orchestration/SKILL.md | HA-F005 | dev.yaml delegates routing rules to goose-orchestration and keeps only short invocation reminder. | grep dev.yaml; recipe eval for orchestration decision/load() behavior. |
| Change relations/metadata for .goose/recipes/sdd.yaml, .specs/schemas/expert-contribution.schema.json, .specs/schemas/decision-resolution.schema.json | HA-F006 | Recipes define storage path and schema validation for contribution/resolution records, or remove mandatory schema claim. | schema validation command over produced artifacts; recipe smoke scenario. |
