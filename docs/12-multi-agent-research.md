# 12 — Multi-Agent Research

Use parallel subagents for broad read-only investigation while keeping the parent context focused.

## User scenario

> "Research the storage layer, CLI commands, and docs in parallel, then synthesize a plan."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe harness-master \
  --params task="parallel research on <topic>" \
  --params repo_path="$PWD" \
  --params mode="research"
```

### Method B — slash command in an interactive Goose session

```text
/harness parallel research on <topic>; use read-only subagents and synthesize findings
```

For direct manual control, use Summon `delegate(..., async: true)` as shown below.

## Recommended recipe

```bash
goose run --recipe harness-master   --params task="parallel research on <topic>"   --params repo_path="$PWD"   --params mode="research"
```

## Direct Summon pattern

Inside Goose:

```text
delegate(source: "codebase-researcher", instructions: "Research storage architecture. Read-only.", async: true)
delegate(source: "codebase-researcher", instructions: "Research CLI entrypoints. Read-only.", async: true)
delegate(source: "codebase-researcher", instructions: "Research docs and user workflows. Read-only.", async: true)
```

Then:

```text
load(source: "<task_id_1>")
load(source: "<task_id_2>")
load(source: "<task_id_3>")
```

## Partitioning rules

- Research can overlap.
- Writes must not overlap.
- Each subagent gets a clear scope and output format.
- Parent synthesizes and decides.

## Output format for subagents

```text
Scope:
Files inspected:
Key findings:
Risks:
Recommended Beads:
Open questions:
```

## Done criteria

- Parent synthesis resolves contradictions.
- Findings include evidence.
- Durable work becomes Beads.
