# Current inventory

## Status summary

- Skills: 20 directories with `SKILL.md` (19 domain skills plus `skill-creator` tooling per harness-core spec).
- Agents: 13 named agent files.
- Top-level recipes: 19 YAML files.
- Subrecipes: 10 YAML files.
- Evals: see `command-outputs/inventory-files.txt`.

## L1 skills
| Skill | Path | Lines | Target decision |
|---|---|---:|---|
| `agentic-devlopment` | `.agents/skills/agentic-devlopment/SKILL.md` | 215 | KEEP_AND_IMPROVE |
| `agentic-ux` | `.agents/skills/agentic-ux/SKILL.md` | 141 | KEEP_AND_IMPROVE |
| `atomic-design` | `.agents/skills/atomic-design/SKILL.md` | 162 | KEEP_AND_IMPROVE |
| `beads` | `.agents/skills/beads/SKILL.md` | 267 | KEEP_AND_IMPROVE |
| `code-review` | `.agents/skills/code-review/SKILL.md` | 171 | KEEP_AND_IMPROVE |
| `cognitive-ux` | `.agents/skills/cognitive-ux/SKILL.md` | 82 | KEEP_AND_IMPROVE |
| `design-critique-case-studies` | `.agents/skills/design-critique-case-studies/SKILL.md` | 143 | KEEP_AND_IMPROVE |
| `design-systems-arch` | `.agents/skills/design-systems-arch/SKILL.md` | 103 | KEEP_AND_IMPROVE |
| `frontend-blueprint` | `.agents/skills/frontend-blueprint/SKILL.md` | 106 | KEEP_AND_IMPROVE |
| `gdd` | `.agents/skills/gdd/SKILL.md` | 177 | KEEP_AND_IMPROVE |
| `goose-orchestration` | `.agents/skills/goose-orchestration/SKILL.md` | 401 | KEEP_AND_IMPROVE |
| `harness-judge` | `.agents/skills/harness-judge/SKILL.md` | 494 | KEEP_AND_IMPROVE |
| `knowledge-graph` | `.agents/skills/knowledge-graph/SKILL.md` | 182 | KEEP_AND_IMPROVE |
| `sdd` | `.agents/skills/sdd/SKILL.md` | 265 | KEEP_AND_IMPROVE |
| `skill-creator` | `.agents/skills/skill-creator/SKILL.md` | 504 | KEEP_AND_IMPROVE |
| `systematic-debugging` | `.agents/skills/systematic-debugging/SKILL.md` | 333 | KEEP_AND_IMPROVE |
| `ui-quality` | `.agents/skills/ui-quality/SKILL.md` | 154 | KEEP_AND_IMPROVE |
| `ux-quality` | `.agents/skills/ux-quality/SKILL.md` | 118 | KEEP_AND_IMPROVE |
| `wcag-accessibility-audit` | `.agents/skills/wcag-accessibility-audit/SKILL.md` | 202 | KEEP_AND_IMPROVE |
| `webapp-testing` | `.agents/skills/webapp-testing/SKILL.md` | 119 | KEEP_AND_IMPROVE |

## L2 agents
| Agent | Path | Model | Lines | Target decision |
|---|---|---|---:|---|
| `architect` | `.agents/agents/architect.md` | gpt-5.5 | 204 | KEEP_AND_IMPROVE |
| `codebase-researcher` | `.agents/agents/codebase-researcher.md` | gpt-5.5 | 178 | KEEP_AND_IMPROVE |
| `harness-judge` | `.agents/agents/harness-judge.md` | gpt-5.5 | 171 | KEEP_AND_IMPROVE |
| `implementation-worker` | `.agents/agents/implementation-worker.md` | gpt-5.5 | 238 | KEEP_AND_IMPROVE |
| `orchestrator` | `.agents/agents/orchestrator.md` | gpt-5.5 | 204 | KEEP_AND_IMPROVE |
| `planner` | `.agents/agents/planner.md` | gpt-5.5 | 132 | KEEP_AND_IMPROVE |
| `principal-engineer` | `.agents/agents/principal-engineer.md` | gpt-5.5 | 168 | KEEP_AND_IMPROVE |
| `product-owner` | `.agents/agents/product-owner.md` | gpt-5.5 | 250 | KEEP_AND_IMPROVE |
| `qa-automation` | `.agents/agents/qa-automation.md` | gpt-5.5 | 196 | KEEP_AND_IMPROVE |
| `review-critic` | `.agents/agents/review-critic.md` | gpt-5.5 | 257 | KEEP_AND_IMPROVE |
| `tdd-guide` | `.agents/agents/tdd-guide.md` | gpt-5.5 | 209 | KEEP_AND_IMPROVE |
| `ui-designer` | `.agents/agents/ui-designer.md` | gpt-5.5 | 140 | KEEP_AND_IMPROVE |
| `ux-researcher` | `.agents/agents/ux-researcher.md` | gpt-5.5 | 134 | KEEP_AND_IMPROVE |

## L3 top-level recipes
| Recipe | Path | Lines | Target decision |
|---|---|---:|---|
| `clarify` | `.goose/recipes/clarify.yaml` | 222 | KEEP_AND_IMPROVE |
| `constitution` | `.goose/recipes/constitution.yaml` | 209 | KEEP_AND_IMPROVE |
| `design` | `.goose/recipes/design.yaml` | 99 | KEEP_AND_IMPROVE |
| `dev` | `.goose/recipes/dev.yaml` | 250 | KEEP_AND_IMPROVE |
| `discover` | `.goose/recipes/discover.yaml` | 165 | KEEP_AND_IMPROVE |
| `doc-review` | `.goose/recipes/doc-review.yaml` | 199 | KEEP_AND_IMPROVE |
| `explore` | `.goose/recipes/explore.yaml` | 90 | KEEP_AND_IMPROVE |
| `harness-audit` | `.goose/recipes/harness-audit.yaml` | 174 | KEEP_AND_IMPROVE |
| `harness-doc-review` | `.goose/recipes/harness-doc-review.yaml` | 89 | KEEP_AND_IMPROVE |
| `harness-master` | `.goose/recipes/harness-master.yaml` | 99 | KEEP_AND_IMPROVE |
| `harness-review` | `.goose/recipes/harness-review.yaml` | 182 | KEEP_AND_IMPROVE |
| `implement` | `.goose/recipes/implement.yaml` | 128 | KEEP_AND_IMPROVE |
| `plan` | `.goose/recipes/plan.yaml` | 189 | KEEP_AND_IMPROVE |
| `release` | `.goose/recipes/release.yaml` | 114 | KEEP_AND_IMPROVE |
| `remember` | `.goose/recipes/remember.yaml` | 89 | KEEP_AND_IMPROVE |
| `review` | `.goose/recipes/review.yaml` | 133 | KEEP_AND_IMPROVE |
| `sdd` | `.goose/recipes/sdd.yaml` | 179 | KEEP_AND_IMPROVE |
| `spec` | `.goose/recipes/spec.yaml` | 161 | KEEP_AND_IMPROVE |
| `verify` | `.goose/recipes/verify.yaml` | 174 | KEEP_AND_IMPROVE |

## Subrecipes
| Subrecipe | Path | Lines | Target decision |
|---|---|---:|---|
| `amend-spec` | `.goose/recipes/subrecipes/amend-spec.yaml` | 170 | KEEP_AND_IMPROVE |
| `doc-review` | `.goose/recipes/subrecipes/doc-review.yaml` | 196 | KEEP_AND_IMPROVE |
| `explore` | `.goose/recipes/subrecipes/explore.yaml` | 85 | KEEP_AND_IMPROVE |
| `harness-judge-audit` | `.goose/recipes/subrecipes/harness-judge-audit.yaml` | 164 | KEEP_AND_IMPROVE |
| `implement` | `.goose/recipes/subrecipes/implement.yaml` | 128 | KEEP_AND_IMPROVE |
| `plan` | `.goose/recipes/subrecipes/plan.yaml` | 85 | KEEP_AND_IMPROVE |
| `release` | `.goose/recipes/subrecipes/release.yaml` | 85 | KEEP_AND_IMPROVE |
| `review` | `.goose/recipes/subrecipes/review.yaml` | 101 | KEEP_AND_IMPROVE |
| `spec` | `.goose/recipes/subrecipes/spec.yaml` | 84 | KEEP_AND_IMPROVE |
| `verify` | `.goose/recipes/subrecipes/verify.yaml` | 136 | KEEP_AND_IMPROVE |

## Notable inventory issues

- `harness-agents-pointer` Beads memory is stale versus current 13-agent roster.
- `harness-audit` eval wiring declares `harness-judge` although recipe contract isolates the judge and loads orchestrator in main session.
- `amend-spec` has a recipe eval but is a subrecipe; resolver documentation is ambiguous.
