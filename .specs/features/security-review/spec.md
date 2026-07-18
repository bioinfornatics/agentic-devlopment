# Spec: security-review Recipe

> Status: Planning — implementation not started
> Created: 2026-07-18
> Scope: feat-security-review
> AC prefix: SEC
> Feature path: `.goose/recipes/security-review.yaml`

---

## Context

`docs/03-security-review.md` documents a security-review workflow that currently routes
through the general `review.yaml` recipe via:

```bash
goose run --recipe review \
  --params task="security review current diff and design" \
  --params constraints="Read-only. Prioritize authn/authz, injection, secrets, ..."
```

While `review.yaml` + `code-review` skill's `security-audit.md` sub-reference supports
security use cases, the workflow requires users to embed security intent in free-text
parameters and relies on type-detection heuristics in the skill to load the security
reference. There is no dedicated entry point with:

- Threat-model-first output (8-area structured checklist)
- Security-specific verdict vocabulary (`pass | needs-hardening | block`)
- Mandatory Beads follow-ups for every finding
- Human-gate escalation path for owner approval
- A named slash command (`/security-review`)

This spec defines the acceptance criteria for a first-class `security-review` recipe.

---

## Acceptance Criteria

### AC-SEC-01 — Recipe file valid

WHEN `goose recipe validate .goose/recipes/security-review.yaml` runs
THEN it returns "valid" with 0 failures.

---

### AC-SEC-02 — AD-001 Specialist pattern (single in-session agent)

WHEN `security-review.yaml` is invoked
THEN it follows the **Specialist** pattern from AD-001:
  - loads exactly one specialist agent in-session via `load agent review-critic`
  - does NOT load `harness-orchestrator`
  - does NOT load a second in-session agent alongside `review-critic`
AND the recipe's eval JSON `"agents"` field contains exactly `["review-critic"]`
AND escalation to `principal-engineer` for CRITICAL/human decisions SHALL use
    `bd gate create --blocks <id> --type human --reason "..."` not `load agent principal-engineer`.

---

### AC-SEC-03 — Security-specific First Visible Output

WHEN `security-review.yaml` is invoked
THEN the first visible output appears before ANY tool call and follows this format:

```
Security-review scope: [diff | design | config | deps | release | full]
Threat model areas: [comma-separated subset from: assets, entry-points, authn/authz,
                     injection, secrets, dependencies, data-integrity, observability]
Agent: review-critic
Constraints: [forwarded value or "none"]
```

AND this block is NOT deferred until after any `bd prime`, skill load, or file read.

---

### AC-SEC-04 — Security skill loading (no type-detection)

WHEN `security-review.yaml` starts its skill loading phase
THEN it loads the `code-review` skill first
AND immediately instructs the agent to load `code-review/references/security-audit.md`
    without running the type-detection table in `SKILL.md`
    (security is declared — no heuristic required)
AND the OWASP Top 10 checklist from `security-audit.md` is applied to the review target.

---

### AC-SEC-05 — Structured threat model output (all 8 areas)

WHEN the review completes
THEN the agent produces a structured threat model covering all 8 areas defined in
    `docs/03-security-review.md`:

| Area              | Required output                                               |
|-------------------|---------------------------------------------------------------|
| Assets            | Data, secrets, and capabilities exposed by the change         |
| Entry points      | Inputs that cross trust boundaries                            |
| Authn/authz       | Who can do what; whether checks are centralized and tested    |
| Injection         | SQL, shell, path traversal, template, command, prompt         |
| Secrets           | Whether tokens are logged, committed, echoed, or forwarded    |
| Dependencies      | New packages, install scripts, MCP server trust               |
| Data integrity    | Corruption, loss, replay, race conditions                     |
| Observability     | Failure detectability without leaking secrets                 |

AND each area is addressed even when the verdict is `pass` (explicit "not applicable" is acceptable).

---

### AC-SEC-06 — Security verdict vocabulary

WHEN the review completes
THEN the verdict uses the security vocabulary from `docs/03-security-review.md`:

  - `pass` — zero actionable security findings
  - `needs-hardening` — ≥1 MEDIUM or HIGH finding; no CRITICAL
  - `block` — ≥1 CRITICAL finding with proof (exact file:line + exploit scenario + why
               existing guards don't catch it)

AND for any verdict other than `pass`, the output includes the findings table from
    `code-review/references/security-audit.md` with severity-ranked rows
AND the recipe SHALL NOT emit the general-review vocabulary (`APPROVE | PASS-WITH-NITS | BLOCK`)
    as its primary verdict line (mapping note acceptable in a secondary note).

---

### AC-SEC-07 — Mandatory Beads follow-up for every real finding

WHEN any security finding is identified (any severity including LOW)
THEN a Beads follow-up bead is created or proposed using:

```bash
bd create "Security: <concise-title>" -t bug -p 1 \
  --deps discovered-from:<parent-bead-id> --json
```

AND no real finding SHALL be documented without a corresponding `bd create` command
AND when owner approval is required (security tradeoff, accepted risk), the recipe proposes:

```bash
bd gate create --blocks <issue-id> --type human \
  --reason "Security tradeoff requires owner approval: <brief rationale>"
```

AND "Residual risk accepted by whom" is declared in the output when any finding is downgraded
    or accepted without remediation.

---

### AC-SEC-08 — Subrecipe worker: `subrecipes/security-review.yaml`

WHEN `security-review.yaml` delegates to `subrecipes/security-review.yaml`
THEN the subrecipe:

  a) accepts parameters: `task` (required), `repo_path` (optional, default "."),
     `constraints` (optional, default "")
  b) declares itself read-only unless explicitly instructed otherwise
  c) runs `bd prime` before any file inspection
  d) applies the OWASP Top 10 checklist to changed code surfaces
  e) checks Beads hygiene as a non-discretionary step (no confidence gate):
     - Discovered work filed with `discovered-from` links
     - No markdown TODO files used as durable tracking
  f) returns the structured output from `docs/03-security-review.md`:
     ```
     Security verdict: pass | needs-hardening | block
     Threat model summary:
     Findings by severity:
     Required tests:
     Follow-up beads:
     Residual risk accepted by whom:
     ```
  g) emits `max_turns: 25` (matches existing review subrecipe budget)

---

### AC-SEC-09 — Eval file with 3 scenarios

WHEN `evals/recipes/security-review.json` is created
THEN it contains exactly 3 scenario objects with difficulties: `normal`, `difficult`, `very_difficult`
AND every scenario contains these required fields:
  `agents`, `skills`, `query`, `files`, `max_turns`, `difficulty`,
  `expected_skill_contribution`, `baseline_gaps`, `expected_behavior`
AND every scenario has:
  ```json
  "agents": ["review-critic"],
  "skills": ["code-review"]
  ```
AND the 3 scenarios cover distinct security surfaces:
  - normal: single-surface diff with one clear CRITICAL pattern (e.g., hardcoded credential)
  - difficult: auth/authz flow review requiring reasoning about trust boundaries
  - very_difficult: multi-surface diff (recipe + config + dependency) with supply-chain risk

---

### AC-SEC-10 — Harness-core spec sync

WHEN `security-review.yaml` is merged
THEN the following files are updated in the same commit or PR:

| File                                              | Change required                                    |
|---------------------------------------------------|----------------------------------------------------|
| `.specs/features/harness-core/spec.md` AC-RECIPE-01 | Row added: `security-review.yaml` → `/security-review` |
| `.specs/features/harness-core/spec.md` AC-RECIPE-02 | Wiring row: `security-review` → skills + agents   |
| `.specs/features/harness-core/spec.md` AC-RECIPE-04 | Entry: Specialist pattern                         |
| `USE_CASES.md` chapter map                        | Row: `03-security-review.md` → `/security-review` |
| `README.md` slash command list                    | `/security-review` added                          |
| `docs/15-skill-evaluations.md`                    | Recipes section: security-review entry             |
| `docs/03-security-review.md` Run methods          | Method A updated to use `--recipe security-review` |
| `docs/getting-started.md`                         | Slash commands table if present                    |

---

### AC-SEC-11 — KG pipeline integrity

WHEN all implementation files are written
THEN `node apps/kg/dist/cli.js pipeline` runs without errors
AND `python3 scripts/check-consistency.py` reports no drift
AND `goose skills list | grep -c '|'` returns ≥19 (no skill count regression).

---

### AC-SEC-12 — Secrets never quoted in findings output

WHEN the agent discovers a hardcoded credential, API key, or token in the diff
THEN it references the finding by location only (file:line), not by value:

  ✓ `CRITICAL | config/deploy.yaml:14 | Hardcoded API key | Remove; rotate; use env var`
  ✗ `CRITICAL | config/deploy.yaml:14 | Key "sk-abc123..." found | ...`

AND this rule is expressed as a non-negotiable instruction in `subrecipes/security-review.yaml`.

---

## Non-goals

- Replacing `review.yaml` for general code review — `review.yaml` remains canonical for PR/feature/global/hotfix review types.
- Creating a dedicated `security-review` skill — Phase 1 reuses `code-review` + `security-audit.md`; a dedicated skill is a Phase 2 option if the recipe accumulates enough distinct methodology.
- Automated exploit validation — the recipe produces threat model analysis and findings, not live penetration test execution.
- Multi-session orchestration — this is a Specialist recipe (AD-001); it does not spawn subagents for parallel security scanning.

---

## Open questions (decision required before implementation)

| # | Question | Default assumption | Who decides |
|---|----------|--------------------|-------------|
| OQ-1 | Register `/security-review` as a slash command in `install.sh`? | Yes — mirrors `/review` precedent | Maintainer |
| OQ-2 | Should `harness-review.yaml` grow a `scope=security` option instead of adding a new recipe? | No — separate recipe keeps AD-001 cleaner | Architect |
| OQ-3 | Should `review.yaml` add a routing note pointing security tasks to `/security-review`? | Yes — add a one-line note in instructions | Maintainer |
| OQ-4 | Phase 2: extract dedicated `security-review` skill with its own `SKILL.md`? | Defer — assess after first eval run | Architect |
