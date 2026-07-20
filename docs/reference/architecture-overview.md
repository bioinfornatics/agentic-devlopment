# Harness Architecture

## Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: RECIPES                                                │
│ Workflow orchestration: dev, sdd, review, implement, verify     │
│ Pattern: load skills → load agent → delegate to specialists     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: AGENTS                                                 │
│ Specialist personas with defined scope and skills               │
│ orchestrator, architect, reviewer, implementer, qa-automation   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: SKILLS                                                 │
│ Reusable methodology injected into context                      │
│ sdd, beads, code-review, goose-orchestration, knowledge-graph   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0: GOOSE RUNTIME                                          │
│ Extensions: developer, summon, orchestrator, analyze, fetch     │
│ Tools: shell, write, edit, delegate, load, start_agent          │
└─────────────────────────────────────────────────────────────────┘
```

## Orchestration Architecture

### Transient Delegation (Default)
```
Parent Session ──delegate()──▶ SubAgent (isolated, transient)
      │                              │
      │◀────────result───────────────┘
      │
      │  SubAgent dies with parent, cannot spawn children
```

### Persistent Workers (Native Orchestrator)
```
Orchestrator ──start_agent()──▶ Worker Session (persistent)
      │                               │
      │◀──send_message()─────────────▶│
      │                               │
      │──list_sessions()              │  Worker survives parent
      │──view_session()               │  Can spawn own subagents
      │──interrupt_agent()            │
```

## Frameworks

| Framework | Purpose | Key Skills |
|-----------|---------|------------|
| **SDD** | Spec-Driven Development | sdd, beads, code-review |
| **TDD** | Test-Driven Development | sdd, webapp-testing |
| **GDD** | Graph-Driven Development | gdd, knowledge-graph |

## Recipe Categories

| Category | Recipes | Pattern |
|----------|---------|---------|
| Entry Points | dev, sdd | Orchestration |
| Phases | discover, spec, plan, implement, review, verify, release | Specialist |
| Design | design | Multi-agent (UX→UI) |
| Audit | harness-audit, harness-review | Read-only / Write |
| Utility | explore, remember, clarify | Skill-only |
