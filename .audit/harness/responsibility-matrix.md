# Responsibility Matrix

| Agent | Model | Loaded skills detected | Main sections | Invoked by recipes (detected load-agent) | Target decision |
|---|---|---|---|---|---|
| architect | claude-opus-4-5 | agentic-devlopment, design-systems-arch, sdd | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | constitution, plan, spec | KEEP_AND_IMPROVE |
| codebase-researcher | claude-sonnet-4-5 | agentic-devlopment, goose-orchestration | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | explore | KEEP_AND_IMPROVE |
| harness-judge | claude-sonnet-4-5 | harness-judge | Prompt Defense Baseline, Your Role, Required Skill Load, Judging Principles, Evaluation Domains | harness-audit, harness-judge-audit | KEEP_AND_IMPROVE |
| implementation-worker | claude-sonnet-4-5 | agentic-devlopment, beads, knowledge-graph, sdd | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | implement | KEEP_AND_IMPROVE |
| orchestrator | claude-opus-4-5 | agentic-devlopment, beads, goose-orchestration | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | dev, harness-master, sdd | KEEP_AND_IMPROVE |
| planner | claude-sonnet-4-5 | beads | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | plan | KEEP_AND_IMPROVE |
| principal-engineer | claude-opus-4-5 | agentic-devlopment, code-review | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | release | KEEP_AND_IMPROVE |
| product-owner | claude-opus-4-5 | agentic-devlopment, agentic-ux, sdd | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | clarify, discover | KEEP_AND_IMPROVE |
| qa-automation | claude-sonnet-4-5 | agentic-devlopment, systematic-debugging, webapp-testing | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | verify | KEEP_AND_IMPROVE |
| review-critic | claude-sonnet-4-5 | code-review, knowledge-graph | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | doc-review, harness-doc-review, harness-review, review | KEEP_AND_IMPROVE |
| tdd-guide | claude-sonnet-4-5 | agentic-devlopment, sdd, systematic-debugging | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | implement, spec | KEEP_AND_IMPROVE |
| ui-designer | claude-sonnet-4-5 | atomic-design, cognitive-ux, design-systems-arch, frontend-blueprint, ui-quality, ux-quality, webapp-testing | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | design | KEEP_AND_IMPROVE |
| ux-researcher | claude-sonnet-4-5 | agentic-ux, cognitive-ux, ux-quality, webapp-testing | Prompt Defense Baseline, Your Role, Required Skill Load, When to Invoke, Operating Process | design, discover | KEEP_AND_IMPROVE |

Note: recipes also invoke subrecipes and delegate in prose; regex evidence is conservative.
