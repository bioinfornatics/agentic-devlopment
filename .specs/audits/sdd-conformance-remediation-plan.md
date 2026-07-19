# Harness SDD Conformance Remediation Plan

Status: active remediation scaffold
Mode: REMEDIATE_APPROVED_BY_USER_REQUEST
Repository: /home/jmercier/Codes/agentic-devlopment
Created: 2026-07-19T08:14:10Z

Current verification snapshot: git status is dirty with 113 entries.

Dedicated Beads Epic: Harness SDD Conformance Remediation Epic. Required gates: Audit Evidence Complete; Target State Approved; Implementation Ready; Verification Complete; Independent Review Complete.

## F-001 Dirty repository baseline
- Original problem: audit ran on an already-dirty tree.
- Still valid: yes; tree remains dirty.
- Partial/full resolution: partial; added preflight.
- Affected files: all git-status files; harness-audit/harness-review.
- Affected skills: agentic-devlopment, beads, harness-judge.
- Affected agents: orchestrator, harness-judge, review-critic.
- Affected recipes: harness-audit, harness-review, dev, sdd.
- Affected artifacts: audit report, remediation plan, git status.
- Dependencies: none.
- Risks: non-reproducible findings.
- Target state: clean tree or explicit ALLOW_DIRTY_AUDIT with recorded dirty state.
- Acceptance criteria: preflight blocks dirty tree unless allowed.
- Verification methods: scripts/harness-audit-preflight.sh.
- Requires separate SDD cycle: no.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-002 Beads graph unavailable
- Original problem: bd list returned empty so active work-control could not be validated.
- Still valid: partially.
- Partial/full resolution: partial; Epic/task creation attempted.
- Affected files: beads issues and this plan.
- Affected skills: beads, agentic-devlopment.
- Affected agents: planner, orchestrator, implementation-worker, review-critic.
- Affected recipes: plan, implement, review, verify, release, remember.
- Affected artifacts: Beads Epic/tasks/labels/evidence.
- Dependencies: F-001.
- Risks: tasks outside Epic or without ACs.
- Target state: all remediation work in one Epic with ACs/owners/verification.
- Acceptance criteria: Beads storage shows Epic/task and follow-ups reference findings.
- Verification methods: bd list/json or issues.jsonl inspection.
- Requires separate SDD cycle: no for scaffold; yes for redesign.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-003 Prose-only recipe gates
- Original problem: gates are prompt instructions not typed metadata.
- Still valid: yes.
- Partial/full resolution: partial; semantic lint added.
- Affected files: recipes and check-consistency.py.
- Affected skills: goose-orchestration, beads, sdd, harness-judge.
- Affected agents: orchestrator, planner, qa-automation, principal-engineer, review-critic.
- Affected recipes: review, verify, release, sdd, plan.
- Affected artifacts: gate metadata, Beads labels.
- Dependencies: F-004, F-006.
- Risks: agents skip gates while YAML passes.
- Target state: machine-readable phase/entry/exit/agents/skills/artifacts.
- Acceptance criteria: semantic lint catches contradictions.
- Verification methods: check-consistency and recipe validation.
- Requires separate SDD cycle: yes for full schema.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-004 AD-001 pattern fragility
- Original problem: recipes said Delegated/summoned none while loading/delegating agents.
- Still valid: partially.
- Partial/full resolution: partial; headers fixed and linter added.
- Affected files: design/discover/implement/plan/spec/verify/constitution/clarify/check-consistency.
- Affected skills: goose-orchestration, agentic-devlopment.
- Affected agents: recipe-specific agents.
- Affected recipes: changed recipes.
- Affected artifacts: recipe comments and consistency report.
- Dependencies: F-003.
- Risks: eval/runtime drift.
- Target state: every recipe declares AD-001 pattern without contradictory prose.
- Acceptance criteria: no contradictory Delegated/summoned none remains.
- Verification methods: check-consistency.
- Requires separate SDD cycle: no for fix; yes for full schema.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-005 Missing collegial aggregation schema
- Original problem: multi-agent contributions lack uniform provenance/conflict schema.
- Still valid: yes.
- Partial/full resolution: planned only.
- Affected files: plan.yaml, sdd.yaml, future schemas.
- Affected skills: sdd, goose-orchestration, knowledge-graph.
- Affected agents: product-owner, architect, planner, qa, tdd-guide, review-critic, ui/ux.
- Affected recipes: discover, spec, plan, sdd, design.
- Affected artifacts: ExpertContribution, DecisionResolution.
- Dependencies: F-006.
- Risks: ignored/untraceable advice.
- Target state: recipes produce contribution/resolution tables.
- Acceptance criteria: contribution records include producer/conflict/decision/resolver.
- Verification methods: sample planning flow validates schema.
- Requires separate SDD cycle: yes.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-006 Ontology/KG gap
- Original problem: KG dry-run lacks full TBox/ABox export/constraints/queries.
- Still valid: yes.
- Partial/full resolution: partial; graph export scaffold added.
- Affected files: export script, apps/kg, knowledge files.
- Affected skills: knowledge-graph, harness-judge, goose-orchestration.
- Affected agents: architect, orchestrator, harness-judge, review-critic.
- Affected recipes: all recipes.
- Affected artifacts: harness graph JSON.
- Dependencies: F-003.
- Risks: false confidence from incomplete graph.
- Target state: reproducible typed graph with provenance and constraints.
- Acceptance criteria: graph has skills/agents/recipes/phases/load/involve edges.
- Verification methods: export-harness-graph.py --summary.
- Requires separate SDD cycle: yes for full ontology; no for scaffold.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-007 Context/token cost
- Original problem: large skills and broad loading increase context overhead.
- Still valid: yes.
- Partial/full resolution: partial only.
- Affected files: skills, agents, recipes.
- Affected skills: harness-judge, skill-creator, goose-orchestration, ui/ux family.
- Affected agents: ui-designer, orchestrator, harness-judge.
- Affected recipes: design, sdd, harness-audit.
- Affected artifacts: references and token report.
- Dependencies: F-009.
- Risks: slow/costly runs and context dilution.
- Target state: concise core skills, references on demand, budgets.
- Acceptance criteria: size thresholds pass and large refs explicit.
- Verification methods: check-consistency and future profiler.
- Requires separate SDD cycle: no small; yes policy.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-008 Duplicate review recipes
- Original problem: review/doc-review/harness-review/harness-doc-review overlap.
- Still valid: yes.
- Partial/full resolution: not fixed.
- Affected files: review family recipes/evals/docs.
- Affected skills: code-review, agentic-devlopment, beads.
- Affected agents: review-critic.
- Affected recipes: review, doc-review, harness-review, harness-doc-review.
- Affected artifacts: routing tables, eval JSON.
- Dependencies: F-003, AD-001.
- Risks: wrong entrypoint/duplicate maintenance.
- Target state: canonical review entrypoint with modes or explicit separation.
- Acceptance criteria: routing table has no ambiguity.
- Verification methods: recipe validation, consistency, eval checks.
- Requires separate SDD cycle: yes.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-009 UI/UX skill overlap
- Original problem: design agents load many overlapping skills by default.
- Still valid: yes.
- Partial/full resolution: not fixed.
- Affected files: UI/UX skills, ui-designer, ux-researcher, design.
- Affected skills: cognitive-ux, design-critique-case-studies, ux-quality, ui-quality, atomic-design, design-systems-arch, frontend-blueprint.
- Affected agents: ui-designer, ux-researcher.
- Affected recipes: design, verify, sdd UI paths.
- Affected artifacts: design audit outputs.
- Dependencies: F-007.
- Risks: over-engineering and token overuse.
- Target state: minimal default UI/UX skills with optional deep dives.
- Acceptance criteria: design recipe states required vs optional triggers.
- Verification methods: static skill-load review and sample design task.
- Requires separate SDD cycle: yes.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## F-010 review-critic challenge blocked
- Original problem: required review-critic adversarial challenge failed due model deployment error.
- Still valid: yes unless rerun succeeds.
- Partial/full resolution: not fixed.
- Affected files: none directly.
- Affected skills: code-review, harness-judge.
- Affected agents: review-critic, harness-judge.
- Affected recipes: harness-audit, harness-review.
- Affected artifacts: adversarial-review log.
- Dependencies: runtime model availability.
- Risks: high findings insufficiently challenged.
- Target state: independent challenge captured and linked to findings.
- Acceptance criteria: delegate succeeds or alternate model approved.
- Verification methods: saved review output.
- Requires separate SDD cycle: no.
- Beads: belongs under the dedicated remediation Epic; create follow-up task when scope exceeds this scaffold.

## Separate SDD-cycle remediation task queue

Planned under Epic agentic-devlopment-9wx - Harness SDD Conformance Remediation Epic. Generated 2026-07-19T08:33:29+00:00.

| Task | Beads ID | Findings | Owner | Priority | Separate SDD cycle | Dependencies | Acceptance summary | Verification |
|---|---|---|---|---:|---|---|---|---|
| SDD cycle: typed recipe workflow schema and gate metadata | agentic-devlopment-quy | F-003, F-004 | architect | 1 | yes | none | All active recipes expose machine-readable phase/pattern/gates/artifacts; contradictory prose fails check-consistency; all recipes validate. | goose recipe validate .goose/recipes/*.yaml; python3 scripts/check-consistency.py; no missing AD-001 pattern warnings. |
| SDD cycle: collegial contribution and decision-resolution artifact schema | agentic-devlopment-ect | F-005 | orchestrator | 2 | yes | SDD cycle: typed recipe workflow schema and gate metadata | Multi-agent recipes define contribution tables with producer, consumer, artifact, conflict status, decision impact, resolver, and provenance. | Run/sample planning path or static artifact check; validate schema fields in plan/sdd outputs. |
| SDD cycle: full harness ontology TBox ABox and query suite | agentic-devlopment-b8f | F-006 | architect | 1 | yes | SDD cycle: typed recipe workflow schema and gate metadata | Graph export covers skills, topics, agents, responsibilities, recipes, delegated tasks, artifacts, gates, Beads tasks, findings, decisions. | python3 scripts/export-harness-graph.py --summary; full JSON export spot-check; graph integrity query suite passes. |
| SDD cycle: context and token budget policy | agentic-devlopment-6oe | F-007 | principal-engineer | 2 | yes | none | Recipes and agents distinguish required versus optional skill loads; large skills are split or justified; token/context budget report exists. | python3 scripts/check-consistency.py; line-count thresholds; token/context report or estimator output. |
| SDD cycle: review recipe consolidation and routing clarity | agentic-devlopment-ev8 | F-008 | orchestrator | 2 | yes | SDD cycle: typed recipe workflow schema and gate metadata | No ambiguous review entrypoint; README/recipe docs/evals/AC-RECIPE wiring agree; deprecated recipes have migration path or are removed consistently. | goose recipe validate affected recipes; python3 scripts/check-consistency.py; eval JSON and generated docs updated. |
| SDD cycle: UI UX skill consolidation and optional deep-dive loading | agentic-devlopment-84j | F-009, F-007 | ui-designer | 3 | yes | SDD cycle: context and token budget policy | Design and UI/UX agents specify minimal required skill set plus explicit triggers for optional references/deep dives; overlap is documented or removed. | static skill-load review; check-consistency; sample design workflow confirms correct optional loading. |
| SDD cycle: independent adversarial review rerun and judge closure | agentic-devlopment-kku | F-010 | review-critic | 1 | no | none | review-critic challenge output is captured; high findings have challenge/resolution notes; harness-judge independence is preserved. | delegate/session output saved or summarized in audit artifact; plan updated with resolved disagreements. |
| SDD cycle: Beads remediation dependency and gate model | agentic-devlopment-hmd | F-002 | planner | 1 | yes | none | Remediation tasks have dependencies, owner, ACs, verification, gate tasks, and human approval where needed; unrestricted bd list is not an execution queue. | bd list/json or .beads/issues.jsonl inspection; dependency graph has no cycles and all tasks link to findings. |

## Fix-all implementation status

- F-003/F-004: metadata artifact, checker, AD-001 markers, and consistency integration implemented.
- F-005: ExpertContribution and DecisionResolution schemas implemented; plan/sdd require them for multi-agent aggregation.
- F-006: graph scaffold plus metadata/schema coverage implemented; deeper TBox/ABox reasoning remains extensible.
- F-007: context budget script and report implemented.
- F-008: review-family routing policy documented.
- F-009: UI/UX optional loading policy documented and design recipe trigger rules added.
- F-010: remains runtime-dependent pending successful independent review rerun.

## Final fix-all validation snapshot

- Recipe validation failures: []
- check-recipe-metadata.py exit: 0
- check-consistency.py exit: 0
- export-harness-graph.py --summary exit: 0
- Remaining context-budget warnings are informational for >500-line skills.
- Independent review-critic rerun remains blocked by model deployment unless retried with a valid model.
