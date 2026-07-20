# Agentic Development Harness — SDD Conformance, Gap, Drift and Performance Audit

## 1. Mission

Perform a rigorous, adversarial and evidence-based review of this repository’s agentic development harness.

The harness is organized into three superimposed layers, from down to top layers:

* **L1 — Skills:** reusable expertise, rules, procedures and quality standards;
* **L2 — Agents:** specialized roles that apply skills and produce bounded artifacts;
* **L3 — Recipes:** executable Goose workflows coordinating agents, skills, tools, artifacts and gates;
* **Work control:** Beads;
* **Runtime and orchestration:** Goose.

The objective is not to preserve the current architecture.

The objective is to obtain the most:

* [ ] coherent;
* [ ] efficient;
* [ ] performant;
* [ ] understandable;
* [ ] maintainable;
* [ ] executable;
* [ ] traceable;
* [ ] testable;
* [ ] scalable;
* [ ] resilient;
* [ ] cost-efficient;

end-to-end agentic development flow.

The audit must determine whether the harness:

* [ ] Implements a coherent Spec-Driven Development lifecycle.
* [ ] Preserves alignment between intent, clarification, specification, planning, tasks, implementation, verification, review and release.
* [ ] Defines clear responsibilities for every agent.
* [ ] Defines explicit inputs, outputs and handoffs.
* [ ] Supports effective collegial multi-agent work.
* [ ] Aggregates expert contributions into shared planning and decision artifacts.
* [ ] Uses Beads as an actual work-control and dependency system.
* [ ] Uses Goose recipes as executable workflows rather than static documentation.
* [ ] Detects specification deviations and implementation drift.
* [ ] Prevents unsupported self-review and self-approval.
* [ ] Avoids unnecessary agents, skills, recipes, gates and LLM calls.
* [ ] Uses deterministic validation where deterministic validation is possible.
* [ ] Provides a coherent flow from user intent to verified delivery.

Do not assume that the current architecture, documentation, previous findings or implementation are correct.

---

# 2. Checklist status formalism

Every checklist item must use one of these statuses:

* `[ ]` Not started
* `[~]` In progress
* `[x]` Completed and verified
* `[!]` Blocked
* `[-]` Not applicable
* `[?]` Uncertain or insufficient evidence

An item may be marked `[x]` only when:

* [ ] The requested action was performed.
* [ ] Direct evidence was collected.
* [ ] The result was reviewed.
* [ ] The acceptance criteria were satisfied.
* [ ] The result was recorded in the audit artifacts.

An unchecked applicable item must never be silently ignored.

For blocked items, record:

```yaml
status: BLOCKED
reason:
missing_information:
required_decision:
impact:
recommended_next_action:
```

For uncertain items, record:

```yaml
status: UNCERTAIN
known_facts:
unknowns:
assumptions:
confidence:
verification_needed:
```

---

# 3. Execution rules

## 3.1 Execution modes

Supported execution modes:

* [x] `AUDIT_ONLY`
* [ ] `PLAN_REMEDIATION`
* [ ] `REMEDIATE_APPROVED`

The default mode is `AUDIT_ONLY`.

The execution mode must be stated at the beginning of the report and before each major phase transition.

---

## 3.2 `AUDIT_ONLY` rules

In `AUDIT_ONLY` mode:

* [ ] Do not modify tracked repository files.
* [ ] Do not modify agents.
* [ ] Do not modify skills.
* [ ] Do not modify recipes.
* [ ] Do not modify templates.
* [ ] Do not implement findings.
* [ ] Do not close existing Beads tasks.
* [ ] Do not execute unrelated Beads tasks.
* [ ] Do not rename, delete or move repository components.
* [ ] Temporary validation commands are allowed when they do not modify tracked files.
* [ ] Temporary generated files must be kept outside tracked repository paths or removed after validation.
* [ ] Findings, target-state proposals and remediation tasks may be documented.
* [ ] Proposed Beads Epics and tasks may only be created after evidence and acceptance criteria are established.
* [ ] Stop after producing the audit, target architecture and remediation proposal.

---

## 3.3 `PLAN_REMEDIATION` rules

In `PLAN_REMEDIATION` mode:

* [ ] Findings must already be supported by evidence.
* [ ] Target-state decisions must be explicit.
* [ ] Remediation work must be represented in a dedicated Beads Epic.
* [ ] Each task must reference one or more findings.
* [ ] Each task must define acceptance criteria.
* [ ] Each task must define verification evidence.
* [ ] Dependencies must be explicit.
* [ ] Owners must be explicit.
* [ ] Human approval requirements must be explicit.
* [ ] No source implementation may occur.

---

## 3.4 `REMEDIATE_APPROVED` rules

In `REMEDIATE_APPROVED` mode:

* [ ] Implement only explicitly approved findings.
* [ ] Implement only tasks belonging to the active remediation Epic.
* [ ] Implement only ready tasks.
* [ ] Implement only assigned tasks.
* [ ] Implement only unblocked tasks.
* [ ] Require complete acceptance criteria.
* [ ] Require an executable verification method.
* [ ] Respect task dependencies.
* [ ] Respect work-in-progress limits.
* [ ] Require independent review before closure.
* [ ] Require completion evidence before task closure.
* [ ] Do not implement unrelated tasks returned by an unrestricted `bd list`.

The active execution queue must be equivalent to:

```text
Tasks belonging to the current approved Epic
AND ready
AND unblocked
AND assigned
AND with complete acceptance criteria
AND with a defined verification method
```

---

## 3.5 Beads safety rules

Before using Beads:

* [ ] Confirm the active repository.
* [ ] Confirm the active Epic.
* [ ] Confirm the current execution mode.
* [ ] Inspect existing tasks before creating new tasks.
* [ ] Avoid duplicate tasks.
* [ ] Avoid changing unrelated historical tasks.
* [ ] Record dependencies.
* [ ] Record evidence.
* [ ] Record acceptance criteria.
* [ ] Record verification requirements.

Do not interpret all results from `bd list` as authorized work.

When listing implementation tasks:

* [ ] Filter by the active Epic.
* [ ] Filter by readiness.
* [ ] Filter by assignment.
* [ ] Filter out blocked tasks.
* [ ] Filter out deferred tasks.
* [ ] Filter out audit-only findings.
* [ ] Filter out tasks without acceptance criteria.

---

## 3.6 Loop and retry rules

A remediation or re-evaluation loop must not run indefinitely.

Maximum loops per finding or workstream:

* [ ] Initial evaluation
* [ ] Remediation loop 1
* [ ] Remediation loop 2

After two unsuccessful remediation loops:

* [ ] Stop implementation.
* [ ] Mark the task `BLOCKED`.
* [ ] Record remaining failures.
* [ ] Record the missing decision.
* [ ] Record required human intervention.
* [ ] Preserve all evidence.
* [ ] Do not silently lower acceptance criteria.
* [ ] Do not continue indefinitely.

---

## 3.7 Evidence rules

Every substantial claim must be supported by one or more of:

* [ ] Repository file and line reference.
* [ ] Recipe validation output.
* [ ] Command output.
* [ ] Beads task or dependency evidence.
* [ ] Goose execution evidence.
* [ ] Test result.
* [ ] Schema validation result.
* [ ] Primary external source.
* [ ] Reproducible scenario.

Clearly distinguish:

* [ ] Proven fact.
* [ ] Interpretation.
* [ ] Assumption.
* [ ] Recommendation.
* [ ] Uncertainty.
* [ ] External principle.
* [ ] Project-specific design choice.

---

# 4. Architectural freedom and optimization authority

The auditor has full freedom to challenge and redesign the current harness architecture.

The current inventory of agents, skills and recipes must not be treated as fixed, mandatory or inherently correct.

The auditor is explicitly authorized to recommend adding, removing, merging, splitting, replacing, moving or renaming any component when this improves the coherence, quality or performance of the harness.

## 4.1 Agent authority

The auditor may recommend:

* [ ] Adding agents.
* [ ] Removing agents.
* [ ] Merging agents.
* [ ] Splitting agents.
* [ ] Renaming agents.
* [ ] Deprecating agents.
* [ ] Replacing agents.
* [ ] Changing agent responsibilities.
* [ ] Changing agent inputs and outputs.
* [ ] Changing agent decision authority.
* [ ] Changing agent review authority.
* [ ] Changing handoff mechanisms.
* [ ] Changing which agents are mandatory.
* [ ] Changing which agents are optional.
* [ ] Changing which agents participate in each lifecycle phase.

## 4.2 Skill authority

The auditor may recommend:

* [ ] Adding skills.
* [ ] Removing skills.
* [ ] Merging skills.
* [ ] Splitting skills.
* [ ] Renaming skills.
* [ ] Deprecating skills.
* [ ] Replacing skills.
* [ ] Moving reusable instructions from recipes into skills.
* [ ] Moving agent-specific instructions out of shared skills.
* [ ] Consolidating duplicate rules.
* [ ] Removing obsolete rules.
* [ ] Establishing a single source of truth for shared principles.

## 4.3 Recipe authority

The auditor may recommend:

* [ ] Adding recipes.
* [ ] Removing recipes.
* [ ] Merging recipes.
* [ ] Splitting recipes.
* [ ] Renaming recipes.
* [ ] Deprecating recipes.
* [ ] Replacing recipes.
* [ ] Reordering recipes.
* [ ] Adding lifecycle phases.
* [ ] Removing redundant lifecycle phases.
* [ ] Creating subrecipes.
* [ ] Removing unnecessary subrecipes.
* [ ] Changing entry criteria.
* [ ] Changing exit criteria.
* [ ] Adding gates.
* [ ] Removing redundant gates.
* [ ] Changing orchestration strategies.
* [ ] Changing parallel and sequential execution.
* [ ] Replacing LLM checks with deterministic commands.

## 4.4 Broader architectural authority

The auditor may also recommend changes to:

* [ ] Beads Epic structure.
* [ ] Beads task granularity.
* [ ] Beads dependency rules.
* [ ] Beads readiness rules.
* [ ] Beads gate tasks.
* [ ] Work-in-progress limits.
* [ ] Assignment rules.
* [ ] Human approval gates.
* [ ] Knowledge Graph structure.
* [ ] Memory and context-loading mechanisms.
* [ ] Artifact schemas.
* [ ] Artifact storage locations.
* [ ] Naming conventions.
* [ ] Repository structure.
* [ ] Validation mechanisms.
* [ ] Scoring mechanisms.
* [ ] Observability.
* [ ] Audit trail.
* [ ] Caching and incremental analysis.

---

## 4.5 No-preservation-bias rule

Do not preserve a component solely because:

* [ ] It already exists.
* [ ] It has documentation.
* [ ] It was part of a previous architecture decision.
* [ ] Several files reference it.
* [ ] Removing it requires migration.
* [ ] Its name suggests that it should be useful.
* [ ] It mirrors another framework.
* [ ] It was introduced for a problem that no longer exists.
* [ ] It is considered part of the historical harness design.

For every component, assign exactly one decision:

* [ ] `KEEP`
* [ ] `KEEP_AND_IMPROVE`
* [ ] `RENAME`
* [ ] `MOVE`
* [ ] `SPLIT`
* [ ] `MERGE`
* [ ] `REPLACE`
* [ ] `DEPRECATE`
* [ ] `REMOVE`
* [ ] `UNDECIDED`

Use:

```yaml
component:
component_type: agent | skill | recipe | subrecipe | template | gate | artifact
current_purpose:
actual_usage:
decision:
justification:
evidence:
dependencies:
replacement:
migration_impact:
expected_quality_benefit:
expected_performance_benefit:
risk:
```

---

## 4.6 Addition criteria

Do not add a new component unless:

* [ ] It addresses a demonstrated gap.
* [ ] Its responsibility is distinct.
* [ ] Its inputs are explicit.
* [ ] Its outputs are explicit.
* [ ] Its outputs have identified consumers.
* [ ] Its ownership is explicit.
* [ ] It does not duplicate an existing component.
* [ ] It can be independently tested.
* [ ] Its operational cost is justified.
* [ ] Its contribution is measurable.
* [ ] It improves the end-to-end flow.

---

## 4.7 Removal, merger or deprecation criteria

Recommend removal, merger or deprecation when a component:

* [ ] Is never invoked.
* [ ] Produces no consumed output.
* [ ] Duplicates another responsibility.
* [ ] Contradicts a source of truth.
* [ ] Adds cost without measurable value.
* [ ] Creates unnecessary context switching.
* [ ] Introduces unclear ownership.
* [ ] Cannot be independently evaluated.
* [ ] Exists only as documentation without executable integration.
* [ ] Makes the flow harder to understand.
* [ ] Increases token cost disproportionately.
* [ ] Increases runtime disproportionately.
* [ ] Encourages self-review.
* [ ] Represents an obsolete decision.
* [ ] Has been superseded by another component.

---

## 4.8 Flow performance checklist

Evaluate:

* [ ] Number of lifecycle phases.
* [ ] Number of mandatory agents per phase.
* [ ] Number of optional agents per phase.
* [ ] Number of LLM calls.
* [ ] Number of expensive-model calls.
* [ ] Number of handoffs.
* [ ] Number of generated artifacts.
* [ ] Number of Beads tasks.
* [ ] Number of gates.
* [ ] Number of repeated repository scans.
* [ ] Number of repeated web searches.
* [ ] Number of repeated context-loading operations.
* [ ] Number of judge calls.
* [ ] Number of review loops.
* [ ] Sequential steps that could run in parallel.
* [ ] Parallel steps that unnecessarily duplicate work.
* [ ] Deterministic checks currently delegated to LLMs.
* [ ] Context given to agents that do not need it.
* [ ] Verbose artifacts that impair downstream consumption.
* [ ] Missing caching or incremental analysis.
* [ ] Failure recovery cost.
* [ ] Human-intervention frequency.

For every phase:

* [ ] Confirm it provides distinct value.
* [ ] Determine whether it can be merged.
* [ ] Determine whether it can run in parallel.
* [ ] Determine whether all assigned agents are required.
* [ ] Determine whether outputs can be reused.
* [ ] Determine whether context can be loaded once and referenced.
* [ ] Determine whether outputs can use a shared schema.
* [ ] Determine whether deterministic checks can replace LLM judgment.
* [ ] Determine whether a smaller model can be used.
* [ ] Determine whether human approval is necessary.

---

# 5. Detailed harness inventory

## 5.1 L1 — Skills

Inspect recursively:

* [ ] `.agents/skills/agentic-devlopment`
* [ ] `.agents/skills/agentic-ux`
* [ ] `.agents/skills/atomic-design`
* [ ] `.agents/skills/beads`
* [ ] `.agents/skills/code-review`
* [ ] `.agents/skills/cognitive-ux`
* [ ] `.agents/skills/design-critique-case-studies`
* [ ] `.agents/skills/design-systems-arch`
* [ ] `.agents/skills/frontend-blueprint`
* [ ] `.agents/skills/gdd`
* [ ] `.agents/skills/goose-orchestration`
* [ ] `.agents/skills/harness-judge`
* [ ] `.agents/skills/knowledge-graph`
* [ ] `.agents/skills/README.md`
* [ ] `.agents/skills/sdd`
* [ ] `.agents/skills/skill-creator`
* [ ] `.agents/skills/systematic-debugging`
* [ ] `.agents/skills/ui-quality`
* [ ] `.agents/skills/ux-quality`
* [ ] `.agents/skills/wcag-accessibility-audit`
* [ ] `.agents/skills/webapp-testing`

For each path:

* [ ] Confirm whether it is a file or directory.
* [ ] Confirm existence.
* [ ] Inspect recursively when it is a directory.
* [ ] Identify the entrypoint.
* [ ] Record purpose.
* [ ] Record intended consuming agents.
* [ ] Record inputs.
* [ ] Record outputs.
* [ ] Record dependencies.
* [ ] Record commands.
* [ ] Record referenced files.
* [ ] Record validation mechanisms.
* [ ] Detect overlapping skills.
* [ ] Detect contradictory rules.
* [ ] Detect naming inconsistencies.
* [ ] Detect unused skills.
* [ ] Detect missing consumers.
* [ ] Assign a target-state decision.

Explicitly verify whether `agentic-devlopment` is intentionally named or misspelled.

Do not rename it automatically.

---

## 5.2 L2 — Agents

Inspect:

* [ ] `.agents/agents/architect.md`
* [ ] `.agents/agents/codebase-researcher.md`
* [ ] `.agents/agents/harness-judge.md`
* [ ] `.agents/agents/implementation-worker.md`
* [ ] `.agents/agents/orchestrator.md`
* [ ] `.agents/agents/planner.md`
* [ ] `.agents/agents/principal-engineer.md`
* [ ] `.agents/agents/product-owner.md`
* [ ] `.agents/agents/qa-automation.md`
* [ ] `.agents/agents/review-critic.md`
* [ ] `.agents/agents/tdd-guide.md`
* [ ] `.agents/agents/ui-designer.md`
* [ ] `.agents/agents/ux-researcher.md`

For each agent:

* [ ] Confirm existence.
* [ ] Record purpose.
* [ ] Record responsibilities.
* [ ] Record explicit non-responsibilities.
* [ ] Record required inputs.
* [ ] Record produced outputs.
* [ ] Record invoked skills.
* [ ] Record tools.
* [ ] Record upstream agents.
* [ ] Record downstream agents.
* [ ] Record handoff format.
* [ ] Record decision authority.
* [ ] Record review authority.
* [ ] Record escalation rules.
* [ ] Detect responsibility overlaps.
* [ ] Detect role ambiguity.
* [ ] Detect self-review.
* [ ] Detect missing expertise.
* [ ] Detect unconsumed outputs.
* [ ] Detect missing recipe invocation.
* [ ] Determine whether the agent is mandatory or optional.
* [ ] Assign a target-state decision.

Produce the complete current agent list.

For every agent answer:

* [ ] Why does this agent exist?
* [ ] Which distinct value does it provide?
* [ ] Which lifecycle phases use it?
* [ ] Which artifacts does it produce?
* [ ] Who consumes those artifacts?
* [ ] Could its role be merged with another agent?
* [ ] Is it invoked often enough to justify its existence?
* [ ] Is it independent from the agents it reviews?

---

## 5.3 L3 — Goose recipes

Inspect:

* [ ] `.goose/recipes/design.yaml`
* [ ] `.goose/recipes/dev.yaml`
* [ ] `.goose/recipes/discover.yaml`
* [ ] `.goose/recipes/doc-review.yaml`
* [ ] `.goose/recipes/explore.yaml`
* [ ] `.goose/recipes/harness-audit.yaml`

* [ ] `.goose/recipes/harness-review.yaml`
* [ ] `.goose/recipes/implement.yaml`
* [ ] `.goose/recipes/plan.yaml`
* [ ] `.goose/recipes/README.md`
* [ ] `.goose/recipes/release.yaml`
* [ ] `.goose/recipes/remember.yaml`
* [ ] `.goose/recipes/review.yaml`
* [ ] `.goose/recipes/sdd.yaml`
* [ ] `.goose/recipes/spec.yaml`
* [ ] `.goose/recipes/subrecipes`
* [ ] `.goose/recipes/templates`
* [ ] `.goose/recipes/verify.yaml`

For each path:

* [ ] Confirm existence.
* [ ] Confirm whether it is a file or directory.
* [ ] Inspect recursively when it is a directory.
* [ ] Validate YAML syntax where applicable.
* [ ] Validate against the current Goose recipe format.
* [ ] Record purpose.
* [ ] Record parameters.
* [ ] Record required inputs.
* [ ] Record outputs.
* [ ] Record invoked agents.
* [ ] Record invoked skills.
* [ ] Record invoked subrecipes.
* [ ] Record Beads operations.
* [ ] Record entry criteria.
* [ ] Record exit criteria.
* [ ] Record gates.
* [ ] Record validation commands.
* [ ] Record downstream recipes.
* [ ] Detect missing references.
* [ ] Detect unreachable recipes.
* [ ] Detect circular calls.
* [ ] Detect missing failure handling.
* [ ] Detect missing retry limits.
* [ ] Detect missing output aggregation.
* [ ] Detect missing completion conditions.
* [ ] Detect duplicated recipes.
* [ ] Detect recipe responsibilities that should be skills.
* [ ] Assign a target-state decision.

---

# 6. External SDD knowledge

## 6.1 Required web sources

Fetch and analyze:

* [ ] `https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/`
* [ ] `https://developer.microsoft.com/blog/spec-driven-development-spec-kit/`

The search may be extended.

Prioritize:

* [ ] Current Spec Kit repository and official documentation.
* [ ] Official Microsoft sources.
* [ ] Official GitHub sources.
* [ ] Official Goose documentation.
* [ ] Official Beads documentation.
* [ ] Primary sources for multi-agent orchestration.
* [ ] Primary sources for LLM-as-judge evaluation.
* [ ] Primary sources for agentic harness design.
* [ ] Primary sources for context engineering and evaluation loops.

For every source:

* [ ] Record URL.
* [ ] Record title.
* [ ] Record publication or update date.
* [ ] Record source authority.
* [ ] Extract principles separately.
* [ ] Classify principles as normative, recommended or illustrative.
* [ ] Record applicability.
* [ ] Record confidence.
* [ ] Record evidence.
* [ ] Record possible conflict with other sources.

For every principle:

```yaml
principle_id:
name:
description:
source:
source_type:
classification:
applicability:
expected_harness_behavior:
confidence:
```

---

# 7. Local Spec Kit knowledge

Read at least:

* [ ] `/home/jmercier/Codes/third-parties/spec-kit/AGENTS.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/workflows/PUBLISHING.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/workflows/ARCHITECTURE.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/templates/checklist-template.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/templates/constitution-template.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/templates/plan-template.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/templates/spec-template.md`
* [ ] `/home/jmercier/Codes/third-parties/spec-kit/templates/tasks-template.md`

For each file:

* [ ] Confirm existence.
* [ ] Record path.
* [ ] Record purpose.
* [ ] Extract lifecycle phases.
* [ ] Extract mandatory artifacts.
* [ ] Extract entry criteria.
* [ ] Extract exit criteria.
* [ ] Extract validation rules.
* [ ] Extract clarification mechanisms.
* [ ] Extract traceability expectations.
* [ ] Extract role expectations.
* [ ] Extract ambiguity-management rules.
* [ ] Extract deviation-management rules.
* [ ] Record evidence with file and line references.

Do not merely summarize the files.

---

# 8. Canonical SDD reference model

Build a canonical lifecycle containing at least:

* [ ] Constitution
* [ ] Discover or Intent
* [ ] Specify
* [ ] Clarify
* [ ] Plan
* [ ] Tasks
* [ ] Implement
* [ ] Verify or Validate
* [ ] Review
* [ ] Release
* [ ] Specification deviation handling
* [ ] Learning or memory feedback

For every phase:

* [ ] Define purpose.
* [ ] Define mandatory inputs.
* [ ] Define mandatory outputs.
* [ ] Define primary owner.
* [ ] Define supporting agents.
* [ ] Define entry gate.
* [ ] Define exit gate.
* [ ] Define Beads representation.
* [ ] Define validation evidence.
* [ ] Define allowed next phases.
* [ ] Define prohibited transitions.
* [ ] Define failure handling.
* [ ] Define feedback loop.
* [ ] Map the current harness implementation.
* [ ] Identify missing or redundant phases.

Use:

| Phase | Purpose | Inputs | Outputs | Owner | Supporting agents | Entry gate | Exit gate | Recipe | Status |
| ----- | ------- | ------ | ------- | ----- | ----------------- | ---------- | --------- | ------ | ------ |

For each divergence from Spec Kit, classify:

* [ ] `ADOPTED`
* [ ] `ADAPTED`
* [ ] `EXTENDED`
* [ ] `INTENTIONALLY_DIFFERENT`
* [ ] `MISSING`
* [ ] `CONTRADICTORY`

A difference is not automatically a defect.

---

# 9. Structural and executable maps

## 9.1 Layer map

* [ ] Map each skill to its consuming agents.
* [ ] Map each agent to its invoking recipes.
* [ ] Map each recipe to its invoked skills.
* [ ] Map each recipe to its invoked agents.
* [ ] Identify orphan skills.
* [ ] Identify orphan agents.
* [ ] Identify recipes without owners.
* [ ] Identify undocumented cross-layer dependencies.

## 9.2 Artifact flow

* [ ] Identify all artifacts.
* [ ] Identify producers.
* [ ] Identify consumers.
* [ ] Identify storage locations.
* [ ] Identify formats.
* [ ] Identify schemas.
* [ ] Identify validation.
* [ ] Identify versioning.
* [ ] Identify provenance.
* [ ] Detect dead-end artifacts.
* [ ] Detect missing artifacts.
* [ ] Detect incompatible formats.
* [ ] Detect outputs that are regenerated unnecessarily.

## 9.3 Agent handoff graph

* [ ] Identify every handoff.
* [ ] Identify handoff triggers.
* [ ] Identify payloads.
* [ ] Identify acceptance conditions.
* [ ] Identify rejection conditions.
* [ ] Identify escalation paths.
* [ ] Detect implicit handoffs.
* [ ] Detect undocumented handoffs.
* [ ] Detect handoffs without consumers.
* [ ] Detect handoffs without validation.
* [ ] Detect handoffs that lose provenance.
* [ ] Detect handoffs based only on conversational context.

## 9.4 Recipe invocation graph

* [ ] Identify entrypoints.
* [ ] Identify subrecipe calls.
* [ ] Identify conditional calls.
* [ ] Identify terminal states.
* [ ] Identify failure states.
* [ ] Identify cycles.
* [ ] Identify unreachable nodes.
* [ ] Identify bypassable gates.
* [ ] Identify missing transitions.
* [ ] Identify conflicting transitions.
* [ ] Identify repeated execution of equivalent phases.

## 9.5 Beads workflow graph

* [ ] Identify Epic creation rules.
* [ ] Identify task creation rules.
* [ ] Identify assignment rules.
* [ ] Identify dependency rules.
* [ ] Identify readiness rules.
* [ ] Identify blocking rules.
* [ ] Identify gate tasks.
* [ ] Identify closure rules.
* [ ] Identify verification evidence.
* [ ] Detect unrestricted `bd list` usage.
* [ ] Detect tasks without acceptance criteria.
* [ ] Detect tasks without verification methods.
* [ ] Detect tasks executable outside the active Epic.
* [ ] Detect unclear ownership.
* [ ] Detect excessive task granularity.
* [ ] Detect insufficient task granularity.

---

# 10. Collegial multi-agent work

Do not infer collaboration merely from the existence of several agent files.

For every relevant workflow:

* [ ] Identify participating agents.
* [ ] Identify mandatory agents.
* [ ] Identify optional agents.
* [ ] Determine whether execution is sequential.
* [ ] Determine whether execution is parallel.
* [ ] Identify shared artifact schemas.
* [ ] Identify aggregation logic.
* [ ] Identify how disagreements are represented.
* [ ] Identify who arbitrates disagreements.
* [ ] Identify whether minority opinions are preserved.
* [ ] Identify whether provenance is preserved.
* [ ] Identify whether mandatory contributions are enforced.
* [ ] Identify whether an agent can be bypassed.
* [ ] Identify whether the orchestrator can override expert advice.
* [ ] Identify whether override justification is recorded.
* [ ] Identify whether one agent authors and approves the same artifact.
* [ ] Identify whether the judge is independent.
* [ ] Identify whether aggregation is semantic or simple concatenation.
* [ ] Identify whether conflicting expert outputs influence the final plan.

Planning must be checked for input from:

* [ ] Product Owner
* [ ] Architect
* [ ] Principal Engineer
* [ ] QA Automation
* [ ] TDD Guide
* [ ] Security expertise when applicable
* [ ] UX Researcher when applicable
* [ ] UI Designer when applicable
* [ ] Implementation Worker for feasibility when applicable
* [ ] Review Critic

For each contribution:

* [ ] Input was requested.
* [ ] Input was produced.
* [ ] Input was stored.
* [ ] Input was traceable.
* [ ] Input was aggregated.
* [ ] Conflicts were resolved.
* [ ] Final decisions referenced the contribution.

Answer explicitly:

* [ ] What is the current list of agents?
* [ ] Which agents are actually invoked?
* [ ] Which agents are never invoked?
* [ ] Do agents work collegially?
* [ ] Are outputs aggregated into a shared plan?
* [ ] Is aggregation structured and traceable?
* [ ] Are disagreements preserved and resolved?
* [ ] Is agent expertise used at the right phase?
* [ ] Are too many agents invoked by default?
* [ ] Are some agents better represented as skills or review modes?

---
# 11. Domain G — Global orchestration and ontological graph audit

Perform an additional audit at the global harness and orchestration level.

The objective is to construct a navigable and machine-queryable knowledge graph representing the complete harness architecture, its semantics, its runtime orchestration and its actual use.

This graph must support:

* [ ] Structural exploration.
* [ ] Dependency analysis.
* [ ] Responsibility analysis.
* [ ] Topic and capability coverage analysis.
* [ ] Orchestration-path analysis.
* [ ] Traceability analysis.
* [ ] Gap detection.
* [ ] Drift detection.
* [ ] Contradiction detection.
* [ ] Ontological reasoning.
* [ ] Impact analysis.
* [ ] Architectural decision support.
* [ ] Target-state comparison.
* [ ] Incremental updates after repository changes.

The graph must not be a decorative diagram or a simple list of files.

It must be:

* [ ] Traversable.
* [ ] Queryable.
* [ ] Typed.
* [ ] Directed where relationship semantics require direction.
* [ ] Supported by repository evidence.
* [ ] Equipped with stable identifiers.
* [ ] Equipped with provenance.
* [ ] Equipped with confidence values when information is inferred.
* [ ] Exportable in a machine-readable representation.
* [ ] Suitable for TBox and ABox reasoning.

---

## 11.1 TBox and ABox separation

The ontological model must explicitly distinguish:

### TBox — Terminological knowledge

The TBox defines:

* [ ] Node types.
* [ ] Relationship types.
* [ ] Relationship direction.
* [ ] Allowed domains and ranges.
* [ ] Cardinality constraints.
* [ ] Mandatory properties.
* [ ] Inheritance rules.
* [ ] Equivalence rules.
* [ ] Disjointness rules.
* [ ] Integrity constraints.
* [ ] Inference rules.
* [ ] Validation rules.

### ABox — Assertional knowledge

The ABox contains concrete repository instances such as:

* [ ] The `architect` agent.
* [ ] The `sdd` skill.
* [ ] The `plan.yaml` recipe.
* [ ] A responsibility assigned to an agent.
* [ ] A topic covered by a skill.
* [ ] A recipe delegating a task to an agent.
* [ ] An agent loading a skill.
* [ ] A gate blocking a recipe transition.
* [ ] An artifact produced by one agent and consumed by another.
* [ ] A finding affecting a specific component.
* [ ] A decision recommending that two agents be merged.

The audit must verify:

* [ ] Every ABox assertion conforms to the TBox.
* [ ] Every relationship uses an allowed domain and range.
* [ ] Mandatory properties are present.
* [ ] Contradictory assertions are identified.
* [ ] Inferred assertions are distinguished from explicit assertions.
* [ ] Evidence exists for every explicit assertion.
* [ ] Confidence exists for every inferred assertion.

---

## 11.2 Mandatory node types

Create at least the following node types.

### Core harness nodes

* [ ] `Skill`
* [ ] `SkillTopic`
* [ ] `Agent`
* [ ] `AgentTopic`
* [ ] `AgentResponsibility`
* [ ] `Recipe`
* [ ] `RecipeTopic`
* [ ] `DelegatedTask`
* [ ] `Subrecipe`
* [ ] `Template`
* [ ] `Tool`
* [ ] `Command`
* [ ] `Model`
* [ ] `RepositoryFile`
* [ ] `RepositoryDirectory`

### SDD and orchestration nodes

* [ ] `LifecyclePhase`
* [ ] `WorkflowStep`
* [ ] `EntryCriterion`
* [ ] `ExitCriterion`
* [ ] `Gate`
* [ ] `Handoff`
* [ ] `DecisionAuthority`
* [ ] `ReviewAuthority`
* [ ] `EscalationRule`
* [ ] `AggregationRule`
* [ ] `RetryRule`
* [ ] `FailureState`
* [ ] `TerminalState`

### Work-control nodes

* [ ] `BeadsEpic`
* [ ] `BeadsTask`
* [ ] `BeadsDependency`
* [ ] `BeadsGate`
* [ ] `Assignee`
* [ ] `AcceptanceCriterion`
* [ ] `VerificationMethod`
* [ ] `CompletionEvidence`

### Knowledge and artifact nodes

* [ ] `Artifact`
* [ ] `ArtifactType`
* [ ] `ArtifactSchema`
* [ ] `KnowledgeSource`
* [ ] `ExternalPrinciple`
* [ ] `LocalPrinciple`
* [ ] `Requirement`
* [ ] `Constraint`
* [ ] `Assumption`
* [ ] `Evidence`
* [ ] `Finding`
* [ ] `Risk`
* [ ] `ArchitecturalDecision`
* [ ] `TargetStateDecision`
* [ ] `Metric`

### Optional inferred or recommended nodes

The auditor may introduce other node types when they improve reasoning, including:

* [ ] `Capability`
* [ ] `QualityAttribute`
* [ ] `ProjectContext`
* [ ] `HumanActor`
* [ ] `Approval`
* [ ] `CostCenter`
* [ ] `ExecutionRun`
* [ ] `EvaluationResult`
* [ ] `Score`
* [ ] `Conflict`
* [ ] `DeprecatedComponent`
* [ ] `MigrationStep`
* [ ] `RollbackStep`

Every additional node type must:

* [ ] Have a clear semantic definition.
* [ ] Have at least one concrete use.
* [ ] Avoid duplicating an existing type.
* [ ] Define its allowed relationships.
* [ ] Improve a required reasoning capability.

---

## 11.3 Mandatory relationship types

Create at least the following typed relationships.

### Skill relationships

* [ ] `Skill COVERS_TOPIC SkillTopic`
* [ ] `Skill DEPENDS_ON Skill`
* [ ] `Skill REFERENCES_FILE RepositoryFile`
* [ ] `Skill USES_TOOL Tool`
* [ ] `Skill EXECUTES_COMMAND Command`
* [ ] `Skill PRODUCES Artifact`
* [ ] `Skill VALIDATED_BY VerificationMethod`
* [ ] `Skill OVERLAPS_WITH Skill`
* [ ] `Skill CONTRADICTS Skill`
* [ ] `Skill SUPERSEDES Skill`

### Agent relationships

* [ ] `Agent COVERS_TOPIC AgentTopic`
* [ ] `Agent HAS_RESPONSIBILITY AgentResponsibility`
* [ ] `Agent LOADS_SKILL Skill`
* [ ] `Agent USES_TOOL Tool`
* [ ] `Agent PRODUCES Artifact`
* [ ] `Agent CONSUMES Artifact`
* [ ] `Agent DELEGATES_TO Agent`
* [ ] `Agent REVIEWS Agent`
* [ ] `Agent CHALLENGES Agent`
* [ ] `Agent HANDS_OFF_TO Agent`
* [ ] `Agent ESCALATES_TO Agent`
* [ ] `Agent AGGREGATES_OUTPUT_FROM Agent`
* [ ] `Agent PARTICIPATES_IN Recipe`
* [ ] `Agent OWNS LifecyclePhase`
* [ ] `Agent SUPPORTS LifecyclePhase`
* [ ] `Agent ASSIGNED_TO BeadsTask`
* [ ] `Agent HAS_DECISION_AUTHORITY DecisionAuthority`
* [ ] `Agent HAS_REVIEW_AUTHORITY ReviewAuthority`
* [ ] `Agent OVERLAPS_WITH Agent`
* [ ] `Agent CONFLICTS_WITH Agent`
* [ ] `Agent MAY_REPLACE Agent`

### Recipe relationships

* [ ] `Recipe COVERS_TOPIC RecipeTopic`
* [ ] `Recipe INVOLVES_AGENT Agent`
* [ ] `Recipe LOADS_SKILL Skill`
* [ ] `Recipe DELEGATES_TASK DelegatedTask`
* [ ] `DelegatedTask ASSIGNED_TO Agent`
* [ ] `DelegatedTask REQUIRES_SKILL Skill`
* [ ] `Recipe INVOKES_RECIPE Recipe`
* [ ] `Recipe INVOKES_SUBRECIPE Subrecipe`
* [ ] `Recipe USES_TEMPLATE Template`
* [ ] `Recipe USES_TOOL Tool`
* [ ] `Recipe EXECUTES_COMMAND Command`
* [ ] `Recipe PRODUCES Artifact`
* [ ] `Recipe CONSUMES Artifact`
* [ ] `Recipe IMPLEMENTS_PHASE LifecyclePhase`
* [ ] `Recipe HAS_ENTRY_CRITERION EntryCriterion`
* [ ] `Recipe HAS_EXIT_CRITERION ExitCriterion`
* [ ] `Recipe BLOCKED_BY Gate`
* [ ] `Recipe TRANSITIONS_TO Recipe`
* [ ] `Recipe FAILS_TO FailureState`
* [ ] `Recipe TERMINATES_AT TerminalState`
* [ ] `Recipe CREATES BeadsTask`
* [ ] `Recipe UPDATES BeadsTask`
* [ ] `Recipe CLOSES BeadsTask`
* [ ] `Recipe OVERLAPS_WITH Recipe`
* [ ] `Recipe CONFLICTS_WITH Recipe`
* [ ] `Recipe MAY_REPLACE Recipe`

### Artifact and handoff relationships

* [ ] `Artifact HAS_TYPE ArtifactType`
* [ ] `Artifact CONFORMS_TO ArtifactSchema`
* [ ] `Artifact DERIVED_FROM Artifact`
* [ ] `Artifact SATISFIES Requirement`
* [ ] `Artifact SUPPORTED_BY Evidence`
* [ ] `Artifact INPUT_TO Recipe`
* [ ] `Artifact OUTPUT_OF Recipe`
* [ ] `Handoff TRANSFERS Artifact`
* [ ] `Handoff FROM_AGENT Agent`
* [ ] `Handoff TO_AGENT Agent`
* [ ] `Handoff VALIDATED_BY AcceptanceCriterion`
* [ ] `AggregationRule AGGREGATES Artifact`
* [ ] `AggregationRule PRODUCES Artifact`

### SDD and control relationships

* [ ] `LifecyclePhase PRECEDES LifecyclePhase`
* [ ] `LifecyclePhase REQUIRES Artifact`
* [ ] `LifecyclePhase PRODUCES Artifact`
* [ ] `LifecyclePhase GUARDED_BY Gate`
* [ ] `Gate REQUIRES AcceptanceCriterion`
* [ ] `Gate VERIFIED_BY VerificationMethod`
* [ ] `Gate BLOCKS LifecyclePhase`
* [ ] `Gate BLOCKS Recipe`
* [ ] `BeadsEpic CONTAINS BeadsTask`
* [ ] `BeadsTask DEPENDS_ON BeadsTask`
* [ ] `BeadsTask BLOCKED_BY BeadsTask`
* [ ] `BeadsTask SATISFIES AcceptanceCriterion`
* [ ] `BeadsTask VERIFIED_BY VerificationMethod`
* [ ] `BeadsTask EVIDENCED_BY CompletionEvidence`

### Audit and decision relationships

* [ ] `Finding AFFECTS Skill`
* [ ] `Finding AFFECTS Agent`
* [ ] `Finding AFFECTS Recipe`
* [ ] `Finding AFFECTS Artifact`
* [ ] `Finding AFFECTS LifecyclePhase`
* [ ] `Finding SUPPORTED_BY Evidence`
* [ ] `Finding CREATES Risk`
* [ ] `Finding RESOLVED_BY BeadsTask`
* [ ] `ArchitecturalDecision ADDRESSES Finding`
* [ ] `ArchitecturalDecision CHANGES Skill`
* [ ] `ArchitecturalDecision CHANGES Agent`
* [ ] `ArchitecturalDecision CHANGES Recipe`
* [ ] `TargetStateDecision RECOMMENDS_KEEP Skill`
* [ ] `TargetStateDecision RECOMMENDS_KEEP Agent`
* [ ] `TargetStateDecision RECOMMENDS_KEEP Recipe`
* [ ] `TargetStateDecision RECOMMENDS_MERGE Skill`
* [ ] `TargetStateDecision RECOMMENDS_MERGE Agent`
* [ ] `TargetStateDecision RECOMMENDS_MERGE Recipe`
* [ ] `TargetStateDecision RECOMMENDS_REMOVE Skill`
* [ ] `TargetStateDecision RECOMMENDS_REMOVE Agent`
* [ ] `TargetStateDecision RECOMMENDS_REMOVE Recipe`

The auditor may refine relationship names, but semantic direction and meaning must remain explicit.

---

## 11.4 Mandatory node properties

Every graph node must contain, when applicable:

```yaml
id:
type:
name:
description:
source_path:
source_lines:
source_kind: explicit | inferred | external
confidence:
status:
version:
created_at:
updated_at:
tags:
```

Additional properties may include:

```yaml
layer:
topics:
responsibilities:
inputs:
outputs:
owner:
criticality:
execution_cost:
token_cost:
runtime_cost:
quality_impact:
lifecycle_phase:
deprecated:
```

Rules:

* [ ] IDs must be stable and unique.
* [ ] File paths must be repository-relative when possible.
* [ ] Line references must be recorded when available.
* [ ] Explicit and inferred knowledge must be distinguishable.
* [ ] Confidence must be between `0.0` and `1.0`.
* [ ] Deprecated components must remain queryable.
* [ ] Renamed components must preserve identity history.
* [ ] Aliases must not create duplicate semantic entities.

---

## 11.5 Mandatory relationship properties

Every relationship must contain, when applicable:

```yaml
id:
type:
source:
target:
direction:
evidence:
source_path:
source_lines:
source_kind: explicit | inferred
confidence:
status:
condition:
cardinality:
```

The graph must distinguish:

* [ ] Declared relationships.
* [ ] Observed runtime relationships.
* [ ] Inferred relationships.
* [ ] Recommended target-state relationships.
* [ ] Deprecated relationships.
* [ ] Contradictory relationships.

---

## 11.6 Topic taxonomy audit

Topics must not be extracted as uncontrolled free-text labels only.

Build and normalize a topic taxonomy covering at least:

* [ ] Spec-Driven Development.
* [ ] Requirements.
* [ ] Clarification.
* [ ] Architecture.
* [ ] Planning.
* [ ] Task management.
* [ ] Implementation.
* [ ] Test-Driven Development.
* [ ] Quality assurance.
* [ ] Code review.
* [ ] Verification.
* [ ] Release.
* [ ] Security.
* [ ] Accessibility.
* [ ] User experience.
* [ ] User interface.
* [ ] Design systems.
* [ ] Observability.
* [ ] Debugging.
* [ ] Knowledge management.
* [ ] Knowledge graphs.
* [ ] Orchestration.
* [ ] Multi-agent collaboration.
* [ ] Beads.
* [ ] Goose.
* [ ] Performance.
* [ ] Cost optimization.
* [ ] Governance.
* [ ] Auditability.

For every topic:

* [ ] Define a canonical name.
* [ ] Define aliases.
* [ ] Define parent topics.
* [ ] Define child topics.
* [ ] Define related topics.
* [ ] Identify skills covering it.
* [ ] Identify agents covering it.
* [ ] Identify recipes covering it.
* [ ] Identify lifecycle phases using it.
* [ ] Detect uncovered topics.
* [ ] Detect topics with excessive duplication.
* [ ] Detect inconsistent terminology.
* [ ] Detect components claiming a topic without executable evidence.

Use relationships such as:

* [ ] `Topic BROADER_THAN Topic`
* [ ] `Topic NARROWER_THAN Topic`
* [ ] `Topic RELATED_TO Topic`
* [ ] `Topic EQUIVALENT_TO Topic`
* [ ] `Topic CONFLICTS_WITH Topic`

---

## 11.7 Responsibility ontology audit

Agent responsibilities must be modeled as entities rather than unstructured prose only.

For every responsibility:

* [ ] Define the responsibility.
* [ ] Identify the accountable agent.
* [ ] Identify contributing agents.
* [ ] Identify reviewing agents.
* [ ] Identify decision authority.
* [ ] Identify required skills.
* [ ] Identify produced artifacts.
* [ ] Identify consuming recipes.
* [ ] Identify lifecycle phases.
* [ ] Identify escalation path.
* [ ] Identify acceptance criteria.
* [ ] Identify possible conflicts.

Use a RACI-like semantic model where useful:

* [ ] `ACCOUNTABLE_FOR`
* [ ] `RESPONSIBLE_FOR`
* [ ] `CONTRIBUTES_TO`
* [ ] `CONSULTED_FOR`
* [ ] `INFORMED_ABOUT`
* [ ] `REVIEWS`
* [ ] `APPROVES`
* [ ] `CHALLENGES`

Detect:

* [ ] Responsibilities with no accountable agent.
* [ ] Responsibilities assigned to multiple accountable agents.
* [ ] Responsibilities with no executing agent.
* [ ] Responsibilities with no reviewer.
* [ ] Responsibilities whose required skills are not loaded.
* [ ] Responsibilities not invoked by any recipe.
* [ ] Responsibilities duplicated across agents.
* [ ] Responsibilities contradicting agent non-responsibilities.
* [ ] Agents owning incompatible responsibilities.
* [ ] Self-approval paths.
* [ ] Circular accountability.

---

## 11.8 Recipe delegation ontology audit

For every recipe, model each delegated task independently.

Each delegated task must identify:

```yaml
id:
recipe:
task_name:
task_purpose:
delegated_to:
required_topics:
required_skills:
inputs:
outputs:
preconditions:
acceptance_criteria:
verification:
downstream_consumer:
parallelizable:
mandatory:
```

Verify:

* [ ] Every delegated task has an assigned agent.
* [ ] The assigned agent has the required responsibility.
* [ ] The agent loads the required skills.
* [ ] The delegated task has inputs.
* [ ] The delegated task has outputs.
* [ ] Outputs have consumers.
* [ ] Acceptance criteria are explicit.
* [ ] Verification is explicit.
* [ ] Parallel execution does not duplicate equivalent work.
* [ ] Sequential execution is justified by dependency.
* [ ] Optional tasks are distinguishable from mandatory tasks.
* [ ] The recipe does not delegate outside an agent’s declared responsibility.
* [ ] The recipe does not rely on undeclared skills.
* [ ] Delegation paths preserve provenance.
* [ ] Delegation paths preserve the active Beads Epic and task context.

---

## 11.9 End-to-end orchestration path analysis

Construct traversable paths covering at least:

```text
User intent
→ lifecycle phase
→ recipe
→ delegated task
→ agent
→ responsibility
→ loaded skill
→ topic
→ produced artifact
→ consuming agent or recipe
→ verification
→ gate
→ Beads task completion
→ next lifecycle phase
```

For every expected end-to-end path:

* [ ] Confirm that the path exists.
* [ ] Confirm that each node exists.
* [ ] Confirm that each relationship is valid.
* [ ] Confirm that the path is directionally coherent.
* [ ] Confirm that no required node is bypassed.
* [ ] Confirm that all mandatory artifacts are produced.
* [ ] Confirm that all mandatory artifacts are consumed.
* [ ] Confirm that every gate has evidence.
* [ ] Confirm that the path terminates.
* [ ] Confirm that failure paths exist.
* [ ] Confirm that retry paths are bounded.
* [ ] Confirm that escalation paths exist.
* [ ] Confirm that specification deviations can return to an appropriate upstream phase.

Detect:

* [ ] Broken paths.
* [ ] Incomplete paths.
* [ ] Dead-end paths.
* [ ] Circular paths.
* [ ] Bypass paths.
* [ ] Paths without verification.
* [ ] Paths without ownership.
* [ ] Paths relying only on implicit conversational memory.
* [ ] Paths with redundant agents.
* [ ] Paths with redundant skills.
* [ ] Paths with redundant recipe transitions.
* [ ] Paths that regenerate an existing artifact unnecessarily.

---

## 11.10 Graph-based reasoning requirements

The graph must support reasoning questions such as:

### Coverage questions

* [ ] Which topics are not covered by any skill?
* [ ] Which topics are covered by skills but by no agent?
* [ ] Which topics are covered by agents but never invoked by recipes?
* [ ] Which lifecycle phases have insufficient topic coverage?
* [ ] Which responsibilities require skills that do not exist?

### Dependency questions

* [ ] Which recipes depend transitively on a given skill?
* [ ] Which agents are affected if a skill is removed?
* [ ] Which recipes break if an agent is merged or removed?
* [ ] Which artifacts become orphaned after a component change?
* [ ] Which gates rely on a particular verification method?

### Orchestration questions

* [ ] Which agents are central orchestration bottlenecks?
* [ ] Which agents are single points of failure?
* [ ] Which recipes delegate equivalent tasks to multiple agents?
* [ ] Which recipes invoke agents without consuming their output?
* [ ] Which recipe paths bypass mandatory validation?
* [ ] Which agent receives the most unrelated topics?
* [ ] Which handoffs create the most context loss?

### Responsibility questions

* [ ] Which responsibilities have no owner?
* [ ] Which responsibilities have multiple conflicting owners?
* [ ] Which agents review their own outputs?
* [ ] Which agents have responsibilities unsupported by loaded skills?
* [ ] Which skills are loaded but irrelevant to assigned responsibilities?
* [ ] Which agents are candidates for merger?
* [ ] Which agents should be split due to excessive semantic scope?

### Performance questions

* [ ] Which orchestration paths produce the highest number of agent calls?
* [ ] Which paths load the same skills repeatedly?
* [ ] Which agents receive unnecessarily large context?
* [ ] Which recipes repeat equivalent repository exploration?
* [ ] Which LLM-based validations can be deterministic?
* [ ] Which nodes or relationships contribute cost without downstream value?

### Drift questions

* [ ] Which declared relationships are not observed in recipes?
* [ ] Which recipe delegations contradict agent documentation?
* [ ] Which agent responsibilities have changed without documentation updates?
* [ ] Which skills are referenced under obsolete names?
* [ ] Which target-state decisions have not been reflected in implementation?
* [ ] Which artifacts no longer conform to their declared schema?

---

## 11.11 Graph algorithms and metrics

Apply graph metrics where useful.

At minimum evaluate:

* [ ] In-degree.
* [ ] Out-degree.
* [ ] Degree centrality.
* [ ] Betweenness centrality.
* [ ] Connected components.
* [ ] Strongly connected components.
* [ ] Cycle detection.
* [ ] Orphan-node detection.
* [ ] Dead-end-node detection.
* [ ] Shortest relevant orchestration paths.
* [ ] Longest required execution paths.
* [ ] Topic-coverage density.
* [ ] Responsibility-overlap density.
* [ ] Agent-to-skill loading ratio.
* [ ] Recipe-to-agent invocation ratio.
* [ ] Artifact producer-to-consumer ratio.
* [ ] Gate coverage ratio.
* [ ] Verification coverage ratio.

Interpret metrics cautiously.

A high-centrality node may represent:

* [ ] A legitimate orchestrator.
* [ ] A bottleneck.
* [ ] A single point of failure.
* [ ] Excessive responsibility concentration.
* [ ] An overly broad abstraction.

Do not classify it without contextual evidence.

---

## 11.12 Ontological integrity constraints

Define and validate at least these constraints:

* [ ] Every `Agent` must have at least one `AgentResponsibility`.
* [ ] Every active `AgentResponsibility` must have exactly one accountable owner unless explicitly justified.
* [ ] Every `Agent` involved in a recipe must receive or produce an artifact, decision or verification result.
* [ ] Every `Agent` assigned a responsibility must load at least one relevant skill or provide an explicit justification.
* [ ] Every active `Skill` must be consumed by at least one agent or recipe.
* [ ] Every active `Recipe` must implement at least one lifecycle phase or provide a documented cross-cutting function.
* [ ] Every active `Recipe` must have an entry criterion and an exit criterion.
* [ ] Every delegated task must have an agent.
* [ ] Every delegated task must have a downstream consumer.
* [ ] Every produced mandatory artifact must have a consumer.
* [ ] Every mandatory gate must have a verification method.
* [ ] Every verification method must produce evidence.
* [ ] Every review relation must avoid prohibited self-review.
* [ ] Every Beads task must belong to an Epic or have an explicit exception.
* [ ] Every target-state recommendation must link to one or more findings.
* [ ] Every inferred relationship must have a confidence value.
* [ ] Every contradiction must be represented explicitly rather than overwritten.

---

## 11.13 Current-state and target-state graphs

Produce two graph views:

### Current-state graph

The current-state graph must represent:

* [ ] What is explicitly declared.
* [ ] What is actually invoked.
* [ ] What is inferred from repository structure.
* [ ] Current contradictions.
* [ ] Current missing relationships.
* [ ] Current orphan components.
* [ ] Current runtime and orchestration risks.

### Target-state graph

The target-state graph must represent:

* [ ] Recommended retained components.
* [ ] Recommended added components.
* [ ] Recommended removed components.
* [ ] Recommended merged components.
* [ ] Recommended split components.
* [ ] Recommended relationship changes.
* [ ] Recommended orchestration paths.
* [ ] Recommended ownership.
* [ ] Recommended gates.
* [ ] Recommended artifact flows.
* [ ] Recommended topic coverage.

Every target-state change must link to:

* [ ] A finding.
* [ ] An architectural decision.
* [ ] Expected benefit.
* [ ] Migration impact.
* [ ] Verification criteria.

Produce a graph diff identifying:

* [ ] Added nodes.
* [ ] Removed nodes.
* [ ] Renamed nodes.
* [ ] Merged nodes.
* [ ] Split nodes.
* [ ] Added relationships.
* [ ] Removed relationships.
* [ ] Changed relationship direction.
* [ ] Changed ownership.
* [ ] Changed topic coverage.
* [ ] Changed orchestration paths.

---

## 11.14 Required graph representations

Produce the graph in at least:

* [ ] One human-readable visual representation.
* [ ] One machine-readable representation.
* [ ] One queryable representation or import script.

Acceptable machine-readable formats include:

* [ ] JSON-LD.
* [ ] RDF/Turtle.
* [ ] GraphML.
* [ ] Neo4j Cypher import statements.
* [ ] A documented property-graph JSON schema.

Mermaid alone is insufficient because it is primarily a visualization format.

A Mermaid representation may be produced additionally for documentation.

The output must document:

* [ ] Chosen graph format.
* [ ] Import procedure.
* [ ] Query examples.
* [ ] Node schema.
* [ ] Relationship schema.
* [ ] Constraints.
* [ ] Versioning strategy.
* [ ] Incremental-update strategy.

---

## 11.15 Required graph queries

Provide executable or implementation-ready queries for at least:

* [ ] List all agents and their loaded skills.
* [ ] List all agents and their responsibilities.
* [ ] List all recipes and involved agents.
* [ ] List all recipes and delegated tasks.
* [ ] List all delegated tasks and required skills.
* [ ] Find skills unused by agents and recipes.
* [ ] Find agents unused by recipes.
* [ ] Find recipes without lifecycle phases.
* [ ] Find responsibilities without accountable agents.
* [ ] Find agents with overlapping responsibilities.
* [ ] Find self-review paths.
* [ ] Find artifacts without consumers.
* [ ] Find recipes that invoke an agent but consume no output from it.
* [ ] Find recipe paths that bypass verification.
* [ ] Find gates without verification evidence.
* [ ] Find topics with no skill coverage.
* [ ] Find topics with no agent coverage.
* [ ] Find topics with excessive duplicated coverage.
* [ ] Find agents loading skills unrelated to their responsibilities.
* [ ] Find responsibilities unsupported by loaded skills.
* [ ] Find all components affected by removing a selected skill.
* [ ] Find all components affected by removing a selected agent.
* [ ] Find all paths from intent to release.
* [ ] Find all cycles in recipe invocation.
* [ ] Compare current-state and target-state graphs.

---

## 11.16 Graph evidence and provenance

Every graph assertion must link to evidence.

For repository-derived assertions:

* [ ] Record file.
* [ ] Record line range when available.
* [ ] Record extraction method.
* [ ] Record whether the assertion is explicit or inferred.
* [ ] Record confidence.
* [ ] Record extraction timestamp or repository revision.

For web-derived assertions:

* [ ] Record source URL.
* [ ] Record publication or update date.
* [ ] Record source authority.
* [ ] Record extracted principle.
* [ ] Avoid mixing external recommendations with current-state facts.

For runtime-derived assertions:

* [ ] Record command.
* [ ] Record command result.
* [ ] Record execution environment.
* [ ] Record timestamp.
* [ ] Record whether execution was successful.

---

## 11.17 Global orchestration findings

Use the ontological graph to identify additional findings including:

* [ ] `ONTOLOGY_GAP`
* [ ] `ONTOLOGY_CONTRADICTION`
* [ ] `MISSING_RELATION`
* [ ] `INVALID_RELATION`
* [ ] `TOPIC_COVERAGE_GAP`
* [ ] `RESPONSIBILITY_COVERAGE_GAP`
* [ ] `RESPONSIBILITY_OVERLAP`
* [ ] `SKILL_LOADING_MISMATCH`
* [ ] `DELEGATION_MISMATCH`
* [ ] `ORCHESTRATION_BOTTLENECK`
* [ ] `SINGLE_POINT_OF_FAILURE`
* [ ] `GRAPH_ORPHAN`
* [ ] `GRAPH_DEAD_END`
* [ ] `GRAPH_CYCLE`
* [ ] `UNJUSTIFIED_CENTRALITY`
* [ ] `UNUSED_KNOWLEDGE`
* [ ] `UNTRACEABLE_INFERENCE`
* [ ] `CURRENT_TARGET_DRIFT`

Each graph-derived finding must include:

* [ ] Graph query or reasoning rule that detected it.
* [ ] Involved nodes.
* [ ] Involved relationships.
* [ ] Repository evidence.
* [ ] Confidence.
* [ ] Impact.
* [ ] Recommended graph correction.
* [ ] Recommended harness correction.
* [ ] Verification query.

---

## 11.18 Global orchestration scoring

Add the following dimensions to the independent harness score:

* [ ] Ontological completeness.
* [ ] Ontological consistency.
* [ ] Topic coverage.
* [ ] Responsibility coverage.
* [ ] Skill-loading coherence.
* [ ] Recipe-delegation coherence.
* [ ] End-to-end path completeness.
* [ ] Graph traceability.
* [ ] Graph queryability.
* [ ] Current-state to target-state explainability.
* [ ] Orchestration bottleneck control.
* [ ] Incremental maintainability.

A HIGH result requires:

* [ ] No unexplained orphan active components.
* [ ] No unbounded recipe cycles.
* [ ] No mandatory responsibility without an accountable agent.
* [ ] No mandatory delegated task without required skills.
* [ ] No mandatory artifact without a consumer.
* [ ] No critical path bypassing verification.
* [ ] No unresolved ontology contradiction affecting a core flow.
* [ ] Complete provenance for critical graph assertions.
* [ ] A reproducible current-state graph.
* [ ] A reproducible target-state graph.

---

## 11.19 Global orchestration audit checklist

The complementary audit is complete only when:

* [ ] The TBox is defined.
* [ ] The ABox is populated.
* [ ] Node types are documented.
* [ ] Relationship types are documented.
* [ ] Domain and range constraints are documented.
* [ ] Integrity constraints are implemented or specified.
* [ ] Skills are represented.
* [ ] Skill topics are represented.
* [ ] Agents are represented.
* [ ] Agent topics are represented.
* [ ] Agent responsibilities are represented.
* [ ] Agent-loaded skills are represented.
* [ ] Recipes are represented.
* [ ] Recipe topics are represented.
* [ ] Recipe delegated tasks are represented.
* [ ] Recipe-involved agents are represented.
* [ ] Artifacts are represented.
* [ ] Handoffs are represented.
* [ ] Lifecycle phases are represented.
* [ ] Beads Epics, tasks and gates are represented.
* [ ] Findings and decisions are represented.
* [ ] Current-state orchestration paths are represented.
* [ ] Target-state orchestration paths are represented.
* [ ] Graph consistency checks were executed.
* [ ] Graph reasoning queries were executed.
* [ ] Graph-derived findings were recorded.
* [ ] Current-state and target-state graphs were compared.
* [ ] The graph is exportable.
* [ ] The graph is importable.
* [ ] The graph is traversable.
* [ ] The graph is queryable.
* [ ] Evidence and provenance are preserved.
* [ ] The graph can be incrementally updated.

---

# Additions to required final deliverables

Add the following items to the required final deliverables checklist:

* [ ] Harness ontology TBox.
* [ ] Harness instance graph ABox.
* [ ] Node-type catalogue.
* [ ] Relationship-type catalogue.
* [ ] Ontological integrity constraints.
* [ ] Topic taxonomy.
* [ ] Responsibility ontology.
* [ ] Recipe delegation graph.
* [ ] Agent-to-skill loading graph.
* [ ] End-to-end orchestration graph.
* [ ] Current-state knowledge graph.
* [ ] Target-state knowledge graph.
* [ ] Current-state versus target-state graph diff.
* [ ] Machine-readable graph export.
* [ ] Graph import procedure.
* [ ] Graph query catalogue.
* [ ] Graph reasoning results.
* [ ] Graph metrics and bottleneck analysis.
* [ ] Graph-derived findings.
* [ ] Incremental graph-maintenance strategy.

---

# Additions to final closure checklist

Add the following items to the final closure checklist:

* [ ] The ontological TBox was validated.
* [ ] The ABox conforms to the TBox.
* [ ] Every active skill is connected to a topic, agent, recipe or justified cross-cutting use.
* [ ] Every active agent is connected to responsibilities, loaded skills and invoking recipes.
* [ ] Every active recipe is connected to topics, involved agents and delegated tasks.
* [ ] Every delegated task is connected to an agent and required skills.
* [ ] Every mandatory artifact has a producer and a consumer.
* [ ] Every mandatory lifecycle phase has a traversable orchestration path.
* [ ] No core path contains an unexplained dead end.
* [ ] No core path contains an unbounded cycle.
* [ ] No critical assertion lacks provenance.
* [ ] Explicit and inferred relationships are distinguishable.
* [ ] Current-state and target-state graphs are both reproducible.
* [ ] Target-state graph changes are traceable to findings and decisions.
* [ ] Required graph queries were executed successfully.
* [ ] Graph-derived findings were included in the remediation plan.
* [ ] The graph supports incremental updates without full reconstruction.

---

# 12. Finding detection

Search for:

* [ ] `BROKEN`
* [ ] `GAP`
* [ ] `INCONSISTENCY`
* [ ] `DRIFT`
* [ ] `AMBIGUITY`
* [ ] `DUPLICATION`
* [ ] `UNREACHABLE`
* [ ] `MISSING_GATE`
* [ ] `BROKEN_HANDOFF`
* [ ] `BROKEN_TRACEABILITY`
* [ ] `OVER_ENGINEERING`
* [ ] `UNDER_ENGINEERING`
* [ ] `PERFORMANCE_ISSUE`
* [ ] `UNNECESSARY_LLM_CALL`
* [ ] `UNCONSUMED_OUTPUT`
* [ ] `SELF_APPROVAL_RISK`
* [ ] `IMPROVEMENT`

Each finding must include:

* [ ] Unique ID
* [ ] Title
* [ ] Category
* [ ] Severity
* [ ] Confidence
* [ ] Affected layer
* [ ] Affected files
* [ ] Expected behavior
* [ ] Observed behavior
* [ ] Direct evidence
* [ ] Impact
* [ ] Likely root cause
* [ ] Recommended target state
* [ ] Acceptance criteria
* [ ] Verification method
* [ ] Dependencies
* [ ] Proposed owner
* [ ] Separate SDD-cycle requirement
* [ ] Blocking status
* [ ] Deferred status
* [ ] Expected quality benefit
* [ ] Expected performance benefit

Use:

```yaml
id:
title:
category:
severity:
confidence:
status:
affected_layer:
affected_files:
expected_behavior:
observed_behavior:
evidence:
impact:
root_cause:
target_state:
acceptance_criteria:
verification:
dependencies:
proposed_owner:
requires_separate_sdd_cycle:
blocking:
deferred:
expected_quality_benefit:
expected_performance_benefit:
```

Do not report a finding without direct evidence.

---

# 13. Adversarial challenge

Assign at least:

* [ ] `review-critic`
* [ ] `principal-engineer`

They must challenge:

* [ ] The SDD reference model.
* [ ] The inventory.
* [ ] Every critical finding.
* [ ] Every high finding.
* [ ] Severity assignments.
* [ ] Confidence assignments.
* [ ] Root-cause analysis.
* [ ] Target-state recommendations.
* [ ] Unsupported assumptions.
* [ ] False positives.
* [ ] False equivalence with Spec Kit.
* [ ] Unnecessary complexity.
* [ ] Over-engineering.
* [ ] Missing simpler alternatives.
* [ ] Performance assumptions.
* [ ] Token-cost assumptions.
* [ ] Operational constraints.
* [ ] Migration risks.

For every disagreement:

* [ ] Record original claim.
* [ ] Record challenge.
* [ ] Record evidence for both positions.
* [ ] Record orchestrator resolution.
* [ ] Record unresolved points.
* [ ] Update the finding where required.

Do not silently merge conflicting conclusions.

---

# 14. Independent judging and scoring

The `harness-judge` must be independent from the agents that authored or implemented the evaluated work.

Score from 0 to 5:

* [ ] Lifecycle completeness
* [ ] Artifact traceability
* [ ] Agent-responsibility clarity
* [ ] Handoff quality
* [ ] Collegial aggregation
* [ ] Beads integration
* [ ] Goose recipe executability
* [ ] Verification integrity
* [ ] Specification-drift management
* [ ] Maintainability
* [ ] Observability
* [ ] Auditability
* [ ] Protection against self-approval
* [ ] Failure handling
* [ ] Recovery and retry control
* [ ] Token efficiency
* [ ] Runtime efficiency
* [ ] Context efficiency
* [ ] Architectural simplicity

Domain G — Global ontology and orchestration graph:

* [ ] Ontological completeness
* [ ] Ontological consistency
* [ ] TBox quality and constraint coverage
* [ ] ABox completeness and evidence provenance
* [ ] Topic taxonomy quality
* [ ] Responsibility coverage and ownership consistency
* [ ] Agent-to-skill loading coherence
* [ ] Recipe delegation coherence
* [ ] End-to-end orchestration path completeness
* [ ] Graph queryability and reproducibility
* [ ] Current-state to target-state explainability
* [ ] Orchestration bottleneck and single-point-of-failure control
* [ ] Incremental graph maintainability

Domain G hard gates:

* [ ] Missing TBox or ABox caps Domain G at FAIL.
* [ ] Missing provenance for critical assertions caps Domain G at PARTIAL.
* [ ] An unexplained orphan mandatory component caps Domain G at PARTIAL.
* [ ] An unbounded core recipe cycle caps the global verdict at FAIL.
* [ ] A mandatory path bypassing verification caps the global verdict at FAIL.
* [ ] A responsibility without an accountable owner caps Domain G at PARTIAL.
* [ ] A delegated task without an assigned capable agent caps Domain G at PARTIAL.

For every score:

* [ ] Provide score.
* [ ] Provide evidence.
* [ ] Explain deficiencies.
* [ ] Explain how to raise the score.
* [ ] Identify blocking findings.

Convert to a score out of 100.

Ratings:

* [ ] `0–49`: LOW
* [ ] `50–74`: MEDIUM
* [ ] `75–89`: ACCEPTABLE
* [ ] `90–100`: HIGH

Rules:

* [ ] A critical finding caps the rating at MEDIUM.
* [ ] A broken core executable flow caps the rating at LOW.
* [ ] Missing independent verification caps the rating at MEDIUM.
* [ ] Missing evidence prevents a HIGH rating.
* [ ] An architecture with unresolved circular ownership cannot receive HIGH.
* [ ] A harness with significant orphan agents, skills or recipes cannot receive HIGH.

---

# 15. Target architecture alternatives

Propose at least three target architectures.

## 15.1 Minimal architecture

* [ ] Smallest coherent harness.
* [ ] Lowest justified number of agents.
* [ ] Lowest justified number of skills.
* [ ] Lowest justified number of recipes.
* [ ] Essential gates only.
* [ ] Optimized for speed and low token cost.

## 15.2 Balanced architecture

* [ ] Balanced expertise.
* [ ] Balanced assurance.
* [ ] Controlled agent count.
* [ ] Reusable skills.
* [ ] Coherent SDD lifecycle.
* [ ] Recommended default for normal projects.

## 15.3 High-assurance architecture

* [ ] Strong independent review.
* [ ] Strong audit trail.
* [ ] Explicit human gates where appropriate.
* [ ] Suitable for regulated, critical or high-risk projects.
* [ ] Higher cost accepted only when justified.

For each alternative:

* [ ] Agents retained.
* [ ] Agents added.
* [ ] Agents removed.
* [ ] Agents merged.
* [ ] Skills retained.
* [ ] Skills added.
* [ ] Skills removed.
* [ ] Skills merged.
* [ ] Recipes retained.
* [ ] Recipes added.
* [ ] Recipes removed.
* [ ] Recipes merged.
* [ ] Lifecycle phases.
* [ ] Mandatory gates.
* [ ] Expected agent calls.
* [ ] Expected token cost.
* [ ] Expected runtime.
* [ ] Expected complexity.
* [ ] Expected assurance level.
* [ ] Advantages.
* [ ] Drawbacks.
* [ ] Migration effort.
* [ ] Appropriate project types.

Use:

| Dimension              | Minimal | Balanced | High assurance |
| ---------------------- | ------: | -------: | -------------: |
| Number of agents       |         |          |                |
| Number of core skills  |         |          |                |
| Number of core recipes |         |          |                |
| Mandatory gates        |         |          |                |
| Expected LLM calls     |         |          |                |
| Token cost             |         |          |                |
| Runtime                |         |          |                |
| Execution complexity   |         |          |                |
| Assurance level        |         |          |                |
| Recommended usage      |         |          |                |

Select one recommended architecture.

The recommendation must:

* [ ] Explain why it is preferred.
* [ ] Explain why alternatives were not selected.
* [ ] List additions.
* [ ] List removals.
* [ ] List mergers.
* [ ] List renames.
* [ ] List changed responsibilities.
* [ ] Show the end-to-end flow.
* [ ] Show the collaboration model.
* [ ] Show the Beads workflow.
* [ ] Show the Goose recipe graph.
* [ ] Estimate quality impact.
* [ ] Estimate token impact.
* [ ] Estimate runtime impact.
* [ ] Provide migration phases.
* [ ] Provide rollback options.

---

# 16. Beads remediation plan

Create:

* [ ] One audit Epic.
* [ ] One remediation Epic proposal.
* [ ] One task per independently verifiable correction.
* [ ] Explicit dependencies.
* [ ] Explicit owners.
* [ ] Explicit acceptance criteria.
* [ ] Explicit verification evidence.

Required gates:

* [ ] `Audit Evidence Complete`
* [ ] `Target State Approved`
* [ ] `Implementation Ready`
* [ ] `Verification Complete`
* [ ] `Independent Review Complete`

For every task:

* [ ] Link to the active Epic.
* [ ] Link to findings.
* [ ] Provide description.
* [ ] Provide owner.
* [ ] Provide dependencies.
* [ ] Provide acceptance criteria.
* [ ] Provide verification.
* [ ] Provide expected artifacts.
* [ ] Provide completion evidence.
* [ ] Mark human approval requirement.
* [ ] Mark separate SDD-cycle requirement.
* [ ] Mark deferred status.

---

# 17. Standard per-task workflow

For each approved checklist task or finding, follow this workflow.

## 17.1 Remember

* [ ] Restate the relevant meaning of SDD.
* [ ] Reload the relevant external knowledge from section 6.
* [ ] Reload the relevant local Spec Kit knowledge from section 7.
* [ ] Reload relevant previous findings and decisions.
* [ ] Avoid repeating repository-wide analysis unnecessarily.

## 17.2 Explain

* [ ] Explain the current task.
* [ ] Explain the current problem.
* [ ] Explain its impact.
* [ ] Explain expected behavior.
* [ ] Explain acceptance criteria.
* [ ] Explain relevant constraints.

## 17.3 Explore

* [ ] Inspect affected local files.
* [ ] Inspect upstream dependencies.
* [ ] Inspect downstream dependencies.
* [ ] Inspect related agents.
* [ ] Inspect related skills.
* [ ] Inspect related recipes.
* [ ] Inspect related Beads tasks.
* [ ] Fetch additional web resources when necessary.
* [ ] Update evidence.
* [ ] Avoid unrelated exploration.

## 17.4 Challenge

* [ ] Challenge the current implementation.
* [ ] Challenge the assumed root cause.
* [ ] Challenge the proposed solution.
* [ ] Search for simpler solutions.
* [ ] Search for compatibility risks.
* [ ] Search for regressions.
* [ ] Search for over-engineering.
* [ ] Search for performance regressions.
* [ ] Confirm the target state.

## 17.5 Plan with Beads

* [ ] Create or update tasks in the active Epic.
* [ ] Describe tasks.
* [ ] Assign owners.
* [ ] Define dependencies.
* [ ] Define acceptance criteria.
* [ ] Define verification methods.
* [ ] Define rollback.
* [ ] Confirm readiness.
* [ ] Do not include unrelated `bd list` tasks.

## 17.6 Implement

Only in `REMEDIATE_APPROVED` mode:

* [ ] Implement active-Epic tasks.
* [ ] Respect dependencies.
* [ ] Respect WIP limits.
* [ ] Update documentation.
* [ ] Update tests.
* [ ] Preserve compatibility where required.
* [ ] Record implementation evidence.

## 17.7 Verify

* [ ] Validate syntax.
* [ ] Validate schemas.
* [ ] Validate references.
* [ ] Validate behavior.
* [ ] Validate integration.
* [ ] Validate handoffs.
* [ ] Validate Beads gates.
* [ ] Validate Goose execution.
* [ ] Validate documentation consistency.
* [ ] Validate acceptance criteria.
* [ ] Record evidence.

## 17.8 Independent review

* [ ] Assign an independent reviewer.
* [ ] Assign the harness judge.
* [ ] Review implementation.
* [ ] Review tests.
* [ ] Review evidence.
* [ ] Review specification alignment.
* [ ] Review regressions.
* [ ] Record dissent.
* [ ] Resolve or record disagreement.

## 17.9 Re-evaluate

* [ ] Re-score affected dimensions.
* [ ] Re-score the harness when appropriate.
* [ ] Compare before and after.
* [ ] Record remaining findings.
* [ ] Record newly introduced findings.
* [ ] Determine whether another loop is required.

Exit conditions:

* [ ] HIGH: exit successfully.
* [ ] ACCEPTABLE: exit with documented residual risks.
* [ ] MEDIUM: execute another loop when permitted.
* [ ] LOW: execute another loop when permitted.
* [ ] Maximum loops reached: mark `BLOCKED`.

---

# 18. Required final deliverables

The final output must include:

* [ ] Executive summary
* [ ] Audit scope
* [ ] Execution mode
* [ ] Preconditions report
* [ ] External SDD principles
* [ ] Local Spec Kit reference model
* [ ] Canonical SDD lifecycle
* [ ] Complete L1 skills inventory
* [ ] Complete L2 agent inventory
* [ ] Complete L3 recipe inventory
* [ ] Complete current agent list
* [ ] Agent responsibility matrix
* [ ] Skills-to-agents matrix
* [ ] Agents-to-recipes matrix
* [ ] SDD phase-coverage matrix
* [ ] Artifact production and consumption graph
* [ ] Agent handoff graph
* [ ] Recipe invocation graph
* [ ] Beads task and gate model
* [ ] Collegial-work assessment
* [ ] Findings register
* [ ] Critical and high-risk summary
* [ ] Performance and cost analysis
* [ ] Component KEEP/MERGE/REMOVE decisions
* [ ] Adversarial-review results
* [ ] Independent judge score
* [ ] Domain G score and hard-gate results
* [ ] Harness ontology TBox
* [ ] Harness instance graph ABox
* [ ] Node-type catalogue
* [ ] Relationship-type catalogue
* [ ] Ontological integrity constraints
* [ ] Topic taxonomy
* [ ] Responsibility ontology
* [ ] Recipe delegation graph
* [ ] Agent-to-skill loading graph
* [ ] End-to-end orchestration graph
* [ ] Current-state knowledge graph
* [ ] Target-state knowledge graph
* [ ] Current-state versus target-state graph diff
* [ ] Machine-readable graph export
* [ ] Graph import procedure
* [ ] Graph query catalogue and results
* [ ] Graph metrics and bottleneck analysis
* [ ] Graph-derived findings
* [ ] Incremental graph-maintenance strategy
* [ ] Minimal target architecture
* [ ] Balanced target architecture
* [ ] High-assurance target architecture
* [ ] Recommended target architecture
* [ ] Proposed remediation Epic
* [ ] Proposed remediation tasks
* [ ] Dedicated proposals for C2, C4, D7 and WCAG
* [ ] Migration plan
* [ ] Rollback plan
* [ ] Known uncertainties
* [ ] Unverified assumptions
* [ ] Final completion checklist

---

# 19. Final closure checklist

Before concluding:

* [ ] All specified paths were checked.
* [ ] All directories were inspected recursively.
* [ ] Missing paths were reported.
* [ ] All applicable checklist items have a status.
* [ ] No applicable item remains silently unchecked.
* [ ] All blocked items contain reasons.
* [ ] All uncertain items contain uncertainty details.
* [ ] All findings contain evidence.
* [ ] All critical findings were challenged.
* [ ] All high findings were challenged.
* [ ] The judge remained independent.
* [ ] Current agents, skills and recipes were not presumed necessary.
* [ ] Add/remove/merge decisions were produced.
* [ ] No unrelated Beads task was executed.
* [ ] No unrestricted `bd list` queue was implemented.
* [ ] Facts and interpretations were separated.
* [ ] External recommendations were identified.
* [ ] Remaining risks were documented.
* [ ] Overall score was calculated.
* [ ] The result is reproducible.
* [ ] The recommended target flow is coherent.
* [ ] The recommended target flow is performant.
* [ ] The recommended target flow has no known dead-end artifacts.
* [ ] Every mandatory output has a consumer.
* [ ] Every phase has entry and exit criteria.
* [ ] Every blocking gate has a clear owner.
* [ ] Every retry loop has a limit.
* [ ] Domain G was scored independently with evidence.
* [ ] The TBox was validated.
* [ ] The ABox conforms to the TBox.
* [ ] Every active skill is connected to a topic, agent, recipe or justified cross-cutting use.
* [ ] Every active agent is connected to responsibilities, loaded skills and invoking recipes.
* [ ] Every active recipe is connected to topics, involved agents and delegated tasks.
* [ ] Every mandatory delegated task is connected to an assigned capable agent and required skills.
* [ ] Every mandatory artifact has a producer and consumer.
* [ ] Every mandatory lifecycle phase has a traversable orchestration path.
* [ ] No core path contains an unexplained dead end or unbounded cycle.
* [ ] No critical graph assertion lacks provenance.
* [ ] Current-state and target-state graphs are reproducible and comparable.
* [ ] Required graph queries were executed and graph-derived findings recorded.

Final status must be exactly one of:

* [ ] `AUDIT_COMPLETE`
* [ ] `AUDIT_COMPLETE_WITH_BLOCKERS`
* [ ] `AUDIT_INCOMPLETE`
* [ ] `REMEDIATION_PLANNED`
* [ ] `REMEDIATION_COMPLETE`
* [ ] `REMEDIATION_COMPLETE_WITH_RESIDUAL_RISKS`
* [ ] `REMEDIATION_BLOCKED`

Do not claim completion merely because files exist, agents are declared or recipes pass syntax validation.

Completion requires coherent, traceable, evidence-based and executable end-to-end behavior.