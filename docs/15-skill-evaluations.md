# 15 — Skill Evaluations

## Why

Skills are production instruction surfaces. Evaluations are development artifacts. Keep them separate so skills stay compact and so evals can be created before the skill grows.

This harness stores skill evals outside `.agents/skills/`:

```text
evals/skills/<skill-name>.json
```

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

There are two useful loops: a quick visual review of the eval definitions, and a real runtime evaluation of agent behavior.

### 1. Render a visual review of eval definitions

Use this before editing skill text or before asking someone to review the eval set. It does **not** execute model runs; it renders `query`, `baseline_gaps`, and `expected_behavior` in the skill-creator review UI.

```bash
python scripts/render-skill-eval-review.py
xdg-open dist/skill-eval-review/index.html
```

If `skill-creator` is installed somewhere other than `~/.agents/skills/skill-creator`, pass it explicitly:

```bash
python scripts/render-skill-eval-review.py \
  --skill-creator-dir /path/to/skill-creator \
  --output dist/skill-eval-review/index.html
```

### 2. Execute real A/B runs

Use `scripts/run-skill-ab-eval.py` for real behavioral review. It creates isolated copied worktrees under `dist/evals/`, runs Goose for each scenario, grades each output, aggregates `benchmark.json`, and renders the skill-creator HTML review.

Plan-only smoke test, useful for checking workspace shape without model calls:

```bash
python scripts/run-skill-ab-eval.py \
  --skill code-review \
  --iteration 0 \
  --grade-mode heuristic

xdg-open dist/evals/skills/code-review/iteration-0/review.html
```

Real `with_skill` / `without_skill` run:

```bash
python scripts/run-skill-ab-eval.py \
  --skill code-review \
  --iteration 1 \
  --runs-per-config 1 \
  --execute \
  --grade-mode llm

xdg-open dist/evals/skills/code-review/iteration-1/review.html
```

The generated workspace follows the shape expected by skill-creator:

```text
dist/evals/skills/<skill-name>/iteration-1/
  eval-0/
    eval_metadata.json
    with_skill/
      run-1/
        outputs/
        grading.json
        timing.json
    without_skill/
      run-1/
        outputs/
        grading.json
        timing.json
  benchmark.json
  benchmark.md
  review.html
```

By default, the runner now uses an isolated Goose home and a neutral cwd for each run. That hides installed project skills, named agents, and recipes from Goose discovery, so `without_skill` is a strict baseline except for built-in Goose skills. The runner still gives every run an isolated copy of the repository path in the prompt, so the task can inspect or edit the copied files without exposing project-local Goose discovery from the source checkout.

Use `--ambient-goose` only when you intentionally want the caller's normal Goose environment, for example while debugging provider configuration. In ambient mode, `goose skills list` and `goose recipe list` may see installed user/project skills and recipes, so the baseline is no longer strict.

If the isolated home cannot use your default provider, pass explicit provider/model flags that work with the copied minimal Goose config:

```bash
python scripts/run-skill-ab-eval.py   --skill code-review   --iteration 1   --execute   --grade-mode llm   --provider custom_claude_from_azure   --model claude-sonnet-4-6
```

### 3. Execute the full skill suite

Use the suite runner when you want every `evals/skills/*.json` file executed and summarized in one visual index.

Plan-only smoke suite for one or more selected skills:

```bash
python scripts/run-skill-ab-suite.py \
  --iteration 0 \
  --grade-mode heuristic \
  --skills code-review sdd

xdg-open dist/evals/skills/index.html
```

Full real suite:

```bash
python scripts/run-skill-ab-suite.py \
  --iteration 1 \
  --runs-per-config 1 \
  --execute \
  --grade-mode llm \
  --continue-on-failure

xdg-open dist/evals/skills/index.html
```

The suite runner uses the same strict isolated Goose baseline by default. Pass `--ambient-goose` only to debug with your normal installed skills/agents/recipes visible.

The suite index links to each per-skill review and benchmark:

```text
dist/evals/skills/index.html
dist/evals/skills/iteration-1-index.html
dist/evals/skills/<skill-name>/iteration-1/review.html
dist/evals/skills/<skill-name>/iteration-1/benchmark.json
```

Use `--skills` to run a subset while developing an eval. Omit `--execute` for a fast shape check; include `--execute` for real model runs.

### 4. Execute old/new A/B after changing a skill

Before editing a skill, snapshot the current version:

```bash
mkdir -p dist/evals/snapshots
cp -a .agents/skills/code-review dist/evals/snapshots/code-review-before
```

After editing `.agents/skills/code-review`, compare the candidate against the snapshot. If `--baseline-skill-dir` is omitted, the runner uses the installed original skill at `~/.agents/skills/<skill-name>` when present; if `--candidate-skill-dir` is omitted, it uses `.agents/skills/<skill-name>`.

```bash
python scripts/run-skill-ab-eval.py \
  --skill code-review \
  --mode old-new \
  --baseline-skill-dir dist/evals/snapshots/code-review-before \
  --candidate-skill-dir .agents/skills/code-review \
  --iteration 2 \
  --runs-per-config 1 \
  --execute \
  --grade-mode llm \
  --previous-workspace dist/evals/skills/code-review/iteration-1

xdg-open dist/evals/skills/code-review/iteration-2/review.html
```

The benchmark tab supports dynamic configuration names, so the same viewer works for `with_skill` / `without_skill` and `new_skill` / `old_skill`. No project-local viewer fork is needed unless we want UI features beyond the upstream skill-creator viewer.

### 5. Interpret and iterate

1. Compare behavior against `baseline_gaps` and `expected_behavior`.
2. Inspect both the output tab and benchmark tab.
3. Treat low pass-rate deltas or noisy assertions as eval-design feedback, not only skill failures.
4. Record durable follow-up work as Beads issues.
5. Fix the smallest instruction surface: eval, skill, recipe, then docs.
6. Re-run the failed scenario and one neighboring scenario.

### Manual workspace rules

If you create workspaces by hand instead of using the runner, the viewer expects:

- `eval_metadata.json` with `eval_id`, `eval_name`, `prompt`, and `assertions`;
- one or more configuration directories containing `run-*` directories;
- each run directory containing `outputs/`, `grading.json`, and optionally `timing.json`;
- `grading.json.expectations[]` fields named exactly `text`, `passed`, and `evidence`.

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

- evals live outside `.agents/skills/`;
- changed skills have corresponding eval scenarios in `evals/skills/`;
- scenarios capture observed baseline gaps before expanding instructions;
- docs build successfully;
- `goose skills list` still discovers project skills;
- recipe validation still passes if routing changed.
