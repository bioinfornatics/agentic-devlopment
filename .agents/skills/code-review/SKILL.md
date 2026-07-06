---
name: code-review
description: >
  Adaptive code review for agentic development: detects review type from context,
  loads the matching process reference, applies confidence-filtered findings with
  Beads hygiene, and returns a verdict. Covers PR, feature, security, global,
  release, and hotfix review types.
metadata:
  version: 4.0.0
---

# Code Review Skill

## Step 1 — Detect review type, load the matching reference

Read context (query, files, bead description) and load exactly one reference:

| Signals present in context | Type | Load |
|---|---|---|
| diff / PR / staged / merge / patch | PR review | `load skill: code-review/references/pr-review.md` |
| feature / acceptance criteria / user story / spec | Feature review | `load skill: code-review/references/feature-review.md` |
| security / auth / payments / input / CVE / OWASP | Security audit | `load skill: code-review/references/security-audit.md` |
| release / deploy / production / gate / go-no-go | Release review | `load skill: code-review/references/release-review.md` |
| hotfix / urgent / incident / critical / regression | Hotfix review | `load skill: code-review/references/hotfix-review.md` |
| architecture / codebase / global / patterns / audit | Global review | `load skill: code-review/references/global-review.md` |

**Default when ambiguous:** load `code-review/references/pr-review.md`.

Follow the process in the loaded reference. Everything below applies to all types.

---

## Universal rules — apply in every review type

### Confidence gate (non-negotiable)
Report only if >80% confident it is a real issue.
Before writing any finding, answer all four:
1. Can I cite the **exact file and line**?
2. Can I name the **concrete failure mode** (input → state → bad outcome)?
3. Have I read the **surrounding context** — callers, imports, tests?
4. Is the **severity defensible** to a senior engineer on this team?

If any answer is NO → downgrade severity or drop the finding.
**HIGH / CRITICAL require proof**: exact snippet + line + failure scenario + why existing guards don't catch it.

### Beads hygiene (non-discretionary — not subject to confidence filtering)
Always check, always report if violated:
- Claimed/closed status reflects actual work done
- Discovered work linked with `discovered-from`
- No markdown TODO files as durable tracking

### Zero findings is valid
A clean review returning zero findings with a clear diff is correct output, not a failure.
Do not manufacture findings to justify the invocation.

### Output format (use in every type)

```markdown
**Verdict:** APPROVE | PASS-WITH-NITS | BLOCK

## Findings

| Severity | File:Line | Issue | Fix |
|---|---|---|---|

## Missing tests
[list or "None identified"]

## Beads follow-ups
[bd create commands or "None"]
```

---

## Gotchas

- Beads hygiene violations are always reportable regardless of confidence filtering.
- Prefer `git diff --staged && git diff` before any file reads — this is a review, not an exploration task.
- For recipe or skill files: run `goose recipe validate` before flagging structural issues.
- explore_pct rises when you read files before reading the diff. Read the diff first.
- "Consider adding error handling" is not a finding unless you can name the exact uncaught error and its consequence.
