# Release Review

**When to use:** release gate, go/no-go decision, pre-deploy, production readiness, version tag.
**Exploration budget:** focused on release artifacts. **Stop and BLOCK on first gate FAIL.**

## Release gate sequence (run in order, stop on FAIL)

```
[ ] 1. Recipe validation    — find .goose/recipes -name '*.yaml' | xargs goose recipe validate
[ ] 2. Skill visibility     — goose skills list (all project skills visible?)
[ ] 3. Tests pass           — run test suite; report pass rate + coverage
[ ] 4. Docs build           — ./scripts/build-docs.sh (or equivalent)
[ ] 5. Install safety       — review install.sh for idempotence and backup behaviour
[ ] 6. Breaking changes     — check public API surface, config schema, CLI params
[ ] 7. Migration safety     — DB migrations reversible? Down migration exists?
[ ] 8. Rollback plan        — exact commands to revert this release
[ ] 9. Open blockers        — bd blocked --json; any P1+ open?
```

## Output format for release review
```markdown
## Release Readiness Matrix

| Gate              | Status    | Evidence               |
| ----------------- | --------- | ---------------------- |
| Recipe validation | PASS/FAIL | N of N recipes valid   |
| Skill visibility  | PASS/FAIL | N skills visible       |
| Tests             | PASS/FAIL | coverage X%            |
| Docs build        | PASS/FAIL | ---------------------- |
| Install safety    | PASS/FAIL | idempotence confirmed? |
| Breaking changes  | PASS/FAIL | list or "none"         |
| Migration safety  | PASS/FAIL | down migration exists? |
| Rollback plan     | PASS/FAIL | commands listed below  |
| Open blockers     | PASS/FAIL | count                  |

**Release verdict:** READY | BLOCKED — [reasons]

## Rollback procedure
[Exact revert commands]

## Remaining risks
[List or "none"]
```

## Gotchas specific to release review
- A gate with status UNKNOWN is treated as FAIL — verify, do not assume.
- Do NOT skip any gate because it was checked previously — run fresh.
- Rollback plan must be executable by someone who did not write the release.
