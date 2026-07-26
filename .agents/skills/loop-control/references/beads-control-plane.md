# Beads control-plane protocol

Beads is the sole durable runtime state for Loop Engineering. Git keeps source and proof artifacts; Beads keeps their status, references, provenance, and decisions.

## Run model

A run is an epic (a Beads molecule once it has children):

- epic: objective, global acceptance criteria, spec reference, budgets, owner;
- child task: one stage or bounded increment;
- blocking dependencies: executable order (build depends on plan; verify depends on build; control depends on verify);
- non-blocking relations: discovery, validation, attestation, and provenance;
- metadata: machine-readable counters, roles, evidence signatures, session IDs;
- state dimensions: queryable current phase, transition, and verdict;
- comments/events: append-only chronology and compact evidence references.

## Canonical metadata

```json
{
  "loop_role": "controller",
  "execution_mode": "orchestrated",
  "loop_iteration": 0,
  "loop_max_iterations": 8,
  "loop_no_progress_count": 0,
  "loop_max_no_progress": 2,
  "loop_transition": "CONTINUE",
  "loop_evidence_signature": "sha256-or-stable-summary",
  "builder_session": null,
  "verifier_session": null
}
```

The Beads status is the issue lifecycle; loop_transition is the controller decision. Do not conflate them.

## Start or resume

1. If run_id is supplied, run bd show on it and verify its loop-engineering label.
2. Otherwise search open runs by objective or external reference and deduplicate.
3. Create an epic only when no compatible run exists, with the objective, global acceptance criteria, spec ID, labels, and canonical metadata.
4. Claim the ready child task, not blindly the whole backlog, before any write.
5. Use bd set-state for current phase, transition, and verdict. It also creates state-event history.

## Dynamic increment

Create only the next justified increment. A typical chain is:

```text
frame/research → plan → build → verify → control
```

With bd dep add B A, B depends on A. Parallelize only tasks without dependency edges and with disjoint write sets. Persist delegated session IDs on the owning tasks. Require builder_session to differ from verifier_session.

## Evidence and decisions

Store compact references, never large raw output. Use comments such as:

```text
EVIDENCE AC-1 command=<cmd> exit=0 artifact=<path-or-ci-url>
```

Update loop_evidence_signature, set the verdict state with a reason, then set the transition state with a reason. Every control decision records transition, reason, evidence references, next task, iteration, progress delta, and remaining budget.

COMPLETE closes remaining control tasks and then the epic. WAIT and ESCALATE block or defer rather than busy-loop. ABORT closes with an explicit reason and preserved evidence.

## Recovery inquiry

Before each phase, answer only the questions that can change the next action:

- What durable state and acceptance criteria govern this phase?
- Which tools or skills are required, available, and authorized?
- Which checks and evidence would falsify success?
- What relevant facts, decisions, or prior attempts are already in Beads?
- Which failures repeated, and did the hypothesis change?
- What evidence or repository changes were added after the last failure, and can they now make the criterion provable?
- Is there measurable progress, a ready bounded task, and enough remaining budget?

Persist material answers as task notes, comments, or metadata. Do not persist chain-of-thought.
