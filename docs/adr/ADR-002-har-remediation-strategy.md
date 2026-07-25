# ADR-002 — HAR Remediation Strategy

> Status: Accepted — Option B
> Created: 2026-07-25
> Decided: 2026-07-25
> Decided-by: product-owner
> Covers: AD-001, AD-002, AD-003
> Spec: .specs/features/harness-audit-remediation/spec.md
> Beads: agentic-devlopment-36ws.2

## Context

The Harness Audit Remediation (HAR) epic (agentic-devlopment-36ws) defines six deterministic
conformance criteria (HAR-01..06) across lifecycle ordering, recipe path consistency, KG
conformance, read-only Beads evidence, regression gates, and evaluation traceability.

**Architecture constraint (2026-07-25 human decision):** The active harness is the minimal
Loop Engineering baseline (`implement`, `loop-engineering`, `research`, `verify`). Legacy
recipes and agents live in `.goose.old/` and must not influence active baseline measurements.

**HAR-01 conflict:** The spec references `/dev` (WHEN `/dev` runs…). The `/dev` recipe is
in `.goose.old/` and not part of the active harness. HAR-01 must be rewritten to reference
`/loop-engineering` before implementation begins. This rewrite is prerequisite to all
HAR-01 RED/GREEN tasks.

**AD-001 — Persona separation:** Builder and verifier must be separate sessions.
**AD-002 — Generated mirrors:** Generated artifacts (KG JSON, recipe metadata) must not
diverge from their source declarations.
**AD-003 — Compatibility identifier:** Changes must preserve the canonical entity names
and relation vocabulary; no rename without alias migration.

---

## Three remediation options

### Option A — Incremental AC slices *(recommended)*

**Approach:** Fix one HAR criterion per iteration using the RED/GREEN/review/verify loop.
Each criterion gets its own builder, verifier, and controller gate before the next begins.

**File boundaries per slice:**
| Slice | Primary files |
|---|---|
| HAR-01 | `.goose/recipes/loop-engineering.yaml` (lifecycle ordering) |
| HAR-02 | Recipe YAML files + install scripts (path consistency) |
| HAR-03 | `apps/kg/src/` + KG JSON declarations (uniqueness, LOADS_SKILL) |
| HAR-04 | Beads JSONL adapter code (read-only evidence fields) |
| HAR-05 | Test harness integration suite (regression gate) |
| HAR-06 | KG eval traceability declarations |

**Blast radius:** One subsystem at a time; no cross-subsystem contamination.

**Rollback:** `git revert <slice-commit>` restores exactly the previous state.

**Observability:** Each slice gate emits a typed CONTINUE/REWORK/COMPLETE transition
stored in Beads; the HAR-05 regression suite is the integration guard across all slices.

**Risks and mitigations:**
| Risk | Mitigation |
|---|---|
| HAR-01 references `/dev` (stale) | Rewrite HAR-01 target to `/loop-engineering` before RED; update spec |
| HAR-03 KG changes break downstream | Run `node apps/kg/dist/cli.js pipeline` after every KG slice |
| Slice ordering dependency | HAR-05 (regression gate) runs last; HAR-06 depends on HAR-03 |
| AD-002 drift | Every slice runs `python3 scripts/check-consistency.py` before close |

---

### Option B — Big-bang patch

**Approach:** Implement all HAR-01..06 fixes in a single branch; single review gate.

**File boundaries:** All subsystems simultaneously.
**Blast radius:** High — lifecycle, recipe inventory, KG, Beads adapter, tests, and
eval traceability all change at once.
**Rollback:** Revert the entire PR; no granular recovery.
**Observability:** Only one gate for all six criteria; a failure in HAR-03 blocks
evidence for HAR-01.
**Risks:** Conflicts between slices; large diff obscures individual criterion evidence;
AD-001 hard to enforce (single PR vs. per-criterion session pairs).

---

### Option C — Subsystem-sequential

**Approach:** Group HAR criteria by subsystem (runtime → inventory → KG → Beads → eval),
fix each group with one build + verify cycle.

**File boundaries per group:**
| Group | HAR criteria | Primary systems |
|---|---|---|
| Runtime | HAR-01 | recipes |
| Inventory | HAR-02 | recipes, install scripts |
| Graph | HAR-03, HAR-06 | KG, eval traceability |
| Evidence | HAR-04, HAR-05 | Beads adapter, test harness |

**Blast radius:** Medium — two to three criteria per iteration.
**Rollback:** Per-group revert; cleaner than Option B.
**Observability:** Fewer gates than Option A; a HAR-03 defect delays HAR-06 evidence.

---

## Decision: Option B — Big-bang patch *(human-approved 2026-07-25)*

Product-owner chose Option B: all HAR criteria (HAR-01..06) implemented in a single coordinated commit. Rationale: the codebase is clean after the minimal harness migration; a single-pass big-bang is lower coordination overhead at this stage than six incremental RED/GREEN cycles.

---

## Original Recommendation: Option A (superseded)

**Rationale:**
1. Smallest blast radius per step; every slice is independently testable.
2. AD-001 is naturally satisfied: each slice has a dedicated builder and verifier.
3. AD-002 is checked per slice: `check-consistency.py` runs after every change.
4. AD-003 is respected: changes are scoped to one subsystem's vocabulary at a time.
5. Failure evidence is scoped: a REWORK on HAR-03 does not invalidate HAR-01 evidence.
6. The HAR-05 regression suite serves as the cross-slice integration guard.

**Prerequisites before starting any RED task:**
- Update `.specs/features/harness-audit-remediation/spec.md` HAR-01 to reference
  `/loop-engineering` instead of `/dev`.
- Obtain human approval at agentic-devlopment-36ws.5 (HUMAN GATE).

## Decisions recorded

**AD-001 — Persona separation:** Confirmed. Each HAR slice uses separate builder and
verifier sessions. Controller gates are separate from builder sessions.

**AD-002 — Generated mirrors:** Confirmed. Every slice runs `check-consistency.py` and
`node apps/kg/dist/cli.js pipeline` before the controller gate closes the task.

**AD-003 — Compatibility identifier:** Confirmed. No HAR slice renames existing entity
names or relation types without a migration alias tracked in the ADR.
