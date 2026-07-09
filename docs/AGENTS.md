# AGENTS.md — docs/

> Overrides root AGENTS.md when working in the docs/ directory.

## Setup

```bash
./scripts/build-docs.sh   # pandoc → dist/docs/html/ + KG pipeline
```

## Conventions

- **Recipe names** — always workflow verbs: `dev`, `explore`, `plan`, `implement`, `review`, `verify`, `design`, `sdd`, `release`, `remember`, `discover`, `spec`. Never `harness-*`.
- **Slash commands** — `/dev`, `/review`, `/implement` etc.
- **Mermaid diagrams** — use ```mermaid``` fenced blocks. Validate by rendering.
- **Skill references** — use backtick `skill-name` format. Load with `load skills <name>`.
- **Agent references** — use backtick `agent-name` format.

## File naming

```
docs/00-index.md          # decision table + workflow diagrams
docs/01-09-*.md           # use-case playbooks
docs/14-memory.md         # Beads memory guide
docs/15-skill-evaluations.md  # eval workflow
docs/knowledge-graph.md   # KG semantic model (source of truth for KG design)
docs/kg-lifecycle.md      # KG initiation + maintenance + auto-alimentation
docs/adr/ADR-*.md         # Architecture Decision Records
```

## After editing

```bash
./scripts/build-docs.sh   # verify HTML builds without errors
# Check: wrote dist/docs/html/agentic-development-harness.html
# Check: KG bootstrapped + reasoned
```

## What to avoid

- Referencing deleted files or old recipe names (`harness-review`, `sdd-master`, etc.)
- Adding user-facing docs for unreleased features
- Adding `TODO` sections — create a Beads issue instead
