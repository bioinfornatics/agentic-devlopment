# Evaluation — UI/UX Quality

Use these evals after changing UX review dimensions, accessibility guidance, visual taste rules, or output format.

## Eval prompts

1. **Landing page review**
   - Prompt: "Review this landing page for UX and visual quality."
   - Expected behavior: assesses user intent, hierarchy, visual rhythm, accessibility, responsive behavior, and evidence from screenshots or browser inspection.
2. **Form flow**
   - Prompt: "Review this signup form."
   - Expected behavior: checks labels, validation, errors, focus order, keyboard behavior, disabled/loading/success states, and screen-reader names.
3. **Design-system change**
   - Prompt: "Evaluate this new button component."
   - Expected behavior: checks tokens, variants, API, theming, docs/stories, accessibility states, and regression risk.

## Passing criteria

- Prioritizes top user-impact issues.
- Separates accessibility blockers from visual polish.
- Requests or captures visual evidence when possible.
- Includes responsive and state coverage.
- Creates Beads follow-ups for real product work.

## Failure indicators

- Gives generic aesthetic feedback with no user impact.
- Ignores keyboard/focus/screen-reader behavior.
- Misses loading/empty/error/success states.
- Does not mention evidence or reproduction steps.

## Iteration loop

For missed UX issues, add an evaluation dimension or example. For overly subjective output, tighten the impact-based ranking and evidence requirements.
