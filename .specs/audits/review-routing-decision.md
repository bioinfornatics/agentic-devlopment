# Review Recipe Routing Decision

Status: **Superseded** (2026-07-20). See consolidation below.

## Current State (Post-Consolidation)

- `/review` — canonical code and handoff review
- `/harness-review` — unified quality gate with `scope` param (code/docs/full) and `output_format` (json/markdown)

## Deleted (Absorbed)

- `/doc-review` → use `/harness-review scope=docs`
- `/harness-doc-review` → use `/harness-review scope=docs output_format=json`

## Historical Context

Original finding F-008 noted overlap between review/doc-review/harness-review/harness-doc-review.
Resolved by collapsing to 2 recipes with parameterized scope.

Verification: goose recipe validate, check-consistency.
