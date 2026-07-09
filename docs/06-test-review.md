# 06 — Test Review

Assess whether tests are sufficient, meaningful, maintainable, and connected to the spec.

## User scenario

> "Are these tests enough for this change? What gaps remain?"

## Run methods

### Method A — headless recipe

```bash
goose run --recipe review \
  --params task="test quality review for current diff" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Focus on test gaps, brittle tests, missing edge cases, and quality gates."
```

### Method B — slash command in an interactive Goose session

```text
/review test quality review for current diff; focus on gaps, brittle tests, edge cases, and quality gates
```

## Recommended command

```bash
goose run --recipe review   --params task="test quality review for current diff"   --params repo_path="$PWD"   --params constraints="Read-only. Focus on test gaps, brittle tests, missing edge cases, and quality gates."
```

## What to inspect

- changed behavior and acceptance criteria;
- existing test structure;
- unit/integration/e2e balance;
- negative cases;
- concurrency/race cases;
- migration/rollback tests;
- CLI JSON contract tests;
- UI accessibility/browser tests if applicable.

## Test review rubric

| Score | Meaning |
|---|---|
| 0 | No relevant tests |
| 1 | Smoke coverage only |
| 2 | Main happy path covered |
| 3 | Happy + important failure paths |
| 4 | Edge cases and regressions covered |
| 5 | Excellent, fast, maintainable, spec-linked coverage |

## Output format

```text
Test verdict:
Coverage score: /5
Missing tests:
Brittle tests:
Suggested commands:
Beads follow-ups:
```

## Beads examples

```bash
bd create "Tests: add regression coverage for duplicate dependency handling"   -t task -p 1   --deps discovered-from:<parent-id>   --json
```

## Done criteria

- Every behavior claim maps to a test or explicit risk.
- Missing coverage is represented as Beads if not fixed immediately.
- Quality gate commands are documented.
