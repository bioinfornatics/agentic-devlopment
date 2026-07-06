# PR / Diff Review

**When to use:** diff present, staged changes, merge request, patch file, PR context.
**Exploration budget:** diff first, then **at most 3 surrounding files** for context on specific findings.

## Process

### Phase 1 — Read the diff (always first, no exceptions)
```bash
git diff --staged && git diff
# If no diff: git log --oneline -5 && git show HEAD
```
Understand scope: what files changed, what feature/fix this relates to.

### Phase 2 — Apply the review checklist (in order)
1. **Intent fit** — Does the change satisfy the bead/acceptance criteria?
2. **Correctness** — Edge cases, error handling, concurrency, data consistency.
3. **Tests** — Regressions covered? Assertions meaningful? Not testing implementation details?
4. **Security** — Injection, secrets, authz/authn, unsafe IO. Load `references/security-audit.md` if auth/payments/input-handling changed.
5. **Maintainability** — Simplicity, names, boundaries, public API stability.
6. **Operations** — Logs, migrations, rollback, performance impact.
7. **Beads hygiene** — Claimed/closed, discovered work linked, no hidden TODOs.

### Phase 3 — Expand only when needed
Read a surrounding file only if a specific finding requires context (caller, test, import).
Stop at 3 additional files. If more context is needed, state it as a risk rather than expanding.

### Phase 4 — Filter and report
Apply the confidence gate. Consolidate similar findings.
Produce the standard output format with verdict.

## Common false positives — skip these
- "Consider adding error handling" when caller/framework already handles it
- "Missing JSDoc" on self-describing single-purpose internal helpers
- "Magic number" for well-known constants (200, 404, 1000ms, 60, 24)
- "Function too long" for switch statements, config objects, or test tables
- "Possible null dereference" when preceding line narrows the type
- "Hardcoded value" in test fixtures (tests SHOULD have hardcoded expectations)
- "Should use TypeScript" in a JS-only file
