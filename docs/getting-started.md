# Getting Started — Agentic Development Harness

This guide explains how to use the harness in practice:
which slash commands exist, when to invoke each one, and how they fit together.

---

## Setup (first time)

```bash
./scripts/install.sh          # install recipes, skills, agents into ~/.config/goose/
goose skills list             # verify 14+ skills visible
```

The installer registers all slash commands in `~/.config/goose/config.yaml`.
Restart Goose after installation.

---

## Slash commands — complete reference

| Command | When to use | What it does |
|---|---|---|
| `/dev` | Any task — when unsure which command to use | Master entry point: analyses intent, routes to the right specialist |
| `/discover` | Starting a new feature or initiative | Interview-style discovery → `.specs/features/[feature]/spec.md` + Beads epic |
| `/spec` | After discovery, before planning | Formal spec: WHEN/THEN/SHALL format, `[FEAT]-NN` IDs → spec.md + Beads stories |
| `/explore` | Unfamiliar codebase, blast-radius analysis | Read-only investigation → structured JSON report (no writes) |
| `/plan` | After spec, to create the task graph | Beads dependency graph from spec ACs — ordered, parallel-safe |
| `/implement` | A Beads task is ready to code | TDD: RED test → GREEN code → REFACTOR, minimal blast radius |
| `/review` | After implementation, before closing | Adaptive code review: PR / feature / security / global / hotfix |
| `/verify` | After implementation, before release | Auto-detects type: api (Bruno) · web (Playwright) · cli · lib · ui |
| `/design` | New UI or UX feature | Phase 1: UX research (`ux-quality`) → Phase 2: UI design (`ui-quality`) |
| `/sdd` | Full SDD governance loop | Orchestrates the complete discover → spec → plan → implement → verify cycle |
| `/release` | Ready to ship to production | Gate checks: tests · docs · recipe validation · rollback plan |
| `/remember` | Store or query a durable project fact | Reads/writes Beads memory (not session-scoped, persists across sessions) |

---

## SDD on-ramp — new feature from scratch

The recommended sequence for any new feature:

```
/discover "user authentication with Google OAuth"
      │  → .specs/features/auth-google/spec.md
      │  → Beads epic + user stories
      ▼
/spec "auth-google"
      │  → AC-AUTH-01..05 with WHEN/THEN/SHALL
      │  → [FEAT]-NN IDs linked in KG
      ▼
/plan "auth-google"
      │  → Beads dependency graph (ordered tasks)
      ▼
/implement <bead-id>
      │  → TDD: RED failing test → GREEN code → REFACTOR
      │  → bd update --add-label env:dev
      ▼
/review
      │  → APPROVE | PASS-WITH-NITS | BLOCK
      ▼
/verify
      │  → api · web · cli · lib · ui (auto-detected)
      │  → bd update --add-label env:staging
      ▼
/release
        → gate checks → bd update --add-label env:prod
```

---

## Everyday workflows

### Reviewing a pull request
```
/review
```
Detects PR type automatically (PR diff, feature, security, hotfix) and loads
the appropriate review reference from `code-review` skill.

### Debugging an unexpected failure
```
/explore "why does the auth endpoint return 500 on invalid email"
```
Read-only investigation. Returns: root cause hypothesis, blast radius, regression test to write.

### Investigating an unfamiliar codebase
```
/explore
```
Maps architecture, entry points, key modules, test coverage — no writes.

### Checking what to work on next
```
bd ready           # show claimable Beads
bd prime           # load context: memories, priorities, workflow
```

### Storing a project decision for future sessions
```
/remember
# or directly:
bd remember "Auth: JWT preferred over sessions — see ADR-003" --key auth-decision
```

---

## Which command for which situation?

| Situation | Command |
|---|---|
| "I have a vague idea, where do I start?" | `/discover` |
| "I need to write formal acceptance criteria" | `/spec` |
| "I need to understand existing code before touching it" | `/explore` |
| "I have ACs, I need to break them into tasks" | `/plan` |
| "I have a task to implement" | `/implement` |
| "I need someone to review my changes" | `/review` |
| "I need to check the feature works end to end" | `/verify` |
| "I'm working on UX or UI" | `/design` |
| "I'm ready to ship" | `/release` |
| "I'm not sure — just do the right thing" | `/dev` |

---

## Where to go deeper

| Topic | Document |
|---|---|
| Choosing a workflow | [docs/00-index.md](00-index.md) |
| Initialising a project with Beads | [docs/01-init-project.md](01-init-project.md) |
| Code review playbook | [docs/02-code-review.md](02-code-review.md) |
| Security review | [docs/03-security-review.md](03-security-review.md) |
| UX/UI review | [docs/04-uxr-simulation.md](04-uxr-simulation.md) |
| Spec review (writing good specs) | [docs/07-spec-review.md](07-spec-review.md) |
| Implementation loop (TDD detail) | [docs/09-implementation-loop.md](09-implementation-loop.md) |
| Release readiness checklist | [docs/10-release-readiness.md](10-release-readiness.md) |
| SDD + Beads memory | [docs/14-memory.md](14-memory.md) |
| Skill evaluation (A/B testing) | [docs/15-skill-evaluations.md](15-skill-evaluations.md) |
| Knowledge Graph lifecycle | [docs/kg-lifecycle.md](kg-lifecycle.md) |
| Use case scenarios | [USE_CASES.md](../USE_CASES.md) |
