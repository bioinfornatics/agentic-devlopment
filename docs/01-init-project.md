# 01 — Init Project

Initialize a repository so Goose and Beads can operate as an agentic development harness.

## User scenario

> "I have a repo. Set it up so agents can work safely, track durable tasks, use specs, and hand off cleanly."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe sdd-master \
  --params initiative="Initialize this project for agentic development" \
  --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/sdd Initialize this project for agentic development
```

Alternative:

```text
/plan Initialize project harness
```

Slash commands accept one free-text argument; `repo_path` defaults to the current directory.

## Goals

- Confirm or initialize Beads.
- Add project instructions for agents.
- Establish SDD workflow and quality gates.
- Create initial Beads graph for known work.
- Make Goose recipes/skills discoverable if the project carries local harness config.

## Recommended recipe

```bash
goose run --recipe sdd-master   --params initiative="Initialize this project for agentic development"   --params repo_path="$PWD"
```

Alternative:

```bash
goose run --recipe harness-plan   --params task="Initialize project harness"   --params repo_path="$PWD"
```

## Beads setup checklist

```bash
bd context || true
bd prime || true
bd doctor quick || true
bd ready --json || true
```

If the repo is not initialized for Beads, use the project policy for `bd init` / `bd bootstrap`. Do not silently initialize shared tracking without human approval.

## Files to consider

| File | Purpose |
|---|---|
| `AGENTS.md` | Agent instructions and session policy |
| `.agents/skills/` | Project-local reusable skills |
| `.agents/agents/` | Project-local named subagents |
| `.goose/recipes/` or `.agents/recipes/` | Project-local recipes |
| `.beads/` | Beads database/config/formulas |
| `.gooseignore` | Paths agents should not inspect or modify |

## Initial Beads graph

Recommended first issues:

```bash
bd create "Define SDD project charter" -t task -p 1 --json
bd create "Document quality gates" -t task -p 1 --json
bd create "Create first implementation backlog" -t task -p 1 --json
bd create "Review agent permissions and secrets" -t task -p 1 --json
```

Then add dependencies if needed:

```bash
bd dep add <backlog-id> <charter-id>
bd dep add <quality-gates-id> <charter-id>
```

Remember: `bd dep add B A` means **B needs A**.

## Expected output

A good init run should produce:

- current repo/Beads state;
- proposed files to add/update;
- initial Beads issues and dependencies;
- quality gates;
- security/permission notes;
- handoff instructions for future agents.

## Done criteria

- `bd prime` gives useful project context.
- `bd ready` shows actionable work.
- agents know not to use markdown TODOs as source of truth.
- SDD loop is documented.
- quality gates are explicit.
