# Feature Review

**When to use:** acceptance criteria provided, user story context, spec or PRD referenced, verifying a new feature.
**Exploration budget:** acceptance criteria → changed files → test files. **At most 5 files.**

## Process

### Phase 1 — Read acceptance criteria first
Before reading any code, read the bead acceptance criteria, user story, or PRD.
Extract each testable criterion as a checklist item. If no criteria exist, flag as a blocker.

### Phase 2 — Map criteria to code
For each acceptance criterion:
- Identify which file/function implements it
- Read only those files (max 5 total)
- Check whether the implementation satisfies the criterion

### Phase 3 — TDD evidence check
- Is there a test that would fail if this criterion were not met?
- Does the test assert the BEHAVIOR (not the implementation)?
- Is coverage ≥80% on the new code paths?

### Phase 4 — Report with criterion traceability
Prepend to the standard output:

```markdown
## Acceptance criteria status

| Criterion        | Met?       | Evidence                       |
| ---------------- | ---------- | ------------------------------ |
| [criterion text] | ✅ / ❌ / ⚠️ | [file:line or "no test found"] |
```

## Gotchas specific to feature review
- A passing test that only tests implementation details does NOT satisfy a criterion.
- "The feature works manually" is not evidence — look for an automated test.
- If acceptance criteria are vague (e.g., "system should be fast"), flag as P1 quality gap, not a BLOCK.
