# Findings register

## HA-F001 — Harness-audit recipe eval declares the isolated judge as in-session agent

```yaml
id: HA-F001
title: Harness-audit recipe eval declares the isolated judge as in-session agent
category: AD001_EVAL_WIRING_DRIFT
severity: HIGH
confidence: High
status: OPEN
affected_layer: L3 recipes/evals
affected_files: ['.goose/recipes/harness-audit.yaml', 'evals/recipes/harness-audit.json']
expected_behavior: Recipe eval JSON agents list only in-session agents per AD-001.
observed_behavior: harness-audit instructions say main session loads orchestrator and judge only runs in isolated subrecipe, while eval declares harness-judge.
evidence: ['.goose/recipes/harness-audit.yaml:95-99', 'evals/recipes/harness-audit.json:1-8', 'AGENTS.md:152-155']
impact: Layer-delta scoring can measure the wrong layer and mask orchestration regressions.
root_cause: Audit recipe was converted to orchestration pattern without corresponding eval layer declaration update.
target_state: Eval declares orchestrator/goose-orchestration in-session and treats harness_judge as isolated subrecipe evidence.
acceptance_criteria: check-consistency.py includes harness-audit AD-001 eval assertion; eval JSON lists only in-session agents.
verification: python3 scripts/check-consistency.py; inspect evals/recipes/harness-audit.json.
dependencies: []
proposed_owner: review-critic
requires_separate_sdd_cycle: true
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```

## HA-F002 — Durable Beads memory contains stale agent roster and obsolete names

```yaml
id: HA-F002
title: Durable Beads memory contains stale agent roster and obsolete names
category: DRIFT
severity: MEDIUM
confidence: High
status: OPEN
affected_layer: Work control / memory
affected_files: ['Beads memory:harness-agents-pointer', '.agents/agents/', 'README.md']
expected_behavior: Pointer memories used for routing reflect current agent names or defer to live discovery.
observed_behavior: bd prime reports 11 agents and old names while filesystem/README list 13 current agents.
evidence: ['bd prime output in command log', 'README.md:144-165', '.agents/agents directory inventory']
impact: Agents relying on memory may route to nonexistent names or miss current specialists.
root_cause: Structural roster changed without updating/deprecating durable pointer memory.
target_state: Memory points to live load()/README roster rather than embedding stale list.
acceptance_criteria: bd recall harness-agents-pointer references current source and no obsolete agent names.
verification: bd recall harness-agents-pointer; load() roster comparison.
dependencies: []
proposed_owner: orchestrator
requires_separate_sdd_cycle: false
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```

## HA-F003 — Slash-command documentation is inconsistent across README, AGENTS, and harness-core spec

```yaml
id: HA-F003
title: Slash-command documentation is inconsistent across README, AGENTS, and harness-core spec
category: INCONSISTENCY
severity: MEDIUM
confidence: High
status: OPEN
affected_layer: Docs/specs/recipes
affected_files: ['README.md', 'AGENTS.md', '.specs/features/harness-core/spec.md']
expected_behavior: User-facing slash command list has one canonical generated source or explicit inclusion rules.
observed_behavior: README table, installer sentence, AGENTS slash command line, and spec recipe table differ for clarify, constitution, and doc-review.
evidence: ['README.md:101-114', 'README.md:181', 'AGENTS.md:211-213', '.specs/features/harness-core/spec.md:21-41']
impact: Users and agents may invoke undocumented or missing commands; generated-doc consistency is undermined.
root_cause: Multiple manually maintained slash-command lists with different scope semantics.
target_state: Single generated slash-command table with clear top-level vs internal/harness-only classification.
acceptance_criteria: check-consistency.py fails when slash command lists diverge or docs explicitly label differences.
verification: python3 scripts/check-consistency.py plus grep slash command tables.
dependencies: []
proposed_owner: review-critic
requires_separate_sdd_cycle: false
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```

## HA-F004 — Subrecipe eval support is ambiguous for amend-spec

```yaml
id: HA-F004
title: Subrecipe eval support is ambiguous for amend-spec
category: BROKEN_TRACEABILITY
severity: MEDIUM
confidence: Medium
status: OPEN
affected_layer: Evals/recipes
affected_files: ['evals/recipes/amend-spec.json', 'docs/15-skill-evaluations.md', '.goose/recipes/subrecipes/amend-spec.yaml']
expected_behavior: Every eval subject resolution path is documented and executable for top-level recipes and subrecipes.
observed_behavior: amend-spec eval targets a subrecipe, but docs state recipe subjects resolve to .goose/recipes/<name>.yaml.
evidence: ['evals/recipes/amend-spec.json:9-11', 'docs/15-skill-evaluations.md:333-334', '.goose/recipes/subrecipes/amend-spec.yaml']
impact: Eval runner may skip or fail the subrecipe eval, leaving SPEC_DEVIATION amendment workflow under-tested.
root_cause: Subrecipe eval was added without documenting resolver semantics for subrecipe subjects.
target_state: Eval runner/docs explicitly support subrecipe subjects or move amend-spec under an eval category with path override.
acceptance_criteria: eval-hub dry run resolves amend-spec to subrecipes/amend-spec.yaml; docs describe behavior.
verification: node apps/eval-hub/dist/index.js --run --layers recipes --subjects amend-spec --ambient-goose (or dry-run if available).
dependencies: []
proposed_owner: qa-automation
requires_separate_sdd_cycle: false
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```

## HA-F005 — dev recipe routing text contradicts live-discovery orchestration rule

```yaml
id: HA-F005
title: dev recipe routing text contradicts live-discovery orchestration rule
category: CONTRADICTION
severity: MEDIUM
confidence: High
status: OPEN
affected_layer: L3 recipes / orchestration skill
affected_files: ['.goose/recipes/dev.yaml', '.agents/skills/goose-orchestration/SKILL.md']
expected_behavior: Orchestration routes from live load() discovery before delegation.
observed_behavior: dev.yaml says 'Do NOT rely on runtime discovery when the table below covers the intent' while goose-orchestration requires load() as primary source before delegation.
evidence: ['.goose/recipes/dev.yaml:36-40', 'goose-orchestration skill loaded content: discovery protocol/load() primary source']
impact: Agents may bypass live availability and stale routing tables can override current agent descriptions.
root_cause: Recipe embeds routing methodology that belongs in the orchestration skill and diverged from it.
target_state: dev.yaml delegates routing rules to goose-orchestration and keeps only short invocation reminder.
acceptance_criteria: dev.yaml instructs load() before delegate and no longer forbids runtime discovery.
verification: grep dev.yaml; recipe eval for orchestration decision/load() behavior.
dependencies: []
proposed_owner: architect
requires_separate_sdd_cycle: true
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```

## HA-F006 — Core recipe paths still depend on conversational handoff more than enforceable artifact schemas

```yaml
id: HA-F006
title: Core recipe paths still depend on conversational handoff more than enforceable artifact schemas
category: BROKEN_HANDOFF
severity: HIGH
confidence: Medium
status: OPEN
affected_layer: L3 recipes / artifacts
affected_files: ['.goose/recipes/sdd.yaml', '.specs/schemas/expert-contribution.schema.json', '.specs/schemas/decision-resolution.schema.json']
expected_behavior: Collegial multi-agent contributions are persisted in shared schemas with validation and consumers.
observed_behavior: sdd requires ExpertContribution/DecisionResolution records, but no deterministic validation command or storage location is enforced in recipe gates.
evidence: ['.goose/recipes/sdd.yaml:75-76', '.specs/schemas/expert-contribution.schema.json:1-14', '.specs/schemas/decision-resolution.schema.json:1-14']
impact: Multi-agent work can degrade into unstructured synthesis; dissent/provenance may be lost.
root_cause: Schema artifacts exist but are not integrated into executable validation gates.
target_state: Recipes define storage path and schema validation for contribution/resolution records, or remove mandatory schema claim.
acceptance_criteria: sdd run produces schema-conformant records and validation command passes.
verification: schema validation command over produced artifacts; recipe smoke scenario.
dependencies: []
proposed_owner: principal-engineer
requires_separate_sdd_cycle: true
blocking: false
deferred: false
expected_quality_benefit: improved traceability and executable gates
expected_performance_benefit: fewer misrouted or repeated LLM checks
```
