# Review recipe routing

| Intent | Recipe | Notes |
|---|---|---|
| Code, handoff, security, release, or feature review | review.yaml | General adaptive review using code-review and review-critic. |
| Documentation-only review | doc-review.yaml | Documentation scanner with optional review-critic escalation. |
| Harness source, recipe, or skill quality review | harness-review.yaml | Harness-specific quality review with Beads and workflow hygiene. |
| CI JSON documentation wrapper | harness-review.yaml (output_format=json, scope=docs) | Machine-readable wrapper around documentation review expectations. |

These recipes have distinct phases in .specs/harness/recipe-workflow-metadata.json. Future merge or deprecation must update recipe YAML, evals, AC-RECIPE wiring, generated docs, and this table together.
