# Evaluation Fixtures

Fixtures are deterministic setup artifacts for runtime evaluations. They should be coherent with the subject being evaluated and should avoid leaking the full answer key into the task prompt.

## Difficulty ladder

- `normal`: one clear issue or workflow behavior that the skill should improve reliably.
- `difficult`: realistic ambiguity, multiple files, or durable follow-up hygiene.
- `very_difficult`: multiple interacting risks, sequencing constraints, or orchestration decisions.

For each scenario, `expected_skill_contribution` states what we expect from the skill specifically. This is reviewer/grader-facing and should not be needed by the runtime agent.

## Code review fixtures

- `install-missing-recipe.patch` — normal: direct install-script regression.
- `eval-docs-todo-antipattern.patch` — difficult: durable tracking anti-pattern in docs.
- `current-diff-regression.patch` — very difficult: mixed recipe, skill, and docs regression.
