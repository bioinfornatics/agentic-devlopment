# Goose Skills — Optimized Agentic Harness

This directory was rewritten as a compact skill library for Goose + Beads.

## Core skills

- `agentic-dev-harness` — master operating model.
- `beads-harness` — Beads commands and durable task graph semantics.
- `goose-orchestration` — Goose extensions, recipes, subrecipes, subagents, Summon.
- `sdd` — product engineering governance loop.
- `code-review` — review methodology.
- `ui-ux-quality` — unified UI/UX quality framework.
- `webapp-testing` — browser verification method.

Old copies are available in `~/.agents/skills.old`.

## Evaluation files

Each project skill includes an `EVALUATION.md` file following the skill evaluation/iteration practice described in Claude skill guidance:

- realistic prompts that should trigger the skill;
- expected behavior for each prompt;
- passing criteria and failure indicators;
- a small iteration loop for improving the skill after failures.

When a skill changes, run the relevant eval prompts manually or through the target agent runtime, then update the smallest instruction surface that fixes the failure. Keep evals next to the skill so future agents can maintain them with the skill.
