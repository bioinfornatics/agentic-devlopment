# 09 — Implementation Loop

Execute one scoped unit of work from claim to verified handoff.

## User scenario

> "Implement this Beads issue and hand it off cleanly."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-implement \
  --params task="bd-123" \
  --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/implement bd-123
```

For non-Beads work, describe the scoped task:

```text
/implement implement the approved plan for the cache invalidation fix
```

## Recommended command

```bash
goose run --recipe harness-implement   --params task="bd-123"   --params repo_path="$PWD"
```

## Loop

1. `bd prime`.
2. `bd show bd-123 --json`.
3. `bd update bd-123 --claim --json`.
4. Inspect code and tests.
5. Implement smallest coherent change.
6. Run narrow tests.
7. Broaden validation if needed.
8. Create follow-up Beads for discoveries.
9. Close or hand off the bead.

## Quality gates

Choose project-appropriate commands:

```bash
make test
cargo test
go test ./...
npm test
pytest
```

## Delegation

Use subagents for read-only support:

```text
delegate(source: "codebase-researcher", instructions: "Map existing tests for bd-123. Do not edit.", async: true)
delegate(source: "review-critic", instructions: "Review my current diff for bd-123. Do not edit.")
```

Do not delegate overlapping writes.

## Handoff format

```text
Bead: bd-123
Status: closed | in progress | blocked
Changed files:
Validation:
Follow-up beads:
Risks:
Next recommended command:
```

## Done criteria

- Implementation satisfies acceptance criteria.
- Tests or explicit validation exist.
- Beads state is accurate.
- No hidden TODOs replace durable follow-up issues.
