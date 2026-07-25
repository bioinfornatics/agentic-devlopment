# Getting Started

## Prerequisites

- [Goose](https://github.com/block/goose) installed
- Python 3.14+ (for scripts)
- Node.js 22.x (for apps; pinned in apps/.node-version)

## Installation

```bash
# Clone and install harness
# Replace <repo> with the actual repository URL (ask your team lead).
git clone <repo>
cd agentic-devlopment
./scripts/install.sh

# Verify installation
goose skills list | grep -c '|'  # Should show 17+
```

## First Session

```bash
# Run the governed engineering loop (orchestrates research → build → verify)
goose recipe run loop-engineering

# Or target a specific phase directly
goose recipe run research    # Read-only codebase research and planning
goose recipe run implement   # TDD implementation of a claimed Beads task
goose recipe run verify      # Independent verification against spec ACs
```

> **How to start a session:** Run `goose` in your terminal to enter an interactive session, then type slash commands. Or run `goose recipe run <name>` directly from the terminal for non-interactive execution.

## Slash Commands

Active recipes installed by this harness (use the recipe name as the slash command):

| Slash command | Recipe file | Purpose |
|---|---|---|
| `/loop-engineering` | loop-engineering | Full governed loop: research → build → verify → control |
| `/research` | research | Read-only research and task framing |
| `/implement` | implement | TDD implementation of a Beads task |
| `/verify` | verify | Independent spec-anchored verification |

## Workflow Overview

```
┌──────────┐    ┌─────────┐    ┌───────────┐    ┌────────┐
│ research │───▶│ Beads   │───▶│ implement │───▶│ verify │
│ /research│    │ bd prime│    │ /implement│    │/verify │
└──────────┘    └─────────┘    └───────────┘    └────────┘
      │               │               │               │
      ▼               ▼               ▼               ▼
  Context +       Task graph       Code+Tests      Evidence
  task-framing    bd ready         RED→GREEN       AC proven
```

> **Canonical sequence:** research → claim (bd) → implement → verify.
> The `/loop-engineering` recipe orchestrates this full sequence automatically.

## Key Concepts

### Beads (Task Graph)
```bash
bd prime              # Load context
bd ready --json       # See claimable work
bd update <id> --claim # Claim before writing
bd close <id>         # Mark complete
```

### Delegation

Goose agents are discovered automatically from `.agents/agents/`. Active agents:

| Name | Role |
|---|---|
| `repository-researcher` | Read-only research, context mapping |
| `change-builder` | Bounded implementation (claims before writing) |
| `independent-verifier` | Spec-anchored verification (never repairs) |

The `/loop-engineering` recipe delegates to all three automatically.

## Next Steps

1. Read [Architecture Overview](architecture-overview.md)
2. Review [Recipe Guide](recipe-guide.md)
3. Explore [Workflow Chooser](00-index.md)
