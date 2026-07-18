# STATE.md — ADR Log + Project Handoff

> **Role**: Architecture Decision Records (ADR log) + session handoff.
> **Why here**: STATE.md makes SDD *spec-anchored* (level 2) vs merely *spec-first* (level 1).
>   Every active AD-NNN entry is a constraint future specs must conform to or explicitly supersede.
>   Without STATE.md, decisions made in one feature silently contradict the next.
>
> **Not a spec**: doesn't describe WHAT to build. Describes decisions that govern HOW specs are written.
> **Not AGENTS.md**: AGENTS.md = instructions for agents. STATE.md = project decisions log.

---

## AD-001 — Orchestration vs specialist recipe session pattern

**Date**: 2026-07-17
**Status**: Active
**Applies to**: All `.goose/recipes/*.yaml` files

### Decision

Two mutually exclusive patterns govern how a recipe adopts an agent persona:

**Specialist pattern** — the recipe session *is* the specialist.
Load one or more specialist agents in-session via `load agent X`.
Specialists collaborate within the shared session context.
Applies to: `design`, `discover`, `explore`, `implement`, `plan`, `release`, `review`, `spec`, `verify`.

**Orchestration pattern** — the recipe session *is* the orchestrator.
Load `harness-orchestrator` as the single in-session agent.
ALL specialist work is delegated via Summon (isolated sub-sessions).
No specialist agent is ever loaded in-session alongside the orchestrator.
Applies to: `dev`, `sdd`.

**Skill-only pattern** — no agent loaded, skill workflow only.
Applies to: `remember`.

### Invariants

- A recipe that loads `harness-orchestrator` in-session **SHALL NOT** also load any specialist agent in-session.
- The orchestrator summons specialists; it never inherits specialist methodology via `load agent`.
- A recipe's `"agents"` field in its eval JSON **SHALL** list only in-session agents — summoned sub-agents are **not** included.
- Every new recipe **SHALL** declare one of the three patterns above before merging.

### Rationale

Clean `layer-delta` A/B baselines require exactly knowing which agent the recipe adds on top of.
Predictable context budgets: the orchestrator session stays lean; specialist work is isolated.
Prevents implicit orchestration where a recipe delegates without declaring a persona, making
session behaviour and eval results unpredictable.

### Supersedes

Nothing. This is the initial formalization of a pattern already present in the implementation.

---

## AD-002 — Generated tables over hand-written documentation mirrors

**Date:** 2026-07-18 | **Status:** Active | **Applies to:** README.md, docs/15-skill-evaluations.md

### Decision

Documentation sections that mirror the state of files already on disk
(`.agents/skills/`, `.agents/agents/`, `.goose/recipes/`, `evals/`)
SHALL be **generated** from those files, not maintained by hand.

Principle source: Matt Pocock "Delete (most of) your docs"
(https://www.youtube.com/shorts/Fj8DKMbdIzU) — when there are two sources
of truth that can conflict, the documentation lies and the code is correct.

### Generated sections (marked with `<!-- BEGIN/END GENERATED: <section> -->`)

| Section | File | Source of truth |
|---------|------|-----------------|
| `skills-table` | `README.md` | `.agents/skills/*/SKILL.md` frontmatter |
| `agents-table` | `README.md` | `.agents/agents/*.md` frontmatter |
| `eval-skills` | `docs/15-skill-evaluations.md` | `evals/skills/*.json` |
| `eval-agents` | `docs/15-skill-evaluations.md` | `evals/agents/*.json` |
| `eval-recipes` | `docs/15-skill-evaluations.md` | `evals/recipes/*.json` |

### Workflow

1. Make structural change (add/rename/remove skill, agent, or recipe).
2. Run `python3 scripts/generate-tables.py` — regenerates all marked sections.
3. Run `python3 scripts/check-consistency.py` — validates counts and wiring.
4. The Goose `AfterFileEdit` hook runs `check-and-regenerate.sh` automatically during sessions (plugin: `.agents/plugins/harness-consistency/`).

Git hook install: `./scripts/install-git-hooks.sh` (copies `.agents/plugins/harness-consistency/scripts/pre-commit.sh` → `.git/hooks/pre-commit`)

### What NOT to generate

- ADRs (`STATE.md`) — capture WHY decisions were made; cannot be derived from code.
- Playbooks (`docs/01-16-*.md`) — narrate HOW to use the harness in context; cannot be derived.
- Specs (`.specs/features/*/spec.md`) — formal WHEN/THEN/SHALL criteria; cannot be derived.
- `AGENTS.md` — orientation and invariants for agents; cannot be derived.

### Rationale

Every naming change (skill, agent, recipe) previously required manually updating
5–10 documentation files. This caused documented drift — confirmed by the January 2026
audit that found 6 FAILs and 8 WARNs in `check-consistency.py`. Generated sections
eliminate that entire class of bug.

### Supersedes

Nothing. Initial formalization of a pattern introduced 2026-07-18.

---