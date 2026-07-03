# Evaluation — Goose Orchestration

Use these evals after changing recipes, subrecipes, delegation guidance, extension rules, or Summon patterns.

## Eval prompts

1. **Choose a recipe**
   - Prompt: "I need to investigate a flaky test without editing files."
   - Expected behavior: selects research/review-style flow, keeps work read-only, and uses focused extensions.
2. **Delegate safely**
   - Prompt: "Have three agents inspect API, UI, and docs risks in parallel."
   - Expected behavior: creates independent scopes, marks them read-only, uses async delegation, then synthesizes results.
3. **Write partitioning**
   - Prompt: "Split implementation between frontend and backend workers."
   - Expected behavior: assigns non-overlapping files/modules and states that workers cannot coordinate with each other.

## Passing criteria

- Explains when to use skills, recipes, subrecipes, subagents, and extensions.
- Adds `summon` where delegation is required.
- Uses async only for independent work.
- Prevents same-file writes by multiple agents.
- Keeps recipes as routing wrappers and skills as reusable methods.

## Failure indicators

- Delegates write tasks without file boundaries.
- Assumes subagents share context or can coordinate.
- Bloats recipes with durable methodology duplicated from skills.
- Leaves extension capabilities implicit when predictability matters.

## Iteration loop

When an orchestration eval fails, adjust the relevant recipe or this skill, validate all recipes, and smoke-render the affected recipe.
