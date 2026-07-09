# .specs/ - Spec-Driven Development

SOTA SDD 2026. Research: sdd-sota-2026.md. Decisions: STATE.md.

## File naming (SOTA consensus)

| File | When | Contents |
|---|---|---|
| spec.md | Always | ACs WHEN/THEN/SHALL, [FEAT]-NN IDs |
| design.md | Medium+ | Architecture, components, data flow, risks |
| contracts/s.md | API-heavy | Interface contract, data schemas |
| components.md | UI features | Atomic Design, ASCII art mockups |
| context.md | Complex | Gray area decisions |

## Project-level files

| File | Contents |
|---|---|
| product.md | Vision, users, metrics, principles |
| architecture.md | System overview, component contracts |
| STATE.md | AD-NNN Architecture Decisions + handoff |
| sdd-sota-2026.md | SOTA research |

## Auto-sizing

| Scope | spec | design |---|---|---|---|---|
| Micro 1 file | inline | no | no | no |
| Small <= 3 | spec.md | no | no | no |
| Medium | spec.md | design.md | no | if API |
| Large | spec.md | design.md | Complex | spec.md | design.md 
## Features

| Feature | spec | design |---|---|---|---|---|
| harness-core | done | done | no | kg-cli + kg-mcp |
| kg-integration | done | no | done | no |
| eval-suite | done | no | no | no |
| beads-workflow | done | no | no | no |

## Create a spec

/spec "feature name"
  -> .specs/features/name/spec.md
  -> bd remember pointer
  -> node apps/kg/dist/cli.js pipeline
## Beads remplace tasks.md et plan.md

| Besoin | Outil |
|---|---|
| Tâches, planning, suivi | Beads (`bd create --issue_type task`) |
| Spec, design, contrats, décisions | .specs/ |

Jamais de `tasks.md` ou `plan.md` dans `.specs/` — utiliser `bd create`.
