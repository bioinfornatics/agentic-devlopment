# Recipe Invocation Map

| Recipe | Top level | In-session agents | Skills | Subrecipes | Delegates parsed | Beads refs | Gates/failure refs |
|---|---:|---|---|---|---|---:|---:|
| .goose/recipes/clarify.yaml | True | product-owner | agentic-devlopment, sdd | - | - | True | True |
| .goose/recipes/constitution.yaml | True | architect | agentic-devlopment, sdd | - | - | True | True |
| .goose/recipes/design.yaml | True | ui-designer, ux-researcher | agentic-devlopment, agentic-ux, atomic-design, cognitive-ux, design-systems-arch, ui-quality, ux-quality, webapp-testing | verify | - | True | False |
| .goose/recipes/dev.yaml | True | orchestrator | agentic-devlopment, beads, goose-orchestration | explore, plan, implement, review, verify, release | - | True | True |
| .goose/recipes/discover.yaml | True | product-owner, ux-researcher | agentic-devlopment, sdd | - | - | True | True |
| .goose/recipes/doc-review.yaml | True | review-critic | agentic-devlopment, beads | doc-review | - | True | True |
| .goose/recipes/explore.yaml | True | codebase-researcher | agentic-devlopment | explore | - | True | False |
| .goose/recipes/harness-audit.yaml | True | harness-judge | harness-judge | harness_judge | - | True | True |
| .goose/recipes/harness-doc-review.yaml | True | review-critic | agentic-devlopment, beads | doc-review | - | True | True |
| .goose/recipes/harness-master.yaml | True | orchestrator | agentic-devlopment, and, beads, goose-orchestration | harness-review, harness-doc-review | - | True | False |
| .goose/recipes/harness-review.yaml | True | review-critic | agentic-devlopment, beads, code-review | review, doc-review | - | True | False |
| .goose/recipes/implement.yaml | True | implementation-worker, tdd-guide | agentic-devlopment, beads, sdd | implement | - | True | True |
| .goose/recipes/plan.yaml | True | architect, planner | beads, sdd | plan-worker | - | True | True |
| .goose/recipes/release.yaml | True | principal-engineer | agentic-devlopment | release | - | True | True |
| .goose/recipes/remember.yaml | True | - | beads | - | - | True | False |
| .goose/recipes/review.yaml | True | review-critic | code-review | review | - | True | True |
| .goose/recipes/sdd.yaml | True | orchestrator | agentic-devlopment, sdd | - | - | True | True |
| .goose/recipes/spec.yaml | True | architect, tdd-guide | beads, sdd | spec-worker | - | True | True |
| .goose/recipes/subrecipes/amend-spec.yaml | False | - | beads, sdd | - | - | True | False |
| .goose/recipes/subrecipes/doc-review.yaml | False | - | agentic-devlopment, beads | - | - | True | True |
| .goose/recipes/subrecipes/explore.yaml | False | - | agentic-devlopment | - | - | True | True |
| .goose/recipes/subrecipes/harness-judge-audit.yaml | False | harness-judge | harness-judge | - | - | False | True |
| .goose/recipes/subrecipes/implement.yaml | False | - | agentic-devlopment, knowledge-graph, sdd | - | - | True | True |
| .goose/recipes/subrecipes/plan.yaml | False | - | beads, sdd | - | - | True | True |
| .goose/recipes/subrecipes/release.yaml | False | - | agentic-devlopment | - | - | True | True |
| .goose/recipes/subrecipes/review.yaml | False | - | code-review, knowledge-graph | - | - | True | False |
| .goose/recipes/subrecipes/spec.yaml | False | - | beads, sdd | - | - | True | True |
| .goose/recipes/subrecipes/verify.yaml | False | - | agentic-devlopment, atomic-design, ui-quality, webapp-testing | - | - | False | True |
| .goose/recipes/verify.yaml | True | qa-automation | agentic-devlopment, ui-quality, webapp-testing | verify | - | True | True |