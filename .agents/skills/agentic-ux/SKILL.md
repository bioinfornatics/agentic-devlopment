---
name: agentic-ux
description: >
  Design patterns for agentic AI interfaces: trust calibration, delegation UX,
  multi-agent orchestration patterns, generative UI, AI safety guardrails, and
  the paradigm shift from tool-based to agent-based interaction. Load when
  designing or evaluating agentic AI products, AI copilot interfaces, or
  multi-step autonomous workflows.
metadata:
  author: phazurlabs (adapted for harness)
  upstream: https://github.com/phazurlabs/ux-ui-mastery/tree/main/skills/agentic-ai-generative-ux
  version: 1.0.0
---

# Agentic AI & Generative UX

## The Paradigm Shift

Traditional software: user is the operator. Agentic AI: user is the supervisor.
The interface shifts from direct manipulation to goal delegation + outcome review.

**Three eras:**
1. **Tool Era (pre-2023)** — user drives every action; interfaces optimise direct manipulation
2. **Copilot Era (2023-2025)** — AI assists within user workflows; user remains in control
3. **Agent Era (2025+)** — AI executes entire workflows autonomously; interfaces optimise delegation and oversight

These coexist. Match the right interaction model to the task complexity.

## Core Design Principles for Agentic Interfaces

### 1. Transparent autonomy
Users must understand what the agent is doing, why, and what it has access to.
- Show the agent's current goal and plan before execution
- Surface tool calls and external actions in plain language ("I'm editing your calendar", not just a spinner)
- Provide a clear audit trail of what the agent did

### 2. Graduated trust calibration
Trust is built incrementally, not assumed from the start.
- Start with confirmation-required flows → auto-approve low-risk actions → gate high-risk actions
- Show confidence levels; flag uncertainty explicitly
- Never let the agent act on low-confidence inferences without user confirmation

### 3. Meaningful interruption points
Users need to pause, inspect, and redirect the agent.
- Design explicit checkpoints for high-stakes decisions
- Never bury the "stop" action — it must always be accessible
- Preserve context so resumption is seamless

### 4. Graceful degradation
Agents fail. The interface must handle failure without losing trust.
- Partial results are better than silent failure
- Explain what went wrong in plain language; suggest next steps
- Preserve user data and state across agent failures

### 5. Appropriate abstraction level
Show enough detail to maintain trust; not so much that it overwhelms.
- Summary first, details on demand
- Hide orchestration complexity from end users (relevant only for developers/admins)
- Use progressive disclosure for multi-step agent plans

## AI Safety UX Patterns

| Anti-pattern                             | Safe alternative                               |
|------------------------------------------|------------------------------------------------|
| Agent acts on ambiguous instructions     | Clarify before acting; list interpretations    |
| Irreversible action with no confirmation | Require explicit approval; show consequences   |
| No visibility into tool use              | Show tool calls in plain language in real time |
| Agent "tries harder" after failure       | Escalate to human after N failures             |
| Hallucinated confidence                  | Explicit uncertainty: "I'm not sure, but..."   |

## Trust Calibration Spectrum

```
Read-only report → Suggest + confirm → Auto-approve low-risk → Gate high-risk → Full autonomy
```
Start left. Earn trust through demonstrated reliability before moving right.

## Relevance to this harness
Our agents (harness-orchestrator, implementation-worker, review-critic) ARE
the agentic system. Design decisions about output format, escalation triggers,
and user confirmation gates directly affect user trust and adoption.

## Beads follow-ups
```bash
bd create "Agentic UX: add confirmation gate for <action>" --assignee ux-researcher -p 2
bd create "Agentic UX: surface agent plan before execution in <flow>" --assignee ui-designer -p 3
```
## Knowledge generation — orient first

Before applying this skill, generate context:
1. Read the relevant files (use `analyze` or `read` tools)
2. Identify the specific scope (component, feature, endpoint)
3. Only then apply the methodology in this skill
## Self-validation checklist

Before completing the task:
- [ ] Findings are based on evidence, not assumptions
- [ ] Each recommendation is actionable with a concrete next step
- [ ] Findings reference specific file/line/component
- [ ] Beads follow-up created for anything out of scope
