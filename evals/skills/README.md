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

## Visual review

Render all eval definitions in the skill-creator review UI:

```bash
python scripts/render-skill-eval-review.py
xdg-open dist/skill-eval-review/index.html
```

This checks that prompts, baseline gaps, and expected behaviors are reviewable. It does not execute model runs. For runtime with-skill/baseline evaluation and grading, see `docs/15-skill-evaluations.md`.

Run a real A/B skill eval with:

```bash
python scripts/run-skill-ab-eval.py --skill code-review --iteration 1
xdg-open dist/evals/<timestamp>/skills/code-review/iteration-1/review.html
```

Compare the working-tree skill against a committed baseline with:

```bash
python scripts/run-skill-ab-eval.py --skill code-review --mode old-new --baseline-git-ref HEAD~1
xdg-open dist/evals/<timestamp>/skills/code-review/iteration-1/review.html
```

The A/B runners use isolated Goose homes by default, so installed skills, agents, and recipes are hidden for `without_skill` baselines. Use `--ambient-goose` only when debugging with the normal Goose environment.

Run the full skill suite and open the suite index with:

```bash
python scripts/run-skill-ab-suite.py --iteration 1 --continue-on-failure
xdg-open dist/evals/<timestamp>/skills/index.html
```

Editor shortcuts:

- VS Code: **Terminal → Run Task… → Eval Skills: Full A/B Suite**.
- JetBrains: run configuration **Eval Skills - Full A/B Suite**.

## Files

- `agentic-dev-harness.json`
- `beads-harness.json`
- `code-review.json`
- `goose-orchestration.json`
- `sdd.json`
- `ui-ux-quality.json`
- `webapp-testing.json`


## Scenario quality notes

- Keep `expected_behavior` grader-only; do not rely on it being present in the task prompt.
- Avoid contradictory expectations. For read-only scenarios, ask the agent to propose Beads follow-up commands instead of executing `bd create`.
- If delegation is optional, grade either useful delegation or an explicit rationale for direct inspection.
- Avoid putting `.agents/skills/` in `files` for with/without skill evals unless the scenario intentionally allows the baseline to inspect skill text.
- For Beads workflow scenarios, provide a deterministic issue or allow the agent to create and claim a scoped issue when no exact active issue exists.
