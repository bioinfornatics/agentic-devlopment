---
name: knowledge-graph
description: Create, query, validate, and update the project knowledge graph for Spec-Driven Development and agentic-harness audits. Use for product traceability; agents, skills, recipes, topics, responsibilities, delegated tasks, artifacts, gates, and Beads orchestration analysis; TBox/ABox construction; current-versus-target graph comparison; blast-radius queries; integrity checks; or structural changes recorded in `.knowledge/memory.jsonl`. Always search before creating entities. Do not use when no graph query, update, or structural knowledge change is required.
metadata:
  version: 1.0.0
---

# Knowledge Graph — SDD and Harness Ontology

Use `.knowledge/memory.jsonl` as the typed project knowledge graph. Treat Goose builtin memory as contextual notes, never as a substitute for graph relations.

## Core protocol

1. Orient with `search_nodes("<domain keyword>")` before creating anything.
2. Open likely matches and reuse stable entities and aliases.
3. Select the `product:`, `harness:`, or `work:` ontology profile.
4. Create or enrich ABox instances using the TBox and relation catalogue.
5. Record provenance, graph view, status, and confidence.
6. Preserve contradictions as explicit findings; never overwrite them silently.
7. Validate the graph after every structural change.

Never create duplicate entities. Enrich existing entities with observations when they already exist.

## Namespaces

- `product:` — epics, features, stories, acceptance criteria, components, APIs, data models, tests, code, and specifications.
- `harness:` — skills, skill topics, agents, agent topics, responsibilities, recipes, recipe topics, delegated tasks, artifacts, phases, gates, findings, decisions, and execution evidence.
- `work:` — Beads epics, tasks, dependencies, assignees, gates, acceptance criteria, verification methods, and completion evidence.

## Buildtime and runtime boundary

Create structural nodes only for buildtime knowledge: specifications, source files, contracts, tests, agents, skills, recipes, responsibilities, topics, gates, and work-control structures.

Do not create raw runtime logs, sessions, requests, responses, credentials, tokens, or database rows as structural nodes. Record audit-grade executions as `harness:execution_evidence` nodes or observations containing command, timestamp, exit code, repository revision, and output hash.

## Mandatory metadata

Store these observations when applicable:

```text
scope:buildtime
source_kind:explicit|inferred|external|runtime_evidence
source_path:<repository-relative path>
source_lines:<start-end>
confidence:<0.0-1.0>
status:current|deprecated|proposed|contradictory
graph_view:current|target
version:<version or repository revision>
```

Rules:

- Use stable, unique identifiers.
- Distinguish explicit, inferred, external, and runtime-evidence assertions.
- Add confidence to every inferred assertion.
- Keep current-state and target-state assertions separate.
- Preserve deprecated and renamed entities when history matters.
- Link every file-backed buildtime entity to a `code_file`, `spec_file`, or `repository_file` node.

## Select the profile

Read only the references needed for the task:

- Product SDD traceability: `references/product-ontology.md`
- Harness agents, skills, recipes, topics, responsibilities, and orchestration: `references/harness-ontology.md`
- Relation direction, domain, range, and cardinality: `references/relation-catalogue.md`
- Integrity validation and completion gates: `references/integrity-constraints.md`
- Traversal, gap, blast-radius, and current/target queries: `references/query-cookbook.md`
- Full global orchestration audit procedure: `references/domain-g-audit.md`

For a structural harness audit, read the harness ontology, relation catalogue, integrity constraints, query cookbook, and Domain G procedure before concluding.

## MCP operations

The external knowledge-graph MCP commonly exposes:

```text
create_entities
create_relations
add_observations
delete_entities
delete_relations
delete_observations
read_graph
search_nodes
open_nodes
```

If relation properties are unsupported, represent a sourced relationship as a `harness:relation_assertion` entity with observations for subject, predicate, object, provenance, confidence, status, and graph view.

## Product SDD protocol

### Discover

Create or reuse `product:epic` and `product:feature` entities, then connect the epic to its features.

### Specify

Create user stories and acceptance criteria. Use stable criterion identifiers such as `[FEAT]-01`. Link criteria to their specification file.

### Plan

Create or reuse `work:beads_task` entities and connect them to the stories or criteria they track.

### Implement

Create components, API endpoints, data models, tests, and code-file entities. Link implementations to stories and file locations.

### Review and verify

Query for missing criteria, tests, file links, producers, consumers, and validation evidence. Record test execution as evidence or observations, not as raw runtime entities.

## Harness update protocol

After changing a skill, agent, recipe, responsibility, topic, artifact, or gate:

1. Search for the current entity and aliases.
2. Update file, topics, responsibilities, loaded skills, inputs, outputs, and lifecycle phases.
3. Update delegated-task, artifact, handoff, gate, and work-control relations.
4. Mark obsolete relations deprecated; delete only when history is unnecessary.
5. Update current and proposed target views independently.
6. Run `scripts/validate_graph.py` against the exported JSONL graph.

## Minimum traversable orchestration path

The harness graph must support:

```text
User intent
→ lifecycle phase
→ recipe
→ delegated task
→ agent
→ responsibility
→ required or loaded skill
→ topic
→ produced artifact
→ consumer
→ verification method
→ gate
→ work-task completion
→ next lifecycle phase
```

Every mandatory path must terminate or reach an explicit bounded failure, retry, or escalation state.

## Evidence and contradiction policy

For every substantial assertion, record file and line evidence when available. Separate facts, inference, external principles, recommendations, and uncertainty.

Represent contradictions explicitly with `harness:finding`, `harness:conflict`, or `harness:relation_assertion` nodes. Do not silently choose one assertion and discard the other.

## Goose memory boundary

Goose builtin memory is flat contextual memory. Use it only for compact summaries such as the current SDD phase, active Beads task IDs, project conventions, and short component summaries.

Keep structural truth, typed relations, traversal, blast-radius analysis, and current/target comparison in the external graph.

## Completion checklist

- [ ] Search before creating.
- [ ] Use the correct namespace and entity type.
- [ ] Validate relation direction, domain, range, and cardinality.
- [ ] Add source path and lines where available.
- [ ] Distinguish explicit and inferred assertions.
- [ ] Add confidence to inferred assertions.
- [ ] Keep current and target views distinct.
- [ ] Link file-backed entities to file nodes.
- [ ] Link mandatory artifacts to producers and consumers.
- [ ] Link delegated tasks to recipes, agents, responsibilities, and required skills.
- [ ] Preserve contradictions as findings or relation assertions.
- [ ] Validate the graph after structural changes.
- [ ] Create Beads follow-up only when remediation is outside the authorized scope.

## When to load references

Load supporting reference files only when deeper implementation detail is required:

- load references/domain-g-audit.md — use when the task needs detailed domain g audit guidance.
- load references/harness-ontology.md — use when the task needs detailed harness ontology guidance.
- load references/integrity-constraints.md — use when the task needs detailed integrity constraints guidance.
- load references/product-ontology.md — use when the task needs detailed product ontology guidance.
- load references/query-cookbook.md — use when the task needs detailed query cookbook guidance.
- load references/relation-catalogue.md — use when the task needs detailed relation catalogue guidance.
