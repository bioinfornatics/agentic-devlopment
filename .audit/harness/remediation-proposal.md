# Remediation proposal

AUDIT_ONLY: no Beads were created. Proposed remediation epic: `Epic: Harness audit remediation 2026-07-19`.

| Proposed task | Findings | Owner | Acceptance criteria | Verification |
|---|---|---|---|---|
| Harness-audit recipe eval declares the isolated judge as in-session agent | HA-F001 | review-critic | check-consistency.py includes harness-audit AD-001 eval assertion; eval JSON lists only in-session agents. | python3 scripts/check-consistency.py; inspect evals/recipes/harness-audit.json. |
| Durable Beads memory contains stale agent roster and obsolete names | HA-F002 | orchestrator | bd recall harness-agents-pointer references current source and no obsolete agent names. | bd recall harness-agents-pointer; load() roster comparison. |
| Slash-command documentation is inconsistent across README, AGENTS, and harness-core spec | HA-F003 | review-critic | check-consistency.py fails when slash command lists diverge or docs explicitly label differences. | python3 scripts/check-consistency.py plus grep slash command tables. |
| Subrecipe eval support is ambiguous for amend-spec | HA-F004 | qa-automation | eval-hub dry run resolves amend-spec to subrecipes/amend-spec.yaml; docs describe behavior. | node apps/eval-hub/dist/index.js --run --layers recipes --subjects amend-spec --ambient-goose (or dry-run if available). |
| dev recipe routing text contradicts live-discovery orchestration rule | HA-F005 | architect | dev.yaml instructs load() before delegate and no longer forbids runtime discovery. | grep dev.yaml; recipe eval for orchestration decision/load() behavior. |
| Core recipe paths still depend on conversational handoff more than enforceable artifact schemas | HA-F006 | principal-engineer | sdd run produces schema-conformant records and validation command passes. | schema validation command over produced artifacts; recipe smoke scenario. |

Required gates: Audit Evidence Complete → Target State Approved → Implementation Ready → Verification Complete → Independent Review Complete.
