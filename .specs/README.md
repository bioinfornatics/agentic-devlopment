# .specs/ - Spec-Driven Development

SOTA SDD 2026. Research: sdd-sota-2026.md. Decisions: STATE.md.

## File naming (SOTA consensus)

| File           | When        | Contents                                   |
|----------------|-------------|--------------------------------------------|
| spec.md        | Always      | ACs WHEN/THEN/SHALL, [FEAT]-NN IDs         |
| design.md      | Medium+     | Architecture, components, data flow, risks |
| contracts/s.md | API-heavy   | Interface contract, data schemas           |
| components.md  | UI features | Atomic Design, ASCII art mockups           |
| context.md     | Complex     | Gray area decisions                        |

## Note on STATE.md

STATE.md is an **ADR log** (Architecture Decision Records) — not a feature spec.
It makes SDD spec-anchored: every AD-NNN constrains future specs.
SOTA research → see `docs/sota/` (knowledge, not specification).

## Project-level files

| File            | Contents                                |
|-----------------|-----------------------------------------|
| product.md      | Vision, users, metrics, principles      |
| architecture.md | System overview, component contracts    |
| STATE.md        | AD-NNN Architecture Decisions + handoff |

## Auto-sizing

| Scope                   | spec.md   | design.md | contracts/ |
|-------------------------|-----------|-----------|------------|
| Micro (1 file)          | inline AC | —         | —          |
| Small (≤ 3 files)       | spec.md   | —         | —          |
| Medium (feature)        | spec.md   | design.md | if API     |
| Large (multi-component) | spec.md   | design.md | if API     |
| Complex (ambiguous)     | spec.md   | design.md | contracts/ |


## Features

| Feature | spec.md | design.md | contracts/ |
|---|---|---|---|
| [harness-core](features/harness-core/) | ✅ | ✅ | kg-cli, kg-mcp |
| [kg-integration](features/kg-integration/) | ✅ | — | — |
| [eval-suite](features/eval-suite/) | ✅ | — | — |
| [beads-workflow](features/beads-workflow/) | ✅ | — | — |


## Create a spec

/spec "feature name"
  -> .specs/features/name/spec.md
  -> bd remember pointer
  -> node apps/kg/dist/cli.js pipeline
## Beads replaces tasks.md et plan.md

| Besoin                             | Outil                                 |
|------------------------------------|---------------------------------------|
| Tasks, planning, tracking          | Beads (`bd create --issue_type task`) |
| Spec, design, contracts, decisions | .specs/                               |

Use `bd create` for tasks, planning, and tracking.