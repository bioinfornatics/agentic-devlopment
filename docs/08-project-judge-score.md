# 08 — Judge and Score Project

Score a project across engineering, product, security, testing, operations, and agentic-readiness dimensions.

## User scenario

> "Audit this repository and give it a score with prioritized improvements."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe explore \
  --params task="judge and score project quality" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Score architecture, tests, security, docs, operations, UX, and Beads/agent readiness."
```

### Method B — slash command in an interactive Goose session

```text
/explore judge and score project quality across architecture, tests, security, docs, operations, UX, and agent readiness
```

Optional second pass:

```text
/review project scorecard review
```

## Recommended command

```bash
goose run --recipe explore   --params task="judge and score project quality"   --params repo_path="$PWD"   --params constraints="Read-only. Score architecture, tests, security, docs, operations, UX, and Beads/agent readiness."
```

Then optionally run:

```bash
goose run --recipe review   --params task="project scorecard review"   --params repo_path="$PWD"
```

## Scorecard dimensions

| Dimension | Questions | Score |
|---|---|---|
| Product clarity | Is purpose, user, scope clear? | /10 |
| Architecture | Clear boundaries, simple abstractions, low coupling? | /10 |
| Code quality | Maintainable, idiomatic, understandable? | /10 |
| Test quality | Fast, meaningful, layered, regression-focused? | /10 |
| Security | Secrets, auth, input handling, dependencies? | /10 |
| Operations | Logs, metrics, CI, release, rollback? | /10 |
| UX/accessibility | Flows, states, a11y, performance? | /10 |
| Documentation | Onboarding, commands, design docs? | /10 |
| Agent readiness | AGENTS.md, Beads, quality gates, safe harness? | /10 |

## Output format

```text
Overall score: NN/90
Executive summary:
Top 5 risks:
Top 5 improvements:
Fast wins:
Strategic investments:
Suggested Beads backlog:
Evidence:
```

## Beads backlog creation

Only create Beads automatically if instructed. Otherwise propose exact commands:

```bash
bd create "Improve onboarding: document local test command" -t task -p 2 --json
bd create "Security: remove hardcoded token from config" -t bug -p 0 --json
```

## Done criteria

- Every score is justified by evidence.
- Recommendations are prioritized by impact and effort.
- Improvements can be converted into Beads.
