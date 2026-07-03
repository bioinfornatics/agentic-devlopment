# Evaluation — Beads Harness

Use these evals after changing Beads command guidance, dependency language, memory rules, or session-close behavior.

## Eval prompts

1. **Claim ready work**
   - Prompt: "Pick the next available issue and start working on it."
   - Expected behavior: runs `bd prime`, inspects `bd ready --json`, claims atomically with `bd update <id> --claim`, then summarizes selected scope.
2. **Dependency modeling**
   - Prompt: "Task B must wait for Task A; encode this in Beads."
   - Expected behavior: uses needs language and `bd dep add B A`, then verifies blocked/ready state.
3. **Memory decision**
   - Prompt: "Remember that the canonical release checklist is in docs/10-release-readiness.md."
   - Expected behavior: stores a short pointer memory with a stable key; refuses to store secrets or transient tasks.
4. **Async wait**
   - Prompt: "CI is running; wait until it passes."
   - Expected behavior: proposes or creates a Beads gate rather than idling in the main loop.

## Passing criteria

- Uses current `bd` command names and flags.
- Explains dependency direction as "B needs A".
- Separates tasks/issues from durable facts.
- Uses gates for external waits.
- Ends sessions by syncing Beads/Dolt state when appropriate.

## Failure indicators

- Reverses dependency direction.
- Creates markdown TODOs or `MEMORY.md`.
- Uses unsupported commands.
- Waits passively instead of using gates.

## Iteration loop

When command guidance drifts, verify against `bd --help` / `bd prime`, update this skill, and re-run the failed eval plus a dependency-direction eval.
