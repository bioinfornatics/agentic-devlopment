---
name: beads-harness
description: >
  Beads operating manual for agents: prime, ready/claim/close, dependencies, memory, molecules, wisps, gates, and Dolt sync.
version: 1.0.0
---

# Beads Harness

Use Beads as the durable scheduler and audit log for agentic development.

## Core commands

```bash
bd prime                  # inject workflow + memories
bd ready --json           # claimable work
bd blocked --json         # blocked work and blockers
bd show <id> --json       # issue detail
bd update <id> --claim    # atomic claim
bd close <id> --reason "Done"
bd create "Title" -t task -p 2 --json
```

## Dependency semantics

`bd dep add B A` means **B needs A**. Use requirement language. Verify with `bd blocked`.

Blocking dependencies: `blocks`, `parent-child`, `conditional-blocks`, `waits-for`.
Non-blocking links: `related`, `discovered-from`, `replies-to`.

## Memory

```bash
bd remember "fact" --key stable-key
bd memories <keyword>
bd recall <key>
bd forget <key>
```

Do not create `MEMORY.md` files.

## Memory as navigation index

Prefer pointer memories over content memories to save tokens:

```bash
bd remember "Testing: canonical source is AGENTS.md#validation; read before changing tests; invariant: use the project default gate." --key testing-policy-pointer
```

A good pointer memory says:

```text
topic -> canonical file/section -> when to read -> one-line invariant
```

Do not store long documentation in memory. Update docs and remember a short pointer.

## Molecules and wisps

```bash
bd formula list
bd cook <formula> --dry-run
bd mol pour <proto-or-formula> --var k=v    # durable work
bd mol wisp <proto-or-formula> --var k=v    # ephemeral work
bd mol bond A B                             # compose graphs
bd mol squash <id> --summary "..."          # digest/persist
bd mol burn <id>                            # discard
bd mol wisp gc --dry-run
```

Use mols for durable feature work. Use wisps for patrols, diagnostics, temporary operations, and release runs where a digest is enough.

## Gates

```bash
bd gate create --blocks <issue> --type gh:run --await-id <run-id>
bd gate check --type gh:run
bd gate resolve <gate-id> --reason "passed"
```

Use gates for async waits instead of keeping an agent idle.
