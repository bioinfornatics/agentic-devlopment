# Beads output filters

Filter at the command level — before data enters the context.

## Read commands

```bash
# ❌ Full object (2–12k chars)
bd show ID --json

# ✅ Only the fields the next step needs
bd show ID --json | jq '{status, title, acceptance_criteria}'
bd show ID --json | jq -r '.acceptance_criteria'
bd show ID --json | jq -r '.status + " " + .title'

# Lists — always select fields
bd list --status=in_progress --json | jq '[.[] | {id, title, status}]'
bd ready --json                     | jq '[.[] | {id, title}]'
bd blocked --json                   | jq '[.[] | {id, title}]'

# Comments — tail, not full history
bd comments ID | tail -20
```

## Write / state commands

```bash
# Evidence comment — one compact line, not raw output
bd comment ID "EVIDENCE AC-1 cmd=<cmd> exit=0 artifact=<path>"

# State transition — add a reason, nothing more
bd set-state ID phase=verify --reason "builder session 20260727_1 complete"
```

## Pattern: extract → persist → discard

```bash
FINDING=$(bd show ID --json | jq -r '.status')
bd comment ID "STATE status=$FINDING session=$SESSION"
# Return "status=in_progress", not the full JSON
```
