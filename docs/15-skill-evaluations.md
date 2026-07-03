# 15 — Skill Evaluations

## Why

Skills are instruction surfaces. They need lightweight evals so changes can be tested against realistic prompts instead of relying on intuition.

This harness keeps evals beside each skill:

```text
.agents/skills/<skill-name>/EVALUATION.md
```

## What each eval includes

- realistic prompts that should activate the skill;
- expected behavior for each prompt;
- passing criteria;
- failure indicators;
- an iteration loop for updating the skill after failures.

## When to run evals

Run the relevant skill evals when you change:

- a skill `SKILL.md`;
- a recipe or subrecipe that routes into that skill;
- Beads workflow language used by the skill;
- delegation rules or output formats;
- docs that materially change the skill's expected behavior.

## How to run evals

1. Open the relevant `EVALUATION.md`.
2. Run each eval prompt in the target agent runtime or as a recipe smoke test.
3. Compare the response against expected behavior and passing criteria.
4. Record any durable follow-up as a Beads issue.
5. Fix the smallest instruction surface: eval wording, skill, recipe, then docs.
6. Re-run the failed prompt and one neighboring prompt.

## Current skill eval map

| Skill | Eval file |
| --- | --- |
| Agentic development harness | `.agents/skills/agentic-dev-harness/EVALUATION.md` |
| Beads harness | `.agents/skills/beads-harness/EVALUATION.md` |
| Code review | `.agents/skills/code-review/EVALUATION.md` |
| Goose orchestration | `.agents/skills/goose-orchestration/EVALUATION.md` |
| SDD | `.agents/skills/sdd/EVALUATION.md` |
| UI/UX quality | `.agents/skills/ui-ux-quality/EVALUATION.md` |
| Webapp testing | `.agents/skills/webapp-testing/EVALUATION.md` |

## Done criteria

A skill evaluation update is done when:

- every changed skill has an adjacent eval file;
- eval prompts cover at least one happy path and one common failure mode;
- docs build successfully;
- `goose skills list` still discovers project skills;
- recipe validation still passes if routing changed.
