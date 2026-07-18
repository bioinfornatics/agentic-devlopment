# Domain D — Recipes Quality Checklist

**Scope:** Evaluation of `.goose/recipes/*.yaml` files in the harness.

This checklist is used by the harness judge to audit Goose recipe files. Recipes are the top-level orchestration layer that wires agents, skills, parameters, and extensions into a named workflow. The judge evaluates both structural validity (binary, enforced by `goose recipe validate`) and qualitative depth (gradient scoring covering instructions, wiring, and eval coverage).

**Reference format** (canonical recipe schema):

```yaml
version: 1.0.0
title: recipe-name
description: What this recipe does
instructions: |
  You are... Load skills X...
prompt: |           # required for headless mode
  The initial task message
extensions:
  - type: builtin
    name: developer
  - type: platform
    name: summon    # required when delegate() used without sub_recipes
parameters:
  - key: param_name
    input_type: string
    requirement: required
    description: What this param does
  - key: optional_param
    input_type: string
    requirement: optional
    default: "default value"
settings:
  goose_provider: anthropic
  goose_model: claude-sonnet-4-5
  max_turns: 50
sub_recipes:
  - name: tool-name
    path: ./subrecipes/name.yaml
    description: what this subrecipe does
retry:
  max_retries: 3
  checks:
    - type: shell
      command: "test -f output.json"
  on_failure: "rm -f output.json"
response:
  json_schema: {...}
```

**AD-001 Pattern Reference:**

| Pattern | Rule | Indicator |
|---------|------|-----------|
| Specialist | `load agent <specialist>` in-session; session IS the specialist | `instructions` contains `load agent X` where X is not `orchestrator` |
| Orchestration | `load agent orchestrator` in-session; specialists summoned via `delegate()` | `instructions` contains `load agent orchestrator`; `summon` extension present |
| Skill-only | `load skills X` only; no `load agent` line | `instructions` contains `load skills` but no `load agent` |

---

## Section D1 — Structural Validation

**Mode:** Binary (PASS / FAIL per item)  
**Purpose:** Verify the recipe file is syntactically valid and would pass `goose recipe validate`. Structural failures prevent execution.

> **Recommended:** Run `goose recipe validate <file>` first and capture output before scoring D1 manually.

### D1.1 — Required Top-level Fields

- [ ] `title` field is present and non-empty
- [ ] `description` field is present and non-empty
- [ ] At least one of `instructions` or `prompt` is present
- [ ] `prompt` is present when the recipe is intended for headless / automated execution
- [ ] `version` field is present (typically `1.0.0`)

**Failure evidence format:**
```
D1.1 FAIL — missing required field `title`
  File: .goose/recipes/example.yaml
  Found keys: description, instructions, extensions
  Expected: title (required), plus description, and instructions|prompt
```

### D1.2 — Parameter Integrity

- [ ] Every `{{ variable }}` reference in `instructions` or `prompt` has a corresponding entry in `parameters`
- [ ] Every entry in `parameters` is referenced at least once in `instructions` or `prompt` (no orphan params)
- [ ] Parameters with `requirement: optional` have a `default` value
- [ ] Parameters with `input_type: file` do NOT have a `default` value
- [ ] Parameters with `input_type: select` have an `options` list
- [ ] Parameter `key` values are valid slugs (lowercase, underscores allowed, no spaces)
- [ ] Parameter `description` fields are non-empty
- [ ] No duplicate `key` values across the parameters list

**Variable scan procedure:**
1. Extract all `{{ <key> }}` patterns from `instructions` and `prompt` text.
2. Compare against `parameters[*].key` list.
3. Report any key in template but not in params (missing param) or in params but not in template (orphan param).

**Failure evidence format:**
```
D1.2 FAIL — orphan parameter `output_format` defined but never referenced in instructions or prompt
  File: .goose/recipes/example.yaml, parameters[2]
  Key: output_format
  Referenced in instructions: false
  Referenced in prompt: false
```

### D1.3 — Extension Wiring

- [ ] `summon` extension (`type: platform, name: summon`) is present if `instructions` or `prompt` contains `delegate()`
- [ ] If `sub_recipes` are defined and used instead of `delegate()`, `summon` extension is not required
- [ ] `developer` extension present when shell/file operations are expected
- [ ] No duplicate extension entries

**Failure evidence format:**
```
D1.3 FAIL — `delegate()` used in instructions but `summon` extension not listed in extensions
  File: .goose/recipes/dev.yaml, line 42
  Found: delegate("architect", task)
  Extensions listed: [developer]
  Missing: {type: platform, name: summon}
```

### D1.4 — Subrecipe Path Integrity

- [ ] All `sub_recipes[*].path` values resolve to files that exist on disk
- [ ] All `sub_recipes[*].name` values are unique within the recipe
- [ ] Each `sub_recipes[*].description` is present and non-empty

**Check procedure:** For each `path` in `sub_recipes`, verify `test -f <path>` from the repo root.

**Failure evidence format:**
```
D1.4 FAIL — subrecipe path does not exist on disk
  File: .goose/recipes/dev.yaml, sub_recipes[1]
  Name: spec
  Path: ./subrecipes/spec.yaml
  Disk check: NOT FOUND
```

### D1.5 — Settings Validity

- [ ] `settings.goose_provider` is a recognized provider (`anthropic`, `openai`, `google`, `ollama`)
- [ ] `settings.goose_model` matches a model known to work with the specified provider
- [ ] `settings.max_turns` is a positive integer ≤ 200 (warn if > 100)

### D1.6 — Retry Configuration

- [ ] If `retry` is present: `max_retries` is a positive integer ≤ 10
- [ ] If `retry.checks` is present: each check has `type` and `command`
- [ ] `retry.on_failure` command is a valid shell expression (syntactically)

**D1 Overall Scoring:**

| Result | Condition |
|--------|-----------|
| PASS   | All D1 items pass OR `goose recipe validate` exits 0 with no errors |
| FAIL   | Any D1 item fails OR `goose recipe validate` exits non-zero |

---

## Section D2 — AD-001 Pattern Compliance

**Mode:** Binary (PASS / FAIL per item)  
**Purpose:** Verify the recipe follows one of the three sanctioned harness patterns from Architecture Decision 001.

### D2.1 — Pattern Identification

- [ ] The recipe's pattern can be unambiguously classified as one of: Specialist, Orchestration, or Skill-only
- [ ] **Specialist pattern indicator:** `instructions` contains `load agent X` where X is NOT `orchestrator`; no `delegate()` calls in instructions
- [ ] **Orchestration pattern indicator:** `instructions` contains `load agent orchestrator`; `summon` extension present; `delegate()` calls present
- [ ] **Skill-only pattern indicator:** `instructions` contains `load skills` but no `load agent` line

**Failure evidence format:**
```
D2.1 FAIL — recipe pattern is ambiguous: both `load agent review-critic` and `load agent orchestrator` found in instructions
  File: .goose/recipes/review.yaml
  Line 8: load agent review-critic
  Line 12: load agent orchestrator
  AD-001 invariant violated: never load orchestrator alongside a specialist agent in same session
```

### D2.2 — Specialist Pattern Invariants

*Check only if pattern = Specialist.*

- [ ] `instructions` does NOT contain `load agent orchestrator`
- [ ] `instructions` does NOT contain `delegate()` calls (orchestration is not the specialist's job)
- [ ] `summon` extension is NOT required (and ideally absent)
- [ ] Exactly one specialist agent is loaded (not two specialists in same session)

### D2.3 — Orchestration Pattern Invariants

*Check only if pattern = Orchestration.*

- [ ] `instructions` contains `load agent orchestrator` (not a specialist)
- [ ] All specialist agents are referenced via `delegate()` calls, not via `load agent`
- [ ] `summon` extension is present in `extensions`
- [ ] The orchestrator's instructions describe delegation targets explicitly

### D2.4 — Skill-only Pattern Invariants

*Check only if pattern = Skill-only.*

- [ ] `instructions` does NOT contain any `load agent` line
- [ ] `instructions` contains at least one `load skills` line
- [ ] The skills loaded are appropriate for the recipe's stated purpose

### D2.5 — Eval JSON Consistency

- [ ] Corresponding `evals/recipes/<name>.json` exists on disk
- [ ] Eval JSON `"agents"` field lists only in-session agents (not summoned delegates)
  - Specialist: lists the one specialist agent name
  - Orchestration: lists `"orchestrator"` only (not the summoned specialists)
  - Skill-only: `"agents"` is empty array `[]`
- [ ] Eval JSON `"skills"` field matches skills loaded in `instructions`

**Failure evidence format:**
```
D2.5 FAIL — eval JSON `agents` field includes summoned agents (violates AD-001 eval rule)
  File: evals/recipes/dev.json
  Found: ["orchestrator", "architect", "review-critic"]
  Expected: ["orchestrator"] (only in-session agents; summoned agents omitted)
```

**D2 Overall Scoring:**

| Result | Condition |
|--------|-----------|
| PASS   | All applicable D2 items pass |
| FAIL   | Any D2 item fails |

> D2 FAIL does not block D3–D6 scoring but must be flagged in final verdict.

---

## Section D3 — Instructions Quality

**Mode:** Gradient (0–3 per item, total /18)  
**Purpose:** Assess whether the instructions are actionable, well-scoped, and correctly reference skills.

### D3.1 — Voice and Tone

- [ ] **3** — All instructions use imperative voice ("Load", "Analyze", "Output", "Do not"); no passive or hedged language
- [ ] **2** — Mostly imperative; 1–2 passive constructions
- [ ] **1** — Mix of imperative and descriptive ("The agent should…", "It is expected that…")
- [ ] **0** — Entirely descriptive prose; no imperatives

### D3.2 — Skill Loading Accuracy

- [ ] **3** — Skills loaded via `load skills X` exactly match the task domain; no missing skills, no unneeded skills
- [ ] **2** — All required skills present; 1 unneeded skill also loaded (low harm)
- [ ] **1** — 1 required skill missing; agent may hallucinate its methodology
- [ ] **0** — Multiple required skills missing OR entirely wrong skills loaded for domain

**How to verify:** Cross-reference skills in `load skills X` lines against `.agents/skills/` on disk. Check each skill's `SKILL.md` to confirm it addresses the recipe's domain.

### D3.3 — Completion Criterion

- [ ] **3** — Instructions state a clear, testable stopping condition ("Stop when the output file exists and passes validation", "Stop after verdict is delivered to caller")
- [ ] **2** — Stopping condition implied but not explicit
- [ ] **1** — "Complete the task" or equivalent tautology
- [ ] **0** — No stopping condition; agent may loop indefinitely

### D3.4 — Methodology Delegation to Skills

- [ ] **3** — Instructions reference skills for domain methodology (`load skills code-review`); no step-by-step methodology duplicated inside the recipe
- [ ] **2** — Skills loaded but some methodology also repeated inline (minor duplication)
- [ ] **1** — Skills loaded but extensive methodology duplicated in instructions (skills effectively unused)
- [ ] **0** — No skills loaded; all methodology inline (skills layer bypassed)

### D3.5 — Scope Bounding

- [ ] **3** — Instructions constrain the agent's scope explicitly ("Do not modify files outside `./src`", "Limit analysis to the files specified in `{{ target_files }}`")
- [ ] **2** — Scope partially bounded; some implicit boundaries
- [ ] **1** — Scope is the entire repository or project without restriction
- [ ] **0** — No scope boundaries; agent has unconstrained access

### D3.6 — Safety Rails

- [ ] **3** — At least one explicit negative instruction prevents a common dangerous action ("Do not run destructive commands without user confirmation", "Do not commit or push changes")
- [ ] **2** — Implicit safety through scope bounding
- [ ] **1** — No explicit safety rails; relies on model defaults
- [ ] **0** — Instructions actively request potentially dangerous broad operations

**D3 Scoring:**

| Score | Band |
|-------|------|
| 15–18 | PASS |
| 9–14  | PARTIAL |
| 0–8   | FAIL |

---

## Section D4 — Parameter Quality

**Mode:** Gradient (0–3 per item, total /12)  
**Purpose:** Assess whether parameters are well-designed for their use cases.

### D4.1 — Name Descriptiveness

- [ ] **3** — Parameter keys are self-documenting (`target_file`, `pr_number`, `output_format`); purpose is clear from name alone
- [ ] **2** — Keys are domain-relevant but require description to understand (`mode`, `path`)
- [ ] **1** — Keys are abbreviated or opaque (`f`, `m`, `p`)
- [ ] **0** — Keys are entirely non-descriptive (`param1`, `input`)

### D4.2 — Description Quality

- [ ] **3** — Each parameter description states purpose AND format/constraints (e.g., "Path to the PR diff file, relative to repo root. Must be a `.diff` extension.")
- [ ] **2** — Description states purpose but not format/constraints
- [ ] **1** — Description is tautological ("The file to analyze" for a `file_to_analyze` key)
- [ ] **0** — Description is empty or missing

### D4.3 — Required vs Optional Correctness

- [ ] **3** — `requirement: required` used only for params without which the recipe cannot function; all others are optional with sensible defaults
- [ ] **2** — Mostly correct; 1 param that could be optional is marked required
- [ ] **1** — Several params that have natural defaults are marked required (increases caller friction unnecessarily)
- [ ] **0** — All params marked required regardless of necessity

### D4.4 — Default Value Sensibility

- [ ] **3** — Default values are the most common correct value (not a placeholder like `"TODO"` or empty string `""`)
- [ ] **2** — Defaults are valid but not optimal (e.g., default model is outdated)
- [ ] **1** — Defaults are technically present but are empty strings or `null`
- [ ] **0** — Optional params have no defaults (violates D1.2 structural requirement)

**D4 Scoring:**

| Score | Band |
|-------|------|
| 10–12 | PASS |
| 6–9   | PARTIAL |
| 0–5   | FAIL |

---

## Section D5 — Wiring Quality

**Mode:** Gradient (0–3 per item, total /12)  
**Purpose:** Assess whether subrecipes, extensions, and context flow are well-structured.

### D5.1 — Subrecipe Purpose Distinctiveness

- [ ] **3** — Each subrecipe serves a clearly distinct purpose; no two subrecipes could be merged without losing functionality
- [ ] **2** — Minor overlap between two subrecipes; could be refactored but not blocking
- [ ] **1** — Significant overlap; one subrecipe duplicates another's primary function
- [ ] **0** — Duplicate subrecipes (same path, same purpose, no distinction)
- [ ] N/A — No subrecipes defined (skip this item)

### D5.2 — Repetition Mode Appropriateness

- [ ] **3** — `sequential_when_repeated: true` set for subrecipes where order matters (file processing, pipeline stages); parallelism used only where safe
- [ ] **2** — Repetition mode not set explicitly but default behavior is correct for the use case
- [ ] **1** — Parallelism enabled where sequential execution is required (race conditions possible)
- [ ] **0** — `sequential_when_repeated` set incorrectly causing logic errors
- [ ] N/A — No repeated subrecipes

### D5.3 — Context Passing Documentation

- [ ] **3** — Instructions document how output from one subrecipe/phase feeds into the next (e.g., "Pass the path returned by Phase 1 as `target_file` to Phase 2")
- [ ] **2** — Context passing implied but not documented
- [ ] **1** — Context passing expected but not described; likely to fail at runtime
- [ ] **0** — No context passing; each phase/subrecipe operates in isolation when the task requires coordination

### D5.4 — Extension Appropriateness

- [ ] **3** — All listed extensions are necessary for the recipe's function; no missing extensions, no unused extensions
- [ ] **2** — All required extensions present; 1 unnecessary extension also listed (harmless)
- [ ] **1** — 1 required extension missing (e.g., `developer` absent for a recipe that writes files)
- [ ] **0** — Multiple required extensions missing OR irrelevant extensions dominate

**D5 Scoring:**

| Score | Band |
|-------|------|
| 10–12 | PASS |
| 6–9   | PARTIAL |
| 0–5   | FAIL |

---

## Section D6 — Eval JSON Quality

**Mode:** Gradient (0–3 per item, total /15)  
**Purpose:** Assess whether the companion eval file enables meaningful A/B evaluation.

> **File location:** `evals/recipes/<recipe-name>.json`

### D6.1 — Agents Field Accuracy

- [ ] **3** — `"agents"` field lists exactly the in-session agents and nothing more (see D2.5 for values by pattern)
- [ ] **2** — Agents field has correct in-session agents plus one summoned agent erroneously included
- [ ] **1** — Agents field is missing or empty when an in-session agent exists
- [ ] **0** — Agents field lists agents that are not in-session (e.g., summoned specialists for an orchestration recipe)

### D6.2 — Skills Field Accuracy

- [ ] **3** — `"skills"` field exactly matches the `load skills X` directives in recipe instructions
- [ ] **2** — Skills field has 1 extra or missing skill vs instructions
- [ ] **1** — Skills field significantly diverges from instructions (2+ missing/extra)
- [ ] **0** — Skills field is empty or absent when recipe loads skills

### D6.3 — Expected Behavior Observability

- [ ] **3** — All `"expected_behavior"` items describe observable, verifiable outputs ("A structured YAML verdict file written to `./output/verdict.yaml`", "Shell exit code 0")
- [ ] **2** — Most items observable; 1–2 are inferred ("Agent understands the task correctly")
- [ ] **1** — Most items are inferred or subjective ("Agent provides good analysis")
- [ ] **0** — All items are inferred/subjective; eval cannot be automated

**Good vs bad expected_behavior examples:**
```json
// GOOD — observable
"expected_behavior": [
  "File ./output/report.md is created with ## Summary section",
  "Shell command exit code is 0",
  "Verdict field contains one of: PASS, PARTIAL, FAIL"
]

// BAD — inferred
"expected_behavior": [
  "Agent thoroughly reviews the code",
  "Agent understands the requirements",
  "Output is high quality"
]
```

### D6.4 — Baseline Gaps Realism

- [ ] **3** — `"baseline_gaps"` items describe genuine limitations of the skills-only baseline vs the agent-enhanced recipe (specific, plausible gaps)
- [ ] **2** — Gaps described but overly broad ("baseline doesn't know about the project")
- [ ] **1** — Gaps listed but implausible or trivially solvable without an agent
- [ ] **0** — `"baseline_gaps"` is absent or empty

### D6.5 — Difficulty Calibration

- [ ] **3** — `"difficulty"` is set to `"normal"`, `"difficult"`, or `"very_difficult"` and matches the actual complexity of the eval scenario
- [ ] **2** — Difficulty set but appears miscalibrated (e.g., trivial task marked `"very_difficult"`)
- [ ] **1** — Difficulty field present but with invalid value
- [ ] **0** — Difficulty field absent

**D6 Scoring:**

| Score | Band |
|-------|------|
| 13–15 | PASS |
| 8–12  | PARTIAL |
| 0–7   | FAIL |

---

## Aggregate Scoring Rubric

### Section Weights

| Section | Weight | Max Raw | Gate? |
|---------|--------|---------|-------|
| D1 Structural Validation | binary gate | N/A | Yes |
| D2 AD-001 Pattern Compliance | binary gate | N/A | Yes |
| D3 Instructions Quality | 30% | 18 | No |
| D4 Parameter Quality | 20% | 12 | No |
| D5 Wiring Quality | 25% | 12 | No |
| D6 Eval JSON Quality | 25% | 15 | No |

### Final Verdict

| Verdict | Condition |
|---------|-----------|
| **PASS** | D1 all pass AND D2 all pass AND weighted score ≥ 75% |
| **PARTIAL** | D1 all pass AND D2 all pass AND weighted score 50–74% |
| **FAIL** | Any D1 failure OR any D2 failure OR weighted score < 50% |

### Override Rules

- A `goose recipe validate` non-zero exit → automatic FAIL on D1 → automatic FAIL on aggregate.
- D5 items with N/A: exclude from denominator, reweight D3/D4/D6 proportionally.
- If `evals/recipes/<name>.json` is absent entirely: D6 scores 0/15 (not N/A); flag missing eval file as a separate FAIL finding.

---

## Evidence Templates

### D1 Structural Failure

```
FINDING D1.[item] — [PASS|FAIL]
File:    .goose/recipes/<name>.yaml
Lines:   <start>–<end>
Command: goose recipe validate .goose/recipes/<name>.yaml
Output:  <stderr/stdout from validate command>
Issue:   <description of structural violation>
Found:   <verbatim excerpt or "absent">
Expected: <what the schema requires>
```

### D2 Pattern Compliance Failure

```
FINDING D2.[item] — [PASS|FAIL]
File:    .goose/recipes/<name>.yaml
Pattern: <Specialist|Orchestration|Skill-only>
AD-001 Invariant: <which invariant is violated>
Evidence line(s): |
  <verbatim excerpt from instructions>
Fix: <one-line remediation>
```

### D3–D6 Gradient Finding

```
FINDING D[N].[item] — Score [0|1|2|3]/3
File:    <recipe or eval file>
Lines:   <start>–<end>
Score rationale: <one sentence explaining the score>
Evidence: |
  <verbatim excerpt>
Improvement: <one actionable suggestion>
```

---

## Calibration Anchors

### Anchor A — PASS Recipe (score ≥ 75%)

**Recipe:** `review.yaml` (Specialist pattern)

Characteristics:
- `title: review`, `description: "Run a structured code and spec review"` — complete
- `instructions` loads `load agent review-critic` (specialist, not orchestrator)
- `instructions` loads `load skills code-review` (correct domain skill)
- No `delegate()` calls (specialist handles in-session)
- Parameter `target_path` with `description: "Path to file or directory to review, relative to repo root"` — descriptive
- Parameter `output_file` optional with `default: "./review-output.md"` — sensible default
- Completion criterion: "Stop when you have written the structured verdict to {{ output_file }}"
- Eval JSON: `"agents": ["review-critic"]`, `"skills": ["code-review"]` — matches exactly
- `"expected_behavior"`: all observable (`"File {{ output_file }} created with VERDICT section"`)
- `"difficulty": "normal"` — appropriate for a standard review task

### Anchor B — PARTIAL Recipe (score 50–74%)

**Recipe:** `discover.yaml` (Specialist pattern, partial quality)

Characteristics earning PARTIAL:
- D1 passes (validate exits 0)
- D2 passes (pattern correctly classified as Specialist)
- D3.2 Skills: `load skills sdd` but task is code exploration — wrong domain skill (score 1)
- D3.3 Completion criterion: "Complete the discovery" — tautological (score 1)
- D4.1 Parameter names: `f` and `m` instead of `target_file` and `mode` (score 0)
- D5.3 Context passing: subrecipes defined but no documentation of output handoff (score 1)
- D6.3 Expected behavior: `"Agent discovers relevant context"` — inferred (score 0)
- D6.4 Baseline gaps: absent (score 0)
- Weighted: ~52% → PARTIAL

### Anchor C — FAIL Recipe (structural failure)

**Recipe:** `broken.yaml` (fails D1)

```yaml
title: broken
instructions: |
  Load agent architect.
  When done, delegate("review-critic", task).
```

D1 failures:
- `description` missing (D1.1 FAIL)
- `{{ target }}` referenced in instructions but no matching parameter (D1.2 FAIL)
- `delegate()` used without `summon` extension (D1.3 FAIL)

D2 failures:
- `load agent architect` (specialist) + `delegate()` calls = pattern contradiction (D2.1 FAIL)
- Specialist pattern invariant: delegate() not allowed in specialist session (D2.2 FAIL)

→ D1 FAIL → automatic FAIL verdict; D3–D6 scores noted informally but do not affect verdict.

### Anchor D — FAIL Recipe (AD-001 violation)

**Recipe:** `mixed.yaml`

```yaml
instructions: |
  load agent orchestrator
  load agent review-critic
  Review the PR and delegate to architect.
```

D2.1 FAIL: both `orchestrator` and `review-critic` loaded in-session.

AD-001 invariant violated: "Never load orchestrator alongside a specialist agent in the same session."

Eval JSON: `"agents": ["orchestrator", "review-critic", "architect"]` — further violates eval invariant (architect is summoned, not in-session).

→ D2 FAIL → automatic FAIL verdict.

### Anchor E — PARTIAL Eval JSON (D6 scoring)

**File:** `evals/recipes/implement.json`

```json
{
  "agents": ["implement-agent", "review-critic"],
  "skills": ["code-review"],
  "expected_behavior": [
    "Agent implements the feature",
    "File ./output/implementation.py is created"
  ],
  "baseline_gaps": ["baseline cannot plan implementation steps"],
  "difficulty": "difficult"
}
```

Scoring:
- D6.1: `"agents"` includes `review-critic` which is summoned, not in-session → score 1
- D6.2: `"skills"` has `code-review` but recipe loads `code-review` and `sdd` → missing `sdd` → score 1
- D6.3: `"Agent implements the feature"` is inferred; `"./output/implementation.py is created"` is observable → score 2
- D6.4: Gap is plausible but vague → score 1
- D6.5: `"difficult"` — reasonable for implementation → score 3
- D6 Total: 8/15 → PARTIAL

---

## Common Judge Errors (Anti-patterns)

These are things the harness judge must NOT do when evaluating recipes:

1. **Do not run `goose recipe validate` mentally.** Always execute the actual command and capture its output for D1 findings. Parser errors are non-obvious from inspection alone.
2. **Do not classify pattern from file name alone.** Inspect `instructions` for `load agent` and `delegate()` to determine pattern; file names can be misleading.
3. **Do not penalize Skill-only recipes for missing agents.** An empty `"agents": []` in eval JSON is correct for Skill-only; it is not a D6.1 failure.
4. **Do not treat PARTIAL as near-PASS.** PARTIAL means the recipe needs work; document which specific items to improve and estimate effort.
5. **Do not skip D6 when eval file is absent.** Score all D6 items as 0/3 and add a separate finding: "evals/recipes/<name>.json is missing — required by harness change impact rules."
6. **Do not conflate D2 and D3.** D2 is binary pattern compliance; D3 is gradient instructions quality. A recipe can have correct AD-001 wiring (D2 PASS) with poor instructions quality (D3 PARTIAL).
7. **Do not accept `{{ variable }}` orphan params silently.** Even if the recipe runs without error (perhaps the variable has a fallback), an orphan parameter signals a maintenance burden and must be flagged.
8. **Do not score D5 items N/A unless the item genuinely does not apply.** "No subrecipes defined" is N/A for D5.1–D5.3, not a score of 0.

---

## Quick Reference: Goose Recipe Validate Errors

Common error messages and their D1 mapping:

| Validate Error | D1 Item | Meaning |
|----------------|---------|---------|
| `missing required field: title` | D1.1 | `title` key absent |
| `undefined variable: <key>` | D1.2 | Template uses `{{ key }}` with no matching parameter |
| `orphan parameter: <key>` | D1.2 | Parameter defined but not used in template |
| `optional parameter missing default: <key>` | D1.2 | Optional param has no `default` |
| `select parameter missing options: <key>` | D1.2 | `select` type param has no `options` list |
| `subrecipe not found: <path>` | D1.4 | Path in `sub_recipes` doesn't exist |
| `invalid provider: <name>` | D1.5 | `goose_provider` is not recognized |
| `max_turns exceeds limit` | D1.5 | `max_turns > 200` |

---

*Last updated: 2026-07-18 | Domain D v1.0*
