# Spec: WCAG Skill Refactoring — HJ052 Bloat Remediation

> Status: Active
> Created: 2026-07-19
> Scope: feat-wcag-skill-refactor

## Context

The `wcag-accessibility-audit` skill's `SKILL.md` has 517 body lines, triggering the
HJ052 WARN threshold (> 500 lines). Three large inline sections — the full POUR criteria
catalogue (224 lines), the detailed audit procedure (106 lines), and the quick-reference
tables (61 lines) — are reference material that does not need to live in the main skill
body. They should be extracted to `references/` sub-files, and SKILL.md should reference
them with `load references/...` pointers. This is a pure content restructure: correctness
and coverage do not change.

## Acceptance Criteria

### WCAG-REFACTOR-01 — SKILL.md body ≤ 500 lines (HJ052 threshold)

WHEN `python3 scripts/check-consistency.py` runs
THEN the HJ052 check for `wcag-accessibility-audit/SKILL.md` does NOT emit a WARN or FAIL
AND the body line count reported is ≤ 500

### WCAG-REFACTOR-02 — Three reference files created

WHEN `.agents/skills/wcag-accessibility-audit/references/` is listed
THEN it contains:
- `wcag-criteria-pour.md` (POUR criteria, Level A & AA detail)
- `wcag-audit-steps.md` (full 4-step audit procedure)
- `wcag-quick-reference.md` (priority matrix, quick wins, best practices, WCAG 2.2 summary)
AND the pre-existing `wcag-checklist-detail.md` is unchanged

### WCAG-REFACTOR-03 — SKILL.md references all four reference files

WHEN `SKILL.md` is read
THEN it contains `load references/wcag-criteria-pour.md` pointer
AND it contains `load references/wcag-audit-steps.md` pointer
AND it contains `load references/wcag-quick-reference.md` pointer
AND it contains `load references/wcag-checklist-detail.md` pointer (pre-existing)

### WCAG-REFACTOR-04 — Core methodology preserved in SKILL.md

WHEN `SKILL.md` is read
THEN it retains all of the following sections:
- "## When to Use This Skill"
- "## Inputs Required"
- "## The 4 POUR Principles" (summary form)
- "## Conformance Levels"
- "## Security Notice"
- "## Gotchas"
- "## Self-Validation Checklist"
AND each section still contains substantive content (not just a heading)

### WCAG-REFACTOR-05 — No methodology is lost

WHEN `wcag-criteria-pour.md`, `wcag-audit-steps.md`, and `wcag-quick-reference.md` are read
THEN their combined content equals the content previously inline in SKILL.md
AND no criterion, audit step, or quick-reference item has been deleted or altered

### WCAG-REFACTOR-06 — check-consistency passes with no new failures

WHEN `python3 scripts/check-consistency.py` runs after refactoring
THEN all checks that previously passed still pass
AND no new FAIL or new WARN is introduced (beyond pre-existing HJ052 on wcag skill)
