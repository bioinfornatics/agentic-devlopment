# Domain G — Global orchestration and ontology audit

## Objective

Build a navigable, queryable, typed, evidence-backed graph of the complete agentic harness. Audit both declared architecture and actual orchestration behavior.

## Required views

- Current TBox: node types, relations, domains, ranges, cardinalities, integrity rules, and inference rules.
- Current ABox: observed skills, topics, agents, responsibilities, loaded skills, recipes, delegated tasks, artifacts, gates, work items, findings, and decisions.
- Target ABox: recommended retained, added, removed, merged, split, or redirected components and relations.
- Graph diff: all current-to-target changes with finding, decision, benefit, migration impact, and verification criteria.

## Required extraction

Extract recursively from skills, agents, recipes, subrecipes, templates, Beads data, documentation, and executable validation output. Record provenance and confidence.

At minimum represent:

- skills and skill topics;
- agents, agent topics, responsibilities, loaded skills, tools, inputs, and outputs;
- recipes, recipe topics, delegated tasks, involved agents, loaded skills, phases, gates, transitions, and Beads operations;
- artifacts, schemas, producers, consumers, handoffs, and aggregation rules;
- lifecycle phases, criteria, failure states, retry rules, and terminal states;
- findings, evidence, risks, decisions, and target-state recommendations.

## Required analyses

1. Topic and capability coverage.
2. Responsibility ownership and RACI coherence.
3. Skill-loading relevance.
4. Recipe delegation compatibility.
5. Artifact producer-consumer closure.
6. End-to-end orchestration path completeness.
7. Self-review and self-approval detection.
8. Orphan, dead-end, cycle, and bypass detection.
9. Bottleneck and single-point-of-failure analysis.
10. Repeated context loading, duplicate work, unnecessary LLM calls, and deterministic-check opportunities.
11. Current-versus-target drift.

## Graph metrics

Use in-degree, out-degree, degree and betweenness centrality, connected components, strongly connected components, cycle detection, orphan and dead-end detection, path length, topic coverage density, responsibility overlap, agent-to-skill ratio, recipe-to-agent ratio, artifact producer-consumer ratio, gate coverage, and verification coverage.

Interpret metrics with context; high centrality may indicate either legitimate orchestration or an unjustified bottleneck.

## Required deliverables

- TBox and ABox catalogues.
- Topic taxonomy and responsibility ontology.
- Current and target graphs.
- Machine-readable export in JSON-LD, Turtle, GraphML, Cypher, or documented property-graph JSON.
- Import instructions and query catalogue.
- Graph metrics and graph-derived findings.
- Incremental update strategy.
- Evidence and provenance report.

Mermaid may supplement documentation but cannot be the only machine-readable representation.
