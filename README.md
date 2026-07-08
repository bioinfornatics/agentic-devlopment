# Agentic Development Harness

A portable Goose + Beads harness for durable agentic software development.

This repository packages reusable **Goose recipes**, **Goose skills**, and **named agents** that make agentic development more reliable, repeatable, and auditable.

## Core idea

- **Goose** is the runtime: extensions, skills, recipes, subrecipes, sessions, and subagents.
- **Beads (`bd`)** is the durable control plane: issues, dependencies, gates, molecules/wisps, memory, and handoffs.
- **SDD** is the development method: spec first, encode work in Beads, implement with tests, review, verify, and remember learnings.

```text
intent → spec → Beads graph → TDD/implementation → review → validation → handoff
```

## Repository layout

```text
.agents/
  agents/                 # Named Goose subagents discoverable by Summon
  skills/                 # Portable Goose skills

.goose/
  recipes/                # Goose recipes and subrecipes
    subrecipes/           # Reusable delegated workflow units
    templates/            # Small helper scripts/templates
```

## Main recipes

| Recipe | Purpose |
|---|---|
| `harness-master` | Default orchestrator for most Goose + Beads development work |
| `harness-research` | Read-only codebase / docs / Beads research |
| `harness-plan` | Convert a goal into a Beads-backed executable plan |
| `harness-implement` | Implement a scoped bead with tests and handoff |
| `harness-review` | Review code, tests, risks, and Beads hygiene |
| `harness-web-test` | Browser/UI/accessibility verification |
| `harness-release` | Gated release / CI / verification workflow |
| `harness-memory` | Beads memory stewardship: remember/search/recall/forget durable facts |
| `sdd-master` | Spec-Driven Development governance over the harness |
| `ui-ux-suite` | UI/UX, accessibility, design-system, and web quality workflow |

## Main skills

| Skill | Purpose |
|---|---|
| `agentic-dev-harness` | The combined Goose + Beads operating model |
| `beads-harness` | Beads commands and durable workflow semantics |
| `goose-orchestration` | Goose recipes, skills, subagents, Summon, and extension rules |
| `sdd` | Spec-Driven Development loop |
| `code-review` | Code review method for correctness, tests, security, and handoff |
| `ux-quality` | Unified UI/UX quality framework |
| `webapp-testing` | Browser automation and local web-app verification method |


Skill evaluations live outside the skill packages in `evals/skills/`; see `docs/15-skill-evaluations.md` for the evaluation-driven workflow, visual definition review, and real A/B runner. Quick definition review: `python scripts/render-skill-eval-review.py`, then open `dist/skill-eval-review/index.html`. Real A/B example: `python scripts/run-skill-ab-eval.py --skill code-review`; old/new from git: `python scripts/run-skill-ab-eval.py --skill code-review --mode old-new --baseline-git-ref HEAD~1`. Full suite: `python scripts/run-skill-ab-suite.py --continue-on-failure`, then open `dist/evals/skills/index.html`. To test with a specific Goose binary, pass `--goose-cli ../third-parties/goose/target/debug/goose` or set `GOOSE_EVAL_CLI`. A/B runners use isolated Goose homes by default so `without_skill` hides installed project skills, agents, and recipes. Generic agent/recipe evals use `scripts/run-harness-ab-eval.py --kind agents|recipes`. SQLite history, including provider, model, turn usage, and feedback recommendations, is written to `dist/evals/evaluation.db`.

Editor shortcuts are available as VS Code tasks in `.vscode/tasks.json` and JetBrains shared run configurations in `.run/`, including run-and-open-review entries for complete or partial skill eval suites.

## Named agents

Named agents live in `.agents/agents/` and can be invoked through Goose Summon. All 11 agents follow the same format contract: Prompt Defense Baseline, rich identity, operating process with numbered phases, domain protocol, false positives list, output format template, skill pointer, and a closing prime directive.

### Orchestration + Research

| Agent | Role | Invoke when |
|---|---|---|
| `harness-orchestrator` | Lead orchestrator for the SDD+TDD loop | Multi-step, multi-agent, or multi-phase work |
| `codebase-researcher` | Read-only architecture mapper | Mapping blast radius, gathering evidence before planning |
| `beads-planner` | Beads dependency graph builder | Converting a goal into executable Beads issues |

### SDD Roles (Spec-Driven Development)

| Agent | Role | Invoke when |
|---|---|---|
| `product-owner` | PRD + acceptance criteria with 100-pt quality gate | Start of any new feature or initiative |
| `architect` | System design, ADRs, trade-off analysis | Touching system boundaries, technology decisions |

### TDD Roles (Test-Driven Development)

| Agent | Role | Invoke when |
|---|---|---|
| `tdd-guide` | RED→GREEN→REFACTOR cycle + 80% coverage gate | Before any new feature implementation or bug fix |
| `implementation-worker` | Scoped bead implementation with TDD | Bead is claimed and ready for coding |
| `qa-automation` | Full test pipeline: unit/integration/E2E + CI | After implementation is complete |

### Review + Quality

| Agent | Role | Invoke when |
|---|---|---|
| `review-critic` | Confidence-filtered code review with proof requirement | After any implementation, before closing a bead |
| `principal-engineer` | Blast radius, breaking changes, architecture coherence | Change touches shared infra, public APIs, or 2+ BLOCK verdicts |
| `ux-researcher`       | User research, personas, journey maps         | New feature, user validation |
| `ui-designer`         | Design system, WCAG 2.2 AA, a11y audit       | Any UI change |
| `atomic-design`       | Component hierarchy (Atoms→Templates)         | Building component libraries |
| `cognitive-ux`        | Laws of UX, Gestalt, cognitive biases         | Evaluating/justifying design decisions |
| `agentic-ux`          | Agentic AI UX, trust calibration              | Designing AI agent interfaces |
| `design-systems-arch` | Token architecture, governance, maturity      | Design system strategy |
| `frontend-blueprint`  | Discovery → design direction → atomic build   | Creating new interfaces |

### SDD+TDD Orchestration Flow

```
product-owner → architect → beads-planner → tdd-guide
  → implementation-worker → review-critic
       ↑                        │  (BLOCK → up to 2 retries)
       └── principal-engineer ◄─┘  (escalation on 2+ BLOCK)
  → qa-automation

codebase-researcher   (read-only, parallel, any phase)
harness-orchestrator  (coordinates the full loop)
ux-researcher + ui-designer  (parallel for UI-bearing changes)
```

Example invocations:

```text
delegate(source: "review-critic", instructions: "Review the current diff. Do not modify files.")
delegate(source: "architect", instructions: "Design the caching layer for the sync service.")
delegate(source: "tdd-guide", instructions: "Write failing tests for bd create duplicate detection.")
delegate(source: "product-owner", instructions: "Spec out the memory stewardship feature.")
```

## Quick start

Install/copy the harness into your Goose config:

```bash
./scripts/install.sh
```

PowerShell:

```powershell
./scripts/install.ps1
```

The installer also upserts slash commands (`/harness`, `/review`, `/sdd`, etc.) in `~/.config/goose/config.yaml` without duplicating existing managed entries.

Or manually copy:

```bash
mkdir -p ~/.config/goose ~/.agents
cp -a .goose/recipes ~/.config/goose/recipes
cp -a .agents/skills ~/.agents/skills
cp -a .agents/agents ~/.agents/agents
```

Validate recipes:

```bash
goose recipe validate .goose/recipes/harness-master.yaml
find .goose/recipes -name '*.yaml' -print -exec goose recipe validate {} \;
```

List skills:

```bash
goose skills list
```

Run the master harness:

```bash
goose run --recipe harness-master \
  --params task="Review the current diff" \
  --params repo_path="$PWD"
```

## Use-case playbooks

Detailed scenario documentation lives in [`USE_CASES.md`](USE_CASES.md) and [`docs/`](docs/). Start there for init project, code review, security review, UXR simulation, UI review, test review, spec review, project scoring, implementation, release, incident, multi-agent research, and documentation review, and Beads memory stewardship.

## Common workflows

### Code review

```bash
goose run --recipe harness-review \
  --params task="review current diff" \
  --params repo_path="$PWD" \
  --params constraints="Read-only. Focus on correctness, tests, security, and Beads hygiene."
```

### Research

```bash
goose run --recipe harness-research \
  --params task="understand the sync architecture" \
  --params repo_path="$PWD"
```

### Planning

```bash
goose run --recipe harness-plan \
  --params task="add feature X" \
  --params repo_path="$PWD"
```

### Implementation

```bash
goose run --recipe harness-implement \
  --params task="bd-123" \
  --params repo_path="$PWD"
```

### UI / accessibility verification

```bash
goose run --recipe ui-ux-suite \
  --params target="settings page" \
  --params repo_path="$PWD"
```

## Build documentation bundle

Generate a single HTML/PDF bundle from the Markdown docs:

```bash
./scripts/build-docs.sh
```

Outputs:

```text
dist/docs/html/agentic-development-harness.html
dist/docs/pdf/agentic-development-harness.pdf
```

Requires `pandoc`; PDF generation uses `xelatex` when available, otherwise tries `chromium`.

### Beads memory

Use memory for durable facts, not work tracking:

```bash
goose run --recipe harness-memory --params action="remember: default validation is make test" --params repo_path="$PWD"
```

Interactive slash command:

```text
/memory remember: default validation is make test
```

See [`docs/14-memory.md`](docs/14-memory.md).

Memory as navigation index: prefer short pointer memories that tell future agents which canonical file/section to read, when to read it, and the one-line invariant.

## Beads operating rules

When working in a Beads-enabled repository:

1. Start with `bd prime`.
2. Inspect work with `bd ready --json` and `bd blocked --json`.
3. Claim before durable edits: `bd update <id> --claim --json`.
4. Encode dependencies with needs language: `bd dep add <issue> <depends-on>`.
5. Create discovered work with `--deps discovered-from:<parent>`.
6. Use `bd remember --key <key> "fact"` for durable memory.
7. Use `bd gate` for async waits.
8. Close completed work with `bd close <id> --reason "Done" --json`.

Do not use markdown TODO files as the source of truth for durable agentic work.

## License / ownership

This harness is local operational configuration. Adapt freely for your projects.
