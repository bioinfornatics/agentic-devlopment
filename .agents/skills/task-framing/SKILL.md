---
name: task-framing
description: Convert an engineering objective into the smallest independently verifiable Beads task contract. Use for ambiguous, risky, or multi-concern work; do not use to implement or approve the change.
---

# Task framing

Turn intent into one bounded contract before implementation. The contract is durable in Beads: use native description, design, acceptance criteria, notes, spec ID, dependencies, labels, and metadata rather than a private state file.

## Knowledge generation

Orient before deciding. Inspect the governing spec, relevant Beads run and ready work, repository conventions, affected interfaces, existing tests, prior attempts, and current budget. Separate observed facts from assumptions.

Ask only questions whose answers can change the next action:

1. What outcome and user-observable behavior must change?
2. Which invariant, policy, authorization, or dependency constrains it?
3. What existing memory, decision, or failed attempt in Beads is relevant?
4. What is the smallest increment that can produce useful evidence?
5. Which tool or domain skill is required, available, and authorized?
6. Which check could falsify success?
7. Has evidence or repository state changed since a prior failure, making success newly possible?

If a critical answer is unavailable, frame a research task or choose WAIT/REPLAN; do not invent precision.

## Skill selection contract

For each role, distinguish its explicit mandatory baseline skills from objective-driven dynamic skills. Discover dynamic candidates from task metadata, the governing spec, repository instructions, the objective, risks, and proof needs. Reference and load skills by name only. Select a dynamic skill only when its method is materially relevant; never preload all available skills.

Record selected skill names and a concise rationale in Beads and the role handoff. If a mandatory baseline skill is unavailable, the role is blocked. If an optional or dynamic skill is unavailable, document the limitation and continue only when the objective can still be completed safely and proved; otherwise block or escalate. This selection contract constrains required methodology, not the agent's freedom of method inside approved scope, acceptance criteria, and guardrails.

## Contract schema

```yaml
run_id: bead-id
objective: string
in_scope: [string]
out_of_scope: [string]
constraints: [string]
assumptions: [string]
acceptance_criteria:
  - id: AC-1
    statement: observable and falsifiable behavior
    proof: command or artifact that can prove it
expected_files: [hypothesis, not permission to ignore discoveries]
dependencies: [bead-id]
required_tools: [string]
required_skills: [mandatory baseline skill names]
dynamic_skill_candidates: [name plus material trigger]
risks: [string]
unknowns: [string]
budget:
  estimate_minutes: integer
  max_attempts: integer
```

## Framing procedure

1. Load the run epic and specification; reject a mismatched or closed run.
2. Reconstruct current phase, prior verdict, transition, evidence signature, and remaining budget.
3. Decompose by independently observable value, not merely by technical layer.
4. Select the smallest coherent increment. Move independent concerns to sibling tasks.
5. Define criteria before seeing implementation output. Every criterion names its expected proof.
6. Identify blocking dependencies. A task is ready only when its blockers are closed.
7. Record expected files as a hypothesis. If satisfying the AC requires broader scope, return REPLAN.
8. Persist the contract in a Beads child task and add dependency edges.

For parallel planning, create siblings only when no dependency edge exists and their write sets are disjoint. Do not let two delegates edit the same file.

## Quality rules

- Every AC is externally observable, falsifiable, and has one or more proof paths.
- Constraints and out-of-scope statements are explicit.
- Assumptions remain assumptions until evidence promotes them to facts.
- Security, destructive operations, credentials, public API breaks, and product judgment identify an escalation path.
- The task can be claimed and completed within one bounded agent session.
- Discovered work is linked as a new task, not silently absorbed.
- A failed previous approach is not retried without a changed hypothesis or new evidence.

## Beads handoff

Persist scope in description/design, ACs in acceptance_criteria, specification in spec_id, budget/role/iteration in metadata, and chronology in comments. Use a child task under the run epic. Add blocking dependencies in executable direction.

Return the task ID, contract, observed facts, unresolved unknowns, dependency rationale, expected proof, and suggested role. Do not claim implementation success.

## Self-validation

- [ ] The run, spec, prior attempts, and current state were inspected.
- [ ] The objective is one bounded independently verifiable outcome.
- [ ] Every AC is observable, falsifiable, and paired with proof.
- [ ] Assumptions, unknowns, tools, skills, risks, and budgets are explicit.
- [ ] Dependencies and safe parallelism were modeled in Beads.
- [ ] Repeated failures are not retried without a new hypothesis or evidence.
- [ ] No implementation or acceptance decision was performed.
