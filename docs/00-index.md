# 00 — Choosing a Harness Workflow

Use this chapter to choose the correct scenario playbook.

## Development workflow

```mermaid
flowchart LR
    E(["/explore\nread-only research"]) --> P(["/plan\nBeads graph"])
    P --> T(["TDD\nRED — write failing test"])
    T --> I(["/implement\nGREEN + REFACTOR"])
    I --> O{observe\ntest result}
    O -- PASS --> V(["/verify\napi · web · cli · lib · ui"])
    O -- "FAIL (max 3×)" --> I
    V -- "✅ AC met" --> R(["/review\nAPPROVE / BLOCK"])
    R --> L(["/release\ngated + rollback"])
    V -- "❌ findings" --> FIX(["fix → re-verify"])
    FIX --> V

    style E fill:#e8f5e9,stroke:#388e3c
    style P fill:#e3f2fd,stroke:#1976d2
    style T fill:#fff3e0,stroke:#f57c00
    style I fill:#fce4ec,stroke:#c62828
    style O fill:#f3e5f5,stroke:#7b1fa2
    style V fill:#e0f2f1,stroke:#00796b
    style R fill:#fff9c4,stroke:#f9a825
    style L fill:#e8eaf6,stroke:#3949ab
```

## Mental model

The harness combines three layers:

1. **Goose runtime** — recipes, skills, extensions, subagents, sessions.
2. **Beads durable control plane** — issues, dependencies, claims, gates, memory, molecules/wisps.
3. **SDD method** — intent → spec → Beads graph → tests → implementation → review → verification.

## Decision table

| User says...                               | Use case             | Recipe                              |
|--------------------------------------------|----------------------|-------------------------------------|
| Goal                                       | Category             | Recipe / slash command              |
| ---                                        | ---                  | ---                                 |
| "Set this repo up for agentic development" | Init project         | `sdd`, `plan`                       |
| "Start a new feature"                      | Discovery            | `/discover`                         |
| "Write the spec"                           | Specification        | `/spec`                             |
| "Review my changes"                        | Code review          | `/review`                           |
| "Find vulnerabilities"                     | Security review      | `/review` with security constraints |
| "Test UX with simulated users"             | UXR simulation       | `/design`, `/sdd`                   |
| "Does this UI look good / accessible?"     | UI review            | `/design`, `/verify`                |
| "Are the tests good enough?"               | Test review          | `/review` with test constraints     |
| "Is this spec complete?"                   | Spec review          | `/sdd`, `/spec`                     |
| "Score this project"                       | Judge and score      | `/explore`, `/review`               |
| "Implement this bead"                      | Implementation loop  | `/implement`                        |
| "Prepare a release"                        | Release readiness    | `/release`                          |
| "Investigate outage / flaky CI"            | Incident/SRE         | `/explore`, `/plan`                 |
| "Research these modules in parallel"       | Multi-agent research | `/dev` with mode=explore            |
| "Improve docs/onboarding"                  | Documentation review | `/review`                           |
| "Remember this repo convention"            | Memory stewardship   | `/remember`                         |

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