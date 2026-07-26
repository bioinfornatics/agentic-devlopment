# Domain G — Global Ontology and Orchestration Graph

## Contents

1. Purpose
2. Required evidence
3. Rubric (HJ061-HJ072)
4. Hard gates
5. Required queries
6. Report format
7. Calibration anchors

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
- KG reasoner evidence when the repository contains `apps/kg`: `node apps/kg/dist/cli.js pipeline`, `node apps/kg/dist/cli.js reason --rules`, `.knowledge/memory.jsonl`, and `.knowledge/derived.jsonl`.
- Derived `HAS_STATUS` facts and inferred relations interpreted as audit evidence, not ignored as generated noise.
- Evidence links from graph assertions to repository paths and lines.
- Graph diff linked to findings and architectural decisions.

Missing evidence must be recorded as `not found`; do not infer graph quality from a polished diagram.

---

## 3. Rubric (HJ061-HJ072)

### HJ061 — TBox defines classes, relations, domain/range, cardinality and integrity rules

**Type:** Binary-presence

**What it measures:** Whether the ontology has a formal schema (TBox) that defines the vocabulary and constraints for the knowledge graph.

**PASS condition:**
- [ ] TBox document or schema file exists (e.g., `docs/knowledge-graph.md`, `.knowledge/schema.jsonld`).
- [ ] Node classes are explicitly defined (Skill, Agent, Recipe, Task, Artifact, Gate, etc.).
- [ ] Relationships have names, domain, and range (e.g., `LOADS_SKILL: Agent → Skill`).
- [ ] Cardinality constraints are stated where applicable (e.g., "Agent has 1..N mandatory skills").
- [ ] Integrity rules are documented (e.g., "No self-review: Agent cannot review its own output").

**PARTIAL condition:**
- TBox exists but is incomplete (e.g., classes defined but no relationships).
- Domain/range specified for some relationships but not all.
- No cardinality constraints.

**FAIL condition:**
- No TBox document or schema.
- Graph has nodes and edges but no defined vocabulary.
- Schema is only in prose comments, not structured.

**Evidence template:**
```
HJ061 TBox Definition
  Schema file: [path or not found]
  Classes defined: [count, list]
  Relationships defined: [count, list]
  Domain/range specified: [yes/no, %]
  Cardinality constraints: [yes/no, examples]
  Integrity rules: [yes/no, examples]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ062 — ABox instances conform to the TBox

**Type:** Binary-presence

**What it measures:** Whether the actual data (ABox) follows the schema rules defined in the TBox.

**PASS condition:**
- [ ] Every node instance uses a class defined in TBox.
- [ ] Every relationship instance uses a relationship type defined in TBox.
- [ ] Domain/range constraints are respected (no Agent→Agent where TBox says Agent→Skill).
- [ ] Cardinality constraints are satisfied.
- [ ] No orphan relationship types (used in ABox but undefined in TBox).

**PARTIAL condition:**
- Most instances conform but some use undefined types.
- Cardinality violations exist but are minor.

**FAIL condition:**
- ABox uses many undefined classes or relationships.
- Systematic domain/range violations.
- No validation mechanism to check conformance.

**Evidence template:**
```
HJ062 ABox Conformance
  ABox file: [path or not found]
  Instance count: [N nodes, M relationships]
  Undefined classes used: [list or none]
  Undefined relationships used: [list or none]
  Domain/range violations: [count, examples]
  Validation command: [command and result]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ063 — Graph assertions preserve provenance and inference confidence

**Type:** Gradient-quality

**What it measures:** Whether graph facts include metadata about where they came from and how confident the assertion is.

**PASS condition:**
- [ ] Each assertion has a `source` field (file path, line, command output).
- [ ] Inferred assertions have a `confidence` score or label.
- [ ] Provenance is machine-readable, not just prose comments.
- [ ] Distinction between observed facts and derived facts is explicit.

**PARTIAL condition:**
- Some assertions have provenance but not all.
- Confidence is implicit (e.g., inferred vs observed) but not scored.
- Provenance exists but is not structured.

**FAIL condition:**
- No provenance metadata.
- No distinction between observed and inferred facts.
- Assertions appear authoritative but have no evidence trail.

**Evidence template:**
```
HJ063 Provenance and Confidence
  Provenance fields present: [yes/no, %]
  Confidence scoring: [yes/no, scale used]
  Observed vs inferred distinction: [yes/no]
  Example assertion with provenance: [quote]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ064 — Skill and topic coverage is normalized and connected

**Type:** Gradient-quality

**What it measures:** Whether skills are organized by topics without gaps or overlaps, and whether the topic graph is connected.

**PASS condition:**
- [ ] Every skill is assigned to at least one topic.
- [ ] Topics form a connected graph (no isolated topic islands).
- [ ] No skill is orphaned (zero topics).
- [ ] Topic coverage is explicit (which topics have skills, which don't).
- [ ] Overlap between skill scopes is documented and intentional.

**PARTIAL condition:**
- Most skills have topics but some are orphaned.
- Topic graph has minor disconnections.
- Overlap exists but is not documented.

**FAIL condition:**
- No topic taxonomy.
- Many orphan skills.
- Topic graph is fragmented.

**Evidence template:**
```
HJ064 Skill/Topic Coverage
  Skills with topics: [N/M]
  Orphan skills: [list or none]
  Topic graph connected: [yes/no]
  Undocumented overlaps: [list or none]
  Coverage query result: [command and output]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ065 — Agent responsibilities, skills and authority are coherent

**Type:** Gradient-quality

**What it measures:** Whether each agent has clearly defined responsibilities that match its loaded skills and authority level.

**PASS condition:**
- [ ] Each agent has documented responsibilities (what it does).
- [ ] Each agent has documented skills it loads.
- [ ] Responsibilities align with skill capabilities.
- [ ] Authority boundaries are explicit (what agent CAN and CANNOT do).
- [ ] No responsibility gaps (something no agent owns).
- [ ] No responsibility conflicts (multiple agents claim same scope without coordination).

**PARTIAL condition:**
- Responsibilities documented but skills not linked.
- Some authority boundaries missing.
- Minor gaps or overlaps.

**FAIL condition:**
- No responsibility documentation.
- Skills loaded without clear purpose.
- Major gaps or conflicts.

**Evidence template:**
```
HJ065 Agent Coherence
  Agents with responsibilities: [N/M]
  Skills-to-responsibility mapping: [exists/missing]
  Authority boundaries: [exists/missing, examples]
  Responsibility gaps: [list or none]
  Responsibility conflicts: [list or none]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ066 — Recipe delegated tasks map to agents, skills, inputs, outputs and consumers

**Type:** Gradient-quality

**What it measures:** Whether recipes have complete delegation contracts that specify who does what with what input and who consumes the output.

**PASS condition:**
- [ ] Each recipe lists its delegated tasks.
- [ ] Each task maps to a specific agent or subrecipe.
- [ ] Each task specifies required inputs.
- [ ] Each task specifies expected outputs.
- [ ] Each output has an identified consumer (another task, user, artifact).
- [ ] Task dependencies are explicit.

**PARTIAL condition:**
- Tasks mapped to agents but inputs/outputs implicit.
- Some consumers not identified.
- Dependencies partially documented.

**FAIL condition:**
- No task mapping.
- Outputs have no identified consumers (dead ends).
- Circular dependencies without gates.

**Evidence template:**
```
HJ066 Recipe Delegation Map
  Recipe: [name]
  Tasks mapped: [N]
  Tasks with inputs: [N/M]
  Tasks with outputs: [N/M]
  Outputs with consumers: [N/M]
  Dead-end outputs: [list or none]
  Dependency cycles: [list or none]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ067 — Core end-to-end orchestration paths are complete, gated and bounded

**Type:** Gradient-quality

**What it measures:** Whether the main workflows have defined paths from start to end with gates and termination conditions.

**PASS condition:**
- [ ] Core paths are identified (e.g., spec→implement→review→verify→release).
- [ ] Each path has a start node and end node.
- [ ] Each transition has a gate condition.
- [ ] Each path has termination bounds (max iterations, timeout, success criteria).
- [ ] No path can bypass verification.
- [ ] Escalation paths exist for blocked states.

**PARTIAL condition:**
- Paths defined but some gates missing.
- Bounds exist but not consistently applied.
- Some paths can bypass verification with rationale.

**FAIL condition:**
- No defined paths.
- Unbounded loops possible.
- Verification can be bypassed without detection.

**Evidence template:**
```
HJ067 Orchestration Paths
  Core paths defined: [list]
  Paths with gates: [N/M]
  Paths with bounds: [N/M]
  Verification bypass possible: [yes/no, evidence]
  Escalation paths: [exist/missing]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ068 — Graph is machine-readable, importable and queryable

**Type:** Binary-presence

**What it measures:** Whether the graph can be loaded into a graph database or reasoner and queried programmatically.

**PASS condition:**
- [ ] Graph export exists in standard format (JSONLD, Turtle, GraphML, Cypher, Property JSON).
- [ ] Import instructions are documented.
- [ ] At least one query example is provided.
- [ ] Query tool or CLI exists (e.g., `node apps/kg/dist/cli.js`).
- [ ] Queries return structured results, not prose.

**PARTIAL condition:**
- Export exists but no import instructions.
- Query possible but not documented.
- Results require manual parsing.

**FAIL condition:**
- No machine-readable export.
- Graph only exists as Mermaid diagrams or prose.
- No query mechanism.

**Evidence template:**
```
HJ068 Machine-Readable Graph
  Export file: [path or not found]
  Format: [JSONLD/Turtle/etc or none]
  Import instructions: [path or not found]
  Query CLI: [command or not found]
  Example query result: [output or not found]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ069 — Structural graph analyses detect cycles, orphans, dead ends and bottlenecks

**Type:** Gradient-quality

**What it measures:** Whether automated analysis identifies structural problems in the graph.

**PASS condition:**
- [ ] Orphan detection query exists and has been run.
- [ ] Cycle detection query exists and has been run.
- [ ] Dead-end detection query exists and has been run.
- [ ] Bottleneck analysis exists (single points of failure).
- [ ] Results are documented with timestamps.
- [ ] Issues found are linked to remediation tasks.

**PARTIAL condition:**
- Some analyses exist but not all.
- Analyses run but results not documented.
- Issues found but not linked to remediation.

**FAIL condition:**
- No structural analyses.
- Problems are discovered ad-hoc, not systematically.

**Evidence template:**
```
HJ069 Structural Analysis
  Orphan detection: [run/not run, result]
  Cycle detection: [run/not run, result]
  Dead-end detection: [run/not run, result]
  Bottleneck analysis: [run/not run, result]
  Issues linked to remediation: [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ070 — Current-state and target-state graph diff is traceable to findings and decisions

**Type:** Gradient-quality

**What it measures:** Whether changes between current and target state are documented and justified.

**PASS condition:**
- [ ] Current-state graph export exists with timestamp.
- [ ] Target-state graph export exists (if planning phase).
- [ ] Diff between states is documented.
- [ ] Each diff item is linked to a finding or decision.
- [ ] Diff is reviewable (not just a binary "changed").

**PARTIAL condition:**
- States exist but diff is implicit.
- Some changes linked to findings but not all.
- Diff exists but is hard to review.

**FAIL condition:**
- No state snapshots.
- No diff mechanism.
- Changes are undocumented.

**N/A condition:** No target-state exists (audit-only mode).

**Evidence template:**
```
HJ070 State Diff
  Current-state export: [path, timestamp]
  Target-state export: [path or N/A]
  Diff document: [path or not found]
  Changes linked to findings: [N/M]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### HJ071 — Graph has versioning and incremental-maintenance strategy

**Type:** Gradient-quality

**What it measures:** Whether the graph is maintained over time, not just created once.

**PASS condition:**
- [ ] Graph exports are versioned (date, commit, or semver).
- [ ] Incremental update procedure exists (not full rebuild each time).
- [ ] Change triggers are defined (what causes a graph update).
- [ ] Maintenance is automated or has defined manual steps.
- [ ] Historical versions are retained for comparison.

**PARTIAL condition:**
- Versioning exists but no incremental updates.
- Procedure exists but is not automated.
- Some history retained but not systematic.

**FAIL condition:**
- No versioning.
- Full rebuild is the only option.
- No maintenance procedure.

**Evidence template:**
```
HJ071 Graph Maintenance
  Versioning scheme: [describe or not found]
  Incremental update: [exists/not exists]
  Change triggers: [documented/not documented]
  Automation: [exists/manual/not exists]
  Historical versions: [count or not retained]
  Score: PASS | PARTIAL | FAIL
```

---

### HJ072 — Ontology is economical and avoids unjustified complexity

**Type:** Gradient-quality

**What it measures:** Whether the ontology is appropriately sized for the domain, not over-engineered.

**PASS condition:**
- [ ] Each class is used by at least one instance.
- [ ] Each relationship type is used at least once.
- [ ] No redundant classes (two classes with same semantics).
- [ ] No redundant relationships (two relationships with same meaning).
- [ ] Complexity is justified by requirements (documented rationale for each element).

**PARTIAL condition:**
- Some unused classes/relationships but minor.
- Some redundancy but documented as intentional.
- Justification exists for most elements.

**FAIL condition:**
- Many unused schema elements.
- Significant redundancy.
- No justification for complexity.
- Schema copied from a template without adaptation.

**Evidence template:**
```
HJ072 Ontology Economy
  Classes defined: [N]
  Classes used: [M/N]
  Relationships defined: [N]
  Relationships used: [M/N]
  Redundancies: [list or none]
  Justification: [exists/missing]
  Score: PASS | PARTIAL | FAIL
```

---

## 4. Hard gates

| Gate | Condition | Effect |
|------|-----------|--------|
| No TBox | HJ061 = FAIL | Domain G cannot score PASS |
| No ABox | HJ062 = FAIL | Domain G cannot score PASS |
| Graph not queryable | HJ068 = FAIL | Domain G cannot score PASS |
| Verification bypassable | HJ067 detects bypass | Domain G capped at PARTIAL |

---

## 5. Required queries

When KG tooling is available (`apps/kg/`), run these queries and cite outputs:

```bash
# Bootstrap and reason
node apps/kg/dist/cli.js pipeline --output-dir .audit/kg
node apps/kg/dist/cli.js reason --rules

# Evidence files
cat .knowledge/memory.jsonl | head -50
cat .audit/kg/derived.jsonl | head -50
```

Required query types (run via CLI or document why blocked):

1. **Orphan skills:** Skills with no agent that loads them.
2. **Orphan agents:** Agents with no recipe that delegates to them.
3. **Dead-end outputs:** Artifact types produced but never consumed.
4. **Self-review paths:** Agent→Review→SameAgent cycles.
5. **Unbounded loops:** Paths with no max-iteration gate.
6. **Responsibility gaps:** Topics with no accountable agent.

---

## 6. Report format

```markdown
## Domain G — Ontology and Global Orchestration Graph

### Evidence Summary
- TBox: [path or not found]
- ABox: [path or not found]
- KG CLI available: [yes/no]
- Pipeline run: [command, exit code]
- Reasoner run: [command, exit code]

### Score Table
| ID | Criterion | Score | Evidence |
|----|-----------|-------|----------|
| HJ061 | TBox definition | | |
| HJ062 | ABox conformance | | |
| HJ063 | Provenance/confidence | | |
| HJ064 | Skill/topic coverage | | |
| HJ065 | Agent coherence | | |
| HJ066 | Recipe delegation map | | |
| HJ067 | Orchestration paths | | |
| HJ068 | Machine-readable | | |
| HJ069 | Structural analysis | | |
| HJ070 | State diff | | |
| HJ071 | Graph maintenance | | |
| HJ072 | Ontology economy | | |

### Hard Gate Status
- [ ] TBox exists (HJ061)
- [ ] ABox exists (HJ062)
- [ ] Graph queryable (HJ068)
- [ ] No verification bypass (HJ067)

### Domain G Verdict: PASS | PARTIAL | FAIL
```

---

## 7. Calibration anchors

### HJ061 PASS anchor
```
TBox file: docs/knowledge-graph.md
Classes: Skill (5 instances), Agent (13 instances), Recipe (19 instances), Task, Artifact, Gate
Relationships: LOADS_SKILL (Agent→Skill), DELEGATES_TO (Recipe→Agent), PRODUCES (Task→Artifact)
Domain/range: all specified
Cardinality: Agent requires 1+ skills, Recipe requires 0+ agents
Integrity: no self-review rule documented
```

### HJ068 PASS anchor
```
Export: .knowledge/derived.jsonl (JSONL format)
Import: node apps/kg/dist/cli.js bootstrap
Query: node apps/kg/dist/cli.js reason --rules
Result: {"type":"HAS_STATUS","subject":"skill:harness-judge","status":"active"}
```

### HJ072 FAIL anchor
```
Classes defined: 45
Classes used: 12
Unused classes: AbstractTask, MetaAgent, HyperRecipe, ... (33 unused)
Justification: "Copied from enterprise ontology template"
Verdict: FAIL — unjustified complexity
```

### HJ067 PARTIAL anchor
```
Core paths: spec→implement→review→verify→release
Gates: review→verify has gate, others implicit
Verification bypass: release can occur without verify if user says "skip" — documented exception
Verdict: PARTIAL — bypass possible with documented override
```
