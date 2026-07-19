# Spec: SPEC_DEVIATION → Spec Update Loop

> Status: Active
> Created: 2026-07-19
> Scope: feat-spec-deviation-loop

## Context
When `implementation-worker` must deviate from a spec AC, it emits a `// SPEC_DEVIATION:` comment.
`review-critic` flags the marker as a finding but stops there — no guided decision workflow exists to either
amend the spec AC to match the accepted deviation, or file a SPEC_REVERT task to bring the code back to spec.
This feature closes that loop: detection script → triage → accept (spec amendment) or reject (SPEC_REVERT bead).

## Acceptance Criteria

### SPDEV-01 — Detection script finds all markers
WHEN `scripts/find-spec-deviations.sh` is executed in a repository root
THEN it exits 0 and prints every `SPEC_DEVIATION:` marker found in source files
AND each output line contains: relative file path, line number, deviation text, reason
AND output is empty (exit 0) when no markers exist
AND the script is executable (`chmod +x`)

### SPDEV-02 — SDD skill Spec Health Audit protocol
WHEN an agent loads the `sdd` skill and enters the Verify phase
THEN the skill provides a numbered "Spec Health Audit" section (Section 8)
AND the section instructs: run detection script → triage each result → for accepted deviations propose AC amendment → for rejected deviations propose SPEC_REVERT bead with `--deps discovered-from:<bead-id>`
AND the section includes a self-validation checklist item: "[ ] All SPEC_DEVIATION markers triaged — none left unresolved"

### SPDEV-03 — review-critic emits structured amendment proposals
WHEN `review-critic` detects one or more `// SPEC_DEVIATION:` comments in the diff
THEN each detected deviation appears in its findings table with severity MEDIUM
AND alongside the finding, the agent outputs a structured "Amendment Proposal" block containing:
  - Affected spec file path (derived from feature context or bead)
  - Affected AC ID (e.g., AUTH-02)
  - If Accept: a draft WHEN/THEN/SHALL amendment reflecting the implementation
  - If Reject: a draft `bd create` command for a SPEC_REVERT task
AND the verdict cannot be APPROVE while any SPEC_DEVIATION remains unresolved

### SPDEV-04 — review.yaml runs deviation scan before verdict
WHEN `review.yaml` is invoked on a feature branch
THEN Step 2 Orient includes: "Run `scripts/find-spec-deviations.sh` on changed files; list results before starting the review checklist"
AND detected deviations are numbered and presented before the verdict block
AND zero deviations detected is explicitly reported as "SPEC_DEVIATION scan: clean"

### SPDEV-05 — amend-spec subrecipe amends or reverts
WHEN the `amend-spec` subrecipe is invoked with a SPEC_DEVIATION description
THEN it reads the relevant spec.md, locates the affected AC by ID
AND proposes a precise WHEN/THEN/SHALL amendment that reflects the actual implementation
AND writes the amendment to `spec.md` only after explicit Accept confirmation
AND creates a SPEC_REVERT bead (with `--deps discovered-from`) if the verdict is Reject
AND stores a Beads memory: "SPDEV amended: [feature] [AC-ID] — reason" via `bd remember`

## Non-goals
- Automatic spec amendment without human triage decision
- Git blame or history analysis
- Cross-repo scanning
