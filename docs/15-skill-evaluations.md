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

### 2. Execute real with-skill / baseline runs

1. Open the relevant JSON file under `evals/skills/`.
2. For each scenario, run the `query` in the target agent runtime:
   - **with skill**: load or point the run at `.agents/skills/<skill-name>`;
   - **baseline**: run the same prompt without that skill when practical.
3. Save outputs in a skill-creator-compatible workspace shape:

   ```text
   <skill-name>-workspace/
     iteration-1/
       eval-0/
         eval_metadata.json
         with_skill/
           outputs/
         without_skill/
           outputs/
   ```

4. Write `eval_metadata.json` for each eval directory:

   ```json
   {
     "eval_id": 0,
     "eval_name": "short-descriptive-name",
     "prompt": "User request from evals/skills/<skill-name>.json",
     "assertions": [
       {"text": "Expected behavior to check"}
     ]
   }
   ```

5. Grade each run against `expected_behavior` and save `grading.json` next to the run. The viewer expects the exact fields `text`, `passed`, and `evidence`:

   ```json
   {
     "expectations": [
       {
         "text": "Expected behavior to check",
         "passed": true,
         "evidence": "Observed output that supports the grade"
       }
     ]
   }
   ```

6. Generate the visual review with skill-creator:

   ```bash
   SKILL_CREATOR_DIR=${SKILL_CREATOR_DIR:-$HOME/.agents/skills/skill-creator}

   python "$SKILL_CREATOR_DIR/eval-viewer/generate_review.py" \
     <skill-name>-workspace/iteration-1 \
     --skill-name "<skill-name>" \
     --static <skill-name>-workspace/iteration-1-review.html

   xdg-open <skill-name>-workspace/iteration-1-review.html
   ```

7. Compare behavior against `baseline_gaps` and `expected_behavior`.
8. Record durable follow-up work as Beads issues.
9. Fix the smallest instruction surface: eval, skill, recipe, then docs.
10. Re-run the failed scenario and one neighboring scenario.

### Optional benchmark tab

If runs include timing and grading data, aggregate them before launching the viewer:

```bash
SKILL_CREATOR_DIR=${SKILL_CREATOR_DIR:-$HOME/.agents/skills/skill-creator}

(
  cd "$SKILL_CREATOR_DIR"
  python -m scripts.aggregate_benchmark \
    /absolute/path/to/<skill-name>-workspace/iteration-1 \
    --skill-name "<skill-name>"
)

python "$SKILL_CREATOR_DIR/eval-viewer/generate_review.py" \
  <skill-name>-workspace/iteration-1 \
  --skill-name "<skill-name>" \
  --benchmark <skill-name>-workspace/iteration-1/benchmark.json \
  --static <skill-name>-workspace/iteration-1-review.html
```

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
