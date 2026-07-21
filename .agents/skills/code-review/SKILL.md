---
name: code-review
description: >
  Load when reviewing code, pull requests, architecture changes, or any diff.
  Adapts review depth to change type (PR / Feature / Security / Release / Hotfix /
  Global). Enforces: read git diff first, apply a 4-question confidence gate,
  produce a Verdict table with an explicit BLOCK / APPROVE / COMMENT recommendation,
  cite exact file and line numbers for every finding. Zero findings is a valid and
  correct output. Use when asked to review, audit, or critique any code change.
  Do NOT use for planning, architecture decisions, or sessions where no reviewable diff, code, or YAML artifact exists.
metadata:
  version: 4.1.0
---

# Code Review Skill

## Knowledge generation (Generated Knowledge Prompting)

Before loading a review type reference, generate context:
1. Run `git diff --staged && git diff` — read the actual diff before reading any other file.
2. Identify which review type applies from the diff content (not from the user's description alone).
3. Check if there is a Beads bead associated with this change: `bd show <id>` if a bead ID is given.
Only after these three steps: load the matching type reference.

## Step 1 — Detect review type, load the matching reference

Read context (query, files, bead description) and load exactly one reference:

| Signals present in context                          | Type           | Load                                                   |
| --------------------------------------------------- | -------------- | ------------------------------------------------------ |
| diff / PR / staged / merge / patch                  | PR review      | `load skill: code-review/references/pr-review.md`      |
| feature / acceptance criteria / user story / spec   | Feature review | `load skill: code-review/references/feature-review.md` |
| security / auth / payments / input / CVE / OWASP    | Security audit | `load skill: code-review/references/security-audit.md` |
| release / deploy / production / gate / go-no-go     | Release review | `load skill: code-review/references/release-review.md` |
| hotfix / urgent / incident / critical / regression  | Hotfix review  | `load skill: code-review/references/hotfix-review.md`  |
| architecture / codebase / global / patterns / audit | Global review  | `load skill: code-review/references/global-review.md`  |

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

### Scope boundary and discovered work

Review the requested artifact and its necessary context only. When the review reveals work outside
the active bead's acceptance criteria:

1. Do **not** implement, fix, or expand into that work inline.
2. Confirm it survives the confidence and false-positive gates.
3. Create a follow-up bead immediately with `--deps discovered-from:<active-bead-id>`.
4. Record the new bead ID in the final handoff.

If no active bead ID is available, state that the discovery cannot yet be linked and ask for or
create the scoped review bead before continuing. A suggested `bd create` command is not a filed
follow-up.

### Output format (use in every type)

```markdown
**Verdict:** APPROVE | PASS-WITH-NITS | BLOCK

## Findings

| Severity | File:Line | Issue | Fix |
| -------- | --------- | ----- | --- |
|          |           |       |     |

## Missing tests
[list or "None identified"]

## Beads follow-ups
[filed bead IDs with one-line scope, or "None"]

## Handoff
- Active bead: [ID and final disposition]
- Validation: [exact commands and pass/fail results]
- Repository state: [relevant changed files plus any pre-existing unrelated changes]
- Follow-ups: [filed bead IDs, or "None"]
```

---

## Finding generation loop

Use this loop for every review type. It gives you freedom to decide what to examine
and how deeply — bounded by the gates below. Do not skip the gates; the output is
whatever survives them.

```
FOR EACH area you examine (diff section, file, pattern, dependency):

  1. DRAFT a candidate finding — what you noticed

  2. PRE-REPORT GATE (binary — all four must pass or drop/downgrade):
     □ Can I cite the exact file and line?
     □ Can I name the concrete failure mode: input → state → bad outcome?
     □ Have I read surrounding context (callers, imports, tests)?
     □ Is the severity defensible to a senior engineer on this team?

  3. FALSE-POSITIVE CHECK (judgment):
     Ask: "Would a senior engineer on this team actually request this change in review?"
     If NO or UNSURE → drop.
     If the pattern appears in the false-positive list for this review type → drop.

  4. Finding survives both gates → add to findings list with severity.

AFTER THE LOOP:

  5. CONSOLIDATE similar findings:
     "5 functions missing the same error handling" → 1 HIGH finding, count noted.

  6. SEVERITY SANITY:
     • CRITICAL → production impact evidence required
     • HIGH     → exact snippet + failure scenario + why existing guards miss it
     • MEDIUM   → specific location + consequence
     • LOW      → include only if the diff is otherwise clean (< 3 other findings)

  7. STOP. Zero findings is a valid, correct, complete output.
     Never add findings to reach a minimum count.
```

**Your freedom within this loop:**
- Choose which areas to examine (within the exploration budget of the active reference)
- Set severity (within the sanity check bounds above)
- Decide what counts as "similar" for consolidation
- Decide whether surrounding context exonerates a finding
- Decide when to stop reading more context

---

## Self-validation (before emitting any finding)

Run this loop for every candidate finding before writing it to output:

- [ ] Can I cite the exact file and line number?
- [ ] Can I describe the concrete failure mode (specific input → wrong outcome)?
- [ ] Have I read the surrounding context, callers, and type signatures?
- [ ] Is the severity defensible to a senior engineer on this team?
- [ ] Confidence > 80%?

If any answer is NO → downgrade severity or drop the finding.

For HIGH / CRITICAL: is there a concrete exploit scenario or exact reproduction case? If not → downgrade to MEDIUM.

## Gotchas

- Beads hygiene violations are always reportable regardless of confidence filtering.
- Prefer `git diff --staged && git diff` before any file reads — this is a review, not an exploration task.
- For recipe or skill files: run `goose recipe validate` before flagging structural issues.
- explore_pct rises when you read files before reading the diff. Read the diff first.
- "Consider adding error handling" is not a finding unless you can name the exact uncaught error and its consequence.

## Beads loop

For Beads workflow commands (prime, ready, claim, close, remember), load skill: `beads`.

Skill-specific commands:
    bd create "Review: <title>" --assignee review-critic       → file the review as a bead
    bd close <id> --reason "APPROVE|PASS-WITH-NITS|BLOCK: <summary>"
    bd create "Follow-up: <issue>" --deps discovered-from:<id> → file discovered work; capture the returned ID

Before ending the session, load `beads/references/session-close.md` and complete its checklist.
The handoff is incomplete unless it reports the active bead's disposition, exact validation results,
relevant git status, and every filed follow-up bead ID.
## Maker/Checker

Code review IS the checker role. The implementation-worker is the maker.

Additional checker for HIGH/CRITICAL security findings:
- Security findings CVSS ≥ 7.0 → require a second pass by security-scanner agent before BLOCK.
- Do not self-approve security findings — a single-agent security review is not reliable.
