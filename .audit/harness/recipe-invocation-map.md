# Recipe invocation map

| Recipe | Path | In-session agents | Delegation/subrecipes | Validation |
|---|---|---|---|---|
| `clarify` | `.goose/recipes/clarify.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `constitution` | `.goose/recipes/constitution.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `design` | `.goose/recipes/design.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `dev` | `.goose/recipes/dev.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `discover` | `.goose/recipes/discover.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `doc-review` | `.goose/recipes/doc-review.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `explore` | `.goose/recipes/explore.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `harness-audit` | `.goose/recipes/harness-audit.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `harness-doc-review` | `.goose/recipes/harness-doc-review.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `harness-master` | `.goose/recipes/harness-master.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `harness-review` | `.goose/recipes/harness-review.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `implement` | `.goose/recipes/implement.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `plan` | `.goose/recipes/plan.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `release` | `.goose/recipes/release.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `remember` | `.goose/recipes/remember.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `review` | `.goose/recipes/review.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `sdd` | `.goose/recipes/sdd.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `spec` | `.goose/recipes/spec.yaml` | prompt-declared | see YAML prompt | validates exit 0 |
| `verify` | `.goose/recipes/verify.yaml` | prompt-declared | see YAML prompt | validates exit 0 |

## Key AD-001 mappings

- Orchestration: `dev`, `sdd`, and audit contract for `harness-audit` main session use orchestrator.
- Skill-only: `remember`.
- Specialist: phase recipes load one or more specialist agents in-session.
- Finding HA-F001 records harness-audit eval wiring mismatch with its orchestration contract.
