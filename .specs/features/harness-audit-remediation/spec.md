# Harness Audit Remediation Specification

## Intent

Restore deterministic coherence across lifecycle recipes, declared recipe inventory, knowledge-graph conformance, and read-only work-control evidence without expanding the harness ontology.

## Acceptance criteria

### [HAR-01] Canonical lifecycle
WHEN `/dev` runs a non-trivial change THEN it SHALL order RED test → code → local validation → review → gated verification → memory, and gated verification SHALL require `env:reviewed`.

### [HAR-02] Recipe path consistency
WHEN recipe declarations, installer metadata, workflow metadata, or tests advertise an entrypoint THEN the corresponding top-level recipe file SHALL exist and every subrecipe path SHALL resolve.

### [HAR-03] KG conformance
WHEN the canonical knowledge graph is validated THEN entity names SHALL be unique, every relation endpoint SHALL resolve, and emitted agent/recipe skill relations SHALL use the canonical `LOADS_SKILL` vocabulary.

### [HAR-04] Read-only Beads evidence
WHEN the evidence adapter reads current Beads JSONL THEN it SHALL report `issue_type`, nested `dependencies`, parent/epic links, readiness, and blocked/dependent state without mutating the source.

### [HAR-05] Deterministic regression gates
WHEN harness validation runs THEN automated tests SHALL reject lifecycle inversion, dangling recipe paths, invalid KG endpoints, and Beads schema regressions.

### [HAR-06] Evaluation traceability
WHEN AC-EVAL-03, AC-EVAL-04, and AC-EVAL-05 are inspected in the KG THEN each SHALL have executable test evidence through a canonical validation relation.

## Non-goals

- Adding replacement recipes merely to preserve stale names.
- Expanding the ontology beyond aliases/entities needed for current conformance.
- Running costly full-roster A/B evaluations without provider availability.
