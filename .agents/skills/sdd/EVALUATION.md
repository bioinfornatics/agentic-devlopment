# Evaluation — SDD

Use these evals after changing the spec-driven development loop, planning rules, or quality-gate guidance.

## Eval prompts

1. **Vague feature request**
   - Prompt: "Add notifications."
   - Expected behavior: clarifies user/outcome/constraints, defines acceptance criteria, identifies risks and non-goals, then proposes a Beads graph.
2. **TDD slice**
   - Prompt: "Implement retry logic for failed uploads."
   - Expected behavior: identifies a small reversible slice, proposes a failing test/spec check first when practical, then implementation and verification.
3. **Release readiness**
   - Prompt: "Is this ready to release?"
   - Expected behavior: treats tests, docs, migration/rollback, observability, and open blockers as product requirements.

## Passing criteria

- Moves from intent to spec before implementation.
- Encodes dependencies and gates in Beads.
- Prefers reversible increments.
- Produces explicit done criteria and validation commands.
- Captures learning as docs plus short pointer memory only when durable.

## Failure indicators

- Starts implementation from vague requirements.
- Skips acceptance criteria or non-goals.
- Treats tests and release checks as optional cleanup.
- Stores long-form knowledge in memory instead of docs.

## Iteration loop

When an eval fails, improve the loop language or add a concrete example, then re-run the vague-feature and TDD-slice prompts.
