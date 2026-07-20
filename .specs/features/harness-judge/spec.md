# Spec: Harness Judge

> Status: Retro-spec (brownfield)
> Created: 2026-07-19
> Scope: feat-harness-judge

## Context
The harness judge provides evidence-first evaluation for the agentic development harness across skills, agents, recipes, SDD/TDD/GDD flow, orchestration, layer-delta value, and ontology integrity. It exists to audit completed artifacts or trajectories without mutating project state or approving its own remediation.

## Acceptance Criteria

### HJ-01 — Evidence-first scoring
WHEN `harness-judge` evaluates a completed harness artifact or transcript
THEN it SHALL identify subject, evaluation mode, applicable domains, and criterion types before emitting an aggregate verdict
AND every PASS, PARTIAL, FAIL, or N/A score SHALL cite observable evidence or explicit `not found`.

### HJ-02 — Read-only audit boundary
WHEN `harness-judge` is invoked for an audit
THEN it SHALL NOT modify tracked source files, Beads issues, memories, generated documentation, or external systems
AND it MAY emit remediation recommendations only as audit findings, not implement them or self-approve fixes.

### HJ-03 — Layer and orchestration correctness
WHEN `harness-judge` evaluates skills, agents, recipes, or layer-delta runs
THEN it SHALL compare each subject to the correct lower layer baseline
AND it SHALL check that recipes follow AD-001, eval JSON lists only in-session agents, required skills are loaded before use, and SDD/TDD/GDD evidence is traceable by stable IDs where applicable.


### HJ-04 — KG reasoning evidence for Domain G
WHEN `harness-judge` or `harness-audit` scores Domain G and `apps/kg` is available
THEN it SHALL run or cite `node apps/kg/dist/cli.js pipeline` and `node apps/kg/dist/cli.js reason --rules`
AND it SHALL inspect `.knowledge/memory.jsonl` and `.knowledge/derived.jsonl`
AND open derived `HAS_STATUS` facts SHALL be reflected in graph query results, findings, or an explicit N/A/blocker rationale.

### HJA-01 — Non-mutating KG evidence
WHEN harness-audit or harness-judge collects Domain G evidence
THEN it SHALL run KG pipeline evidence through an explicit audit output path rather than writing `.knowledge/derived.jsonl`
AND `git status --short .knowledge` SHALL remain unchanged after evidence collection.

### HJA-02 — Read-only Beads evidence
WHEN harness-audit or harness-judge collects Beads workflow evidence
THEN it SHALL use direct `.beads/issues.jsonl` parsing or another proven read-only adapter
AND `.beads` SHALL remain unchanged after evidence collection.

### HJA-03 — Delegate fallback
WHEN a delegated evidence collector returns empty, max-action, or fact-free output for a mandatory partition
THEN the audit SHALL record the delegate as blocked and replace it with deterministic command extraction
AND no mandatory checklist item SHALL depend only on the failed delegate response.

### HJA-04 — Ephemeral audit output policy
WHEN audit artifacts are written under `.audit/`
THEN `.audit/` SHALL be treated as ephemeral ignored output unless a future decision explicitly versions an audit package
AND audit preflight SHALL fail or substitute a temporary directory if the requested output path is neither ignored nor explicitly versioned.
