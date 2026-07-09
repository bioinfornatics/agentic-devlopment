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

## Value Proposition — DORA Metrics & Efficiency

The harness is built around the insight that **agentic development compounds
the four DORA metrics** when disciplined by SDD:

| DORA Metric | Without harness | With harness |
|---|---|---|
| **Deployment frequency** | Limited by human review cycles | Agents iterate 24/7; review is gated not bottlenecked |
| **Lead time for changes** | Days (spec → design → code → review → deploy) | Hours (spec in /discover, implement in one session, review immediate) |
| **Change failure rate** | High when agents "vibe-code" without spec | Low: spec-anchored implementation, TDD gate, review-critic block |
| **Time to recovery (MTTR)** | Hours finding root cause | Minutes: KG traces incident → AC → code → test; systematic-debugging skill |

### Team size & time to market

A single developer with the harness can carry the velocity of a small team:

- Agents handle **routine implementation** (boilerplate, tests, review) at machine speed
- The developer focuses on **intent, spec quality, and architectural decisions**
- **Fewer people** are needed to ship and maintain a feature at the same quality level
- **Time to market** compresses: discovery-to-spec in one session; spec-to-verified in the next

### Token efficiency — lower LLM cost

Unguided agents over-explore: they read entire codebases, retry failed commands,
and generate irrelevant output. The harness reduces token waste through:

| Mechanism | Token saving |
|---|---|
| **Skills with scoped protocols** | Agent reads only what the skill prescribes (e.g. PR review: diff + 3 files, not full repo) |
| **Beads claim before write** | Agent does not re-explore context already known from the bead description |
| **Knowledge Graph orientation** | `open_nodes([FEAT]-NN)` returns exactly the AC, spec, and existing tests — no scanning |
| **Subrecipes (isolated sessions)** | Each subagent gets only the context it needs; orchestrator stays at < 10% context |
| **First Visible Output rule** | Agent commits scope before any tool call — no "explore then decide" drift |

### Measurable efficiency targets

| Metric | Target | Measured by |
|---|---|---|
| Feature lead time | < 4 hours from /discover to verified PR | Bead created_at → bd close timestamp |
| Change failure rate | < 10% of implemented beads require rework | review-critic BLOCK rate / total beads closed |
| Context budget per session | < 30% used for orchestrator sessions | events.jsonl token count |
| Skill delta | Positive on all A/B evals | run-skill-ab-suite.py --check |

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