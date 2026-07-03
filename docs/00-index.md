# 00 — Choosing a Harness Workflow

Use this chapter to choose the correct scenario playbook.

## Mental model

The harness combines three layers:

1. **Goose runtime** — recipes, skills, extensions, subagents, sessions.
2. **Beads durable control plane** — issues, dependencies, claims, gates, memory, molecules/wisps.
3. **SDD method** — intent → spec → Beads graph → tests → implementation → review → verification.

## Decision table

| User says... | Use case | Recipe |
|---|---|---|
| "Set this repo up for agentic development" | Init project | `sdd-master`, `harness-plan` |
| "Review my changes" | Code review | `harness-review` |
| "Find vulnerabilities / threat model this" | Security review | `harness-review` with security constraints |
| "Pretend to be users and test the product idea" | UXR simulation | `ui-ux-suite`, `sdd-master` |
| "Does this UI look good / accessible?" | UI review | `ui-ux-suite`, `harness-web-test` |
| "Are the tests good enough?" | Test review | `harness-review` |
| "Is this spec complete?" | Spec review | `sdd-master`, `harness-plan` |
| "Score this project" | Judge and score | `harness-research`, `harness-review` |
| "Implement this bead" | Implementation loop | `harness-implement` |
| "Prepare a release" | Release readiness | `harness-release` |
| "Investigate outage / flaky CI / operational risk" | Incident/SRE | `harness-research`, `harness-plan` |
| "Research these modules in parallel" | Multi-agent research | Summon `delegate` |
| "Improve docs/onboarding" | Documentation review | `harness-review` |
| "Remember this repo convention" | Memory stewardship | `harness-memory` / `/memory` |

## Golden path

```bash
bd prime || true
bd ready --json || true

goose run --recipe harness-master   --params task="<goal>"   --params repo_path="$PWD"   --params constraints="<optional constraints>"
```

## When to create Beads

Create or update Beads whenever the work is durable:

- feature or bug;
- discovered follow-up;
- decision requiring traceability;
- async wait/gate;
- cross-session handoff;
- release or incident action.

Do **not** use markdown TODOs as durable task tracking.

## When to delegate

Delegate to subagents when:

- the work is read-only and parallelizable;
- a specialist role helps, e.g. `review-critic` or `ui-ux-auditor`;
- you want to preserve the main context;
- you need independent critique.

Do not delegate overlapping write scopes.
