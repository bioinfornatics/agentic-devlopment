# Domain G — Global Ontology and Orchestration Graph

## Contents

1. Purpose
2. Required evidence
3. Rubric
4. Hard gates
5. Required queries
6. Report format

## 1. Purpose

Evaluate whether the harness is represented by a typed, evidence-backed, traversable and queryable graph that connects skills, topics, agents, responsibilities, loaded skills, recipes, delegated tasks, artifacts, gates, Beads work and lifecycle phases.

Judge the graph; do not construct or repair it while acting as Harness Judge.

## 2. Required evidence

Require, where applicable:

- TBox schema with node classes, relationships, domain/range and cardinalities.
- Current-state ABox with stable IDs, provenance and confidence.
- Current-state and target-state graph exports.
- Machine-readable representation and import/query instructions.
- Query results for orphan, cycle, dead-end, self-review, coverage and impact checks.
- Evidence links from graph assertions to repository paths and lines.
- Graph diff linked to findings and architectural decisions.

Missing evidence must be recorded as `not found`; do not infer graph quality from a polished diagram.

## 3. Rubric

| ID | Criterion | PASS | PARTIAL | FAIL |
|---|---|---|---|---|
| HJ061 | TBox completeness | Core classes, relations, direction, domain/range, cardinality and integrity rules exist | Material subset exists | No usable TBox |
| HJ062 | ABox conformance | Instances validate against TBox | Minor violations or incomplete validation | Core violations or no validation |
| HJ063 | Provenance and confidence | Critical assertions have path/line evidence; inferred assertions have confidence | Some noncritical omissions | Critical assertions untraceable |
| HJ064 | Skills/topics coverage | Skills and topics are normalized and connected to consumers | Partial coverage | Material orphan or uncontrolled labels |
| HJ065 | Agent responsibility coherence | Responsibilities, loaded skills, authority and review relations are coherent | Minor ambiguity | Missing owners, unsupported responsibilities or circular accountability |
| HJ066 | Recipe delegation coherence | Delegated tasks have agents, skills, inputs, outputs, consumers and verification | Some optional data missing | Core delegation mismatch or dead-end output |
| HJ067 | End-to-end path completeness | Intent-to-release core paths are traversable, bounded and gated | Noncritical path gaps | Broken, unbounded or verification-bypassing core path |
| HJ068 | Queryability | Machine-readable export and executable queries exist | Import/query steps need manual adaptation | Diagram only or no query path |
| HJ069 | Graph analysis | Cycles, orphans, dead ends, centrality and coverage metrics are evaluated and interpreted | Partial metrics | No structural analysis |
| HJ070 | Current-target explainability | Graph diff links changes to findings, decisions, benefit and migration impact | Partial linkage | Target graph is unsupported or unauditable |
| HJ071 | Incremental maintainability | Versioning and incremental update strategy exist | Manual but documented | Full rebuild only with no strategy |
| HJ072 | Ontology economy | Model is sufficient without needless classes/relations | Some avoidable complexity | Ontology bloat blocks use or reasoning |

## 4. Hard gates

- A critical assertion without provenance prevents Domain G PASS.
- A core orchestration path that bypasses mandatory verification prevents Domain G PASS.
- An unbounded core recipe cycle caps the overall verdict at FAIL.
- A mandatory responsibility without an accountable owner prevents Domain G PASS.
- A mandatory artifact without a consumer prevents Domain G PASS.
- Mermaid-only output cannot satisfy queryability.
- Current-state and target-state must not be conflated.

## 5. Required queries

Check evidence that queries were run for:

- agents and loaded skills;
- agents and responsibilities;
- recipes, involved agents and delegated tasks;
- unused skills and agents;
- responsibilities without owners;
- unsupported responsibilities and irrelevant loaded skills;
- self-review and circular accountability;
- artifacts without consumers;
- recipes invoking agents without consuming outputs;
- verification bypasses and gates without evidence;
- topic coverage gaps and excessive overlap;
- recipe invocation cycles;
- transitive impact of removing a skill or agent;
- all intent-to-release paths;
- current-state versus target-state differences.

## 6. Report format

Include:

- graph formats and revision;
- TBox/ABox status;
- score table HJ061-HJ072;
- integrity violations;
- graph-derived findings;
- bottlenecks and single points of failure;
- current-target diff quality;
- final Domain G verdict.
