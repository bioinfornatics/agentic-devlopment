# Spec: Clarify Phase — Explicit Clarify Artifact

> Status: Active
> Created: 2026-07-19
> Scope: feat-clarify-phase

## Context

The SDD workflow currently jumps from `discover.yaml` (problem statement + user stories) directly
to `spec.yaml` (formal WHEN/THEN/SHALL acceptance criteria). For Complex and Large scope features,
this leaves ambiguities, gray areas, and unresolved implicit-requirement dimensions embedded as
prose in `discovery.md` — where they are invisible to the spec writer and cause expensive
spec-gap loops discovered during TDD. The Clarify phase closes this gap with an explicit,
structured artifact that resolves every ambiguity before spec writing begins.

## Acceptance Criteria

### CLARIFY-01 — Recipe exists and validates

WHEN `goose recipe validate .goose/recipes/clarify.yaml` runs
THEN the command exits with code 0 and reports zero validation failures
AND the recipe file is present at `.goose/recipes/clarify.yaml`

### CLARIFY-02 — Slash command registered

WHEN `./scripts/install.sh` runs on a clean environment
THEN `/clarify` is registered in `~/.config/goose/config.yaml`
AND it maps to the installed `clarify.yaml` recipe path

### CLARIFY-03 — Requires discovery artifact as precondition

WHEN `clarify.yaml` is invoked with a feature name
AND `.specs/features/[feature]/discovery.md` does NOT exist
THEN the recipe STOPS and directs the user to run `/discover` first
AND NO clarify artifact is written

### CLARIFY-04 — Produces a clarify.md artifact

WHEN `clarify.yaml` is invoked with a feature name
AND `.specs/features/[feature]/discovery.md` exists
THEN a `clarify.md` file is written at `.specs/features/[feature]/clarify.md`
AND the file contains at least one `CLARIFY-NN` section

### CLARIFY-05 — Clarify artifact uses QUESTION/DECISION/RATIONALE/SPEC-IMPACT format

WHEN `clarify.md` is produced by the clarify recipe
THEN every clarification entry uses the following format:

```
### [FEAT]-CLR-NN — [Short ambiguity title]
CONTEXT:     [trigger — quoted or paraphrased from discovery.md]
QUESTION:    [the precise question resolved]
DECISION:    [the concrete, testable answer]
RATIONALE:   [one sentence: why this decision]
SPEC IMPACT: [WHEN/THEN clause or constraint this decision unlocks]
```

AND every `DECISION` field contains a concrete, testable value (not "depends on context" or similar)

### CLARIFY-06 — Covers all open questions from discovery.md

WHEN `clarify.yaml` runs against a `discovery.md` that contains open questions or N/A dimensions
THEN every item marked as "open", "TBD", or "??" in `discovery.md` is represented
as a `[FEAT]-CLR-NN` entry in `clarify.md`
AND each entry has a non-empty DECISION field

### CLARIFY-07 — Escalates unresolvable ambiguities

WHEN an ambiguity cannot be resolved by the agent alone
THEN the clarify recipe marks it as `STATUS: Blocked` in the clarify.md entry
AND reports it to the user with a specific question before completing the artifact

### CLARIFY-08 — SDD routing updated

WHEN `.goose/recipes/sdd.yaml` is invoked with a feature that has `discovery.md` but no `spec.md`
THEN the sdd recipe includes `clarify` as the phase between Discover and Spec in its routing table
AND the phase gate table includes a row: `clarify.md exists → Spec phase may start`

### CLARIFY-09 — Beads memory pointer stored

WHEN `clarify.yaml` completes successfully
THEN it stores a Beads memory pointer with key `clarify-[feature]-pointer`
AND the memory value references the path `.specs/features/[feature]/clarify.md`

### CLARIFY-10 — Harness-core spec updated

WHEN any agent reads `.specs/features/harness-core/spec.md`
THEN AC-RECIPE-01 table contains a row for `clarify.yaml` with slash command `/clarify`
AND AC-RECIPE-02 wiring table contains a row for clarify with its skills and agents

## Clarify Artifact Format Reference

```markdown
# Clarify: [Feature Name]

> Status: Resolved | Partial | Blocked
> Created: YYYY-MM-DD
> Feature: [feature-slug]
> Discovery source: .specs/features/[feature]/discovery.md

## Summary
[1–2 sentences: what was resolved, what remains open]

## Resolved Clarifications

### [FEAT]-CLR-01 — [Short ambiguity title]
CONTEXT:     [what triggered this — e.g., "discovery.md §Failure states: not addressed"]
QUESTION:    [the precise question asked to resolve the ambiguity]
DECISION:    [the concrete, testable answer]
RATIONALE:   [one sentence: why this decision over alternatives]
SPEC IMPACT: [WHEN/THEN/SHALL clause this decision unlocks or constrains]

### [FEAT]-CLR-02 — ...

## Unresolved Items

### [FEAT]-CLR-NN — [Title]
STATUS:   Blocked
CONTEXT:  [...]
QUESTION: [...]
BLOCKER:  [what information is needed from the user to resolve this]
```
