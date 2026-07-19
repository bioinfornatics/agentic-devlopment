# SDD Reference Model

Sources: bundled contract, project AGENTS.md, local Spec Kit templates under `/home/jmercier/Codes/third-parties/spec-kit`, and local SDD skill. External Microsoft web sources were required by the contract but blocked by lack of web-fetch tooling; this is a blocker.

| Phase | Purpose | Inputs | Outputs | Owner | Supporting agents | Entry gate | Exit gate | Recipe | Status |
|---|---|---|---|---|---|---|---|---|---|
| Constitution | establish non-negotiable principles | project context | `.specs/constitution.md` | architect | principal-engineer | project initialized | principles accepted | constitution | ADAPTED |
| Discover/Intent | capture problem/user stories | user intent | discovery artifact/epic | product-owner | ux-researcher when needed | intent provided | open questions known | discover | ADOPTED |
| Clarify | resolve gray areas before spec | discovery.md/questions | clarified answers | product-owner | architect/tdd-guide | ambiguity present | no critical unknowns | clarify | ADAPTED |
| Specify | write testable ACs | discovery/answers | `.specs/features/*/spec.md` | product-owner | tdd-guide | problem defined | ACs stable and IDed | spec | ADOPTED |
| Plan/Tasks | create dependency-aware work | spec | Beads graph | planner | architect | spec exists | ready tasks/gates | plan | ADAPTED (Beads replaces tasks.md) |
| Implement | TDD implementation | claimed Bead/spec | code/tests/handoff | implementation-worker | tdd-guide | task ready/claimed | tests pass | implement | ADOPTED |
| Verify | run deterministic/browser/API checks | implementation | evidence report | qa-automation | ui-quality/webapp-testing | implementation complete | verification evidence | verify | ADOPTED |
| Review | independent critique | diff/evidence | approve/block findings | review-critic | principal-engineer escalation | evidence present | verdict recorded | review | ADOPTED |
| Release | readiness and gates | verified changes | release report | principal-engineer/release workflow | review-critic | approvals met | release/rollback ready | release | ADOPTED |
| SPEC_DEVIATION | manage drift | marker/diff | accept/reject/defer | review-critic | product-owner | deviation detected | triaged | amend-spec subrecipe | EXTENDED |
| Learn | store durable pointer memory | completed work | Beads memory pointer | orchestrator | all | closure evidence | memory/task created as needed | remember | ADOPTED |
