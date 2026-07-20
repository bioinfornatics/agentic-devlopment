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

| Order | Recipe file                          | Slash command  |
|------:|--------------------------------------|----------------|
| 1     | `.goose/recipes/dev.yaml`            | `/dev`         |
| 2     | `.goose/recipes/spec.yaml`           | `/spec`        |
| 3     | `.goose/recipes/plan.yaml`           | `/plan`        |
| 4     | `.goose/recipes/implement.yaml`      | `/implement`   |
| 5     | `.goose/recipes/review.yaml`         | `/review`      |
| 6     | `.goose/recipes/verify.yaml`         | `/verify`      |
| 7     | `.goose/recipes/explore.yaml`        | `/explore`     |
| 8     | `.goose/recipes/design.yaml`         | `/design`      |
| 9     | `.goose/recipes/release.yaml`        | `/release`     |
| 10    | `.goose/recipes/doc-review.yaml`     | `/doc-review`  |
| 11    | `.goose/recipes/harness-review.yaml` | —              |
| 12    | `.goose/recipes/harness-audit.yaml`  | —              |

THEN every recipe returns "valid" with 0 failures.

---

### AC-RECIPE-02 — Recipe workflow structure

WHEN a recipe is invoked
THEN it emits First Visible Output before any tool call
AND it loads the relevant skill(s) via `load skills <name>`
AND it delegates to the correct agent(s) per the following wiring table:

| Recipe          | Skills loaded                                                                                         | Agents delegated to                                            |
|-----------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| dev             | agentic-devlopment, beads                                                                             | orchestrator (in-session, then delegates by task type)         |
| spec            | sdd, beads                                                                                            | architect, tdd-guide                                           |
| plan            | beads, sdd                                                                                            | planner, architect                                             |
| implement       | beads, sdd, agentic-devlopment                                                                        | implementation-worker, tdd-guide                               |
| review          | code-review                                                                                           | review-critic                                                  |
| verify          | agentic-devlopment, webapp-testing                                                                    | qa-automation (in-session); ui-designer (summon, ui/web path)  |
| explore         | agentic-devlopment                                                                                    | codebase-researcher                                            |
| design          | ux-quality, cognitive-ux, ui-quality, atomic-design, design-systems-arch, webapp-testing, agentic-ux  | ux-researcher, ui-designer                                     |
| release         | agentic-devlopment                                                                                    | principal-engineer                                             |
| doc-review      | agentic-devlopment, beads                                                                            | review-critic (scope: all/skills/recipes/docs/agents/memory)   |
| harness-review  | code-review, agentic-devlopment, beads                                                                | review-critic (scope: code/docs/full; output: json/markdown)   |
| harness-audit   | goose-orchestration, sdd, knowledge-graph, harness-judge                                              | orchestrator (in-session; isolated harness_judge subrecipe)    |

---

### AC-RECIPE-03 — Slash command registration

WHEN `./scripts/install.sh` runs
THEN all 10 slash commands are registered in `~/.config/goose/config.yaml`:

```
/dev  /spec  /plan  /implement  /review  /verify  /explore  /design  /release  /doc-review
```

AND each maps to its corresponding recipe file in `~/.config/goose/recipes/`.

---

### AC-SKILL-01 — Skill discoverability

WHEN `goose skills list` runs
THEN all of the following 17 domain skills are visible (plus `skill-creator` tooling):

| Skill name                     | Domain                              |
|--------------------------------|-------------------------------------|
| `agentic-devlopment`           | Harness orientation & delegation    |
| `agentic-ux`                   | UX for agentic interfaces           |
| `atomic-design`                | Component hierarchy                 |
| `beads`                        | Task tracking (Beads/Dolt)          |
| `code-review`                  | Adaptive code review                |
| `cognitive-ux`                 | Cognitive load & usability          |
| `design-critique-case-studies` | Design critique with case studies   |
| `design-systems-arch`          | Design system architecture          |
| `frontend-blueprint`           | Frontend architecture               |
| `gdd`                          | Generative-Driven Design framework  |
| `goose-orchestration`          | Multi-agent orchestration           |
| `harness-judge`                | LLM-as-judge harness evaluation     |
| `knowledge-graph`              | KG CRUD & reasoning                 |
| `sdd`                          | Spec-Driven Development             |
| `systematic-debugging`         | Root cause & debugging protocol     |
| `ui-quality`                   | UI technical quality                |
| `ux-quality`                   | UX quality critique                 |
| `webapp-testing`               | Browser/server integration testing  |
| `wcag-accessibility-audit`     | WCAG 2.2 accessibility audit        |

---

### AC-RECIPE-04 — Orchestration vs specialist session pattern (→ AD-001)

WHEN a recipe is invoked
THEN it follows exactly one of:

  a) **Specialist** — loads ≥1 specialist agent(s) in-session via `load agent X`
     (design, explore, implement, plan, release, review, spec, verify, doc-review, harness-review)

  b) **Orchestration** — loads `orchestrator` in-session; ALL specialists are
     summoned as isolated sub-sessions; no specialist is loaded in-session
     (dev, harness-audit)

AND the in-session agent(s) SHALL match the `"agents"` field in the recipe's eval JSON
AND no recipe SHALL mix `orchestrator` with a specialist agent in the same session

---

### AC-RECIPE-05 — Cross-recipe ordering gates (→ D7)

WHEN `review.yaml` produces an APPROVE or PASS-WITH-NITS verdict
THEN it executes `bd update <bead-id> --add-label env:reviewed`

WHEN `verify.yaml` is invoked
THEN it checks for `env:reviewed` label before running any verification step
AND halts with a gate error message if the label is absent

WHEN `verify.yaml` completes with all checks PASS
THEN it executes `bd update <bead-id> --add-label env:verified`

WHEN `release.yaml` is invoked
THEN it checks for `env:verified` label before running any release step
AND halts with a gate error message if the label is absent

The label state machine is: `env:dev → env:reviewed → env:verified → env:prod`

---

### AC-SKILL-02 — Skill self-validation

WHEN an agent loads a skill
THEN the skill contains a self-validation checklist (`- [ ]` items)
AND the skill includes a Knowledge Generation step (orient before acting).

---

### AC-AGENT-01 — Agent format compliance

WHEN agents are loaded from `.agents/agents/`
THEN each of the following 13 agents has all five required sections
     (Prompt Defense Baseline · Required Skill Load · When to Invoke · Operating Process · Output Format):

| Agent file                 | Persona                  |
|----------------------------|--------------------------|
| `architect.md`             | System architecture      |
| `planner.md`         | Task graph & backlog     |
| `codebase-researcher.md`   | Codebase exploration     |
| `orchestrator.md`          | Session orchestration    |
| `implementation-worker.md` | Feature implementation   |
| `principal-engineer.md`    | Release & quality gates  |
| `product-owner.md`         | Discovery & requirements |
| `qa-automation.md`         | Test automation & verify |
| `review-critic.md`         | Code review & blocking   |
| `harness-judge.md`         | Harness evaluation judge |
| `tdd-guide.md`             | Test-Driven Development  |
| `ui-designer.md`           | UI design & components   |
| `ux-researcher.md`         | UX research & personas   |

---

### AC-AGENT-02 — Agent skill contract completeness

WHEN an agent file exists in `.agents/agents/`
THEN it MUST contain a `## Required Skill Load` section
AND  the section MUST include a stop-if-missing guard of the form:
     "If `<skill>` cannot be loaded, stop and report that [role] is blocked…"
AND  `python3 scripts/check-consistency.py` MUST exit 0 with no FAIL lines

This AC is verified mechanically by `check-consistency.py` (section: Agent skill contracts).

---

## Non-goals

- No performance benchmarks on recipe execution time
- No multi-user or concurrent session support
