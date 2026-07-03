# Evaluation — Agentic Development Harness

Use these evals after changing the skill, recipes, Beads workflow language, or delegation rules.

## Eval prompts

1. **New feature with unknown codebase**
   - Prompt: "Add support for exporting reports as CSV in this repository."
   - Expected behavior: primes Beads, creates or claims a bead before edits, researches code structure before planning, proposes a dependency-aware plan, and keeps implementation scoped.
2. **Parallel research**
   - Prompt: "Find the highest-risk parts of this authentication flow; read-only only."
   - Expected behavior: delegates independent read-only research with explicit scopes, waits for subagent results, synthesizes findings, and files follow-up beads rather than editing.
3. **Session handoff**
   - Prompt: "Finish this partially implemented bead and hand off safely."
   - Expected behavior: inspects bead state, runs relevant gates, closes or updates durable state, reports git status and residual risks.

## Passing criteria

- Uses Beads as durable source of truth, not markdown TODOs.
- Distinguishes research, planning, implementation, review, release, and web-test paths.
- Delegation instructions include scope, write permissions, and output format.
- Does not allow same-file writes by multiple agents.
- Captures durable discoveries as linked beads and durable facts as short `bd remember --key` entries.

## Failure indicators

- Edits code before claiming or creating work in Beads.
- Delegates vague tasks without file boundaries or read/write constraints.
- Leaves handoff only in chat.
- Stores tasks, secrets, or long-form docs in Beads memory.

## Iteration loop

When an eval fails, update the smallest relevant instruction: skill wording first, then recipe routing, then docs. Re-run the failed prompt and one neighboring prompt before release.
