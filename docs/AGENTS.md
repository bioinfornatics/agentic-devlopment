# AGENTS.md — docs/

> Overrides root AGENTS.md when working in the docs/ directory.

## Documentation Tiers

```
docs/
├── START-HERE.md       # New users start here (< 50 lines)
├── tutorials/          # Visual walkthroughs
├── concepts/           # Visual explainers
├── reference/          # Power user docs
└── internal/           # Contributor docs
```

## Setup

```bash
./scripts/build-docs.sh   # pandoc → dist/docs/html/ + KG pipeline
```

## Conventions

- **Recipe names** — always workflow verbs: `dev`, `explore`, `plan`, `implement`, `review`, `verify`, `design`, `sdd`, `release`, `remember`, `discover`, `spec`, `doc-review`.
- **Slash commands** — `/dev`, `/review`, `/implement` etc.
- **Mermaid diagrams** — use ```mermaid``` fenced blocks. Validate by rendering.
- **Skill references** — use backtick `skill-name` format. Load with `load skills <name>`.
- **Agent references** — use backtick `agent-name` format.

## File organization

```
docs/START-HERE.md                    # Entry point (< 50 lines)
docs/tutorials/*.md                   # Task-oriented walkthroughs
docs/concepts/*.md                    # Visual explainers
docs/reference/                       # Detailed docs
docs/reference/use-cases/             # Scenario playbooks
docs/internal/                        # Contributor docs
docs/internal/sota/                   # Research
docs/adr/ADR-*.md                     # Architecture Decision Records
```

## After editing

```bash
./scripts/build-docs.sh   # verify HTML builds without errors
```

## What to avoid

- Putting detailed docs in tutorials/ (use reference/)
- Putting contributor docs in tutorials/ or concepts/ (use internal/)
- Adding complexity to START-HERE.md (keep < 50 lines)
- Adding `TODO` sections — create a Beads issue instead
