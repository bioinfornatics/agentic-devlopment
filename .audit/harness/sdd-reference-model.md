# Canonical SDD reference model

Sources: Microsoft SDD blog URLs (HTTP 200 evidence), local Spec Kit files (presence and grep evidence), project `sdd` skill, `.specs/features/harness-core/spec.md`, `.specs/features/spec-deviation-loop/spec.md`.

| Phase | Purpose | Inputs | Outputs | Owner | Supporting agents | Entry gate | Exit gate | Recipe | Status |
|---|---|---|---|---|---|---|---|---|---|
| Constitution | Establish non-negotiable project principles | repository context | `.specs/constitution.md` / ADRs | architect | principal-engineer | project lacks/changes principles | principles accepted | constitution | ADAPTED |
| Discover / Intent | Capture user problem, personas, success metrics | user intent | discovery.md + epic proposal | product-owner | ux-researcher | clear initiative | discovery artifact exists | discover | ADOPTED |
| Clarify | Resolve ambiguities before spec | discovery.md | clarify.md with resolved questions | product-owner | architect | ambiguity present / Medium+ | clarify artifact exists | clarify | ADOPTED |
| Specify | Write WHEN/THEN/SHALL ACs with stable IDs | discovery/clarify | spec.md + stories | architect | tdd-guide | source artifact exists | ACs are testable | spec | ADOPTED |
| Plan / Tasks | Convert ACs to Beads graph | spec.md | dependency graph / Beads tasks | planner | architect | spec.md exists | ready tasks with AC refs | plan | ADAPTED (Beads replaces tasks.md) |
| TDD | Define RED tests before implementation | AC IDs | failing test evidence | tdd-guide | implementation-worker | task claimed | RED observed | implement/subrecipe | PARTIAL: mostly procedural |
| Implement | Minimal change for claimed bead | RED + AC | code/doc change + handoff | implementation-worker | tdd-guide | bead claimed | tests pass / handoff | implement | ADOPTED |
| Review | Independent critique before closure | diff + tests + Beads | verdict + findings | review-critic | principal-engineer on escalation | diff exists | APPROVE/BLOCK and labels | review | ADOPTED |
| Verify / Validate | Run deterministic and adaptive checks | reviewed artifact | verification evidence | qa-automation | ui-designer for UI | env:reviewed | env:verified | verify | ADOPTED |
| Release | Gate production readiness | env:verified | release decision / env:prod | principal-engineer | qa-automation | verification passed | release complete | release | ADOPTED |
| Spec deviation | Detect and triage implementation/spec drift | source scan | accept amendment or SPEC_REVERT | review-critic | product-owner/architect | scan result | all markers triaged | review + amend-spec | EXTENDED |
| Learn / Memory | Store durable pointers | completed work | bd remember pointer / follow-up beads | orchestrator | all | closed/verifiable outcome | memory/follow-up created | dev/sdd | ADAPTED |
