# Harness Recipe Guide

## Recipe Categories

### Entry Points (Orchestration Pattern)
| Recipe | Purpose | When to Use |
|--------|---------|-------------|
| `dev` | Main development entry | Any dev task, routes to specialists |
| `sdd` | SDD loop orchestration | Multi-phase spec→implement→verify |

### Phase Recipes (Specialist Pattern)
| Recipe | Agent | Purpose |
|--------|-------|---------|
| `discover` | product-owner | Problem→PRD→Epic |
| `spec` | architect | PRD→Formal spec with ACs |
| `plan` | planner | Spec→Beads dependency graph |
| `implement` | implementation-worker | Bead→Code with TDD |
| `review` | review-critic | Code→Approval/Block |
| `verify` | qa-automation | Code→Test evidence |
| `release` | principal-engineer | Verified→Released |

### Design Recipes
| Recipe | Agents | Purpose |
|--------|--------|---------|
| `design` | ux-researcher→ui-designer | Full UX+UI design flow |

### Audit Recipes
| Recipe | Agent | Purpose |
|--------|-------|---------|
| `harness-audit` | harness-judge | Forensic audit with KG reasoning (read-only) |
| `harness-review` | review-critic | Quality gate for harness changes (scope: code/docs/full, output: json/markdown) |

### Utility Recipes
| Recipe | Purpose |
|--------|---------|
| `explore` | Read-only codebase research |
| `remember` | Store durable facts in Beads |
| `clarify` | Clarify ambiguous requirements |
| `constitution` | Define project constitution |
| `doc-review` | Review project documentation |

## Key Distinctions

### harness-audit vs harness-review
- **harness-audit**: READ-ONLY scoring using harness-judge (72 criteria)
- **harness-review**: WRITE-capable code review of harness changes

### review vs harness-review
- **review**: General code review for any code
- **harness-review**: Specialized for harness artifacts (knows skill/agent/recipe structure)

### dev vs sdd
- **dev**: Entry point, routes to any specialist
- **sdd**: Specifically for SDD loop (spec→plan→implement→verify)
