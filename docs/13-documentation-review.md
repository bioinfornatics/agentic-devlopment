# 13 — Documentation Review

Review documentation for onboarding, correctness, operational usefulness, and agent readability.

## User scenario

> "Review these docs. Would a new human or agent know what to do?"

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-review \
  --params task="documentation review" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Focus on onboarding, command accuracy, missing prerequisites, and agent handoff quality."
```

### Method B — slash command in an interactive Goose session

```text
/review documentation review; focus on onboarding, command accuracy, missing prerequisites, and agent handoff quality
```

## Recommended command

```bash
goose run --recipe harness-review   --params task="documentation review"   --params repo_path="$PWD"   --params constraints="Read-only. Focus on onboarding, command accuracy, missing prerequisites, and agent handoff quality."
```

## Review dimensions

- Audience and purpose are clear.
- Quick start works from a fresh clone.
- Commands are copy-pasteable and non-interactive where needed.
- Prerequisites are explicit.
- Troubleshooting covers common failures.
- Agent instructions do not conflict with user/repo policy.
- Docs link to source of truth rather than duplicating stale content.

## Documentation score

| Score | Meaning |
|---|---|
| 0 | Missing or misleading |
| 1 | Exists but not usable |
| 2 | Basic but incomplete |
| 3 | Usable with some gaps |
| 4 | Good and mostly tested |
| 5 | Excellent, task-oriented, validated |

## Output format

```text
Docs verdict:
Audience fit:
Command accuracy:
Missing prerequisites:
Agent-readiness issues:
Suggested edits:
Follow-up Beads:
```

## Done criteria

- A new user can install and run the main workflow.
- A future agent can understand constraints and validation.
- Stale or ambiguous commands are fixed or filed.
