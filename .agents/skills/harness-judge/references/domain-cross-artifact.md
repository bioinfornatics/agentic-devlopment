## 12.5 Cross-Artifact Overlap Analysis

Run this analysis when scope=all, after scoring individual domains B, C, D. It is a separate cross-artifact comparison pass — individual domain scores do not cover it.

**Purpose.** Detect instruction duplication or responsibility collision across artifacts of the same type. Overlap is not automatically wrong; the judge distinguishes three cases:

| Case | Definition | Score |
|---|---|---|
| Complementary | Each artifact covers a distinct sub-domain; trigger conditions are mutually exclusive or explicitly layered | PASS |
| Redundant | Two artifacts give the same instruction for the same trigger with no differentiation | FAIL |
| Conflicting | Two artifacts give different instructions for the same trigger, creating ambiguity about which is authoritative | FAIL |

**Methodology — how to run the comparison pass:**

1. For each artifact type (skills, agents, recipes): list all trigger conditions or entry conditions side by side.
2. Identify any two artifacts whose trigger conditions overlap semantically (same verb, same domain, same user intent).
3. For each overlap candidate: read both artifacts and determine whether the overlap is complementary, redundant, or conflicting.
4. Cite both file paths and the overlapping passages as evidence.
5. Score HJ039, HJ040, HJ041 as PASS / PARTIAL / FAIL per artifact type, not per individual artifact.

**Skill × Skill known candidates** (check these first):
- `ux-quality` / `cognitive-ux` / `agentic-ux` — all cover UX evaluation
- `ui-quality` / `wcag-accessibility-audit` / `design-systems-arch` / `atomic-design` / `frontend-blueprint` — all cover UI
- `sdd` / `agentic-devlopment` / `goose-orchestration` — all cover Beads workflow or delegation
- `code-review` / `harness-judge` — both produce artifact verdicts

**Agent × Agent known candidates** (check these first):
- `review-critic` / `harness-judge` — both produce verdicts on harness artifacts
- `tdd-guide` / `qa-automation` — both enforce test coverage
- `planner` / `product-owner` — both decompose work into Beads
- `orchestrator` (when loaded by `dev`) / `sdd` (when loaded by `sdd.yaml`) — both route the full SDD cycle

**Recipe × Recipe known candidates** (check these first):
- `harness-audit` / `harness-review` / `harness-doc-review` — all inspect the harness
- `sdd` / `dev` — both can drive the full SDD cycle
- `doc-review` / `harness-doc-review` — both review documentation

Cross-artifact red flags: two skills with identical trigger scope and no routing rule; two agents with the same primary responsibility and no cross-reference in do-not-invoke; two recipes with the same entry condition and no differentiation statement; conflicting instructions for the same concern across two artifacts of the same type.
