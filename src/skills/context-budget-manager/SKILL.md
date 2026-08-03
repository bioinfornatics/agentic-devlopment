---
name: context-budget-manager
description: >
  Measure and enforce context and tool-call budget in a Goose session.
  Use when approaching budget limits, before delegation, after phase
  transitions, or when marginal efficiency is declining. Do not use
  for implementation or verification decisions.
---

# Context and budget management

Every token in the context costs money on every subsequent API call.
Every tool call grows the context. Budget management is the discipline
of spending both to reduce uncertainty, not to accumulate history.

## What the harness enforces mechanically

| Mechanism | Enforcement | Where |
|---|---|---|
| Turn ceiling | Runtime hard stop | Recipe `settings.max_turns` |
| Identical tool repetition | Runtime block | Recipe `session.max_tool_repetitions` |
| Consecutive failures | SQLite counter → block | `loop-breaker` plugin |
| Iteration / no-progress | Beads snapshot + guard JS | `loop-transition-guard.js` |
| Destructive shell | PreToolUse block | `prevent-catastrophe` plugin |
| Tool-call budget (optional) | Counter file → PreToolUse block | `budget-tracker` plugin |

**Token counting and compaction are not mechanically enforced.**
The platform does not expose token counts to hooks.

## What you must manage cognitively

### Before any action, ask

1. Does this action reduce a specific uncertainty?
2. Could a smaller, cheaper action answer the same question?
3. Is the output going to be read by the next step, or does it just inflate context?
4. Would a Beads reference replace this inline content?

### Sizing tool outputs

Apply before every `shell` or `execute_typescript` call:

```sh
# ❌ returns full object (potentially thousands of chars)
cat src/some/file.json

# ✅ returns only what the next step needs
cat src/some/file.json | jq '{status, version}'

# ❌ reads entire log
cat build.log

# ✅ reads only the failure
cat build.log | grep -E "^(ERROR|FAIL)" | tail -20
```

### Beads-first pattern (context lifecycle)

```sh
# Extract decision from output → persist → discard raw output
RESULT=$(command | jq -r '.status')
bd comment ISSUE_ID "EVIDENCE: status=$RESULT cmd=<cmd> exit=0"
# Return "status=done", not the full JSON
```

### Budget thresholds

Apply the following discipline as turns are consumed:

| Threshold | Action |
|---|---|
| **50 %** | Reassess plan. Drop weak branches. Verify capitalisation in Beads. |
| **75 %** | Stop exploration. Focus on critical path only. No new sub-agents. |
| **90 %** | No new branches. Finalise essential validations. Prepare resume state. |
| **100 %** | Stop immediately. Persist partial result. Record remaining work in Beads. |

Estimate remaining turns as `max_turns - current_turn`.

### When to compact

Compact (summarise and externalise) when:

- A large tool output was just processed and the result has been extracted.
- A sub-agent or delegate session has completed.
- A phase transition has occurred.
- The last assistant message contains more than ~2 000 words of reasoning.

**How to compact:**

1. Extract durable facts → `bd comment ID "FINDING: ..."`
2. Extract decisions → `bd comment ID "DECISION: ..."`  
3. Extract evidence references (path + line, not raw content).
4. Do not carry raw output across turns.

### Detecting stagnation

Stagnation: two consecutive turns where the set of unresolved unknowns did
not shrink and no new evidence was produced.

On stagnation:
1. Change the hypothesis, the tool, the scope, or the model.
2. If two different approaches have failed: escalate.
3. Never retry the same action with the same parameters.

## Using budget-tracker (optional plugin)

Set `GOOSE_TOOL_BUDGET=N` before starting the session to enforce a hard
ceiling on tool calls. The plugin blocks the (N+1)th `PreToolUse` with a
`{"decision":"block",...}` response.

```sh
# Example: hard limit of 120 tool calls for a verify session
GOOSE_TOOL_BUDGET=120 goose recipe run verify --param task_id=...
```

Session stats are written to `~/.local/share/goose-budget/sessions.jsonl`
on `SessionEnd` for FinOps analysis.

## Checklist

- [ ] Every shell command that can produce > 20 lines ends with `| jq`, `| grep`, or `| tail`.
- [ ] Large outputs are summarised into a Beads comment, not kept in conversation.
- [ ] Phase transitions produce a compaction step before the next phase starts.
- [ ] Remaining turns were estimated before the last costly action.
- [ ] Stagnation was not retried with the same parameters.
