# AGENTS.md — .specs/

> Overrides root AGENTS.md when working in the .specs/ directory.

## Beads vs .specs/

Beads (bd) handles: epics, user stories, tasks, bugs, incidents, dependencies, priorities, ACs.
.specs/ handles: specification (WHAT), design (HOW), contracts, decisions, vision.


## Spec format

Every spec lives at `.specs/features/[feature-slug]/spec.md`.

```markdown
# Spec: [Feature Name]

> Status: Active | Retro-spec (brownfield) | Deprecated
> Created: YYYY-MM-DD
> Scope: feat-[name]

## Context
[2-3 sentences: what this feature is and why it exists]

## Acceptance Criteria

### [AC-ID] — [Short title]
WHEN [trigger condition]
THEN [expected outcome]
AND  [additional constraint]   # optional
```

## ID format

- Format: `[FEAT]-NN` — e.g. `KG-01`, `AC-RECIPE-02`, `EVAL-01`
- IDs must be unique across all specs in this project
- Reference IDs in tests, Beads ACs, and KG entities

## After writing or updating a spec

```bash
# 1. Update KG with new spec_file and AC entities
node apps/kg/dist/cli.js pipeline

# 2. Store Beads pointer memory
bd remember "Spec for [feature]: canonical source is .specs/features/[feature]/spec.md; read when implementing [feature]; invariant: ACs define done, not task descriptions" --key spec-[feature]-pointer
```

## Retro-spec pattern

When documenting existing code without a prior spec:
1. Mark `Status: Retro-spec (brownfield)`
2. Extract ACs from current behaviour (not intended behaviour)
3. Create evals that verify each AC (closes R1 gaps in KG)

## What to avoid

- Aspirational ACs ("the system should be fast") — must be measurable
- ACs without IDs — every criterion needs a `[FEAT]-NN` identifier
- Implementation details in ACs — spec behaviour, not mechanism
- tasks.md or plan.md files — use Beads instead