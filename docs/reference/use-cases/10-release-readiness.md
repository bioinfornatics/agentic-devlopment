# 10 — Release Readiness

Prepare and verify a release with gates and durable handoff.

## User scenario

> "Prepare release 1.2.3, wait for CI, verify packages, and hand off."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe release \
  --params task="release 1.2.3" \
  --params repo_path="$PWD" \
  --params constraints="Do not tag or push without explicit approval."
```

### Method B — slash command in an interactive Goose session

```text
/release release 1.2.3; do not tag or push without explicit approval
```

## Recommended command

```bash
goose run --recipe release   --params task="release 1.2.3"   --params repo_path="$PWD"   --params constraints="Do not tag or push without explicit approval."
```

## Release phases

1. Preflight git/worktree/branch.
2. Verify clean or intentionally dirty state.
3. Confirm versions/changelog.
4. Run tests/build.
5. Commit/tag/push only with authority.
6. Create Beads gate for CI wait.
7. Verify artifacts/packages/docs.
8. Close release bead or create follow-ups.

## Beads gates

```bash
bd gate create --blocks <verify-issue> --type gh:run --await-id <run-id> --reason "Wait for release CI"
bd gate check --type gh:run
```

## Release checklist

- version consistent across files;
- changelog complete;
- tests pass;
- CI green;
- artifacts published;
- install smoke passes;
- rollback notes written;
- stale wisps cleaned if release used ephemeral workflow.

## Output format

```text
Release readiness: ready | blocked | partial
Preflight state:
Commands run:
Gates created/resolved:
Artifacts verified:
Rollback notes:
Follow-up beads:
```

## Done criteria

- No irreversible operation happened without authority.
- Async waits are represented by Beads gates.
- Verification is evidence-based.
