---
name: sdd
description: >
  Load when implementing features using Spec-Driven Development: spec before code,
  requirements with [FEAT]-NN IDs, tests anchored to spec acceptance criteria.
  Provides: scale decision table (micro / small / medium / large / complex) to choose
  the right SDD depth, the full SDD loop (Intent → Spec → Graph → TDD → Implement →
  Verify → Learn), Beads integration for task tracking, maker/checker split patterns,
  and the brownfield retro-spec pattern for existing code. Use when asked to implement
  any non-trivial feature, write a formal spec, or establish verifiable acceptance
  criteria for a change.
  Do NOT use for documentation-only changes, read-only research, or sessions where no spec or implementation artifact will be produced.
metadata:
  version: 3.0.0
---

# SDD — Spec-Driven Development

Lightweight development method: every change starts from a spec with testable acceptance criteria,
runs through TDD, is verified by a separate checker, and closes with durable memory.

---

## 1. Orient first (before any SDD phase)

Generate explicit knowledge before naming a phase:

1. Run `bd prime` — loads current issues, memories, and workflow context.
2. Run `bd ready --json` — identifies what is claimable.
3. Read the nearest spec file or acceptance criteria if they exist.

Only after this: name the SDD phase and proceed.

---

## 2. Scale — choose depth before starting

Assess scope. Apply only the depth the complexity warrants.

| Scope       | Signal                     | Specify                        | Design         | TDD               | Implement | Review     |
|-------------|----------------------------|--------------------------------|----------------|-------------------|-----------|------------|
| **Micro**   | 1 file, obvious change     | 1-sentence inline              | skip           | skip              | inline    | skip       |
| **Small**   | ≤3 files, clear intent     | brief AC                       | skip           | tests only        | standard  | quick      |
| **Medium**  | clear feature, <10 tasks   | full AC                        | inline         | full TDD          | standard  | full       |
| **Large**   | multi-component, >10 tasks | full spec + requirement IDs    | full ADR       | full TDD per task | per-task  | full       |
| **Complex** | ambiguity, new domain      | full spec + discuss gray areas | research + ADR | full TDD          | per-task  | full + UAT |

**Escalate to next size tier** when listing steps reveals >5 steps or complex dependencies not visible at the start.

**Discuss gray areas** (always for Large/Complex) when any of these dimensions is present:
- Failure / partial-failure states · Idempotency / retry / duplicate handling
- Auth boundaries or rate limits · Concurrency or ordering guarantees
- Data lifecycle or expiry · Observability requirements
- External-dependency failure handling · State-transition integrity · Input validation bounds

---

## 3. Execute — the SDD loop

```
1. Intent ─→ 2. Spec ─→ 3. Graph ─→ 4. TDD ─→ 5. Implement ─→ 6. Verify ─┬─ AC met ─→ 7. Learn → close bead
                  ↑                     ↑           ↑                       │
                  └── spec gap ─────────┴─ test fail┴─ review finding ──────┘ (loop back)
                                                              max 3 iterations → escalate
```

1. **Intent** — clarify user, outcome, constraints, non-goals.
2. **Spec** — acceptance criteria, risks, data model/API/UI contracts.
3. **Graph** — encode works in Beads with dependencies and gates.
4. **TDD** — write the failing test first; confirm it fails before any implementation.
5. **Implement** — the smallest coherent slice that makes the failing test pass.
6. **Verify** — run tests, code review, UX/security/perf as relevant.
   **Branch point — do not proceed linearly:**
   - ✅ **All AC met** → advance to (7) Learn, close the bead.
   - ❌ **Test failure** → loop back to (5) Implement, fix the code.
   - ❌ **Review finding** → loop back to (5) Implement, address findings.
   - ❌ **Spec gap discovered** → loop back to (2) Spec, clarify AC before re-implementing.
   - ⚠️ **After 3 loops without resolution** → escalate to user; do not loop further.
7. **Learn** — remember durable facts as short pointer memories; file follow-up beads.

### Beads commands for the loop

```bash
`bd prime`                               # orient
`bd ready --json`                        # triage: which SDD bead is next?
`bd update <id> --claim`                 # claim before any phase artifact
# [produce phase artifact]             # spec / test / code / review
`bd create --deps discovered-from:<id>`  # file discovered follow-up work
`bd close <id> --reason "phase done"`
`bd remember "..." --key <key>`          # store durable phase decisions
```

---

## 4. Quality rules

### Requirement traceability

Assign a unique ID to every acceptance criterion:
- Format: `[FEAT]-01`, `[FEAT]-02` (e.g., `AUTH-01`, `CART-03`)
- IDs trace through: spec → tasks → tests → validation
- Every Beads task references the requirement IDs it satisfies
- Every test assertion cites the requirement it verifies

### Spec-anchored outcome rule

A test is spec-anchored only when its asserted value matches the **spec-defined expected outcome** — not just that an assertion exists. Where the spec does not define a precise outcome, mark it as a **spec-precision gap**, not a pass.

```
Spec: "WHEN login fails THEN system SHALL return 401 with {error: 'invalid_credentials'}"

✅  expect(response.status).toBe(401) + expect(response.body.error).toBe('invalid_credentials')
❌  expect(response.status).not.toBe(200)   ← too vague
⚠️  spec says "return an error" with no code → flag as spec-precision gap, do not pass silently
```

---

## 5. Constraints

### Principles

- Prefer reversible increments.
- Make dependencies explicit.
- Optimize for handoff: every future agent must know current state from Beads alone.
- Treat quality gates as product requirements, not cleanup.

### Planning-only mode

When the request says `plan`, `do not implement yet`, `spec`, or `proposal`:

- Do not edit files.
- Do not create, claim, update, close, or link Beads unless the user explicitly asks.
- Inspect only the minimum context needed.
- Output proposed Beads graph as titles/dependencies, not executed commands.

Planning output must cover: user/stakeholder · desired outcome · constraints · non-goals ·
acceptance criteria · risks · proposed dependency-aware Beads graph.

Release readiness output must use an explicit matrix: tests · docs · install-script safety ·
recipe validation · rollback · observability · open blockers — each marked pass/fail/blocked/unknown.

---

## 6. Safety rails

### Gotchas

- **Never skip to implement** — skipping Spec or TDD produces unverifiable code.
- **AC must be testable** — "the system should be fast" is not a criterion. "endpoint responds in <200ms at p95 under 100 rps" is.
- **RED before GREEN** — the failing test must be confirmed to fail before any implementation code.
- **Beads before edits** — claim a bead before any file write; a retrospective claim is not atomic.

### Self-validation checklist

Before advancing to the next SDD phase:
- [ ] The phase name is stated explicitly in the output (Intent / Spec / TDD / Implement / Review / Verify)
- [ ] Acceptance criteria are testable (measurable outcome, not aspirational prose)
- [ ] Do not write a file before a bead was claimed
- [ ] TDD phase: the failing test was run, and the output shows the failure before implementation
- [ ] Implement phase: `bd update --claim` appears before the first `write` or `edit` tool call

At phase (6) Verify — record the branch decision explicitly:
- [ ] All AC checked against spec-anchored outcome rule
- [ ] Decision recorded: **PASS** (→ 7) | **FAIL-IMPL** (→ 5) | **FAIL-SPEC** (→ 2) | **ESCALATE** (>3 loops)
- [ ] Loop count tracked: iteration 3 with same failure → escalate, do not loop again

---

## 7. Maker/Checker splits

Each SDD phase has a designated checker — never advance a phase using the same agent that produced it:

| Phase             | Maker                 | Checker                                          |
|-------------------|-----------------------|--------------------------------------------------|
| Spec + AC         | product-owner         | architect (feasibility), tdd-guide (testability) |
| Design            | architect             | principal-engineer (blast radius)                |
| TDD               | tdd-guide             | implementation-worker (can RED be reproduced?)   |
| Implement         | implementation-worker | review-critic (diff review)                      |
| Release readiness | review-critic         | principal-engineer (blast radius check)          |
---

## Brownfield / retro-spec pattern

When code precedes the spec (brownfield or existing harness):

- **Micro/Small**: Beads descriptions + acceptance criteria ARE the lightweight spec.
  No `.specs/features/*/spec.md` needed for changes < 3 files.

- **Medium/Large**: Create the spec file at `.specs/features/[feature]/spec.md`
  with WHEN/THEN/SHALL ACs and `[FEAT]-NN` IDs.
  Store the pointer: `bd remember "Spec for [feature]: canonical source is .specs/features/[feature]/spec.md" --key spec-[feature]-pointer`

- **Retro-spec**: If implementation exists without a spec, create the spec from the code.
  Mark `Status: Retro-spec (brownfield)` at the top of the file.
  This is SDD debt revealed by R1 (ACs without tests) and R3 (features without KG implementation).
---

## 8. Spec Health Audit — SPEC_DEVIATION triage loop

Run this audit at the Verify phase and after any multi-file implementation session.

### 8.1 Detect

```bash
./scripts/find-spec-deviations.sh          # scan entire repo
./scripts/find-spec-deviations.sh src/     # scope to changed directory
```

Output shows: `FILE | LINE | DEVIATION: <text> | REASON: <reason> | AC-REF: <ID>`.
Zero markers → "SPEC_DEVIATION scan: clean" → proceed.

### 8.2 Triage each marker

For every marker found, make an explicit decision:

| Decision | Meaning | Action |
|---|---|---|
| **Accept** | The deviation is correct; the spec was wrong or incomplete | Amend the spec AC to match the implementation |
| **Reject** | The implementation should have followed the spec | Create a SPEC_REVERT task in Beads |
| **Defer** | Decision requires human input | Create a DECISION bead and block the current bead on it |

### 8.3 Accept path — amend spec.md

1. Locate the affected spec file at `.specs/features/[feature]/spec.md`.
2. Find the AC by its `[FEAT]-NN` ID.
3. Draft a revised WHEN/THEN/SHALL statement that reflects the actual implementation.
4. Confirm the amendment is internally consistent (no contradiction with other ACs).
5. Update `spec.md` in place; note the amendment date in the file header.
6. Remove or annotate the `SPEC_DEVIATION` comment in the source: `// SPEC_DEVIATION resolved — see spec amendment [FEAT]-NN v2`.
7. Store memory: `bd remember "SPDEV accepted: [feature] [AC-ID] — [reason]" --key spdev-[feature]-[ac-id]`

### 8.4 Reject path — SPEC_REVERT task

```bash
bd create "SPEC_REVERT: [feature] [AC-ID] — restore implementation to spec" \
  --type task -p 2 \
  --deps "discovered-from:<current-bead-id>" \
  --acceptance "[FEAT]-NN AC restored: implementation returns [spec-defined-value]" \
  --description "Source: SPEC_DEVIATION at [file]:[line]. Deviation: [text]. Reason given: [reason]. The spec AC remains authoritative; this task brings implementation back."
```

### 8.5 Self-validation checklist (add to Verify phase)

- [ ] `find-spec-deviations.sh` run on all changed files
- [ ] Every detected marker triaged: no unresolved SPEC_DEVIATION remains
- [ ] Accept path: spec.md amended + source comment annotated
- [ ] Reject path: SPEC_REVERT bead created with `--deps discovered-from`
- [ ] Defer path: DECISION bead created; current bead blocked on it

---

## Beads replaces tasks.md and plan.md

Beads is the canonical task tracker:

```bash
bd create "Task: [description]" --issue_type task    # task
bd create "US: [description]"   --issue_type story   # user story
bd create "Epic: [description]" --issue_type epic    # epic
bd dep add <child> <parent>                          # dependencies
```

.specs/ = knowledge artifacts (WHAT/WHY/HOW)
Beads  = execution artifacts (WHO/WHEN/TRACKING)