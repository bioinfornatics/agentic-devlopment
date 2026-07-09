# AGENTS.md — .specs/

> Overrides root AGENTS.md when working in the .specs/ directory.

## Spec format

Every spec file lives at `.specs/features/[feature-slug]/spec.md`.

```markdown
# Spec: [Feature Name]

> Status: Active | Retro-spec (brownfield) | Deprecated
> Created: YYYY-MM-DD
> Scope: feat-[name], feat-[name2]

## Context
[2-3 sentences explaining the feature and why it exists]

## Acceptance Criteria

### [AC-ID] — [Short title]
WHEN [trigger condition]
THEN [expected outcome]
AND [additional constraint]   # optional
```

## ID format

- Use `[FEAT]-NN` where FEAT is a 2-6 char uppercase abbreviation: `KG-01`, `AC-RECIPE-02`, `EVAL-01`
- IDs must be unique across all specs in this project
- Reference IDs in tests, Beads acceptance criteria, and KG entities

## After writing or updating a spec

```bash
# 1. Update KG with new spec_file and AC entities
node apps/kg/dist/cli.js pipeline

# 2. Check that ACs are now LOCATED_IN this spec_file in the KG
# 3. Store Beads pointer memory
bd remember "Spec for [feature]: canonical source is .specs/features/[feature]/spec.md; read when implementing [feature]; invariant: ACs define done, not task descriptions" --key spec-[feature]-pointer
```

## Retro-spec pattern

When documenting existing code without a prior spec:
1. Mark `Status: Retro-spec (brownfield)`
2. Extract ACs from the current behavior (not intended behavior)
3. Create evals that verify each AC (close R1 gaps in KG)

## What to avoid

- Aspirational ACs ("the system should be fast") — must be measurable
- ACs without IDs — every criterion needs a `[FEAT]-NN` identifier
- Implementation details in ACs — spec behavior, not mechanism
