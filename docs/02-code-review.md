# 02 — Code Review

Review a diff, PR, branch, bead implementation, or agent handoff.

## User scenario

> "Review my current changes. Do not modify files. Tell me what blocks merge."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe review \
  --params task="review current diff" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Focus on correctness, tests, regressions, security, and Beads hygiene."
```

### Method B — slash command in an interactive Goose session

```text
/review current diff
```

For a Beads issue:

```text
/review bd-123 implementation
```

Slash commands accept one free-text argument; include focus/constraints in the text when needed.

## Recommended command

```bash
goose run --recipe review   --params task="review current diff"   --params repo_path="$PWD"   --params constraints="Read-only. Focus on correctness, tests, regressions, security, and Beads hygiene."
```

For a Beads issue:

```bash
goose run --recipe review   --params task="review bd-123 implementation"   --params repo_path="$PWD"
```

## Specialist agent

Inside an interactive Goose session:

```text
delegate(source: "review-critic", instructions: "Review the current diff. Do not modify files. Focus on correctness, tests, security, and Beads handoff hygiene.")
```

## Review dimensions

1. Intent fit: does the diff satisfy the bead/spec?
2. Correctness: edge cases, error handling, concurrency, data consistency.
3. Tests: meaningful regression coverage, not just snapshot churn.
4. Security: injection, secrets, auth, file/network safety, dependency risk.
5. Maintainability: simple boundaries, naming, public API stability.
6. Operations: logs, migrations, rollback, performance.
7. Beads hygiene: claimed issue, discovered work filed, no hidden TODOs.

## Beads context

Before review:

```bash
bd prime || true
bd show <id> --json || true
git status --short
git diff --stat
```

## Output format

A good review returns:

```text
Verdict: pass | pass-with-nits | block

Blocking findings:
- [severity] file:line — issue, impact, suggested fix

Non-blocking findings:
- ...

Missing validation:
- ...

Beads follow-ups:
- bd create "..." --deps discovered-from:<id>
```

## Done criteria

- All blocking findings are actionable.
- Missing tests are explicit.
- Follow-up work is represented as proposed Beads, not vague prose.
