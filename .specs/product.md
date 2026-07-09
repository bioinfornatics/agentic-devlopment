# Product Vision — Agentic Development Harness

> Version: 1.0.0 | Status: Active

---

## Definitions

**Agentic development** is the practice of building software using AI agents as active
participants in the development loop — not just code completers, but autonomous actors
that plan, implement, review, and verify work across multiple sessions.

**The harness** is a portable, composable toolkit that structures agentic development:
it provides the methodology (Spec-Driven Development), the task graph (Beads),
the knowledge memory (Knowledge Graph), and the quality measurement (A/B evals)
so that every Goose session produces consistent, auditable, improvable outcomes.

**Spec-Driven Development (SDD)** is a methodology where a formal specification
is written *before* code is generated. The spec defines acceptance criteria in
WHEN/THEN/SHALL format, which agents use as their source of truth throughout
implementation, review, and verification. Specs persist as living artifacts —
they do not get discarded after the first sprint.

**How agents, skills, and recipes work together:**

```
  User intent
       │
       ▼
  Recipe (/discover, /spec, /implement…)     ← workflow entry point
       │  loads
       ▼
  Skill (sdd, code-review, beads-harness…)  ← methodology and domain knowledge
       │  delegates to
       ▼
  Agent (product-owner, review-critic…)     ← specialist persona with operating protocol
       │  tracks work in
       ▼
  Beads (durable task graph, git-synced)    ← epics, stories, tasks, dependencies
       │  traces artifacts in
       ▼
  Knowledge Graph (.knowledge/)             ← specs, code, tests, decisions linked together
```

A **recipe** is the entry point — it knows *which* skill to load and *which* agent
to delegate to. A **skill** carries the methodology — it knows *how* to approach
a class of problems. An **agent** is a specialist persona — it knows *who* is
responsible and *what* their operating protocol is.

---

## Problem Statement

Building software with AI agents today has a fundamental flaw: agents are stateless.
Each session starts from scratch with no memory of past decisions, no durable task graph,
no quality standards, and no way to measure whether the agent is improving or regressing.
The result is inconsistent, unverifiable, hard-to-maintain code — fast to generate
but expensive to own.

---

## Vision

A harness where any software project can be developed by AI agents
with the same discipline, traceability, and quality gates as a senior engineering team:
specs before code, review before merge, verified before ship.

---

## Target Users

| Persona | Pain | How the harness helps |
|---|---|---|
| **Solo developer** | Agent forgets context between sessions | Beads + KG = persistent memory and task state |
| **Tech lead** | Cannot enforce coding standards across agent sessions | Skills = codified methodology, loaded automatically |
| **Product team** | Feature intent gets lost between discovery and delivery | /discover + /spec + KG traceability from intent to test |
| **Harness contributor** | Cannot tell if a skill change improved or degraded quality | A/B eval suite measures skill delta before and after |

---

## Success Criteria

| What success looks like | How it is measured |
|---|---|
| A developer can set up the harness and start a new feature in under 30 minutes | Time-to-first-spec on a clean install |
| An agent implements a feature that satisfies its acceptance criteria without manual correction | Spec ACs verified automatically in the Knowledge Graph |
| Every implementation is traceable: code ↔ acceptance criterion ↔ spec | `node apps/kg/dist/cli.js reason` shows zero acceptance criteria without a linked test |
| Adding a new skill measurably improves agent output quality | A/B eval suite shows positive skill delta (with_skill pass rate > without_skill) |
| Agent decisions survive session boundaries | `bd prime` injects past decisions and memories into every new session |

---

## Non-Goals

- Not a replacement for CI/CD pipelines or production infrastructure
- Not a code generation tool — Goose handles generation, the harness guides it
- Not a project management system — Beads is intentionally minimal (no Gantt, no burndown)
- Not opinionated about the tech stack of products built with the harness

---

## Principles

1. **Composable** — each component (recipe, skill, agent, app) works standalone or together
2. **Spec-anchored** — specs persist and evolve; code follows specs, never the reverse
3. **Self-improving** — A/B evals and Knowledge Graph gaps are the feedback loop
4. **Minimal blast radius** — every change is scoped, claimed, and verified before closing
5. **No privilege escalation** — agents always find user-space alternatives; no sudo
