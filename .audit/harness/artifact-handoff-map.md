# Artifact and handoff map

| Artifact | Producer | Consumer | Storage/schema | Gate / validation | Status |
|---|---|---|---|---|---|
| discovery.md | discover/product-owner | clarify/spec | `.specs/features/[feature]/discovery.md` | presence before clarify/spec | current |
| clarify.md | clarify/product-owner | spec | `.specs/features/[feature]/clarify.md` | Medium+ stop gate | current |
| spec.md | spec/architect | plan/tdd/review | `.specs/features/[feature]/spec.md` | AC IDs, spec-anchored outcome | current |
| Beads task graph | plan/planner | implement/review/release | Beads | dependencies/readiness | current |
| RED test evidence | tdd-guide | implementation-worker/review | test output / handoff | RED before GREEN | partially enforceable |
| ExpertContribution | specialist agents | orchestrator/sdd | `.specs/schemas/expert-contribution.schema.json` | schema exists, storage not enforced | gap HA-F006 |
| DecisionResolution | orchestrator | downstream phases | `.specs/schemas/decision-resolution.schema.json` | schema exists, validation not enforced | gap HA-F006 |
| review verdict | review-critic | verify/release | review output + env:reviewed label | label gate | current |
| verification evidence | qa-automation | release | command outputs + env:verified label | validation commands | current |
| audit artifacts | audit orchestrator | harness_judge/final report | `.audit/harness/*` | evidence manifest hashes | current |
