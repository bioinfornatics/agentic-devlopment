# Skill Evaluations

These evaluations are intentionally **outside** `.agents/skills/`.

Skills should stay compact and production-focused. Evaluation scenarios are a development artifact used to design and iterate skills before expanding instructions.

## Evaluation-driven development

1. **Identify gaps** — run representative tasks without a skill and record concrete failures.
2. **Create evaluations** — define three scenarios that test those failures.
3. **Establish baseline** — capture behavior without the skill.
4. **Write minimal instructions** — add only enough skill content to address the gaps.
5. **Iterate** — run the evaluations, compare to baseline, and refine.

## Schema

Each file is a JSON array. Each scenario follows this shape:

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

## Files

- `agentic-dev-harness.json`
- `beads-harness.json`
- `code-review.json`
- `goose-orchestration.json`
- `sdd.json`
- `ui-ux-quality.json`
- `webapp-testing.json`
