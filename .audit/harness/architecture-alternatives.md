# Target architecture alternatives

| Dimension | Minimal | Balanced | High assurance |
|---|---:|---:|---:|
| Number of agents | 5 | 9 | 13 |
| Number of core skills | 6 | 12 | 19 domain + tooling |
| Number of core recipes | 7 | 13 | 19 + subrecipes |
| Mandatory gates | spec, review, verify | discover/spec/plan/review/verify/release | full gated SDD + independent audit |
| Expected LLM calls | low | medium | high |
| Token cost | low | controlled | high but justified |
| Runtime | fastest | moderate | slowest |
| Execution complexity | low | moderate | high |
| Assurance level | moderate | high | very high |
| Recommended usage | small internal repos | default harness | regulated/high-risk repos |

## Minimal
Retain orchestrator, product-owner, architect, implementation-worker, review-critic. Merge QA/TDD into review modes. Keep sdd, beads, goose-orchestration, code-review, systematic-debugging, webapp-testing. Risk: weaker independent QA/UX/security.

## Balanced (selected)
Retain current core specialists but make optional UX/UI/QA/principal-engineer conditional. Keep recipes discover→clarify→spec→plan→implement→review→verify→release plus dev/sdd/remember/harness-audit. Enforce contribution schemas only when multiple specialists participate. Best trade-off between assurance and cost.

## High assurance
Retain all current agents/skills/recipes; require independent principal-engineer and harness_judge gates for major flows, schema-validated contribution records, complete KG updates, and human approval gates. Appropriate for critical systems; higher token/runtime cost.

## Selected architecture
Balanced architecture. It preserves the SDD flow and independent review while reducing default mandatory calls. Migration phases: (1) fix eval/memory/doc drift, (2) enforce schema validation for multi-agent aggregation, (3) add deterministic CI checks, (4) reserve high-assurance gates for labeled high-risk work. Rollback: keep existing recipes and only tighten eval/validation checks behind consistency scripts first.
