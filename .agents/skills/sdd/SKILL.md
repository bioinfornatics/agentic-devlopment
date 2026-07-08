---
name: sdd
description: >
  Spec-Driven Development: product intent, spec-driven development, TDD, operational readiness, and continuous learning.
metadata:
  version: 2.0.0
---

# SDD — Spec-Driven Development

SDD is a lightweight development method over the Goose+Beads harness.

## Loop

1. **Intent** — clarify user, outcome, constraints, non-goals.
2. **Spec** — acceptance criteria, risks, data model/API/UI contracts.
3. **Graph** — encode work in Beads with dependencies and gates.
4. **TDD** — failing test/spec check before implementation when practical.
5. **Implement** — smallest coherent slice.
6. **Verify** — tests, review, UX/security/perf as relevant.
7. **Learn** — remember durable facts as short pointer memories when possible, and file follow-up beads for work.

## Auto-sizing (apply before starting any SDD phase)

Assess scope first. Apply only the depth the complexity warrants:

| Scope | Signal | Specify | Design | TDD | Implement | Review |
|---|---|---|---|---|---|---|
| **Micro** | 1 file, obvious change | 1-sentence inline | skip | skip | inline | skip |
| **Small** | ≤3 files, clear intent | brief AC | skip | tests only | standard | quick |
| **Medium** | clear feature, <10 tasks | full AC | inline | full TDD | standard | full |
| **Large** | multi-component, >10 tasks | full spec + requirement IDs | full ADR | full TDD per task | per-task | full |
| **Complex** | ambiguity, new domain | full spec + discuss gray areas | research + ADR | full TDD | per-task | full + UAT |

**Discuss gray areas** when the feature has any implicit-requirement dimension present:
- Failure / partial-failure states (timeouts, rollbacks, partial saves)
- Idempotency / retry / duplicate handling
- Auth boundaries or rate limits
- Concurrency or ordering guarantees
- Data lifecycle or expiry (TTL, archival, deletion)
- Observability requirements (logging, metrics, tracing hooks)
- External-dependency failure handling (circuit breakers, fallbacks)
- State-transition integrity (valid transitions, guards)
- Input validation bounds (limits, formats, sanitization)

For Micro/Small: if listing steps reveals >5 steps or complex dependencies, STOP and escalate to Medium.

## Principles

## Requirement traceability

Every spec must assign a unique ID to each acceptance criterion:
- Format: `[FEAT]-01`, `[FEAT]-02` (e.g., `AUTH-01`, `CART-03`)
- IDs trace through: spec → tasks → tests → validation
- Every Beads task references the requirement IDs it satisfies
- Every test assertion cites the requirement it verifies

**Spec-Anchored Outcome Rule (from TLC v3.2.0):**
A test is spec-anchored only when its asserted value matches the **spec-defined expected outcome** — not just that an assertion exists. Where the spec does not define a precise outcome, mark the criterion as a **spec-precision gap** rather than writing a vague assertion and calling it covered.

Example:
  Spec says: "WHEN login fails THEN system SHALL return 401 with body `{error: 'invalid_credentials'}`"
  ✅ spec-anchored: `expect(response.status).toBe(401)` + `expect(response.body.error).toBe('invalid_credentials')`
  ❌ not spec-anchored: `expect(response.status).not.toBe(200)` (too vague)
  ⚠️ spec-precision gap: spec says "return an error" without a defined code or body → flag, do not pass silently

## Mode rules

If the request says `plan`, `do not implement yet`, `spec`, or `proposal`, stay in planning mode:

- do not edit files;
- do not create, claim, update, close, or link Beads unless the user explicitly asks to persist the plan;
- inspect only the minimum context needed;
- output proposed Beads graph as titles/dependencies, not executed commands.

Planning outputs must include:

- user/stakeholder;
- desired outcome;
- constraints and assumptions;
- non-goals;
- acceptance criteria;
- risks;
- proposed dependency-aware Beads graph.

Release readiness outputs must use an explicit matrix covering tests, docs, install-script safety, recipe validation, rollback, observability/diagnostics, and open blockers, each marked pass/fail/blocked/unknown.

- Prefer reversible increments.
- Make dependencies explicit.
- Optimize for handoff: every future agent should know current state from Beads.
- Treat quality gates as product requirements, not cleanup.

## Knowledge generation (before any SDD phase)

Before starting any SDD phase, generate explicit knowledge:
1. Run `bd prime` — loads current issues, memories, and workflow context.
2. Run `bd ready --json` — identifies what is claimable.
3. Read the nearest spec file or acceptance criteria if they exist.
Only after this knowledge is generated: name the SDD phase and proceed.

## Gotchas

- **Never skip to implement** — the SDD loop is Intent→Spec→Graph→TDD→Implement→Review→Verify. Skipping Spec or TDD to reach Implement faster violates the loop and produces unverifiable code.
- **Acceptance criteria must be testable** — "the system should be fast" is not acceptance criteria. "endpoint responds in <200ms at p95 under 100 rps" is.
- **RED before GREEN** — in the TDD phase, the failing test must be written and confirmed to fail before any implementation code is written. A test written after implementation is not TDD.
- **Beads before edits** — claim a bead before any file write. A retrospective claim after editing is not atomic.

## Self-validation loop

### Before advancing to the next SDD phase, verify:
- [ ] Current phase is explicitly named in the output (Intent / Spec / TDD / Implement / Review / Verify)
- [ ] Acceptance criteria are testable (specific measurable outcome, not aspirational prose)
- [ ] No file writes happened before a bead was claimed
- [ ] If TDD phase: failing test was written and confirmed to fail before implementation
- [ ] If Implement phase: `bd update --claim` appears before the first `write` or `edit` tool call

## Maker/Checker

SDD phases have built-in maker/checker splits:
- Spec → verified by Architect (ADR trade-off analysis)
- Acceptance criteria → verified by TDD-guide (can a failing test be written?)
- Implementation → verified by Review-critic (diff review)
- Release readiness → verified by Principal-engineer (blast radius check)

Never advance a phase using the same agent that produced it.

## Beads loop

The SDD loop runs on Beads:
  bd prime                           → knowledge generation (orient)
  bd ready --json                    → triage: which SDD bead is next?
  bd update <id> --claim             → claim before any phase artifact
  [produce phase artifact]           → spec / test / code / review
  bd create --deps discovered-from   → file discovered follow-up work
  bd close <id> --reason "phase done"
  bd remember "..." --key <key>      → store durable phase decisions
