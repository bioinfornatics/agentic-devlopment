# Harness ontology

## Core node types

- `harness:skill`, `harness:skill_topic`
- `harness:agent`, `harness:agent_topic`, `harness:responsibility`
- `harness:recipe`, `harness:recipe_topic`, `harness:delegated_task`
- `harness:subrecipe`, `harness:template`, `harness:tool`, `harness:command`
- `harness:lifecycle_phase`, `harness:workflow_step`
- `harness:entry_criterion`, `harness:exit_criterion`, `harness:gate`
- `harness:handoff`, `harness:aggregation_rule`, `harness:retry_rule`
- `harness:artifact`, `harness:artifact_type`, `harness:artifact_schema`
- `harness:evidence`, `harness:finding`, `harness:risk`
- `harness:architectural_decision`, `harness:target_state_decision`
- `harness:execution_evidence`, `harness:relation_assertion`
- `repository_file`, `repository_directory`

## Core relations

```text
harness:skill COVERS_TOPIC harness:skill_topic
harness:skill DEPENDS_ON harness:skill
harness:agent COVERS_TOPIC harness:agent_topic
harness:agent HAS_RESPONSIBILITY harness:responsibility
harness:agent LOADS_SKILL harness:skill
harness:agent PRODUCES harness:artifact
harness:agent CONSUMES harness:artifact
harness:agent HANDS_OFF_TO harness:agent
harness:agent REVIEWS harness:agent
harness:agent PARTICIPATES_IN harness:recipe
harness:recipe COVERS_TOPIC harness:recipe_topic
harness:recipe INVOLVES_AGENT harness:agent
harness:recipe LOADS_SKILL harness:skill
harness:recipe DELEGATES_TASK harness:delegated_task
harness:delegated_task ASSIGNED_TO harness:agent
harness:delegated_task REQUIRES_SKILL harness:skill
harness:recipe INVOKES_RECIPE harness:recipe
harness:recipe IMPLEMENTS_PHASE harness:lifecycle_phase
harness:recipe PRODUCES harness:artifact
harness:recipe CONSUMES harness:artifact
harness:recipe HAS_ENTRY_CRITERION harness:entry_criterion
harness:recipe HAS_EXIT_CRITERION harness:exit_criterion
harness:recipe BLOCKED_BY harness:gate
harness:artifact CONFORMS_TO harness:artifact_schema
harness:finding SUPPORTED_BY harness:evidence
harness:finding AFFECTS harness:skill|harness:agent|harness:recipe|harness:artifact|harness:lifecycle_phase
harness:architectural_decision ADDRESSES harness:finding
```

## Responsibility semantics

Model responsibilities as nodes. Use `ACCOUNTABLE_FOR`, `RESPONSIBLE_FOR`, `CONTRIBUTES_TO`, `CONSULTED_FOR`, `INFORMED_ABOUT`, `REVIEWS`, `APPROVES`, and `CHALLENGES` where the backend supports them.

Detect responsibilities without accountable owners, multiple unjustified accountable owners, missing reviewers, unsupported skills, duplicated ownership, self-approval, and circular accountability.

## Topics

Normalize topics into a taxonomy rather than uncontrolled tags. Support `BROADER_THAN`, `NARROWER_THAN`, `RELATED_TO`, `EQUIVALENT_TO`, and `CONFLICTS_WITH`.

At minimum cover SDD, requirements, clarification, architecture, planning, implementation, TDD, QA, review, verification, release, security, accessibility, UX, UI, design systems, observability, debugging, knowledge management, orchestration, multi-agent collaboration, Beads, Goose, performance, cost, governance, and auditability.
