# Architecture Alternatives

| Dimension | Minimal | Balanced | High assurance |
|---|---:|---:|---:|
| Number of agents | 5-7 | 10-13 | 13+specialists |
| Number of core skills | 6-8 | 12-16 | 19+ |
| Number of core recipes | 6 | 10-14 | 19+subrecipes |
| Mandatory gates | spec, tests, review | spec, plan, verify, review, release | plus judge, security, WCAG/human approvals |
| Expected LLM calls | low | medium | high |
| Token cost | low | medium | high |
| Runtime | fastest | moderate | slowest |
| Execution complexity | low | medium | high |
| Assurance level | basic | recommended | regulated/high-risk |
| Recommended usage | small changes | normal harness work | release/audit/critical systems |

## Selected: Balanced

Balanced is preferred because the repository already has a mature SDD/Beads/Goose structure and deterministic validators pass, but current audit evidence shows runtime/provider and Beads-access blockers. Minimal would discard useful domain expertise before usage data is available. High-assurance is appropriate for release/audit but too costly as the default.

## Migration phases

1. Add preflight gates: model/provider availability, clean/dirty baseline capture, Beads read-only snapshot.
2. Classify SPEC_DEVIATION examples versus active drift.
3. Schema-normalize handoff artifacts for discover/spec/plan/verify/review/audit.
4. Re-run full audit on clean or frozen snapshot, then decide merges/removals using actual usage.

Rollback: keep current recipes and add gates as opt-in first; remove only after eval and usage evidence.
