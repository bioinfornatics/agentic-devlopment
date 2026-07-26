# Harness Judge — Calibration Anchors Reference

> Loaded when scoring close-call criteria and calibration examples are needed.
> Version: 1.0.1 — Expanded for HJ001-HJ072

## Purpose

This reference provides concrete PASS/PARTIAL/FAIL examples for boundary cases where judgment is difficult. Use these anchors to calibrate scoring consistency across evaluations.

---

## Domain Cross-Artifact Anchors (HJ001-HJ006)

### HJ001 — Evidence cited for every score

**PASS anchor:**
```
Score: PASS
Evidence: .agents/agents/harness-judge.md line 45 states "load skill harness-judge"
```

**FAIL anchor:**
```
Score: PASS
Evidence: (none provided)
```
Rationale: Score without evidence = automatic FAIL.

### HJ003 — Correct evaluation mode identified

**PASS anchor:** "Evaluation mode: layer-delta — comparing Layer 2 (agent+skills) vs Layer 1 (skills only)"

**FAIL anchor:** "Let me review this code" — no mode identification at all.

### HJ006 — Generated sections not hand-edited

**PASS anchor:** `git diff docs/15-skill-evaluations.md` shows only generator output.

**FAIL anchor:** Hand-inserted row in `<!-- BEGIN GENERATED -->` block without re-running `python3 scripts/generate-tables.py`.

---

## Domain A — Prompt/Context/Loop Anchors (HJ007-HJ010, HJ047-HJ050)

### HJ008 — Context loading minimal and relevant

**PASS anchor:** Recipe loads only `harness-judge` skill for audit task.

**PARTIAL anchor:** Recipe loads 4 skills upfront when only 2 are used during execution.

**FAIL anchor:** Recipe instructs `load all skills in .agents/skills/` regardless of task.

### HJ010 — Exit/stop/success criteria explicit

**PASS anchor:**
```
Stop condition: emit final verdict and stop.
Success criteria: all applicable domains scored with evidence.
Exit criteria: PASS/PARTIAL/FAIL verdict emitted.
```

**PARTIAL anchor:** "Continue until done" — no measurable exit condition.

**FAIL anchor:** No exit, stop, or success criteria mentioned in artifact.

### HJ048 — Instruction quality gradient 0-4

| Score | Label | Example |
|-------|-------|---------|
| 0 | Vague aspiration | "Be helpful and thorough" |
| 1 | Goal without steps | "Review the code for issues" |
| 2 | Unordered steps | "Check security, check style, check tests" |
| 3 | Ordered steps | "1. Run linter 2. Check security 3. Run tests" |
| 4 | Ordered + gates | "1. Run linter → STOP if >10 errors 2. Check security → STOP if critical 3. Run tests" |

### HJ049 — No internal contradictions

**PASS anchor:** All instructions are consistent — no "always X" followed by "never X".

**FAIL anchor:** §3 says "load all referenced files" but §5 says "do not load references unless asked".

### HJ050 — Calibration examples for judgment-heavy decisions

**PASS anchor:** HJ048 has the 0-4 gradient table above as calibration.

**FAIL anchor:** Criterion requires "appropriate model assignment" but no definition of "appropriate".

---

## Domain B — Skills Anchors (HJ011-HJ014, HJ051-HJ060)

### HJ051 — All referenced files exist

**PASS anchor:** `python3 scripts/check-consistency.py` exits 0 with "AC-SKILL-02 pass".

**FAIL anchor:** SKILL.md says `load references/missing-file.md` but file does not exist.

### HJ052 — Size 50-500 lines

**PASS anchor:** 499 lines — within healthy band.

**PARTIAL anchor:** 520 lines — minor overage, review for methodology that should be in references.

**FAIL anchor:** 850 lines — significant bloat, must refactor.

### HJ055 — Conditional-load triggers present

**PASS anchor:**
```
→ load `references/domain-a-prompt-context-loop.md` when auditing Domain A in depth
```

**PARTIAL anchor:** References listed but no trigger conditions.

**FAIL anchor:** No references/ directory despite 300+ line SKILL.md.

### HJ057 — Exclusion clause present

**PASS anchor:** "Do NOT use for implementation, code writing, or file mutation."

**FAIL anchor:** Description only says when to use, never when NOT to use.

### HJ058 — Gotchas section with concrete failure modes

**PASS anchor:**
```
## Gotchas
- HJ048 FAIL: Skill with only aspirational language scored 0.
- HJ051 FAIL: Reference to deleted file caused runtime error.
```

**PARTIAL anchor:** Gotchas section exists but has generic warnings, not observed failures.

**FAIL anchor:** No Gotchas section at all.

### HJ060 — Read-only skills declare allowed-tools

**PASS anchor:** Frontmatter includes `allowed_tools: [read, list, search, analyze]`.

**FAIL anchor:** Skill claims "read-only" in body but no frontmatter constraint.

---

## Domain C — Agents Anchors (HJ015-HJ018, HJ032, HJ042-HJ046)

### HJ018 — Avoids self-approval

**PASS anchor:** "Do not approve your own work; escalate to independent reviewer."

**FAIL anchor:** Agent produces verdict AND implements the fix it just judged.

### HJ032 — Mandatory skill contract explicit

**PASS anchor:**
```
## Required Skill Load
load skill harness-judge
If skill cannot be loaded, report BLOCKED and stop.
```

**FAIL anchor:** Skills mentioned in prose but no explicit load instruction or guard.

### HJ042 — Model assignment appropriate

**PASS anchor:** Judge agent uses `claude-sonnet-4-20250514` (review-tier model).

**PARTIAL anchor:** Placeholder `gpt-5.5` — not a real model but fixable.

**FAIL anchor:** Orchestrator uses `claude-haiku-20250414` (too weak for orchestration).

### HJ043 — Persona consistent with operating process

**PASS anchor:** Persona says "code reviewer" → Operating Process has "review code" steps.

**FAIL anchor:** Persona says "calibrated forensic evaluator" but process has no calibration steps.

### HJ046 — Maker/checker pairs independent

**PASS anchor:** Maker uses `implementation-worker` + Checker uses `review-critic` with different model tier.

**FAIL anchor:** Same agent judges and implements in same session.

---

## Domain D — Recipes Anchors (HJ019-HJ022, HJ035-HJ037, HJ041, HJ054)

### HJ019 — Recipe validates

**PASS anchor:** `goose recipe validate .goose/recipes/harness-audit.yaml` → "✓ recipe file is valid"

**FAIL anchor:** Validation fails with schema error.

### HJ020 — AD-001 pattern followed

**PASS anchor:** Recipe says "AD-001 pattern: Orchestration" AND loads orchestrator in-session AND delegates to specialists via subrecipes.

**FAIL anchor:** Recipe says "Specialist" but loads multiple agents in-session.

### HJ021 — Eval JSON lists only in-session agents

**PASS anchor:** `evals/recipes/review.json` has `"agents": ["review-critic"]` and recipe has `load agent review-critic`.

**FAIL anchor:** Eval JSON includes `"implementation-worker"` but recipe only delegates to it via subrecipe.

### HJ035 — Phase dependencies explicit

**PASS anchor:** "Phase 3 may not start until Phase 2 produces `evidence-manifest.json`."

**PARTIAL anchor:** Phases numbered but no explicit gate between them.

**FAIL anchor:** No phase structure at all.

### HJ054 — Size 40-300 lines

**PASS anchor:** instructions + prompt = 130 lines.

**FAIL anchor:** instructions + prompt = 450 lines — methodology embedded instead of delegated to skills.

---

## Domain E — Frameworks Anchors (HJ023-HJ025)

### HJ023 — SDD/TDD/GDD sequence visible

**PASS anchor:** Transcript shows: spec written → bead claimed → test written → implementation → verification.

**PARTIAL anchor:** Spec exists but was written after implementation.

**FAIL anchor:** No spec, no test, direct implementation.

### HJ025 — Validation meaningful, not theater

**PASS anchor:** Validator runs test suite, reports 3 failures, agent addresses them.

**FAIL anchor:** "Validation complete" without command output — theater.

---

## Domain F — Orchestration Anchors (HJ026-HJ030, HJ034)

### HJ026 — Recipe → Agent → Skill layering preserved

**PASS anchor:** Recipe loads agent → Agent loads skill → Skill provides methodology.

**FAIL anchor:** Recipe embeds methodology directly without loading skill.

### HJ027 — Orchestration decision before delegation

**PASS anchor:** "Delegating security review to review-critic because this is a security-sensitive change."

**FAIL anchor:** `delegate(review-critic)` with no preceding decision statement.

### HJ029 — Orchestrator synthesizes delegate outputs

**PASS anchor:** Orchestrator reads 3 delegate reports, produces combined finding summary.

**FAIL anchor:** Orchestrator forwards delegate output verbatim to user.

### HJ034 — Flow coherent end-to-end

**PASS anchor:** Recipe → orchestrator → delegates → validation → handoff all connected.

**FAIL anchor:** Validation step exists but is unreachable from orchestration flow.

---

## Domain G — Ontology Anchors (HJ061-HJ072)

### HJ061 — TBox defines classes and relations

**PASS anchor:** `knowledge-graph.md` defines Skill, Agent, Recipe, HasSkill, DelegatesTo with domain/range.

**FAIL anchor:** Graph has nodes but no defined schema.

### HJ062 — ABox conforms to TBox

**PASS anchor:** All instances in `.knowledge/memory.jsonl` use defined relation types.

**FAIL anchor:** Instance uses `RELATES_TO` but TBox has no such relation.

### HJ068 — Graph machine-readable and queryable

**PASS anchor:** `node apps/kg/dist/cli.js reason --rules` executes successfully.

**FAIL anchor:** Graph in prose description only, no JSONL or graph export.

### HJ072 — Ontology economical

**PASS anchor:** 15 relation types, each justified by harness requirement.

**FAIL anchor:** 50 relation types, 30 unused — unjustified complexity.

---

## Layer-Delta Anchors

### POSITIVE delta example
Baseline score: 0.62 (no skill) — agent produces holistic opinion without criteria.
Enhanced score: 0.78 (with skill) — agent scores 12 criteria before verdict.
Delta: +0.16 POSITIVE — skill adds marginal value.

### NEUTRAL delta example
Baseline score: 0.81 (skills only).
Enhanced score: 0.82 (agent + skills).
Delta: +0.01 NEUTRAL — agent adds minimal marginal value; skill is sufficient.

### NEGATIVE delta example
Baseline score: 0.75 (skills only).
Enhanced score: 0.68 (agent + skills) — agent verbose, misses criteria.
Delta: -0.07 NEGATIVE — agent REGRESSES from baseline.

---

## Anti-Calibration: Common False PASSes to Reject

1. **Polished prose ≠ evidence** — A well-formatted report without cited file paths is FAIL.
2. **Long output ≠ thorough** — Verbosity may mask missing criteria.
3. **Validation claimed ≠ validation run** — "I validated it" without command output is theater.
4. **Near-miss ≠ PASS** — Exact required literals are binary; `load skills harness-judge` ≠ `load skill harness-judge`.
5. **Late correct ≠ timely correct** — `bd prime` after first write is PARTIAL, not PASS.
