# 14 — Beads Memory

Use Beads memory for durable project facts that future agents should know.

## User scenario

> "We learned an important repo convention. Make sure future agents remember it."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-memory   --params action="remember: default validation is make test"   --params repo_path="$PWD"
```

Search:

```bash
goose run --recipe harness-memory   --params action="search validation"   --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/memory remember: default validation is make test
```

```text
/memory search validation
```

```text
/memory recall validation-default
```

```text
/memory forget stale-key
```

Slash commands accept one free-text argument, so include the action and payload in the same text.

## What belongs in Beads memory

Good candidates:

- stable project conventions;
- default validation commands;
- architecture boundaries;
- known agent footguns;
- release constraints;
- pointers to canonical docs;
- maintainer preferences that affect future work.

Examples:

```bash
bd remember "Use make test as the default local validation gate" --key validation-default
bd remember "Do not use bd edit; it opens an interactive editor. Use bd update flags instead" --key no-bd-edit
bd remember "Release must run from the main worktree, not a linked worktree" --key release-main-worktree
```

## What does not belong in Beads memory

Do not store:

- tasks or TODOs — create Beads issues instead;
- transient state — use issue notes/comments or handoff;
- secrets, tokens, credentials, private data;
- long-form documentation — update docs and remember a pointer;
- vague opinions or unverified guesses.

Decision rule:

```text
fact durable for future agents → bd remember
work to do → bd create
async wait → bd gate
long-form knowledge → docs + short bd remember pointer
reusable workflow → recipe/molecule/formula
```


## Memory as navigation index

One of the best uses of Beads memory is to orient future agents toward the right file without injecting the file contents into every session.

Use memory as a routing table:

```text
topic -> canonical file/section -> when to read -> one-line invariant
```

Template:

```bash
bd remember "<topic>: canonical source is <file>#<section>; read when <trigger>; invariant: <short rule>." --key <topic>-pointer
```

Examples:

```bash
bd remember "Harness docs: canonical scenario index is USE_CASES.md; read when choosing workflow; invariant: use recipes/slash commands documented there." --key harness-docs-pointer

bd remember "Memory policy: canonical source is docs/14-memory.md; read before storing durable facts; invariant: facts go to memory, work goes to beads." --key memory-policy-pointer

bd remember "Testing policy: canonical source is AGENTS.md#validation; read before validating changes; invariant: run recipe validation after recipe edits." --key validation-policy-pointer
```

This pattern reduces token use because `bd prime` injects only a short pointer, and the agent reads the full file only when the task requires it.

### Pointer memory checklist

A pointer memory should be:

- short, ideally under 250 characters;
- stable across sessions;
- linked to a canonical file or section;
- triggered by a clear situation;
- limited to one invariant.

Avoid:

```bash
bd remember "$(cat docs/14-memory.md)" --key memory-policy
```

Prefer:

```bash
bd remember "Memory policy: docs/14-memory.md is canonical; read before using bd remember; invariant: do not store tasks/secrets/long docs." --key memory-policy-pointer
```

## Key naming convention

Use short kebab-case keys:

```text
validation-default
no-bd-edit
release-main-worktree
storage-boundary
sync-doc-pointer
```

Prefer stable semantic names over dates or session-specific names.

## Memory checkpoint

At the end of research, planning, implementation, review, or release workflows, ask:

1. Did we learn a durable project fact?
2. Will this help future agents avoid mistakes or act faster?
3. Is it atomic and verifiable?
4. Is it safe to store?
5. Does it belong in memory rather than Beads issues or docs?

If yes:

```bash
bd remember "<fact>" --key <stable-key>
```

If no, do not store it.

## Relationship with Goose memory systems

| System | Use |
|---|---|
| `bd remember` | canonical durable project/repo facts |
| Beads issues | work, bugs, decisions, follow-ups |
| Beads gates | async waits and human decisions |
| Goose Memory MCP | general user preferences |
| Top Of Mind | critical every-turn guardrails |
| Chat Recall | searching prior session history |
| Skills | reusable methods and procedures |
| Docs/ADR | long-form canonical knowledge |

## Done criteria

- Durable facts are stored with stable keys.
- Work items are not hidden as memories.
- Long knowledge is documented and memory stores only a pointer.
- No secrets are stored.
