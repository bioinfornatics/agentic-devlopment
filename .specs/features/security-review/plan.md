# Security-Review Recipe — Implementation Plan

> **Status**: Planning — not yet implemented  
> **Spec source**: `.specs/features/security-review/spec.md`  
> **AC prefix**: SEC (SEC-01 … SEC-12)  
> **SDD pattern**: AD-001 Specialist  
> **Created**: 2026-07-18  

---

## 1. Spec Slice

### Problem

`docs/03-security-review.md` documents a security-review workflow that today routes
through the general `review.yaml` recipe via free-text parameters:

```bash
goose run --recipe review \
  --params task="security review current diff and design" \
  --params constraints="Read-only. Prioritize authn/authz, injection, secrets, ..."
```

The general `review.yaml` + `code-review` skill supports security use cases, but it:

- relies on type-detection heuristics to load `security-audit.md` (not declared);
- produces a general verdict (`APPROVE | PASS-WITH-NITS | BLOCK`), not the security vocabulary (`pass | needs-hardening | block`);
- has no mandatory Beads follow-up per finding;
- has no human-gate escalation path for owner approval on CRITICAL tradeoffs;
- has no named slash command (`/security-review`).

### Solution shape

Add a **first-class Specialist recipe** (`security-review.yaml`) following AD-001, with:

| Property | Value |
|---|---|
| Pattern | AD-001 Specialist |
| In-session agent | `review-critic` |
| Skills loaded | `code-review` (→ `security-audit.md`, bypassing type-detection) |
| Subrecipe | `subrecipes/security-review.yaml` (read-only worker, max_turns: 25) |
| Slash command | `/security-review` |
| Verdict vocabulary | `pass \| needs-hardening \| block` |
| Threat model | 8-area structured output (from `docs/03-security-review.md`) |
| Escalation | `bd gate create --type human` (NOT `load agent principal-engineer`) |

### Non-goals (Phase 1)

- Replacing `review.yaml` for PR/feature/global/hotfix review types.
- Creating a dedicated `security-review` skill (deferred to Phase 2 post-eval).
- Automated exploit validation or live penetration testing.
- Multi-session orchestration (Specialist, not Orchestration pattern).

### Open questions (must be resolved before implementation)

| # | Question | Default |
|---|---|---|
| OQ-1 | Register `/security-review` as slash command in `install.sh`? | Yes |
| OQ-2 | `harness-review.yaml` scope=security vs new recipe? | New recipe (cleaner AD-001) |
| OQ-3 | Add routing note in `review.yaml` pointing to `/security-review`? | Yes |
| OQ-4 | Phase 2 dedicated `security-review` skill? | Defer post-eval |

---

## 2. Acceptance Criteria

> Full WHEN/THEN/SHALL text lives in `.specs/features/security-review/spec.md`.
> This table is an implementation-time checklist.

| ID | Title | Files touched | Verifiable |
|---|---|---|---|
| **SEC-01** | Recipe file valid | `security-review.yaml` | `goose recipe validate` exits 0 |
| **SEC-02** | AD-001 Specialist — single in-session agent | `security-review.yaml`, `evals/recipes/security-review.json` | No orchestrator; `"agents": ["review-critic"]` |
| **SEC-03** | Security-specific First Visible Output | `security-review.yaml` prompt | FVO block appears before any tool call |
| **SEC-04** | Skill loading bypasses type-detection | `security-review.yaml`, `subrecipes/security-review.yaml` | `security-audit.md` explicitly loaded, no heuristic |
| **SEC-05** | Structured threat model — all 8 areas | `subrecipes/security-review.yaml` | All 8 areas addressed even on `pass` verdict |
| **SEC-06** | Security verdict vocabulary | `security-review.yaml`, `subrecipes/security-review.yaml` | `pass / needs-hardening / block` only as primary line |
| **SEC-07** | Mandatory Beads follow-up per finding | `subrecipes/security-review.yaml` | Every finding has `bd create`; owner tradeoffs use `bd gate create --type human` |
| **SEC-08** | Subrecipe worker spec | `subrecipes/security-review.yaml` | read-only, bd prime first, structured output, max_turns: 25 |
| **SEC-09** | Eval file — 3 scenarios | `evals/recipes/security-review.json` | normal / difficult / very_difficult; `"agents": ["review-critic"]`, `"skills": ["code-review"]` |
| **SEC-10** | Harness-core spec sync | 8 files (see spec) | All in same commit; `check-consistency.py` clean |
| **SEC-11** | KG pipeline integrity | (pipeline run) | `pipeline` succeeds; skill count ≥19 |
| **SEC-12** | Secrets never quoted in output | `subrecipes/security-review.yaml` | Findings reference `file:line` only, not credential value |

### Key constraints from spec

- **BLOCK verdict** requires proof: exact `file:line` + exploit scenario + why existing guards don't catch it.
- `bd gate create --blocks <id> --type human` is the only escalation path for CRITICAL tradeoffs (no `load agent principal-engineer`).
- `subrecipes/security-review.yaml` must declare read-only by default.
- Secrets rule (SEC-12) is a **non-negotiable instruction** in the subrecipe (not a suggestion).

---

## 3. Risks

| ID | Risk | Severity | Likelihood | Mitigation | Residual |
|---|---|---|---|---|---|
| **R-1** | **FVO timing** — Agent emits a tool call before the First Visible Output block, violating SEC-03 | HIGH | Medium | Strong ordering in prompt ("emit FVO, then `bd prime`"); step numbering in prompt | FVO timing in eval runs is hard to mechanically verify |
| **R-2** | **Secret leakage** — Agent echoes credential value in findings output, violating SEC-12 | HIGH | Medium | Non-negotiable instruction in `subrecipes/security-review.yaml`; SEC-12 explicitly covers this | Eval fixtures must contain a real-looking (fake) credential to test; absent that, coverage is declarative only |
| **R-3** | **AD-001 violation at runtime** — Agent loads `principal-engineer` in-session for CRITICAL escalation instead of `bd gate create --type human` | MEDIUM | Medium | SEC-02 AC is explicit; recipe instructions must say "escalate via gate, not via load agent" | Agent may override at runtime despite instructions |
| **R-4** | **Type-detection bypass failure** — `code-review` skill's type-detection heuristic runs anyway and selects wrong reference | MEDIUM | Low | SEC-04 requires explicit bypass instruction; recipe declares "security is declared — no heuristic required" | Depends on skill internals; may need skill-level guard |
| **R-5** | **Harness-core spec drift** — T-5/T-6 sync changes land in different commit, causing `check-consistency.py` failures | MEDIUM | Low | SEC-10 requires all sync changes in same commit; T-7 (check-consistency) gates T-8 (KG pipeline) | Pre-commit hook must be installed; verify with `python3 scripts/install-hooks.py` |
| **R-6** | **Eval fixture quality** — Security scenarios require realistic fixtures (hardcoded creds, auth flows, supply-chain diff); poor fixtures → poor eval discrimination | MEDIUM | High | Use `fixture_intent` pattern (proven in `review.json`); defer `fixture_patch` to Phase 2 if needed | Without fixtures, eval may not discriminate skill vs no-skill on SEC-09 scenarios |
| **R-7** | **Verdict vocabulary collision in A/B baseline** — Evaluator confuses baseline `BLOCK` (general) with security `block` (lowercase), producing false positives | LOW | Medium | `baseline_gaps` explicitly list vocabulary mismatch; `expected_behavior` tests for security vocabulary pattern | String-matching evaluators need case-sensitive checks |
| **R-8** | **review.yaml regression** — Updating `docs/03-security-review.md` to point to new recipe breaks existing scripts using `--recipe review` | LOW | Low | OQ-3 resolution: add routing note in `review.yaml` only; `review.yaml` instructions/logic not changed | Legacy `--recipe review` path still works (review.yaml untouched) |
| **R-9** | **KG schema compatibility** — KG pipeline may lack recipe entity type for security domain, causing pipeline skip or failure | LOW | Low | SEC-11 requires dry-run first (`--dry-run`); full `pipeline` only after dry-run succeeds | KG schema changes are out of scope; accept skip if pipeline degrades gracefully |
| **R-10** | **Open question freeze** — OQ-1 through OQ-4 unresolved when implementation starts, requiring rework | INFO | Low | G-0 human gate blocks all implementation tasks until spec is approved with OQ decisions recorded | OQ-4 (dedicated skill) is already deferred by design |

---

## 4. Beads Graph

### Legend

```
[EPIC]   = parent bead grouping all work
[G-N]    = gate bead (blocks downstream until resolved)
[T-N]    = task bead (implementation unit)
[R]      = review step
→        = depends-on (blocked until dependency closes)
∥        = parallel (no dependency between siblings)
```

### DAG

```
┌─────────────────────────────────────────────────────────────────────┐
│ EPIC: SEC-0 — security-review recipe (AD-001 Specialist)            │
│ assignee: architect  priority: 2                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
             ┌─────────────────────────────────────┐
             │  G-0: Human gate — spec approval     │
             │  --type human                        │
             │  --reason "OQ-1…OQ-4 decisions +     │
             │            spec sign-off required"   │
             │  --blocks all T-N tasks              │
             └─────────────────┬───────────────────┘
                               │  (gate resolved)
                    ┌──────────┴──────────┐
                    ▼                     ▼
     ┌──────────────────────┐   ┌─────────────────────────────────┐
     │  T-1: Write           │   │  (no parallel work until T-1    │
     │  security-review.yaml │   │   completes — it defines the    │
     │  ACs: SEC-01,02,03,  │   │   schema for T-2 and evals)     │
     │        04,06          │   └─────────────────────────────────┘
     │  assignee:            │
     │  implementation-worker│
     └──────────┬────────────┘
                │
                ▼
     ┌──────────────────────────────────┐
     │  T-2: Write                       │
     │  subrecipes/security-review.yaml  │
     │  ACs: SEC-08, SEC-12              │
     │  assignee: implementation-worker  │
     └──────────┬────────────────────────┘
                │
                ▼
     ┌──────────────────────────────────┐
     │  G-1: Validation gate             │
     │  goose recipe validate            │
     │  .goose/recipes/security-review   │
     │  AC: SEC-01                       │
     │  Must exit 0 before any other     │
     │  downstream task claims work      │
     └──────────┬────────────────────────┘
                │  (validation passes)
     ┌──────────┴──────────────────────────────────────────┐
     │                        ∥                             │
     ▼                        ▼                             ▼
┌──────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐
│  T-3: Write   │   │  T-4: Update           │   │  T-5: Update             │
│  evals/recipes│   │  harness-core/spec.md  │   │  docs:                   │
│  /security-   │   │  AC-RECIPE-01 row      │   │  USE_CASES.md            │
│  review.json  │   │  AC-RECIPE-02 row      │   │  README.md (slash cmd)   │
│  AC: SEC-09   │   │  AC-RECIPE-04 entry    │   │  docs/03-security-       │
│  3 scenarios  │   │  AC: SEC-10 (partial)  │   │    review.md (Method A)  │
│  assignee:    │   │  assignee:             │   │  docs/getting-started.md │
│  impl-worker  │   │  impl-worker           │   │  AC: SEC-10 (partial)    │
└──────┬────────┘   └──────────┬────────────┘   │  assignee: impl-worker   │
       │                       │                 └────────────┬─────────────┘
       │                       └──────────────────┐          │
       │                                          ▼          ▼
       │                             ┌─────────────────────────────────────┐
       │                             │  T-6: Run generate-tables.py +       │
       │                             │  check-consistency.py                │
       │                             │  AC: SEC-10 (sync verified)          │
       │                             │  AC: SEC-11 (partial — no drift)     │
       │                             │  assignee: implementation-worker     │
       │                             └─────────────────┬───────────────────┘
       │                                               │
       └───────────────────────────────────┐           │
                                           ▼           ▼
                                ┌──────────────────────────────────┐
                                │  T-7: KG pipeline                 │
                                │  node apps/kg/dist/cli.js         │
                                │    bootstrap --dry-run            │
                                │  node apps/kg/dist/cli.js         │
                                │    pipeline                       │
                                │  AC: SEC-11                       │
                                │  assignee: implementation-worker  │
                                └──────────────┬────────────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────────┐
                                │  R: Full validation checklist     │
                                │  (review-critic in-session)       │
                                │  1. recipe validate all *.yaml    │
                                │  2. check-consistency.py          │
                                │  3. goose skills list | grep -c   │
                                │  4. KG smoke test                 │
                                │  5. git status clean              │
                                │  Verdict: APPROVE / BLOCK         │
                                │  AC: SEC-01, SEC-11               │
                                │  assignee: review-critic          │
                                └──────────────────────────────────┘
```

### Beads `bd create` commands (copy-paste for implementation session)

```bash
# Epic
bd create "EPIC: security-review recipe (AD-001 Specialist)" \
  -t epic -p 1 \
  --acceptance "SEC-01 through SEC-12 all pass; goose recipe validate exits 0; check-consistency clean" \
  --json

# Gate: spec approval (captures EPIC id from above)
bd gate create \
  --blocks <EPIC-ID> \
  --type human \
  --reason "OQ-1..OQ-4 must be decided; spec.md sign-off required before any implementation bead starts" \

# T-1: Main recipe file
bd create "T-1: Write .goose/recipes/security-review.yaml" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>" \
  --acceptance "SEC-01,SEC-02,SEC-03,SEC-04,SEC-06: AD-001 Specialist; FVO block; security-audit.md explicit load; security verdict vocabulary" \
  --assignee implementation-worker --json

# T-2: Subrecipe worker
bd create "T-2: Write subrecipes/security-review.yaml" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<T-1-ID>" \
  --acceptance "SEC-08,SEC-12: read-only; bd prime first; 8-area threat model output; secrets by location only; max_turns:25" \
  --assignee implementation-worker --json

# G-1: Validation gate
bd gate create \
  --blocks <T-3-ID>,<T-4-ID>,<T-5-ID> \
  --type automated \
  --reason "goose recipe validate .goose/recipes/security-review.yaml must exit 0"

# T-3: Eval file
bd create "T-3: Write evals/recipes/security-review.json" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<G-1-ID>" \
  --acceptance "SEC-09: 3 scenarios (normal/difficult/very_difficult); agents:[review-critic]; skills:[code-review]; distinct security surfaces" \
  --assignee implementation-worker --json

# T-4: harness-core/spec.md sync
bd create "T-4: Update .specs/features/harness-core/spec.md (AC-RECIPE-01/02/04)" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<G-1-ID>" \
  --acceptance "SEC-10: recipe row in AC-RECIPE-01; wiring row in AC-RECIPE-02; Specialist entry in AC-RECIPE-04" \
  --assignee implementation-worker --json

# T-5: Docs sync
bd create "T-5: Update docs (USE_CASES, README, 03-security-review, getting-started)" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<G-1-ID>" \
  --acceptance "SEC-10: /security-review in slash-command lists; Method A in 03-security-review.md updated" \
  --assignee implementation-worker --json

# T-6: Generate + consistency check
bd create "T-6: generate-tables.py + check-consistency.py" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<T-4-ID>,blockedBy:<T-5-ID>" \
  --acceptance "SEC-10,SEC-11(partial): no drift reported; generated sections updated" \
  --assignee implementation-worker --json

# T-7: KG pipeline
bd create "T-7: KG pipeline (dry-run then full)" \
  -t task -p 2 \
  --deps "partOf:<EPIC-ID>,blockedBy:<T-3-ID>,blockedBy:<T-6-ID>" \
  --acceptance "SEC-11: pipeline exits 0; skill count ≥19" \
  --assignee implementation-worker --json

# Final review
bd create "R: Full validation checklist review" \
  -t task -p 1 \
  --deps "partOf:<EPIC-ID>,blockedBy:<T-7-ID>" \
  --acceptance "All SEC-01..SEC-12 verified; review-critic verdict APPROVE" \
  --assignee review-critic --json
```

---

## Summary: implementation order

```
G-0 (human gate: spec approval)
  └─► T-1 (security-review.yaml)
        └─► T-2 (subrecipes/security-review.yaml)
              └─► G-1 (validation gate: goose recipe validate)
                    ├─► T-3 (evals/recipes/security-review.json)      ∥
                    ├─► T-4 (harness-core/spec.md sync)               ∥
                    └─► T-5 (docs sync)                                ∥
                              T-4 + T-5 ──►
                              T-6 (generate-tables + check-consistency)
                              T-3 + T-6 ──►
                              T-7 (KG pipeline)
                              T-7 ──►
                              R (full validation review)
```

**Critical path**: G-0 → T-1 → T-2 → G-1 → T-4 → T-6 → T-7 → R  
**Parallelizable**: T-3, T-4, T-5 run concurrently after G-1 passes.
