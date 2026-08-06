---
name: evidence-verification
description: Evaluate engineering work against predefined acceptance criteria using reproducible evidence and issue a typed verdict. Use for independent verification and gates; do not use to implement or repair the judged change.
---

# Evidence-driven verification

Completion is a claim until independent evidence proves it. Verify repository state, not the builder narrative, and preserve negative or contradictory results.

## Knowledge generation

Before running checks, load the Beads task, global run ACs, governing spec, build handoff, prior verifier comments, evidence signature, and repository diff. Ask:

- What exactly must be falsified or proven for each criterion?
- Which tool and environment provide the strongest safe proof?
- Which checks are required by repository policy?
- What relevant failures and unknowns are already recorded?
- Did tests, fixtures, dependencies, configuration, or implementation change after a prior failure?
- Is apparently new evidence truly independent, current, and scoped to the claimed behavior?

Never persist private chain-of-thought. Persist concise facts, commands, artifacts, verdicts, and uncertainty.

## Evidence hierarchy

Prefer, in order:

1. deterministic commands and machine-readable results;
2. targeted runtime behavior in a controlled environment;
3. contract, static analysis, build, security, and policy checks;
4. repository inspection tied directly to the criterion;
5. model judgment only when deterministic proof is impossible.

Exit code zero is not sufficient when no test was collected, the wrong target ran, output is stale, or the check does not exercise the claim. Record command, exit code, relevant output summary, timestamp/context, and artifact reference.

## Independent procedure

1. Confirm the verifier session differs from the builder session.
2. Reconstruct scope from Beads and the actual diff; report scope drift.
3. Freeze the predefined criteria. A post-hoc criterion change requires REPLAN and a traceable decision.
4. Select the minimum safe set of checks that covers every criterion and likely regressions.
5. Run all safe deterministic checks even if one criterion requires escalation.
6. Map evidence criterion by criterion. Do not average contradictory signals.
7. Compare the new evidence signature with prior attempts. Identify material additions after failure.
8. Emit one verdict and recommended transition. Do not edit product files.

## Criterion record

```yaml
criterion: AC-1
status: proven | disproven | missing | conflicting
proofs:
  - command: string
    exit_code: integer
    artifact: path-or-url
    observation: concise fact
confidence: high | medium | low
unknowns: [string]
```

## Verdicts

- ACCEPTED: every required criterion is proven and no blocking regression remains.
- REWORK: a bounded implementation defect is reproduced and the contract remains valid.
- REPLAN: the scope, criteria, assumptions, or architecture are invalid or incomplete.
- BLOCKED: a required dependency or environment is unavailable and expected to become available.
- ESCALATE: human judgment, authorization, destructive action, or risk acceptance is required.

Use BLOCKED rather than success for unavailable proof. Use ESCALATE only for the unresolved portion after collecting all safe evidence. Never accept merely because the builder says tests passed.

## Durable evidence

Add compact EVIDENCE comments to the verification task and references to Git commits, CI runs, reports, or files. Set the run verdict using bd set-state with a reason. Store a stable evidence signature in metadata so the controller can detect repeated non-progress. Raw logs stay in artifacts, not Beads comments.

## Semantic review trigger and double gate

Run this review when a patch changes an externally meaningful identifier, shared configuration, serialization or deserialization, provider selection, precedence, mutable routing state, a factory or production constructor, session state, UI projection, or cache key/value behavior. Match semantics, not filenames: aliases, generic maps, adapters, and indirect factories still trigger it. Scale the search to the reachable blast radius, but do not omit a significant consumer merely because the diff is small.

A triggered review has two gates:

1. **Invariant gate:** derive an invariant ledger from the contract and implementation. For each invariant record its source of truth, allowed mutation, precedence, serialization form, and observable projections.
2. **Consumer gate:** construct a lifecycle map and producer-consumer table from creation through mutation, clone/copy/inheritance, persistence/wire boundaries, cache, session, and UI. Classify every significant reader, writer, clone, inherited copy, serializer, and observer as preserved, updated, intentionally divergent, or unverified, with evidence.

ACCEPTED is forbidden when either gate is incomplete. In particular, any unclassified significant consumer makes the triggered review MISSING and blocks ACCEPTED.

### Triggered review probes

- Exercise the production constructor/factory path; a simplified test constructor is supporting evidence only unless production fidelity is demonstrated.
- Inspect the serialization boundary and reject generic-map payloads that leak internal fields, stale aliases, or an unintended identifier.
- Build a mutation + precedence matrix covering initial value, each writer, conflicting sources, early returns, cache/session reuse, and final observer.
- Compare wire/persistence output with session and UI projections; intentional divergence needs a named invariant.
- After the first result, perform a **fresh-patch second pass** from the current diff without relying on the builder inventory. Search for one missed producer, consumer, or boundary and record the result.

Use this compact record:

```yaml
semantic_review:
  trigger: [external-id | shared-config | serialization | provider | precedence | mutable-routing | factory | session | ui | cache]
  invariant_ledger: [{invariant: string, source: string, mutation: string, precedence: string, serialization: string}]
  lifecycle_map: [create, mutate, clone-copy-inherit, serialize, cache, session, ui]
  producer_consumer: [{symbol: string, role: producer|consumer, classification: preserved|updated|intentional-divergence|unverified, proof: string}]
  production_constructor_fidelity: string
  serialization_boundary: string
  mutation_precedence_matrix: string
  fresh_patch_second_pass: string
  blocking_unclassified_consumers: [string]
```

## Self-validation

- [ ] Builder and verifier are different isolated sessions.
- [ ] Actual repository state and predefined ACs were inspected.
- [ ] Every AC has a proven, disproven, missing, or conflicting status.
- [ ] Commands, exit codes, observations, and artifact references are reproducible.
- [ ] Zero-test, stale, irrelevant, and contradictory evidence was rejected.
- [ ] Evidence added after prior failures was identified and assessed.
- [ ] Exactly one verdict was emitted without modifying implementation files.
