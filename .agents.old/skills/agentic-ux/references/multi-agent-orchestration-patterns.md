# Multi-Agent Orchestration UX Patterns

Comprehensive reference for designing interfaces where multiple AI agents coordinate.
Source: Extracted from phazurlabs/ux-ui-mastery@agentic-ai-generative-ux.

---

## Autonomy Tier Classification

Classify every agent action into one of four autonomy tiers:

| Tier | Agent Behavior | User Involvement | Example |
|------|---------------|-------------------|---------|
| **Silent** | Acts and logs | None unless user inspects logs | Formatting, caching |
| **Notify** | Acts and sends non-blocking notification | User reviews after the fact | Routine emails, low-priority tickets |
| **Confirm** | Proposes action, pauses for approval | User approves, modifies, or rejects | Calendar changes, purchases under $50 |
| **Escalate** | Surfaces decision with full context, does not proceed | User must decide and instruct | Deleting data, sending contracts, high-value purchases |

**Rules:**
- Map every capability to exactly one tier
- Publish mapping in visible "Agent Permissions" panel
- Allow users to promote/demote individual actions between tiers
- Never allow silent-tier actions for irreversible operations
- Irreversibility is the primary axis for tier assignment

---

## Escalation Design Patterns

When an agent escalates, present a **decision card** containing:

1. **What** — specific, concrete action description
2. **Why** — reasoning trace, abbreviated
3. **Risk** — what could go wrong; what happens if action not taken
4. **Alternatives** — other actions considered and why ranked lower
5. **Controls:**
   - Approve
   - Modify (inline editor for proposed action)
   - Reject (with optional instruction for alternative)
   - Defer (snooze for configurable duration)

### Batch Escalations
- Group related escalations (e.g., twelve similar file renames)
- Show count, pattern summary, "Approve All / Review Individually" toggle

### Urgency Levels
| Urgency | Treatment |
|---------|-----------|
| Low | Badge counts, inbox items |
| Medium | Toast notifications, banners |
| High | Modal interruptions, system-level notifications |

**Never cry wolf** — reserve high-urgency for genuinely time-sensitive decisions.

---

## Agent Memory Architecture

Three memory layers:

| Layer | Scope | Persistence | Example |
|-------|-------|-------------|---------|
| **Session memory** | Active conversation | Discarded at session end unless saved | Current task context |
| **Episodic memory** | Past sessions | Persists, decays over time | User preferences, past decisions, corrections |
| **Semantic memory** | Learned generalizations | Updated incrementally | Communication style, risk tolerance, expertise level |

### Memory Inspector UX
- Browse what agent remembers, organized by category
- Show creation/last access timestamps
- Allow edit, pin (prevent decay), or delete individual memories
- Surface memory usage in context: "Using your preferred format (learned Oct 2025)"
- Make indicators clickable to view and optionally revoke

### Forgetting Controls
| Scope | Action |
|-------|--------|
| Single memory | Delete one fact/preference |
| Topic | Erase all memories related to a project/person/subject |
| Session | Remove all memories from a specific conversation |
| Factory reset | Clear all episodic and semantic memory |

**Memory pause mode:** Agent functions but stops forming new long-term memories (like incognito mode).

---

## Workflow Plan Visualization

Show complete agent pipeline before execution as a **DAG (directed acyclic graph)**:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Research    │────▶│  Analysis    │────▶│  Report Writer  │
│  Agent       │     │  Agent       │     │  Agent          │
│  ⏳ ~2 min   │     │  ⏳ ~1 min   │     │  ⏳ ~3 min      │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                                          │
       │            ┌──────────────┐              │
       └───────────▶│  Fact-Check  │◀─────────────┘
                    │  Agent       │
                    │  ⏳ ~1 min   │
                    └──────────────┘
```

**Features:**
- Nodes = agent tasks with name, description, estimated duration
- Edges = dependencies and data flow
- User can approve plan, reorder steps, remove steps, or add manual intervention points

---

## Swimlane Views for Parallel Execution

Each horizontal lane = one agent. Time flows left to right.

| Status | Visual Treatment |
|--------|-----------------|
| Queued | Gray block, dashed border |
| Running | Blue block, animated pulse |
| Waiting for input | Yellow block, attention icon |
| Complete | Green block, checkmark |
| Failed | Red block, error icon |
| Paused | Gray block, pause icon |

- Show dependency arrows between lanes
- Highlight critical path (sequence determining total completion time)
- Animate during execution: light up edges as data flows

---

## Agent Identity Design

Each agent must have:

| Element | Requirement |
|---------|-------------|
| **Name** | Descriptive, memorable — "Research Agent", not "Agent 1" |
| **Avatar** | Unique visual icon, instantly recognizable |
| **Role description** | One-sentence capability summary |
| **Capability badges** | Scannable labels: "Web Search", "Code Execution", "File I/O" |

### Introduction Pattern
When new agent enters workflow:
> "Meet Research Agent. It searches the web, academic databases, and your company knowledge base. It cannot modify files or execute code."

### Active Agent Indicator
- Always show which agent is currently acting
- Prefix conversation messages with avatar + name
- Highlight active agent in dashboards
- Never merge outputs from different agents into undifferentiated stream

---

## Handoff Visualization

When one agent passes to another, show:

1. **Who** is handing off (source agent)
2. **What** is being transferred (data/context summary)
3. **Who** is receiving (destination agent)
4. **Why** (source task complete, or different capabilities needed)

### Conversation View Format
```
───────────────────────────────────────────
🔄 Handoff: Research Agent → Writing Agent
   Passing: 12 sources, topic outline, key findings
   Reason: Research phase complete. Writing begins.
───────────────────────────────────────────
```

- Make handoff messages clickable to inspect full payload
- In graph views, animate edge with data-flow pulse

---

## Background Task Monitoring

### Widget Components
- Agent name and avatar
- Task description (one line)
- Progress indicator (determinate or indeterminate)
- Elapsed time + estimated remaining
- Status (running, paused, waiting, complete, failed)
- Quick actions: Pause, Resume, Cancel, View Details

### Density Modes
| Mode | Display |
|------|---------|
| Expanded | Full detail per task |
| Compact | Icon + progress bar + status dot |
| Minimized | Single aggregate indicator |

### Progressive Notification Model

| Situation | Level | Treatment |
|-----------|-------|-----------|
| Progressing normally | Silent | Update widget only |
| Complete, results ready | Gentle | Badge count, subtle toast |
| Blocked, needs input | Moderate | Persistent banner |
| Failed or critical error | Urgent | Modal or system notification |
| Time-sensitive decision | Critical | Modal with countdown |

**Never interrupt for routine completions** — batch and present when user checks.

---

## Trust Calibration Guardrail Tiers

| Tier | Condition | Agent Behavior |
|------|-----------|----------------|
| **Tier 1 — Informational** | Low-risk, reversible | Acts autonomously, logs for optional review |
| **Tier 2 — Advisory** | Medium-risk | Proposes and explains, awaits approval |
| **Tier 3 — Mandatory** | High-risk, irreversible, financially significant | Cannot proceed without explicit approval |

Map every agent capability to a guardrail tier based on risk and reversibility.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why It Fails |
|--------------|--------------|
| Agent acts on ambiguous instructions | Risk of wrong action; clarify first |
| Irreversible action without confirmation | Violates user agency |
| No visibility into tool use | Erodes trust |
| Agent "tries harder" after failure | Escalate to human after N failures |
| Hallucinated confidence | Use explicit uncertainty markers |
| Hidden coordination between agents | Breeds confusion and distrust |
| Merged agent outputs | Users can't attribute or verify |
| Interrupting for routine completions | Notification fatigue |

---

## Key Sources

- Gartner Top Strategic Technology Trends 2025 (Agentic AI #1)
- Microsoft Copilot Design Guidelines
- OpenAI Apps SDK Design System
- NNG Group: Outcome-Oriented Design, Generative UI
- Google A2UI: Agent-to-UI Interoperability Format
- ACM CHI 2025: Designing UIs with AI Workshop
