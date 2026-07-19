# Artifact and Handoff Map

| Artifact | Producer | Consumer | Storage | Validation | Status |
|---|---|---|---|---|---|
| discovery.md / discovery artifact | discover/product-owner | clarify/spec | `.specs/features/*` or recipe output | human/product quality gate | partially explicit |
| spec.md | spec/product-owner | plan/tdd/implement/review | `.specs/features/*/spec.md` | AC IDs + consistency/KG pipeline | explicit |
| Beads tasks | plan/planner | implement/verify/review | `.beads` | bd ready/blocked/gates | blocked in this audit |
| code/tests | implementation-worker | qa-automation/review-critic | repo source | test commands | not audited as feature diff |
| verification report | verify/qa-automation | review/release | session/artifact | command output | explicit in recipes |
| review verdict | review-critic | orchestrator/release | session/handoff | severity table | explicit |
| audit artifacts | harness-audit orchestrator | harness_judge/final report | `.audit/harness` | manifest hashes + judge | explicit |
| KG memory/derived facts | KG pipeline | graph audit/visualizer | `.knowledge` | bootstrap/reason/validate scripts | dry-run OK; tracked files dirty |

Dead-end risk: audit and review artifacts are often conversational unless written to explicit paths or Beads evidence; target state should require schema-backed artifact paths for every multi-agent handoff.
