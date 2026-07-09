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
| Goal | Category | Recipe / slash command |
|---|---|---|
| "Set this repo up for agentic development" | Init project | `sdd`, `plan` |
| "Start a new feature" | Discovery | `/discover` |
| "Write the spec" | Specification | `/spec` |
| "Review my changes" | Code review | `/review` |
| "Find vulnerabilities" | Security review | `/review` with security constraints |
| "Test UX with simulated users" | UXR simulation | `/design`, `/sdd` |
| "Does this UI look good / accessible?" | UI review | `/design`, `/verify` |
| "Are the tests good enough?" | Test review | `/review` with test constraints |
| "Is this spec complete?" | Spec review | `/sdd`, `/spec` |
| "Score this project" | Judge and score | `/explore`, `/review` |
| "Implement this bead" | Implementation loop | `/implement` |
| "Prepare a release" | Release readiness | `/release` |
| "Investigate outage / flaky CI" | Incident/SRE | `/explore`, `/plan` |
| "Research these modules in parallel" | Multi-agent research | `/dev` with mode=explore |
| "Improve docs/onboarding" | Documentation review | `/review` |
| "Remember this repo convention" | Memory stewardship | `/remember` |

## Golden path

```bash
bd prime || true
bd ready --json || true

goose run --recipe dev --params task="<goal>" --params repo_path="$PWD" --params constraints="<optional constraints>"
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
- a specialist role helps, e.g. `review-critic`, `ux-researcher`, or `ui-designer`;
- you want to preserve the main context;
- you need independent critique.

Do not delegate overlapping write scopes.
