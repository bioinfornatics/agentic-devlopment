# Spec: Beads-native Loop Engineering

> Status: Active
> Bead: agentic-devlopment-hyoa
> Sources: loop_engineering_goose_beads.md and docs/loop-engineering/diagrams/

## Context

Goose provides recipes, Skills, Open Plugin hooks, isolated Summon delegates, and long-lived Orchestrator sessions. Beads provides the durable work graph. Conversation context and local trace files are not authoritative state.

## Acceptance Criteria

### AC-LE-01 — Durable control plane
WHEN a controlled loop starts or resumes
THEN it SHALL create or load a Beads run epic
AND SHALL store objective, acceptance contract, budget, phase, transition, verdict, dependencies, assignments, evidence references, and history in Beads
AND SHALL NOT use a .loop directory as runtime state.

### AC-LE-02 — Generic governed sequence
WHEN a run is authorized
THEN it SHALL follow Trigger → Planner → Builder → independent Verifier → Memory → Manager → Controller
AND each stage SHALL emit observable artifacts matching docs/loop-engineering/diagrams
AND the controller SHALL persist exactly one typed transition.

### AC-LE-03 — Delegation and independence
WHEN work has no blocking dependency and disjoint write ownership
THEN the controller MAY delegate it concurrently through Summon or Orchestrator
AND builder and verifier SHALL use different isolated sessions
AND the verifier SHALL not repair the implementation it judges.

### AC-LE-04 — Phase inquiry protocol
WHEN any stage starts or recovers
THEN it SHALL ask focused questions about required tools, required checks, relevant durable memory, prior failures, changed assumptions, and evidence added after a prior failure
AND it SHALL use the answers to select a bounded next action or terminal transition.

### AC-LE-05 — Bounded control
WHEN progress, budget, permissions, or evidence are evaluated
THEN the controller SHALL choose one of CONTINUE, REWORK, REPLAN, WAIT, COMPLETE, ESCALATE, or ABORT
AND SHALL NOT continue by default
AND SHALL terminate on proven completion, exhausted budget, repeated no-progress, impossible objective, or required human authorization.

### AC-LE-06 — Lifecycle plugin
WHEN Goose emits lifecycle events
THEN the Open Plugin SHALL persist sanitized event summaries into a configured Beads run when one is active
AND destructive shell operations SHALL be denied through the supported PreToolUse block contract
AND hook dependency failures SHALL fail open without creating a second source of truth.

### AC-LE-07 — Harness integrity
WHEN the pack is validated
THEN all recipes SHALL pass goose recipe validate
AND plugin script tests and consistency checks SHALL pass
AND eval declarations SHALL model skills as Layer 1, in-session agents as Layer 2, and recipes as Layer 3.

### AC-LE-08 — Runtime loop prevention
WHEN any recipe in the loop engineering pack runs
THEN it SHALL declare `session.max_tool_repetitions` to cap consecutive identical tool+params calls
AND it SHALL declare `retry.max_retries` with `retry.checks` (shell exit-0 success conditions) and `retry.on_failure: abort` to enforce a hard ceiling on recipe retry cycles
AND these runtime guards SHALL complement (not replace) the Beads `loop_max_attempts` metadata and the controller REWORK→ESCALATE→ABORT transition logic.

Rationale: the LLM controller is the primary governance mechanism; Goose runtime limits are the non-negotiable floor that fires before any LLM decision when the session degenerates into repetition or retries exhaust.

## Non-goals

- autonomous execution without budgets or stop conditions;
- storing raw prompts, secrets, complete tool payloads, or large command output in Beads;
- replacing Git, specifications, or evidence artifacts with Beads;
- making hooks the workflow engine.
