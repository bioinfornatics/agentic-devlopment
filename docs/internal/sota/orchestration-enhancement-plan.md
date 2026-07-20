# Harness Enhancement Analysis — Native Orchestration Integration

## Current State

### Counts
- Skills: 21
- Agents: 13  
- Recipes: 19

### Framework Coverage
| Framework | Skills | Primary Agent |
|-----------|--------|---------------|
| SDD | sdd, beads, agentic-devlopment, code-review | architect, orchestrator |
| TDD | sdd, webapp-testing, systematic-debugging | tdd-guide, qa-automation |
| GDD | gdd, knowledge-graph | architect, harness-judge |

## Relationship Graph

```
                    ┌─────────────────────────────────────────┐
                    │              FRAMEWORKS                 │
                    │     SDD      TDD       GDD              │
                    └────┬────────┬─────────┬─────────────────┘
                         │        │         │
           ┌─────────────┼────────┼─────────┼──────────────┐
           │             │        │         │              │
           ▼             ▼        ▼         ▼              ▼
    ┌──────────┐   ┌─────────┐ ┌────────┐ ┌─────┐   ┌──────────┐
    │beads     │   │sdd      │ │webapp- │ │gdd  │   │knowledge-│
    │          │   │         │ │testing │ │     │   │graph     │
    └────┬─────┘   └────┬────┘ └───┬────┘ └──┬──┘   └────┬─────┘
         │              │          │         │           │
         ├──────────────┼──────────┼─────────┼───────────┤
         │              │          │         │           │
         ▼              ▼          ▼         ▼           ▼
    ┌─────────────────────────────────────────────────────────┐
    │                      AGENTS                             │
    │  orchestrator  architect  planner  implementation-worker│
    │  review-critic  tdd-guide  qa-automation  codebase-res  │
    │  product-owner  ui-designer  ux-researcher  harness-judge│
    └────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐        ┌──────────┐        ┌─────────┐
    │dev.yaml │        │sdd.yaml  │        │review   │
    │(entry)  │        │(phases)  │        │.yaml    │
    └─────────┘        └──────────┘        └─────────┘
```

## Native Orchestrator Integration Plan

### Phase 1: Enhance goose-orchestration Skill

Add native orchestrator patterns to existing skill:

```yaml
# New section in goose-orchestration SKILL.md
## Native Orchestrator Tools (when enabled)

For PERSISTENT parallel workers or session monitoring:
- orchestrator__list_sessions — view all active sessions
- orchestrator__view_session — inspect/summarize session
- orchestrator__start_agent — create persistent worker
- orchestrator__send_message — interact with worker
- orchestrator__interrupt_agent — cancel stuck session

Use native orchestrator when:
- Workers outlive parent session
- Need session monitoring dashboard
- Recovery from stuck delegate() needed
- Multiple independent builds in parallel
```

### Phase 2: Update Key Recipes

#### dev.yaml — Add monitoring
```yaml
# When orchestrator extension enabled:
# - Use list_sessions to monitor delegated work
# - Use view_session(mode: "summarize") for long sessions
# - Use interrupt_agent before retrying stuck delegates
```

#### sdd.yaml — Persistent phase workers
```yaml
# For Large/Complex scope:
# - start_agent(name: "Spec Phase", working_dir: ".")
# - start_agent(name: "Implement Phase", working_dir: ".")
# - Coordinate via send_message, monitor via list_sessions
```

### Phase 3: Cleanup Proposals

| Item | Action | Reason |
|------|--------|--------|
| ~~harness-master.yaml~~ | DELETED | Collapsed into harness-review (scope param covers routing) |
| harness-review.yaml | MERGE into review | Consolidate review patterns |
| agentic-devlopment skill | Keep | Core workflow, too fundamental to merge |
| goose-orchestration | ENHANCE | Add native orchestrator patterns |

## New Orchestration Modes

```
Mode 1: TRANSIENT (current default)
  delegate() → SubAgent → dies with parent
  Use for: short tasks, research, reviews

Mode 2: PERSISTENT (native orchestrator)  
  start_agent() → User session → survives parent
  Use for: long builds, parallel pipelines, monitoring

Mode 3: HYBRID (proposed)
  delegate() for quick work
  start_agent() for persistent workers
  list_sessions() for monitoring all
```
