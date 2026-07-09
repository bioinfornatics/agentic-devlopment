# Spec: Beads Workflow Integration

> Status: Retro-spec (brownfield) — implementation predates this spec.
> Created: 2026-07-09
> Scope: feat-beads-workflow

## Context

Durable task tracking via Beads (Dolt git-synced) integrated into the SDD loop.

## Acceptance Criteria

### AC-BEADS-01 — Session orientation
WHEN agent runs `bd prime`
THEN durable memories are injected in context
AND bd ready --json shows claimable issues

### AC-BEADS-02 — Atomic claim
WHEN agent runs `bd update <id> --claim`
THEN issue status transitions to in_progress atomically
AND no other agent can claim the same issue simultaneously

### AC-BEADS-03 — Memory pointers
WHEN agent runs `bd remember "..." --key <key>`
THEN memory is stored in Dolt and persists across sessions
AND `bd recall <key>` retrieves it

## Non-goals

- No real-time multi-agent conflict detection
- No automatic bead creation from code analysis
## DORA Labeling Convention

### AC-BEADS-04 — Environment labels on deployable issues
WHEN a task, bug, or incident transitions to a new environment
THEN it receives the corresponding env label via `bd update --add-label env:<environment>`
AND the label timestamp serves as the DORA measurement point

### AC-BEADS-05 — Incident severity labeling
WHEN a production incident is created
THEN it receives both `env:prod` and a `severity:<level>` label
AND the issue type is `bug` (not `task`)
AND MTTR is measured from issue `created_at` to `bd close` timestamp

### Labeling workflow

```bash
# Feature implementation
bd create "Feature: user auth" --issue_type task --labels env:dev
bd update <id> --add-label env:staging   # after staging deploy
bd update <id> --add-label env:prod      # after production deploy

# Production incident
bd create "Incident: auth broken" --issue_type bug --labels env:prod,severity:high

# Bug found in staging
bd create "Bug: form validation" --issue_type bug --labels env:staging,severity:medium
```
