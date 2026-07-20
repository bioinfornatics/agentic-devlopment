# Getting Started

## Prerequisites

- [Goose](https://github.com/block/goose) installed
- Python 3.14+ (for scripts)
- Node.js 18+ (for apps)

## Installation

```bash
# Clone and install harness
git clone <repo>
cd agentic-devlopment
./scripts/install.sh

# Verify installation
goose skills list | grep -c '|'  # Should show 21+
```

## First Session

```bash
# Start development workflow
goose run dev

# Or use slash commands in any session
/dev       # Main entry, routes to specialists
/review    # Code review
/implement # TDD implementation
```

## Slash Commands

| Command | Recipe | Purpose |
|---------|--------|---------|
| `/dev` | dev | Main entry point, routes to specialists |
| `/spec` | spec | Write formal spec with ACs |
| `/plan` | plan | Spec→Beads task graph |
| `/implement` | implement | Bead→Code with TDD |
| `/review` | review | Code→Approval/Block |
| `/verify` | verify | Code→Test evidence |
| `/explore` | explore | Read-only codebase research |
| `/design` | design | UX research + UI design |
| `/release` | release | Gated release workflow |

## Workflow Overview

```
┌──────┐    ┌──────┐    ┌───────────┐    ┌────────┐    ┌────────┐
│ spec │───▶│ plan │───▶│ implement │───▶│ review │───▶│ verify │
└──────┘    └──────┘    └───────────┘    └────────┘    └────────┘
    │           │             │              │             │
    ▼           ▼             ▼              ▼             ▼
 Spec.md    Beads graph    Code+Tests    Approval     Evidence
```

## Key Concepts

### Beads (Task Graph)
```bash
bd prime              # Load context
bd ready --json       # See claimable work
bd update <id> --claim # Claim before writing
bd close <id>         # Mark complete
```

### Delegation
```
# Transient (short tasks)
delegate(source: "codebase-researcher", instructions: "Map auth module")

# Persistent (long builds)
orchestrator__start_agent(working_dir: "./app", name: "Builder")
```

## Next Steps

1. Read [Architecture Overview](architecture-overview.md)
2. Review [Recipe Guide](recipe-guide.md)
3. Explore [SDD Workflow](02-sdd-workflow.md)
