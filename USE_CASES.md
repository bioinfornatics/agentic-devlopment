# Use Cases — Agentic Development Harness

This document is the entry point for scenario-driven usage of the Goose + Beads + SDD harness.

The detailed documentation is split by use case under [`docs/`](docs/). Each chapter is a standalone playbook with:

- when to use it;
- user scenario;
- recommended recipe/skill/agent;
- Beads state to create or inspect;
- exact command examples;
- expected outputs;
- quality gates and handoff checklist.

## Chapter map

| File | Use case | Primary recipe |
|---|---|---|
| [`00-index.md`](docs/00-index.md) | Scenario map and choosing the right workflow | `harness-master` |
| [`01-init-project.md`](docs/01-init-project.md) | Initialize a project with Goose + Beads + SDD | `sdd-master` / `harness-plan` |
| [`02-code-review.md`](docs/02-code-review.md) | Review a diff, PR, branch, or bead implementation | `harness-review` |
| [`03-security-review.md`](docs/03-security-review.md) | Threat and security review | `harness-review` + `code-review` |
| [`04-uxr-simulation.md`](docs/04-uxr-simulation.md) | Simulate UX research and product discovery | `ui-ux-suite` / `sdd-master` |
| [`05-ui-review.md`](docs/05-ui-review.md) | UI/visual/accessibility review | `ui-ux-suite` / `harness-web-test` |
| [`06-test-review.md`](docs/06-test-review.md) | Test strategy and test quality review | `harness-review` |
| [`07-spec-review.md`](docs/07-spec-review.md) | Spec review and acceptance criteria hardening | `sdd-master` / `harness-plan` |
| [`08-project-judge-score.md`](docs/08-project-judge-score.md) | Judge and score a project across quality dimensions | `harness-research` + `harness-review` |
| [`09-implementation-loop.md`](docs/09-implementation-loop.md) | Execute a bead from claim to verified handoff | `harness-implement` |
| [`10-release-readiness.md`](docs/10-release-readiness.md) | Release readiness, CI gates, and post-release verification | `harness-release` |
| [`11-incident-sre.md`](docs/11-incident-sre.md) | Incident/SRE investigation and operational follow-up | `harness-research` / `harness-plan` |
| [`12-multi-agent-research.md`](docs/12-multi-agent-research.md) | Parallel research with subagents | `harness-master` + Summon |
| [`13-documentation-review.md`](docs/13-documentation-review.md) | Documentation and onboarding quality review | `harness-review` |
| [`14-memory.md`](docs/14-memory.md) | Beads memory guardrails, commands, and pointer-memory token savings | `harness-memory` / `/memory` |

## Default command

When unsure, start with:

```bash
goose run --recipe harness-master   --params task="<what you want>"   --params repo_path="$PWD"
```

In a Beads-enabled repository, first run:

```bash
bd prime
bd ready --json
bd blocked --json
```
