# Agentic Development Harness — Loop Engineering Pack

## Why

AI agents can write code, but reliable software development requires more than code generation. A dependable harness must preserve intent, bound the work, produce reproducible evidence, maintain durable state, and stop or escalate when progress is no longer justified.

This pack makes that **loop explicit, auditable, interruptible, and repeatable** in Goose.

## What

This repository is a minimal Loop Engineering extension for Goose. It deliberately avoids reproducing a human organisation chart as a collection of agents.

The core loop uses three agents, each justified by a distinct execution property:

- **repository-researcher** — read-only exploration and evidence gathering;
- **change-builder** — bounded implementation with explicit scope;
- **independent-verifier** — verification separated from the agent that made the change.

Premium variants (`change-builder-premium`, `independent-verifier-premium`) activate on rework.
`error-analyzer` is summoned by `loop-breaker` on repeated tool failures; it is not part of the normal flow.

The orchestration itself is not represented as another persona. It is implemented through **recipes**, **skills**, **hooks**, persistent state, budgets, evidence, and explicit transition decisions.

## How

The default controlled loop is:

```text
Trigger
  -> Research
  -> Frame one bounded task
  -> Build
  -> Collect deterministic evidence
  -> Verify independently
  -> Persist state
  -> Decide: CONTINUE | REPLAN | WAIT | COMPLETE | ESCALATE | ABORT
```

```mermaid
flowchart LR
    T([Trigger]) --> R[Read-only research]
    R --> F[Task framing]
    F --> B[Bounded build]
    B --> E[Evidence collection]
    E --> V[Independent verification]
    V --> D{Decision}
    D -->|CONTINUE| F
    D -->|REPLAN| R
    D -->|WAIT| W[External gate]
    W --> D
    D -->|COMPLETE| M[Memory + handoff]
    D -->|ESCALATE| H[Human decision]
    D -->|ABORT| A[Stop with evidence]
```

## Architecture

```text
Layer 4: LOOP CONTROL   State transitions, budgets, stagnation and stop conditions
Layer 3: RECIPES        Executable workflows and delegated phases
Layer 2: AGENTS         Isolated execution contexts with distinct permissions
Layer 1: SKILLS         Reusable methods and decision rules
Layer 0: GOOSE          Runtime, tools, sessions, extensions and subagents
```

### Responsibility mapping

| Mechanism      | Responsibility                                                                 |
|----------------|--------------------------------------------------------------------------------|
| **Agent**      | Isolated execution context with a specific permission or independence boundary |
| **Skill**      | Reusable method loaded when relevant                                           |
| **Recipe**     | Executable workflow and phase sequencing                                       |
| **Plugin**     | Distribution unit for hooks and support scripts                                |
| **Hook**       | Event-driven guard or trace action                                             |
| **Evidence**   | Deterministic proof produced by tests, linters, builds or inspections          |
| **State**      | Durable iteration status, decisions, budgets and evidence references           |
| **Controller** | Transition logic implemented by the loop recipe and loop-control skill         |

## Repository structure

```text
.agents/
├── agents/
│   ├── repository-researcher.md
│   ├── change-builder.md
│   └── independent-verifier.md
├── skills/
│   ├── task-framing/
│   │   └── SKILL.md
│   ├── evidence-verification/
│   │   └── SKILL.md
│   ├── loop-control/
│   │   └── SKILL.md
│   ├── interface-quality/
│   │   └── SKILL.md
│   ├── ui-design/
│   │   └── SKILL.md
│   ├── ux-principles/
│   │   └── SKILL.md
│   └── wcag-accessibility-audit/
│       └── SKILL.md
└── plugins/
    └── loop-engineering/
        ├── plugin.json
        ├── hooks/
        │   └── hooks.json
        └── scripts/
            ├── guard-shell.sh
            └── record-event.sh

.goose/
└── recipes/
    ├── research.yaml
    ├── implement.yaml
    ├── verify.yaml
    └── loop-engineering.yaml
```

<!-- BEGIN GENERATED: agents-table -->
## Named agents (6)

Named agents in `.agents/agents/` — invoke with Goose Summon natural language:
`load agent <name>` (in-session) or `delegate task bd-xxx and into those task load agent <name>` (isolated).

| Agent | Role | Model |
|-------|------|-------|
| `change-builder` | Implements one claimed bounded Beads task and produces candidate evidence withou | claude-sonnet-4-6 |
| `change-builder-premium` | Premium implementation agent invoked after 2+ rework cycles. | gpt-5.6-sol |
| `error-analyzer` |  | claude-sonnet-4-6 |
| `independent-verifier` | Independently judges a Beads task against predefined acceptance criteria and rep | claude-sonnet-4-6 |
| `independent-verifier-premium` | Premium verification agent invoked after 2+ rework cycles. | gpt-5.6-sol |
| `repository-researcher` | Builds an evidence-backed repository and Beads state map before implementation w | claude-sonnet-4-6 |
<!-- END GENERATED: agents-table -->

<!-- BEGIN GENERATED: skills-table -->
## Skills (12)

| Skill | Purpose |
|-------|---------|
| `domain-modeling` | Build and sharpen a project's domain model. |
| `evidence-verification` | Evaluate engineering work against predefined acceptance criteria using reproducible eviden |
| `grill-me` | A relentless interview to sharpen a plan or design. |
| `grill-with-docs` | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glo |
| `grilling` | Grill the user relentlessly about a plan, decision, or idea. |
| `interface-quality` | Shared quality floor for UI evaluation: evidence labeling, anti-generic patterns, and stru |
| `loop-control` | Govern a Beads-backed engineering loop with explicit progress, budgets, dependencies, and |
| `output-discipline` | Keep tool outputs within token budget. |
| `task-framing` | Convert an engineering objective into the smallest independently verifiable Beads task contract. |
| `ui-design` | Evaluate visual design decisions: design system token compliance, visual hierarchy, spacin |
| `ux-principles` | Evaluate user experience: journey completion, interaction state coverage (loading, empty, |
| `wcag-accessibility-audit` | Formal WCAG 2. |
<!-- END GENERATED: skills-table -->

## Recipes

| Recipe             | Purpose                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------|
| `research`         | Delegate read-only repository and failure research; return a bounded task contract               |
| `implement`        | Claim one ready Beads child task, delegate bounded writes, and collect candidate evidence        |
| `verify`           | Delegate independent read-only verification and persist criterion evidence plus verdict          |
| `loop-engineering` | Control Trigger → Planner → Builder → Verifier → Memory → Manager → Controller using Beads state |

## Loop decisions

Each iteration must end with exactly one typed decision:

| Decision   | Meaning                                                                           |
|------------|-----------------------------------------------------------------------------------|
| `CONTINUE` | A justified next bounded task exists                                              |
| `REPLAN`   | Current assumptions or task decomposition are invalid                             |
| `WAIT`     | Progress depends on an external gate or event                                     |
| `COMPLETE` | All acceptance criteria are supported by evidence                                 |
| `ESCALATE` | A human decision, permission or risk acceptance is required                       |
| `ABORT`    | A budget, safety limit, impossibility or repeated stagnation requires termination |

Completion must never be accepted solely because the builder reports that the work is done.

## Stop and escalation conditions

The loop must stop or escalate when at least one of these conditions applies:

- all acceptance criteria are proven;
- the maximum iteration, duration, or token budget is reached;
- the same failure repeats without a materially different hypothesis;
- no measurable progress occurs across consecutive iterations;
- required evidence cannot be produced;
- a destructive or privileged action requires approval;
- constraints conflict or the objective is impossible under the current conditions.

## Loop state x Harness

| Étape             | Diagramme         | Recipe                                      | Agent                                      | Skill                                                                        | Plugin                                                    |
|-------------------|-------------------|---------------------------------------------|--------------------------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------|
| **00 Trigger**    | `trigger.puml`    | `loop-engineering.yaml` (entrée)            | —                                          | —                                                                            | `loop-engineering` (SessionStart, UserPromptSubmit hooks) |
| **01 Planner**    | `planner.puml`    | `research.yaml` (sous-boucle)               | `repository-researcher` (lecture seule)    | `task-framing` (décomposition contrat)                                       | —                                                         |
| **02 Builder**    | `builder.puml`    | `implement.yaml` (sous-boucle)              | `change-builder` (session isolée)          | `task-framing` (restate contract)                                            | `loop-engineering` + `prevent-catastrophe` (guard-shell)  |
| **03 Verifier**   | `verifier.puml`   | `verify.yaml` (sous-boucle)                 | `independent-verifier` (session ≠ builder) | `evidence-verification` (verdicts typés)                                     | `loop-engineering` (guard-shell)                          |
| **04 Memory**     | `memory.puml`     | —                                           | ⚠️ **aucun agent dédié**                   | `loop-control` (beads-control-plane.md)                                      | `beads-telemetry` (PostToolUse hooks)                     |
| **05 Manager**    | `manager.puml`    | —                                           | ⚠️ **aucun agent dédié**                   | `loop-control` (priorité, no-progress)                                       | —                                                         |
| **06 Controller** | `controller.puml` | `loop-engineering.yaml` (décisions finales) | —                                          | `loop-control` (6 transitions: CONTINUE/REPLAN/WAIT/COMPLETE/ESCALATE/ABORT) | —                                                         


## Installation

### Project-local installation

Copy the directories into the target repository while preserving hidden paths:

```bash
cp -a .agents /path/to/project/
cp -a .goose /path/to/project/
```

### User-level installation

```bash
mkdir -p ~/.agents/agents ~/.agents/skills ~/.agents/plugins
mkdir -p ~/.config/goose/recipes

cp -a .agents/agents/. ~/.agents/agents/
cp -a .agents/skills/. ~/.agents/skills/
cp -a .agents/plugins/. ~/.agents/plugins/
cp -a .goose/recipes/. ~/.config/goose/recipes/
```

## Validation

Validate each recipe with the installed Goose CLI:

```bash
goose recipe validate .goose/recipes/research.yaml
goose recipe validate .goose/recipes/implement.yaml
goose recipe validate .goose/recipes/verify.yaml
goose recipe validate .goose/recipes/loop-engineering.yaml
```

Validate all recipes:

```bash
find .goose/recipes -name '*.yaml' -print -exec goose recipe validate {} \;
```

Check custom-agent frontmatter:

```bash
find .agents/agents -name '*.md' -maxdepth 1 -print
```

## Example execution

Run the complete loop:

```bash
goose run --recipe loop-engineering \
  --params objective="Implement the requested change" \
  --params max_iterations=8
```

Run an isolated phase:

```bash
goose run --recipe research \
  --params objective="Map the affected components" \
  --params run_id="<optional-beads-run-id>"
```

## Integration with a larger harness

This pack can be merged into a broader Agentic Development Harness using Beads, SDD, TDD, a knowledge graph, CI gates, or organisation-specific skills.

Recommended mapping:

```text
Intent -> Spec/AC -> Beads task -> Loop Engineering -> Evidence -> Memory/Handoff
```

In a larger harness:

- keep **Beads** as the durable work and dependency control plane;
- keep specifications and acceptance criteria as the source of intent;
- use the core loop agents (researcher, builder, verifier) where isolation or independent verification is useful;
- express domain expertise through skills;
- use recipes for orchestration;
- keep deterministic verification outside the model whenever possible.

## Design principles

1. **Few agents, strong boundaries.** Create an agent only when isolation, permissions, context, or independence justify it.
2. **Evidence over declarations.** Tests and reproducible commands establish completion.
3. **State outside conversation.** Durable decisions and progress must survive session compaction or restart.
4. **One bounded change per build iteration.** Reduce blast radius and simplify verification.
5. **Explicit terminal states.** Every loop must be able to complete, escalate, wait, or abort.
6. **Improve the loop deliberately.** Update skills, recipes, and guards only from observed evidence, not from uncontrolled self-modification.

## Evaluation strategy

The bundled `evals/` suite targets this minimal architecture directly:
**4 agents, 7 skills, and 4 recipes** (53 graded scenarios total).

It includes component scenarios and architecture-ablation benchmarks
against a larger harness. Component count is not a success metric;
the preferred configuration is the smallest one that meets the quality
gate and lies on the quality/cost Pareto frontier.

See [`evals/README.md`](evals/README.md).
## License / ownership

This pack is a local operational configuration. Adapt it to the governance, security, and delivery constraints of each project.
## Optional Eval Hub companion

Eval Hub is distributed separately from the core harness as an optional Bun-packaged application plus the `eval-hub` Agent Skill. See `docs/specs/eval-hub-skill-package.md` and `companions/eval-hub/skill/SKILL.md`. The core release remains evaluator-independent.
