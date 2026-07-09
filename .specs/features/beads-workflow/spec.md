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