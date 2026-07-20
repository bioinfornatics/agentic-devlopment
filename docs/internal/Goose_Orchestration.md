# 🔍 Native Orchestrator Extension — Complete Analysis

## Summary

The native `orchestrator` extension provides **multi-session management** — a fundamentally different model than `delegate()` subagents.

## Key Architecture Difference

```
┌─────────────────────────────────────────────────────────────┐
│  delegate() (summon extension)                              │
│  ┌──────────────┐                                           │
│  │ Parent       │──delegate()──▶ ┌──────────┐               │
│  │ Session      │◀──result─────  │ SubAgent │  (transient)  │
│  │              │                │ isolated │               │
│  └──────────────┘                │ context  │               │
│       │                          └──────────┘               │
│       │  SubAgent CANNOT spawn further subagents            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  orchestrator extension                                     │
│  ┌──────────────┐    start_agent()                          │
│  │ Orchestrator │───────────────▶ ┌──────────┐              │
│  │ Session      │◀─send_message─▶ │ User     │ (persisted)  │
│  │              │                 │ Session  │              │
│  └──────────────┘                 └──────────┘              │
│       │                                │                    │
│       │                                ▼                    │
│       │                          ┌──────────┐               │
│       │                          │ Can spawn│  (full User)  │
│       │                          │ its own  │               │
│       │                          │ subagents│               │
│       │                          └──────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Session Types

| Type        | Created By         | Persisted | Can Spawn Children |
|-------------|--------------------|-----------|--------------------|
| `User`      | `start_agent`, CLI | ✅ Yes     | ✅ Yes              |
| `SubAgent`  | `delegate()`       | ❌ No      | ❌ No               |
| `Scheduled` | Scheduler          | ✅ Yes     | ✅ Yes              |
| `Terminal`  | CLI term mode      | ✅ Yes     | ✅ Yes              |
| `Gateway`   | API gateway        | ✅ Yes     | ✅ Yes              |
| `Hidden`    | Internal           | ❌ No      | Varies             |

## Tool Reference

| Tool              | Parameters                 | Use Case                         |
|-------------------|----------------------------|----------------------------------|
| `start_agent`     | `working_dir`, `name?`     | Create persistent worker session |
| `send_message`    | `session_id`, `message`    | Interact with existing session   |
| `list_sessions`   | `session_type?`, `last_n?` | Monitor all sessions             |
| `view_session`    | `session_id`, `mode?`      | Inspect session state/history    |
| `interrupt_agent` | `session_id`               | Cancel busy session              |

## When to Use Native Orchestrator vs Harness delegate()

| Scenario                    | Use `delegate()` | Use Native Orchestrator |
|-----------------------------|------------------|-------------------------|
| Short task (< 5 min)        | ✅                | ❌                       |
| Transient isolated work     | ✅                | ❌                       |
| Persistent parallel workers | ❌                | ✅                       |
| Session monitoring          | ❌                | ✅                       |
| CI/automation management    | ❌                | ✅                       |
| Worker needs sub-workers    | ❌                | ✅                       |
| Recovery from stuck state   | ❌                | ✅                       |

## Harness Integration Opportunity

The native orchestrator could **complement** existing harness patterns:

```yaml
# Enable in goose config for advanced use cases
orchestrator:
  enabled: true
  type: platform
```

**New capabilities:**
1. `list_sessions` — monitor delegated work across sessions
2. `view_session(mode: "summarize")` — LLM-generated session summaries
3. `interrupt_agent` — recover from stuck subagents
4. `start_agent` — persistent workers for long builds

**Keep existing:**
- `delegate()` remains the default for transient subagent tasks
- Harness `goose-orchestration` skill for methodology and routing
