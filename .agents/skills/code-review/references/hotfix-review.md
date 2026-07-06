# Hotfix Review

**When to use:** production incident, urgent regression, critical bug, time-sensitive fix.
**Exploration budget: diff + at most 2 files.** Urgency constrains exploration. Focus = blast radius and regression risk only.

## Process (time-boxed)

### Phase 1 — Read diff only
```bash
git diff HEAD~1 --stat    # what changed
git diff HEAD~1           # exact diff
```

### Phase 2 — Blast radius (2 questions only)
1. Which callers invoke the changed function/method?
2. Which existing tests cover the changed lines?

Read at most 2 files to answer these. If more are needed, flag as a risk rather than reading them.

### Phase 3 — Hotfix checklist
- [ ] Does the fix address the root cause, not just the symptom?
- [ ] Does the fix introduce any new failure mode?
- [ ] Are the changed lines covered by an existing test that would have caught the original bug?
- [ ] Is the blast radius limited to the reported issue?
- [ ] Is there a rollback plan (revert commit, feature flag, config change)?
- [ ] Is a migration required or is this code-only?

### Phase 4 — Must-run tests
List the minimum test set to run before deploying. Do not list the full suite.

## Output format for hotfix review
```markdown
**Verdict:** APPROVE | PASS-WITH-NITS | BLOCK

## Blast radius
[Functions/modules affected beyond the changed lines]

## Must-run tests before deploy
[Exact test file paths or commands]

## Rollback
[Exact revert command: git revert SHA or feature flag toggle]

## Findings
[Blockers only — defer nits to a follow-up bead]
```

## Gotchas specific to hotfix review
- Cleaning up surrounding code during a hotfix is NEVER appropriate. Create a follow-up bead instead.
- A test that passes both with and without the fix is NOT a regression test.
- If root cause cannot be identified in 2 files, state this explicitly rather than approving on incomplete information.
