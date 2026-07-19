# Adversarial review

Execution mode: AUDIT_ONLY. Reviewers were delegated in isolated read-only sessions after draft evidence and findings were written. They did not author evidence or modify files.

## review-critic challenge

Scope: `.audit/harness/findings-register.md`, `.audit/harness/architecture-alternatives.md`, `.audit/harness/sdd-reference-model.md`, and cited source files.

Key challenges:

- HA-F001 factual mismatch is well-supported by `.goose/recipes/harness-audit.yaml:88-99`, `evals/recipes/harness-audit.json:3-8`, and `AGENTS.md:152-155`, but HIGH severity may be overstated unless eval-hub runtime/layer-delta consequences are demonstrated.
- HA-F001 root cause should be phrased as drift in eval fixture metadata, not historical conversion, unless commit history proves conversion sequence.
- HA-F001 target should separate `agents` and `skills`: in-session agent likely `orchestrator`; skills should include all in-session audit skills; `harness-judge` agent remains isolated subrecipe evidence.
- HA-F006 is a valid governance/enforceability gap, but HIGH severity is not proven by cited evidence alone; MEDIUM-HIGH is more defensible unless real SDD runs lose required records or release gates depend on them.
- HA-F006 target should also strengthen schemas into real JSON Schema (`$schema`, `type`, `properties`) and define artifact storage and consumers.
- Balanced architecture is under-specified: it claims 9 agents, 12 skills, and 13 core recipes, but selected prose names only 12 recipes and does not enumerate the exact default/core/conditional roster.
- Balanced architecture makes QA/principal-engineer conditional while verify/release remain mandatory; default ownership for low-risk verify/release must be explicit.

## principal-engineer challenge

Scope: audit findings, architecture alternatives, SDD reference model, current-state graph, and cited files.

Key challenges:

- HA-F001 mismatch is strong; severity depends on whether evals are gating. If eval-hub is advisory only, MEDIUM-HIGH is more precise than HIGH.
- HA-F006 core concern is valid, but HIGH requires a concrete failure scenario; schema minimalism is an additional root cause and migration risk.
- HA-F002 MEDIUM is defensible; runtime `load()` authority reduces blast radius.
- HA-F003 may need taxonomy rather than list equality: user-facing slash commands, internal/on-ramp recipes, subrecipes, and installed Goose commands may legitimately differ.
- HA-F004 is documentation/resolver ambiguity unless eval-runner failure is demonstrated.
- HA-F005 MEDIUM is defensible; duplicated routing authority is the root cause.
- Architecture alternatives use qualitative token/runtime assumptions only; call counts, p50/p95 runtime, and token budgets are needed for stronger selection evidence.
- Current-state graph is inventory-heavy: it has skills, agents, recipes, phases, subrecipes, and findings, but lacks first-class Artifact, Gate, and Evidence nodes despite TBox expectations.
- Current-state graph has incomplete `AFFECTS` coverage and no explicit contradiction nodes.

## Orchestrator resolutions

| Item | Resolution |
|---|---|
| HA-F001 severity | Keep as HIGH for audit register because AD-001 layer-delta correctness is a hard harness integrity gate; record reviewer caveat that runtime eval-hub consequence remains an uncertainty. |
| HA-F001 root cause | Refine in final report: proven root cause is eval fixture metadata drift, not proven conversion history. |
| HA-F006 severity | Keep as HIGH due mandatory multi-specialist aggregation language in core `sdd.yaml`, but mark confidence Medium and require validation of real schema/storage behavior before implementation. |
| Balanced architecture | Keep selected, but final report records that exact core/conditional roster and quantitative performance model are remediation tasks before adoption. |
| Graph completeness | Record Domain G blocker/partial: graph is machine-readable and queryable, but ABox is not complete enough for HIGH Domain G because Artifact/Gate/Evidence nodes are not fully instantiated. |

## Preserved disagreements and uncertainties

- Whether eval-hub treats eval JSON `agents` as execution-shaping layer-delta input or advisory metadata was not verified in this audit.
- Whether `ExpertContribution` / `DecisionResolution` records are produced by real SDD runs was not verified.
- Whether slash-command list differences are intentional taxonomy or drift requires product/documentation decision.
- Architecture performance estimates are qualitative, not measured.
