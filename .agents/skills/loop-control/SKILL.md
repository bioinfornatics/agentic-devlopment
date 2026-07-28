---
name: loop-control
description: Govern a Beads-backed engineering loop with explicit progress, budgets, dependencies, and terminal transitions. Use for stage handoffs and recovery decisions; do not use as an implementation or verification methodology.
---

# Loop control

Beads is the sole durable control plane. Git and CI retain source and proof artifacts; Beads retains objective, graph, current state, chronology, evidence references, assignments, and decisions. The conversation is replaceable.

## Required reference

Consult `references/beads-control-plane.md` whenever creating, resuming, recovering, or finalizing a run. It defines the canonical run model, metadata, dependencies, evidence references, and recovery inquiry.

## Generic governed sequence

Follow the generic stage graph from docs/loop-engineering/diagrams:

1. Trigger: identify cause, deduplicate, load state, check authorization and value.
2. Planner: frame global success, dependencies, risk, smallest increment, and expected proof.
3. Builder: claim one ready task, select tools, implement, collect candidate evidence.
4. Verifier: use a separate session to evaluate actual state and emit a verdict.
5. Memory: persist state, episode facts, decisions, evidence references, conflicts, and lessons.
6. Manager: normalize remaining work, apply dependencies/WIP, detect repetition, choose a ready lot.
7. Controller: evaluate progress, budgets, risk, and assumptions; persist one transition.

Stages may contain parallel read-only research or disjoint ready tasks. The dependency graph, file ownership, and WIP limit determine concurrency—not convenience.

## Phase inquiry protocol

At every stage start or recovery, answer the questions that can alter the next action:

- Which objective, ACs, state dimensions, and dependencies govern this stage?
- Which tools, skills, permissions, and specialist agents are required and available?
- Which checks or evidence are required, and what result would falsify success?
- What facts, decisions, lessons, prior attempts, and blockers are already durable in Beads?
- What failed, how often, and did the hypothesis or method materially change?
- Which implementation, test, fixture, configuration, dependency, or evidence was added after the failure?
- Does that addition make a formerly missing criterion provable, or merely repeat the same claim?
- Is measurable progress possible inside the remaining iteration, time, cost, and WIP budgets?

Persist concise answers that affect control. Never store chain-of-thought or secrets.

## Typed transitions

Emit exactly one:

- CONTINUE: another independent ready task is justified by expected evidence.
- REWORK: one bounded defect can be corrected under the current contract.
- REPLAN: assumptions, architecture, scope, or criteria are invalid.
- WAIT: an external dependency is expected to resolve; block or defer instead of polling.
- COMPLETE: every global criterion is independently proven.
- ESCALATE: human judgment, permission, destructive action, or risk acceptance is required.
- ABORT: budget is exhausted, the objective is impossible, a guardrail fired, or repeated non-progress has no resolvable escalation.

CONTINUE is never the default. Remaining budget alone is not a reason to continue.

## Transition exclusivity and precedence

Emit exactly one transition. Never join transitions with a slash, "or", commas, or alternatives. Apply the first matching branch:

1. Invalid or contradictory contract, criteria, assumptions, scope, or architecture → REPLAN.
2. Temporary external condition with a concrete resume signal → WAIT.
3. Valid contract with an unavailable non-human dependency and no bounded resume signal → BLOCKED at the role boundary.
4. Human authorization, judgment, destructive action, or risk acceptance → ESCALATE.
5. Bounded defect under a valid contract → REWORK.
6. Another independent ready task with expected new evidence → CONTINUE.
7. Every global AC independently proven → COMPLETE.
8. Impossible objective, guardrail, exhausted budget, or repeated zero progress → ABORT.

A contradiction is REPLAN, not BLOCKED. A permission boundary is ESCALATE, not BLOCKED. If several branches appear applicable, choose the earliest branch and state why later branches do not control.

## Decision procedure

1. Load the run epic, ready/blocked children, latest verifier verdict, evidence signature, and budgets.
2. Reject COMPLETE unless all global ACs are proven.
3. Compute measurable progress: newly proven ACs, reduced risk/unknowns, newly unblocked work, or materially new evidence.
4. Compare failure/evidence signatures with prior iterations.
5. Stop repeating when the same failure occurs twice without new evidence, or two consecutive iterations have zero progress.
6. Respect max iterations, time/cost limits, authorization, and WIP.
7. Identify one next task and its expected proof for CONTINUE/REWORK/REPLAN.
8. Persist metadata and use `bd set-state` for phase, verdict, and transition with a reason.

## Decision record

```yaml
run_id: bead-id
transition: CONTINUE
reason: concise evidence-based reason
evidence_refs: [bead-comment, artifact, commit, ci-run]
next_task: bead-id-or-null
iteration: integer
progress_delta:
  newly_proven_criteria: [AC-ID]
  newly_unblocked_tasks: [bead-id]
  new_evidence: boolean
failure_signature: string-or-null
budget_remaining:
  iterations: integer
  time: string
```

## Finalization

COMPLETE closes the accepted child tasks and run with explicit evidence. WAIT/ESCALATE preserve a blocked or deferred run and exact resume condition. ABORT preserves evidence and the reason. REWORK/REPLAN create or update only the next justified child task and dependency edges.

## Self-validation

- [ ] Current run knowledge (epic, prior verdict, iteration count, evidence signature, budget) was loaded from Beads before deciding.
- [ ] Beads only, is the durable state.
- [ ] The generic seven-stage sequence and current stage artifacts are explicit.
- [ ] Phase inquiry covered tools, checks, memory, failures, and later evidence.
- [ ] Progress and repeated evidence signatures were measured.
- [ ] Budgets, permissions, dependencies, WIP, and independence were enforced.
- [ ] Exactly one transition, reason, evidence set, and next task were persisted.
- [ ] COMPLETE is backed by independent proof for every global criterion.
