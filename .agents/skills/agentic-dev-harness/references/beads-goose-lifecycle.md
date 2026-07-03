# Beads + Goose Lifecycle

## Start

```bash
bd prime
bd context
bd doctor quick
bd ready --json
```

## Work

```bash
bd update <id> --claim --json
# edit/test
bd create "Discovered work" -t task -p 2 --deps discovered-from:<id> --json
bd close <id> --reason "Done" --json
```

## Delegate

- Research: many async subagents, read-only.
- Implementation: one writer per file/module; parent owns integration.
- Review: independent read-only critic before closing.

## End

- Close completed beads.
- Run relevant quality gates.
- Report changed files, validation, bead status, and git status.
- Commit/push only with authority from active instructions.
