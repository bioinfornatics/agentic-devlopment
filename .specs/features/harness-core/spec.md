# Spec: Harness Core — Recipes, Skills, Agents

> Status: Retro-spec (brownfield) — implementation predates this spec.
> Created: 2026-07-09
> Updated: 2026-07-10
> Scope: feat-recipe-ecosystem · feat-skill-library · feat-agent-roster

## Context

The agentic development harness provides a composable SDD+Beads+Goose toolchain.
This spec documents acceptance criteria derived from the implemented system.

---

## Acceptance Criteria

### AC-RECIPE-01 — Recipe validation

WHEN `goose recipe validate` runs on each of the following top-level recipes:

| Order | Recipe file                        | Slash command  |
|------:|------------------------------------|----------------|
| 1     | `.goose/recipes/discover.yaml`     | `/discover`    |
| 2     | `.goose/recipes/explore.yaml`      | `/explore`     |
| 3     | `.goose/recipes/spec.yaml`         | `/spec`        |
| 4     | `.goose/recipes/design.yaml`       | `/design`      |
| 5     | `.goose/recipes/sdd.yaml`          | `/sdd`         |
| 6     | `.goose/recipes/plan.yaml`         | `/plan`        |
| 7     | `.goose/recipes/dev.yaml`          | `/dev`         |
| 8     | `.goose/recipes/implement.yaml`    | `/implement`   |
| 9     | `.goose/recipes/review.yaml`       | `/review`      |
| 10    | `.goose/recipes/verify.yaml`       | `/verify`      |
| 11    | `.goose/recipes/release.yaml`      | `/release`     |
| 12    | `.goose/recipes/remember.yaml`     | `/remember`    |
| 13    | `.goose/recipes/doc-review.yaml`   | `/doc-review`  |
| 14    | `.goose/recipes/harness-review.yaml` | —            |

THEN every recipe returns "valid" with 0 failures.

---

### AC-RECIPE-02 — Recipe workflow structure

WHEN a recipe is invoked
THEN it emits First Visible Output before any tool call
AND it loads the relevant skill(s) via `load skills <name>`
AND it delegates to the correct agent(s) per the following wiring table:

| Recipe     | Skills loaded                                                                                        | Agents delegated to              |
|------------|------------------------------------------------------------------------------------------------------|----------------------------------|
| design     | ux-quality, cognitive-ux, ui-quality, atomic-design, design-systems-arch, webapp-testing, agentic-ux | ux-researcher, ui-designer       |
| dev        | agentic-dev-harness, beads-harness                                                                   | harness-orchestrator (in-session, then delegates by task type) |
| discover   | sdd, agentic-dev-harness                                                                             | ux-researcher, product-owner     |
| doc-review | agentic-dev-harness, beads-harness                                                                   | review-critic (in-session, CRITICAL escalation only)           |
| explore         | agentic-dev-harness                                                                             | codebase-researcher              |
| harness-review  | code-review, agentic-dev-harness, beads-harness                                                 | review-critic                    |
| implement       | beads-harness, sdd, agentic-dev-harness                                                         | implementation-worker, tdd-guide |
| plan       | beads-harness, sdd                                                                                   | beads-planner, architect         |
| release    | agentic-dev-harness                                                                                  | principal-engineer               |
| remember   | beads-harness                                                                                        | (direct bd calls — no agent)     |
| review     | code-review                                                                                          | review-critic                    |
| sdd        | sdd, agentic-dev-harness                                                                             | harness-orchestrator (in-session, then routes by SDD phase)    |
| spec       | sdd, beads-harness                                                                                   | architect, tdd-guide             |
| verify     | agentic-dev-harness, webapp-testing                                                                  | qa-automation (in-session); ui-designer (summon, ui/web path)  |

---

### AC-RECIPE-03 — Slash command registration

WHEN `./scripts/install.sh` runs
THEN all 13 slash commands are registered in `~/.config/goose/config.yaml`:

```
/design   /dev   /discover   /doc-review   /explore   /implement   /plan
/release  /remember   /review   /sdd   /spec   /verify
```

AND each maps to its corresponding recipe file in `~/.config/goose/recipes/`.

---

### AC-SKILL-01 — Skill discoverability

WHEN `goose skills list` runs
THEN all of the following 18 domain skills are visible (plus `skill-creator` tooling):

| Skill name             | Domain                              |
|------------------------|-------------------------------------|
| `agentic-dev-harness`  | Harness orientation & delegation    |
| `agentic-ux`           | UX for agentic interfaces           |
| `atomic-design`        | Component hierarchy                 |
| `beads-harness`        | Task tracking (Beads/Dolt)          |
| `code-review`          | Adaptive code review                |
| `cognitive-ux`         | Cognitive load & usability          |
| `design-systems-arch`  | Design system architecture          |
| `frontend-blueprint`   | Frontend architecture               |
| `goose-orchestration`  | Multi-agent orchestration           |
| `knowledge-graph`      | KG CRUD & reasoning                 |
| `sdd`                  | Spec-Driven Development             |
| `systematic-debugging` | Root cause & debugging protocol     |
| `ui-quality`           | UI technical quality                |
| `ux-quality`           | UX quality critique                 |
| `webapp-testing`       | Browser/server integration testing  |
| `atomic-design-fundamentals` | Foundational atomic design concepts |
| `design-critique-case-studies` | Design critique with case studies |
| `wcag-accessibility-audit` | WCAG 2.2 accessibility audit       |

---

### AC-RECIPE-04 — Orchestration vs specialist session pattern (→ AD-001)

WHEN a recipe is invoked
THEN it follows exactly one of:

  a) **Specialist** — loads ≥1 specialist agent(s) in-session via `load agent X`
     (design, discover, doc-review, explore, implement, plan, release, review, spec, verify)

  b) **Orchestration** — loads `harness-orchestrator` in-session; ALL specialists are
     summoned as isolated sub-sessions; no specialist is loaded in-session
     (dev, sdd)

  c) **Skill-only** — loads skills, no agent in-session
     (remember)

AND the in-session agent(s) SHALL match the `"agents"` field in the recipe's eval JSON
AND no recipe SHALL mix `harness-orchestrator` with a specialist agent in the same session

---

### AC-SKILL-02 — Skill self-validation

WHEN an agent loads a skill
THEN the skill contains a self-validation checklist (`- [ ]` items)
AND the skill includes a Knowledge Generation step (orient before acting).

---

### AC-AGENT-01 — Agent format compliance

WHEN agents are loaded from `.agents/agents/`
THEN each of the following 12 agents has all four required sections
     (Prompt Defense Baseline · Operating Process · Output Format · Remember mantra):

| Agent file                 | Persona                  |
|----------------------------|--------------------------|
| `architect.md`             | System architecture      |
| `beads-planner.md`         | Task graph & backlog     |
| `codebase-researcher.md`   | Codebase exploration     |
| `harness-orchestrator.md`  | Session orchestration    |
| `implementation-worker.md` | Feature implementation   |
| `principal-engineer.md`    | Release & quality gates  |
| `product-owner.md`         | Discovery & requirements |
| `qa-automation.md`         | Test automation & verify |
| `review-critic.md`         | Code review & blocking   |
| `tdd-guide.md`             | Test-Driven Development  |
| `ui-designer.md`           | UI design & components   |
| `ux-researcher.md`         | UX research & personas   |

---

## Non-goals

- No performance benchmarks on recipe execution time
- No multi-user or concurrent session support
