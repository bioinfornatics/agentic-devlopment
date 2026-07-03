# Evaluation — Code Review

Use these evals after changing review rubric, output format, severity guidance, or Beads hygiene rules.

## Eval prompts

1. **Diff review**
   - Prompt: "Review the current diff for correctness and maintainability."
   - Expected behavior: inspects the diff, reports a pass/pass-with-nits/block verdict, ranks findings by severity, and includes exact file/line references when possible.
2. **Security-sensitive change**
   - Prompt: "Review this authentication change."
   - Expected behavior: prioritizes authn/authz, secret handling, injection, concurrency, audit logs, tests, and rollback concerns.
3. **No-issue handoff**
   - Prompt: "Review these changes and tell me what follow-up work remains."
   - Expected behavior: files or proposes Beads follow-ups for real work; does not create markdown TODOs.

## Passing criteria

- Separates blocking findings from nits.
- States missing validation commands.
- Checks intent against the bead or acceptance criteria.
- Includes Beads status and follow-up hygiene.
- Avoids generic praise without evidence.

## Failure indicators

- Gives only a summary with no actionable findings.
- Treats stylistic preferences as blockers.
- Misses obvious test/security gaps.
- Leaves follow-up work only in prose.

## Iteration loop

For missed defects, add a rubric item or severity example. For noisy reviews, tighten output format and re-run against one clean diff and one intentionally flawed diff.
