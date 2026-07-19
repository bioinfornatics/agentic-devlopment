# Final audit report

## Executive summary

Repository `.` was audited in AUDIT_ONLY mode against `harness-judge/templates/audit-contract.md` at revision `2ab4bc987eb24fd153e50e0b5b39c1a4274d9e5e`. The audit inspected L1 skills, L2 agents, L3 recipes/subrecipes, eval declarations, SDD/Beads flow, deterministic validation, and JSON-LD current/target graphs.

Deterministic validators are strong: all Goose recipes validated, consistency checks passed, KG smoke passed, and SPEC_DEVIATION scan was clean. The independent judge scored the harness **78/100 (ACCEPTABLE, PARTIAL)** and returned **AUDIT_COMPLETE_WITH_BLOCKERS** because two high findings remain open and Domain G is materially incomplete.

## Scope and mode

- Execution mode: AUDIT_ONLY
- Repository: `.`
- Scope: all
- Focus: none
- Evidence budget: full
- Output directory: `.audit/harness`
- Graph format: JSON-LD

## Preconditions

- Repository revision: `2ab4bc987eb24fd153e50e0b5b39c1a4274d9e5e`
- Output path: `.audit/harness` explicitly authorized by user request; audit artifacts were restricted there.
- Tools available: git, python3, node, pnpm, goose, bd, jq, sha256sum; `rg` unavailable in precondition output.
- Beads read-only state: `bd ready --json` returned `[]`; `bd blocked --json` returned `[]`.
- Existing tracked modifications were present before/while auditing; no tracked source remediation was attempted.

## Deterministic validation

- `goose recipe validate` passed for all top-level and subrecipe YAML files.
- `python3 scripts/check-consistency.py` exited 0 and reported all consistency checks passed.
- `node apps/kg/dist/cli.js bootstrap --dry-run` reported 96 records; `reason --rules` listed R1-R6.
- `scripts/find-spec-deviations.sh` reported 0 active markers and 7 classified example/instruction markers.
- Required Microsoft SDD URLs returned HTTP 200 headers.

## Findings summary

- Critical: 0
- High: 2
- Medium: 4
- Low: 0

High findings:

- HA-F001: harness-audit eval declares isolated judge as in-session agent.
- HA-F006: multi-agent aggregation schemas are required by recipe text but lack enforceable storage/validation integration.

Medium findings:

- HA-F002: stale Beads memory contains obsolete agent roster.
- HA-F003: slash-command documentation is inconsistent across README, AGENTS, and harness-core spec.
- HA-F004: subrecipe eval support is ambiguous for `amend-spec`.
- HA-F005: `dev.yaml` routing text contradicts live-discovery orchestration rule.

## Domain G and graph outputs

JSON-LD current and target graphs were produced:

- `.audit/harness/current-state-graph.jsonld`
- `.audit/harness/target-state-graph.jsonld`
- `.audit/harness/graph-diff.md`
- `.audit/harness/graph-query-results.md`

Domain G score from independent judge: **5/12 PARTIAL**. The graph is machine-readable and queryable, but cannot score HIGH because first-class Artifact, Gate, Evidence, TargetStateDecision, and contradiction nodes are incomplete relative to the contract TBox/ABox expectations.

## Selected target architecture

Selected architecture: **Balanced**.

Rationale: preserve the coherent SDD lifecycle and independent review while reducing default mandatory calls by making UX/UI/QA/principal-engineer and high-assurance gates conditional by risk. Adversarial review requires remediation to enumerate exact core/conditional rosters and quantify token/runtime cost before adoption.

## Independent judge

- Verdict: PARTIAL
- Score: 78/100
- Rating band: ACCEPTABLE
- Confidence: Medium-High
- Final judge status: AUDIT_COMPLETE_WITH_BLOCKERS
- Report artifact: `.audit/harness/harness-judge-report.json`

## Closure checklist summary

Completed: required loads, contract read, preconditions, inventory, deterministic validation, current/target graph export, flow analysis, findings, adversarial challenge, evidence freeze, independent judge invocation.

Blocked / partial:

- Domain G is partial due incomplete first-class ontology instances.
- Eval-hub runtime semantics for recipe `agents` metadata were not verified.
- Real SDD production of ExpertContribution / DecisionResolution artifacts was not verified.
- External SDD source fetch captured HTTP headers only, not full body analysis.
- Existing tracked modifications mean repository state was not clean before audit.

## Final status

AUDIT_COMPLETE_WITH_BLOCKERS
