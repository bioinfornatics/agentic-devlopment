# 15 — Skill Evaluations

## Why

Skills are production instruction surfaces. Evaluations are development artifacts. Keep `SKILL.md` compact so evals can be created before the skill grows.

This harness stores canonical skill evals outside `.agents/skills/`:

```text
evals/skills/<skill-name>.json
```

For portable distribution, each skill also carries a mirrored eval resource:

```text
.agents/skills/<skill-name>/references/evals.json
```

Update the canonical eval first, then refresh the bundled mirror before packaging.

## Evaluation-driven development

Build evaluations before writing extensive skill documentation:

1. **Identify gaps** — run representative tasks without the skill and document concrete failures or missing context.
2. **Create evaluations** — build three scenarios that test those gaps.
3. **Establish baseline** — record behavior without the skill.
4. **Write minimal instructions** — add just enough skill content to address the gaps and pass evals.
5. **Iterate** — execute evals, compare against baseline, and refine.

## Evaluation schema

Each eval file is a JSON array. Each scenario follows this shape:

```json
{
  "skills": ["skill-name"],
  "query": "Representative user request",
  "files": ["optional/context/file"],
  "baseline_gaps": [
    "Observed failure without the skill"
  ],
  "expected_behavior": [
    "Observable behavior that should happen with the skill"
  ]
}
```

## When to run evals

Run or update relevant skill evals when you change:

- a skill `SKILL.md`;
- a recipe or subrecipe that routes into that skill;
- Beads workflow language used by the skill;
- delegation rules or output formats;
- docs that materially change expected skill behavior.

## How to run evals

1. Open the relevant JSON file under `evals/skills/`.
2. Run each `query` in the target agent runtime with and without the listed `skills` when practical.
3. Compare behavior against `baseline_gaps` and `expected_behavior`.
4. Record durable follow-up work as Beads issues.
5. Fix the smallest instruction surface: eval, skill, recipe, then docs.
6. Re-run the failed scenario and one neighboring scenario.

## Current skill eval map

| Skill | Eval file |
| --- | --- |
| Agentic development harness | `evals/skills/agentic-dev-harness.json` |
| Beads harness | `evals/skills/beads-harness.json` |
| Code review | `evals/skills/code-review.json` |
| Goose orchestration | `evals/skills/goose-orchestration.json` |
| SDD | `evals/skills/sdd.json` |
| UI/UX quality | `evals/skills/ui-ux-quality.json` |
| Webapp testing | `evals/skills/webapp-testing.json` |

## Done criteria

A skill evaluation update is done when:

- canonical evals live in `evals/skills/`;
- packaged skills include refreshed `references/evals.json` mirrors;
- changed skills have corresponding eval scenarios in `evals/skills/`;
- scenarios capture observed baseline gaps before expanding instructions;
- docs build successfully;
- `goose skills list` still discovers project skills;
- recipe validation still passes if routing changed.
