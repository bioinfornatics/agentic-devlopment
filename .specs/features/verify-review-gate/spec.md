# Spec: D7 — Verify/Review Cross-Recipe Beads Ordering Gate

> Status: Active
> Created: 2026-07-19
> Scope: feat-verify-review-gate

## Context

The SDD workflow defines a strict ordering: implement → review → verify → release.
However, no runtime enforcement exists across recipe invocations. Any recipe can be
run independently in any order without checking prerequisites. This allows verify to
run before review (shipping unreviewed code) and release to run before verify (shipping
untested code). The fix is a Beads label–based state machine that each recipe checks
before proceeding and stamps on completion. This also closes a rubric gap: the
harness-judge `domain-d-recipes.md` file has dead TOC anchors (D4 Sequential Flow Gates,
D5 Cross-Recipe Overlap) that reference planned rubric sections (HJ035-HJ037, HJ041)
whose content was never written.

## Label State Machine

```
env:dev  →  env:reviewed  →  env:verified  →  env:prod
            (review APPROVE)   (verify PASS)   (release PASS)
```

Each label is a Beads bead label stamped by the recipe that produces the state,
and checked by the recipe that requires that state as precondition.

## Acceptance Criteria

### GATE-01 — review.yaml stamps env:reviewed on APPROVE

WHEN `review.yaml` produces an APPROVE or PASS-WITH-NITS verdict for a bead
THEN the recipe executes `bd update <bead-id> --add-label env:reviewed`
AND the label is present on the bead when `bd show <bead-id>` is run afterward
AND the recipe stores a memory pointer with key `review-gate-<feature>`

### GATE-02 — review.yaml does NOT stamp env:reviewed on BLOCK

WHEN `review.yaml` produces a BLOCK verdict for a bead
THEN the recipe does NOT execute `bd update --add-label env:reviewed`
AND the bead retains its previous labels unchanged

### GATE-03 — verify.yaml checks env:reviewed before running

WHEN `verify.yaml` is invoked with a bead ID that does NOT carry the `env:reviewed` label
THEN the recipe STOPS before running any verification
AND outputs: "❌ Verify gate: bead <id> missing env:reviewed. Run /review first."
AND no verification steps are executed

### GATE-04 — verify.yaml proceeds when env:reviewed is present

WHEN `verify.yaml` is invoked with a bead ID that carries the `env:reviewed` label
THEN the recipe proceeds with normal verification execution

### GATE-05 — verify.yaml stamps env:verified on PASS

WHEN `verify.yaml` completes with all checks PASS for a bead
THEN the recipe executes `bd update <bead-id> --add-label env:verified`
AND the label is present on the bead when `bd show <bead-id>` is run afterward

### GATE-06 — verify.yaml does NOT stamp env:verified on FAIL

WHEN `verify.yaml` completes with any check FAIL for a bead
THEN the recipe does NOT execute `bd update --add-label env:verified`
AND creates a failure bead via `bd create "Verify fail: <description>" -p 2`

### GATE-07 — release.yaml checks env:verified before running

WHEN `release.yaml` is invoked with a bead ID that does NOT carry the `env:verified` label
THEN the recipe STOPS before running any release steps
AND outputs: "❌ Release gate: bead <id> missing env:verified. Run /verify first."
AND no release steps are executed

### GATE-08 — release.yaml stamps env:prod on successful release

WHEN `release.yaml` completes successfully for a bead
THEN the recipe executes `bd update <bead-id> --add-label env:prod`

### GATE-09 — domain-d-recipes.md contains D7 Sequential Flow Gates section

WHEN `.agents/skills/harness-judge/references/domain-d-recipes.md` is read
THEN it contains a `## Section D7 — Sequential Flow Gates` heading
AND that section contains rubric items for HJ035, HJ036, and HJ037
AND the TOC is updated to reference D7 (not D4) for Sequential Flow Gates

### GATE-10 — domain-d-recipes.md contains D8 Cross-Recipe Overlap section

WHEN `.agents/skills/harness-judge/references/domain-d-recipes.md` is read
THEN it contains a `## Section D8 — Cross-Recipe Overlap` heading
AND that section contains a rubric item for HJ041
AND the TOC is updated to reference D8 (not D5) for Cross-Recipe Overlap

## Gate Protocol Reference

```bash
# RECIPE COMPLETES REVIEW WITH APPROVE/PASS-WITH-NITS:
bd update <bead-id> --add-label "env:reviewed"
bd remember "Review gate: APPROVE | Bead: <id> | Feature: <feature>" --key "review-gate-<feature>"

# RECIPE STARTS VERIFY — check precondition:
bd list --label "env:reviewed"           # find reviewed beads
# or for a specific bead:
bd show <bead-id>                        # confirm env:reviewed in labels
# STOP if env:reviewed absent

# RECIPE COMPLETES VERIFY WITH PASS:
bd update <bead-id> --add-label "env:verified"

# RECIPE STARTS RELEASE — check precondition:
bd show <bead-id>                        # confirm env:verified in labels
# STOP if env:verified absent

# RECIPE COMPLETES RELEASE:
bd update <bead-id> --add-label "env:prod"
```
