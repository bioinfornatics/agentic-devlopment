# 15 — Skill, Agent, and Recipe Evaluations

## Why

Skills are production instruction surfaces. Evaluations are development artifacts. Keep them separate so skills stay compact and so evals can be created before the skill grows.

This harness stores skill evals outside `.agents/skills/`:

```text
evals/skills/<skill-name>.json
```

## Harness layer model

The harness treats skills, agents, and recipes as **stacked layers**. Each layer adds structure on top of the previous one:

| Layer | Contents | What it adds |
|-------|----------|-------------|
| **0 — Nothing** | Plain Goose, no project content | Raw model capability |
| **1 — Skills** | Skill `SKILL.md` text injected into the prompt | Reusable methodology |
| **2 — Agents** | Agent spec + supporting skills | Persona, routing, workflow discipline |
| **3 — Recipes** | Recipe YAML + agents + skills | Structured orchestration |

### A/B comparison by layer (`--mode layer-delta`)

Each eval kind measures the **marginal value** of its layer over the one below:

| Kind | Comparison | `with_*` condition | `without_*` baseline |
|------|-----------|-------------------|---------------------|
| Skills | Layer 1 vs Layer 0 | skill text injected | nothing |
| Agents | Layer 2 vs Layer 1 | agent spec + skill text | skill text only |
| Recipes | Layer 3 vs Layer 2 | recipe + agents + skills | agents + skills only |

`layer-delta` is the **default mode** for agents and recipes. It answers: *given the supporting layer is already present, does this artifact improve the outcome?*

`--mode with-without` compares any subject directly against nothing (Layer 0). It remains available for all kinds and is the default for skills (where Layer 0 is the correct baseline).

### Layer declarations in eval JSON

Declare the supporting stack inside each eval scenario so the runner knows what to inject into the baseline condition:

**Agent eval** — `"skills"` declares the Layer 1 stack beneath the agent:
```json
{
  "skills": ["code-review"],
  "query": "…"
}
```

**Recipe eval** — `"agents"` + `"skills"` declare the Layer 2 stack beneath the recipe:
```json
{
  "agents": ["review-critic"],
  "skills": ["code-review"],
  "query": "…"
}
```

In `layer-delta` mode both conditions run with identical environments; only the injected content differs.

### Isolation guarantee

Globally installed skills (`~/.agents/skills/`) and recipes (`~/.config/goose/recipes/`) are hidden for the entire eval run via atomic directory rename — the same mechanism used by the skill runner. Both `with_*` and `without_*` conditions run in the same isolated environment; the supporting layer is injected **as text only**, not installed on disk.

---

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
  "fixture_patch": "optional/path/to.patch",
  "fixture_description": "Optional explanation of prepared changes",
  "fixture_intent": "Why this fixture exists and how it exercises the skill",
  "difficulty": "normal|difficult|very_difficult",
  "expected_skill_contribution": "What the skill should add beyond baseline",
  "max_turns": 100,
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
node apps/eval-hub/dist/index.js --open
xdg-open dist/skill-eval-review/index.html
```

If `skill-creator` is installed somewhere other than `~/.agents/skills/skill-creator`, pass it explicitly:

```bash
node apps/eval-hub/dist/index.js --open \
  --skill-creator-dir /path/to/skill-creator \
  --output dist/skill-eval-review/index.html
```

### 2. Execute A/B runs

Use `.agents/skills/skill-creator/scripts/run-skill-ab-eval.py` for behavioral review. It creates isolated copied worktrees under `dist/evals/`, runs Goose for each scenario, grades each output with an LLM, aggregates `benchmark.json`, and renders the skill-creator HTML review.

#### Eval modes

The runner supports three comparison modes:

| Mode                     | Configs generated                                | Purpose                                                    |
|--------------------------|--------------------------------------------------|------------------------------------------------------------|
| `with-without` (default) | `with_skill`, `without_skill`                    | Core skill-vs-baseline delta                               |
| `with-without-available` | `with_skill`, `available_skill`, `without_skill` | Separates skill content quality from skill discoverability |
| `old-new`                | `new_skill`, `old_skill`                         | Compare two skill versions                                 |

**`available_skill`** installs the skill directory under the isolated Goose home (so `goose skills list` can find it) but does **not** inject the SKILL.md content into the prompt. This tests whether the agent can discover and apply the skill on its own — separate from whether the skill content is high-quality when directly provided.

Single-skill `with_skill` / `without_skill` run:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --skill code-review \
  --runs-per-config 1

xdg-open dist/evals/skills/code-review/<content-hash>/review.html
```

The generated workspace follows the shape expected by skill-creator:

```text
dist/evals/skills/<skill-name>/<content-hash>/
  eval-0/
    eval_metadata.json
    with_skill/
      run-1/
        outputs/
          prompt.md
          response.md
          conversation.md
          loaded_skills.md
          events.jsonl
        raw_stdout.txt
        audit.json
        feedback.json
        feedback.md
        grading.json
        timing.json
    without_skill/
      run-1/
        outputs/
          prompt.md
          response.md
          conversation.md
          loaded_skills.md
          events.jsonl
        raw_stdout.txt
        audit.json
        feedback.json
        feedback.md
        grading.json
        timing.json
  benchmark.json
  benchmark.md
  review.html
```

By default, the runner uses an isolated Goose home and a neutral cwd for each run. That hides installed project skills, named agents, and recipes from Goose discovery, so `without_skill` is a strict baseline except for built-in Goose skills. The runner still gives every run an isolated copy of the repository path in the prompt, so the task can inspect or edit the copied files without exposing project-local Goose discovery from the source checkout.

Use `--ambient-goose` only when you intentionally want the caller's normal Goose environment, for example while debugging provider configuration. In ambient mode, `goose skills list` and `goose recipe list` may see installed user/project skills and recipes, so the baseline is no longer strict.

If the isolated home cannot use your default provider, pass explicit provider/model flags that work with the copied minimal Goose config:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --skill code-review \
  --provider custom_claude_from_azure \
  --model claude-sonnet-4-6
```

### 3. Execute the full skill suite

Use the suite runner when you want every `evals/skills/*.json` file executed and summarized in one visual index.

By default, runtime outputs are grouped by subject under `dist/evals/skills/<skill-name>/<content-hash>/`. For skill evals, the hash covers the primary skill directory, so uncommitted skill edits are reflected without requiring a commit. Pass `--run-id-source git` to use the current commit instead; this requires a clean working tree. Pass `--workspace-root` to override the output root completely.

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --runs-per-config 1 \
  --continue-on-failure

xdg-open dist/evals/skills/index.html
```

Use `--goose-cli` or `GOOSE_EVAL_CLI` to force a specific Goose binary for both task and grader runs, for example:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --continue-on-failure \
  --goose-cli ../third-parties/goose/target/debug/goose
```

VS Code suite tasks forward the `agenticDevelopment.gooseEvalCli` setting from `.vscode/settings.json`. Keep it as `goose` for PATH resolution or set it locally to a debug binary, for example `/home/jmercier/Codes/third-parties/goose/target/debug/goose`. JetBrains run configurations can use the same mechanism by setting the `GOOSE_EVAL_CLI` environment variable in the run configuration.

The task prompt intentionally does **not** include `expected_behavior` or `baseline_gaps`; those fields are grader-only. Use `--include-grading-hints` only while debugging an eval definition, because it leaks the answer key into both A/B arms and can erase the measured skill delta.

The suite runner uses the same strict isolated Goose baseline by default. Pass `--ambient-goose` only to debug with your normal installed skills/agents/recipes visible. Use `--skills` to run a subset while developing an eval:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --subjects code-review sdd
```

The suite index links to each per-skill review and benchmark:

```text
dist/evals/skills/index.html
dist/evals/skills/<skill-name>/<content-hash>/review.html
dist/evals/skills/<skill-name>/<content-hash>/benchmark.json
```


For future agent and recipe eval runners, use the same subject-first pattern: `dist/evals/agents/<agent-name>/<content-hash>/` for `.agents/agents/<agent-name>.md` and `dist/evals/recipes/<recipe-name>/<content-hash>/` for `.goose/recipes/<recipe-name>.yaml`.

The runners also append a lightweight SQLite history database at `dist/evals/evaluation.db` by default. It records the run id, kind (`skills` for the current runner), subject, content hash, git commit, dirty flag, provider, model, turn usage, max-turn hit rate, workspace path, benchmark summary JSON, per-run rows, pass-rate improvement rows, and automatic feedback recommendations in `eval_feedback`. Use `--no-history` to disable this or `--history-db <path>` to write elsewhere. Existing `dist/evals/eval-history.sqlite3` files are renamed to `evaluation.db` on first use.

Long runs print `[start]`, `[heartbeat]`, and `[done]` lines while task and grader subprocesses are running. The default heartbeat interval is 30 seconds; change it with `--heartbeat-seconds N` or disable it with `--heartbeat-seconds 0`.

Task runs use Goose `--output-format stream-json`; JSON events are stored in `outputs/events.jsonl`. Streaming text deltas are aggregated by message id so `outputs/response.md` and `outputs/conversation.md` show atomic assistant messages instead of one fragment per line. `outputs/loaded_skills.md` proves which project skills were injected, while `raw_stdout.txt` is kept outside `outputs/` so the review UI focuses on the rendered conversation. `audit.json` summarizes tool calls, shell commands, validations, Beads actions, browser actions, changed files, token usage, and turn usage. `feedback.json`/`feedback.md` capture automatic recommendations; use `--no-feedback` to skip that extra LLM pass.

### Editor shortcuts

VS Code tasks are defined in `.vscode/tasks.json` (run via **Terminal → Run Task…**):

**Skills** — mode `with-without` (Layer 1 vs Layer 0):

| Task | What it does |
|------|-------------|
| `Eval: Skills — Full Suite` | Sequential, all skills |
| `Eval: Skills — Full Suite (parallel)` | 5 workers |
| `Eval: Skills — Subset` | Sequential, prompted skill list |
| `Eval: Skills — Subset (parallel)` | 5 workers, prompted list |
| `Eval: Skills — Full Suite (parallel) + Post-Suite` | Parallel suite → quality gate → export → trend report |

**Agents** — mode `layer-delta` (Layer 2 vs Layer 1):

| Task | What it does |
|------|-------------|
| `Eval: Agents — Full Suite` | Sequential, all agents |
| `Eval: Agents — Full Suite (parallel)` | 5 workers |
| `Eval: Agents — Single` | One agent, prompted |
| `Eval: Agents — Full Suite (parallel) + Post-Suite` | Parallel suite → export → trend report |

**Recipes** — mode `layer-delta` (Layer 3 vs Layer 2):

| Task | What it does |
|------|-------------|
| `Eval: Recipes — Full Suite` | Sequential, all recipes |
| `Eval: Recipes — Full Suite (parallel)` | 5 workers |
| `Eval: Recipes — Single` | One recipe, prompted |
| `Eval: Recipes — Subset (parallel)` | 5 workers, prompted list |
| `Eval: Recipes — Full Suite (parallel) + Post-Suite` | Parallel suite → export → trend report |

**Cross-kind:**

| Task | What it does |
|------|-------------|
| `Eval: All Kinds — Full Suite` | Skills → Recipes → Agents, each 5 workers |
| `Eval: All Kinds — Skills + Recipes (parallel)` | Skills and recipes simultaneously |
| `Eval: All Kinds — Skills + Recipes (parallel) + Post-Suite` | Parallel → quality gate → export → trend |

**Post-suite building blocks** (run independently after any suite):

| Task | What it does |
|------|-------------|
| `Eval: Post-Suite — Analyze + Quality Gate` | Skills quality gate only |
| `Eval: Post-Suite — Export History` | DB → `evals/history/runs.json` |
| `Eval: Post-Suite — Build Trend Report` | Trend dashboard from DB |
| `Eval: Post-Suite — Full Workflow` | Analyze + export + trend + open both views |

JetBrains run configurations live in `.idea/runConfigurations/` and mirror every task above, organised into `Eval/Skills`, `Eval/Agents`, `Eval/Recipes`, `Eval/All Kinds`, `Eval/Post-Suite`, `Eval/Open`, `SDD`, `Harness`, and `KG` groups. They appear in the Run/Debug configuration selector after the project reloads. Prompted inputs (skill name, recipe name, etc.) are exposed as environment variables editable in the configuration dialog.


### Generic agents and recipes runner

The skill runner is the main path for `evals/skills/`. The generic harness runner covers named agents and recipes using the same A/B framework but with `--mode layer-delta` as the default (see [Harness layer model](#harness-layer-model)).

```bash
# single subject
node apps/eval-hub/dist/index.js --run --layers agents  --subject review-critic
node apps/eval-hub/dist/index.js --run --layers recipes --subject review

# full suite
node apps/eval-hub/dist/index.js --run --layers agents  --continue-on-failure
node apps/eval-hub/dist/index.js --run --layers recipes --continue-on-failure
```

Default output layouts:

```text
dist/evals/agents/<agent-name>/<content-hash>/
dist/evals/recipes/<recipe-name>/<content-hash>/
```

Agent subjects resolve to `.agents/agents/<agent-name>.md`. Recipe subjects resolve to `.goose/recipes/<recipe-name>.yaml`; recipe evals also run `goose recipe validate` and a `--render-recipe` smoke-check before model execution, writing `recipe_checks.json` in the workspace.

**Modes available:**

| Mode | Default for | What it tests |
|------|------------|--------------|
| `layer-delta` | agents, recipes | subject vs the layer below (see layer model) |
| `with-without` | skills | subject vs nothing (Layer 0 baseline) |
| `old-new` | all | candidate git ref vs baseline git ref |

**Post-suite for agents and recipes** — no quality gate (that is skills-specific); export history and build the trend report:

```bash
node apps/eval-hub/dist/index.js --export-history
node apps/eval-hub/dist/index.js --report
xdg-open dist/evals/report/index.html
```

### 4. Run the analysis and quality gate

After a suite run, analyze the artifacts and check for structural problems:

```bash
node apps/eval-hub/dist/index.js --report \
  --check \
  --max-turn-threshold 0.5 \
  --negative-delta-gate \
  --efficiency-gate
```

`--check` enables the quality gate; it exits 1 on hard failures and prints warnings for soft issues:

| Gate | Severity | Triggers when |
|---|---|---|
| `--max-turn-threshold` (default 0.5) | **FAIL** | >50 % of scenarios in a subject hit max turns |
| `--negative-delta-gate` | WARN | Any subject has ≥1 negative skill delta scenario |
| `--efficiency-gate` | WARN | pass_rate=1.0 AND max_turns_reached in the same run (answer-key contamination) |
| Model errors | WARN | Any run contains detected Azure/model content-filter events |

Use the analysis output to decide whether to fix the **skill**, the **eval fixture**, or the **runner** — in that order of preference.

```bash
# View analysis summary
cat dist/evals/skills/analysis-summary.md

# Open analysis index
xdg-open dist/evals/skills/analysis-index.html
```

### 5. Execute old/new A/B after changing a skill

Prefer a git ref for the original baseline when the previous version is committed. This avoids manual snapshot directories:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --skill code-review \
  --mode old-new \
  --baseline-git-ref HEAD~1 \
  --runs-per-config 1 \
  --previous-workspace dist/evals/skills/code-review/<content-hash>

xdg-open dist/evals/skills/code-review/<content-hash>/review.html
```

The runner materializes `.agents/skills/<skill-name>` from `--baseline-git-ref` into the generated workspace and compares it against the working-tree candidate at `.agents/skills/<skill-name>`. You can also compare two refs directly:

```bash
node apps/eval-hub/dist/index.js --run --layers skills \
  --skill code-review \
  --mode old-new \
  --baseline-git-ref v1.0.0 \
  --candidate-git-ref HEAD
```

Fallbacks remain available:

- `--baseline-skill-dir <path>` for a manual snapshot;
- no baseline option, which uses the installed original at `~/.agents/skills/<skill-name>` when present;
- no candidate option, which uses `.agents/skills/<skill-name>`.

The benchmark tab supports dynamic configuration names, so the same viewer works for `with_skill` / `without_skill` and `new_skill` / `old_skill`. No project-local viewer fork is needed unless we want UI features beyond the upstream skill-creator viewer.

### 6. Interpret and iterate

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

## Current eval map

### Skills (mode: `with-without` — Layer 1 vs Layer 0)

| Skill | Eval file |
| --- | --- |
<!-- BEGIN GENERATED: eval-skills -->
| Skill | Eval file |
| --- | --- |
| `agentic-devlopment` | `evals/skills/agentic-devlopment.json` |
| `agentic-ux` | `evals/skills/agentic-ux.json` |
| `atomic-design` | `evals/skills/atomic-design.json` |
| `beads` | `evals/skills/beads.json` |
| `code-review` | `evals/skills/code-review.json` |
| `cognitive-ux` | `evals/skills/cognitive-ux.json` |
| `design-systems-arch` | `evals/skills/design-systems-arch.json` |
| `frontend-blueprint` | `evals/skills/frontend-blueprint.json` |
| `goose-orchestration` | `evals/skills/goose-orchestration.json` |
| `harness-judge` | `evals/skills/harness-judge.json` |
| `knowledge-graph` | `evals/skills/knowledge-graph.json` |
| `sdd` | `evals/skills/sdd.json` |
| `systematic-debugging` | `evals/skills/systematic-debugging.json` |
| `ui-quality` | `evals/skills/ui-quality.json` |
| `ux-quality` | `evals/skills/ux-quality.json` |
| `wcag-accessibility-audit` | `evals/skills/wcag-accessibility-audit.json` |
| `webapp-testing` | `evals/skills/webapp-testing.json` |
<!-- END GENERATED: eval-skills -->

### Agents (mode: `layer-delta` — Layer 2 vs Layer 1)

| Agent | Eval file | Supporting skills (Layer 1 baseline) |
| --- | --- | --- |
<!-- BEGIN GENERATED: eval-agents -->
| Agent | Eval file | Supporting skills (Layer 1 baseline) |
| --- | --- | --- |
| `architect` | `evals/agents/architect.json` | `sdd`, `agentic-devlopment` |
| `codebase-researcher` | `evals/agents/codebase-researcher.json` | `agentic-devlopment` |
| `harness-judge` | `evals/agents/harness-judge.json` | `harness-judge` |
| `implementation-worker` | `evals/agents/implementation-worker.json` | `beads`, `sdd` |
| `orchestrator` | `evals/agents/orchestrator.json` | `agentic-devlopment`, `beads` |
| `planner` | `evals/agents/planner.json` | `beads` |
| `principal-engineer` | `evals/agents/principal-engineer.json` | `agentic-devlopment`, `code-review` |
| `product-owner` | `evals/agents/product-owner.json` | `sdd` |
| `qa-automation` | `evals/agents/qa-automation.json` | `webapp-testing` |
| `review-critic` | `evals/agents/review-critic.json` | `code-review` |
| `tdd-guide` | `evals/agents/tdd-guide.json` | `sdd` |
| `ui-designer` | `evals/agents/ui-designer.json` | `webapp-testing`, `ux-quality` |
| `ux-researcher` | `evals/agents/ux-researcher.json` | `ux-quality` |
<!-- END GENERATED: eval-agents -->

### Recipes (mode: `layer-delta` — Layer 3 vs Layer 2)

| Recipe | Eval file | In-session agents (Layer 2) | Skills (Layer 1) |
| --- | --- | --- | --- |
<!-- BEGIN GENERATED: eval-recipes -->
| Recipe | Eval file | In-session agents (Layer 2) | Skills (Layer 1) |
| --- | --- | --- | --- |
| `design` | `evals/recipes/design.json` | `ux-researcher`, `ui-designer` | `ux-quality`, `cognitive-ux`, `ui-quality`, `atomic-design`, `design-systems-arch`, `webapp-testing` |
| `dev` | `evals/recipes/dev.json` | — |  |
| `doc-review` | `evals/recipes/doc-review.json` | `review-critic` | `agentic-devlopment`, `beads` |
| `explore` | `evals/recipes/explore.json` | `codebase-researcher` | `agentic-devlopment` |
| `harness-audit` | `evals/recipes/harness-audit.json` | `orchestrator` | `goose-orchestration`, `sdd`, `knowledge-graph`, `harness-judge` |
| `harness-review` | `evals/recipes/harness-review.json` | `review-critic` | `code-review`, `agentic-devlopment`, `beads` |
| `implement` | `evals/recipes/implement.json` | `implementation-worker` | `sdd`, `beads` |
| `plan` | `evals/recipes/plan.json` | `planner` | `beads`, `sdd` |
| `release` | `evals/recipes/release.json` | `principal-engineer` | `agentic-devlopment` |
| `review` | `evals/recipes/review.json` | `review-critic` | `code-review` |
| `spec` | `evals/recipes/spec.json` | `architect` | `sdd`, `beads` |
| `verify` | `evals/recipes/verify.json` | `qa-automation` | `webapp-testing` |
<!-- END GENERATED: eval-recipes -->


## Done criteria

A skill evaluation update is done when:

- evals live outside `.agents/skills/`;
- changed skills have corresponding eval scenarios in `evals/skills/`;
- scenarios capture observed baseline gaps before expanding instructions;
- docs build successfully;
- `goose skills list` still discovers project skills;
- recipe validation still passes if routing changed.

- Use `fixture_patch` for deterministic review scenarios instead of relying on the caller's current diff.
- Use per-scenario `max_turns` to balance task complexity with efficiency. Current harness evals use lower values (20–50) to detect saturation; only raise above 50 when the task genuinely requires deep sequential reasoning (browser flows, long Beads-backed pipelines).


## Difficulty ladder

Each evaluated skill should normally cover one `normal`, one `difficult`, and one `very_difficult` scenario.

- `normal`: verifies the core behavior the skill is expected to reliably improve.
- `difficult`: combines the core behavior with realistic ambiguity, constraints, or follow-up hygiene.
- `very_difficult`: combines multiple skill obligations, sequencing constraints, or orchestration risks while staying coherent with the skill's stated purpose.

Use `expected_skill_contribution` to state what we expect from the skill specifically, not just what any competent agent could do. Keep this field grader/reviewer-facing; the runtime task prompt should not rely on it as an answer key.
