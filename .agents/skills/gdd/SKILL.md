---
name: gdd
description: >
  Load when a design or product decision benefits from structured exploration before
  committing to a single option. Implements Generative-Driven Design (GDD): a
  six-step loop (Frame → Generate → Compare → Select → Validate → Escalate) that
  ensures at least two materially different options are evaluated against explicit
  criteria before any design choice is locked. Use when designing UI features,
  selecting technology approaches, evaluating UX patterns, or making any choice where
  generating and comparing alternatives would reduce the risk of a poor default
  commitment. Integrates with SDD by slotting between the Discover and Spec phases
  for design-heavy decisions.
  Do NOT use for decisions with a single correct answer, pure code implementation tasks, or sessions where the design direction is already validated and locked.
metadata:
  version: 1.0.0
---

# Generative-Driven Design (GDD)

GDD is the harness framework for structured, evidence-backed design decisions.
It prevents premature lock-in by requiring at least two materially different options,
explicit evaluation criteria, observable validation evidence, and a written rationale
before any design choice is recorded as final.

GDD slots into the SDD cycle between **Discover** and **Spec**:
```
Discover → [GDD: Frame → Generate → Compare → Select → Validate] → Spec → Plan → TDD → Implement
```

Use GDD whenever a design decision is ambiguous, high-stakes, or genuinely contestable.
Skip it for decisions with only one viable option — forcing artificial options wastes time.

---

## The Six-Step GDD Loop

### Step 1 — Frame
State the decision context completely before generating any option:
- **User goal**: what job is the user trying to complete?
- **Non-goals**: what is explicitly out of scope for this decision?
- **Constraints**: technical, brand, time, accessibility, or cost constraints that are fixed.
- **Success metrics**: how will "good" be measured? (observable, not aspirational)
- **Known risks**: what could go wrong with the decision?

Do not move to Step 2 until the frame is written out. An unwritten frame is an unchecked assumption.

### Step 2 — Generate
Produce at least two materially different options. "Materially different" means they have distinct trade-offs — not just visual variants of the same approach.

Rules:
- Minimum 2 options; 3 is preferred for non-obvious decisions.
- Do not stop at the first plausible answer.
- Each option must be described concisely: what it is, how it works, and who it serves best.
- No option is pre-selected at this stage — treat them as equally viable candidates.

### Step 3 — Compare
Evaluate each option against the criteria defined in Step 1. Use a structured comparison:

| Criterion | Option A | Option B | Option C |
|---|---|---|---|
| User control | ... | ... | ... |
| Implementation risk | ... | ... | ... |
| Accessibility | ... | ... | ... |
| Consistency with design system | ... | ... | ... |
| Failure recovery | ... | ... | ... |

Add criteria as needed for the decision domain. Remove criteria that genuinely do not apply.
Do NOT skip criteria that might produce an uncomfortable result.

### Step 4 — Select
Choose one option. Record the selection with a short trade-off rationale tied to the criteria:
- Which option scored best overall, and why?
- What was the deciding factor when criteria conflicted?
- What are the accepted downsides of the selected option?
- Record rejected alternatives with a note on why they were not selected — they may be revisited.

The selection must be traceable to the comparison table, not to preference or authority.

### Step 5 — Validate
Require observable evidence before treating the decision as final. Acceptable evidence:
- Usability rubric score against defined criteria
- Accessibility check result (automated + keyboard)
- Browser interaction evidence (screenshot, Playwright test)
- harness-judge or review-critic review
- Human decision with explicit authority acknowledged

Preference-only prose ("this feels right") is not validation. If evidence is not yet available, mark the decision as **provisional** and name what validation is pending.

### Step 6 — Escalate
Pause and ask for human direction when:
- Evidence from Step 5 conflicts with the Step 4 selection.
- Risk is high and no option clears the criteria bar.
- N repeated cycles have not produced a decision (default N = 3).
- The decision affects a shared architectural boundary or public API.

Do not regenerate indefinitely — escalation is a valid outcome, not a failure.

---

## GDD Output Contract

Every GDD decision must be recorded in this format before the session closes:

```markdown
GDD decision:
- Goal: [one sentence from Step 1 Frame]
- Constraints: [key constraints]
- Options considered:
  1. [Option A — brief description]
  2. [Option B — brief description]
  3. [Option C — if applicable]
- Criteria: [list from Step 3 comparison table]
- Trade-offs: [key trade-offs that influenced the selection]
- Selected option: [name] — [one-sentence rationale tied to criteria]
- Rejected alternatives: [why each was not selected]
- Validation evidence: [what evidence was collected, or "provisional — pending: X"]
- Escalation needed: yes / no
```

The output contract is non-optional. A GDD loop that ends with "we chose Option B" without the written contract has not produced a durable decision — only a verbal commitment.

---

## Integration with SDD

| SDD Phase | GDD Use |
|---|---|
| **Discover** | Frame the problem; generate alternative solution directions for discovery.md |
| **Spec** | Use GDD for UI/UX decisions that feed into non-functional ACs |
| **Design** | Full GDD loop for component structure, interaction model, visual direction |
| **Architecture** | GDD for technology choices; output feeds into ADR via architect agent |
| **Review** | GDD findings become review criteria; review-critic checks that validation evidence exists |

GDD decisions that affect spec acceptance criteria must be linked:
```bash
bd remember "GDD: [feature] chose [Option] — rationale: [one-line]. Validation: [evidence]." --key gdd-[feature]-decision
```

---

## Integration with agentic-ux

When designing AI-facing interfaces, load both `gdd` and `agentic-ux`:
- Use GDD's Frame/Generate/Compare/Select loop for structural decisions.
- Use `agentic-ux`'s trust calibration spectrum and safety UX patterns as criteria in Step 3.
- The `agentic-ux` skill's GDD section provides an interface-specific output contract template.

---

## Gotchas

- **Generating options is not the same as comparing them** — Step 2 without Step 3 is brainstorming, not GDD; the comparison table is what makes the loop rigorous.
- **Criteria invented after comparing options are post-hoc rationalization** — define evaluation criteria in Step 1 (Frame) or Step 3 before scoring; never add criteria retroactively to justify a preference.
- **"We discussed two options" is not a GDD output contract** — the written contract must be recorded before the session closes; undocumented decisions cannot be audited or revisited.
- **Escalation is a valid outcome, not a failure** — if three loops do not produce a decision, escalating to a human with documented options and evidence is the correct move; continuing to generate without evidence is not.
- **GDD does not apply to single-answer decisions** — forcing artificial options onto a decision with one correct technical answer wastes time and produces noise; reserve GDD for genuinely contestable choices.

---

## When to load references

No references directory yet. The core loop and output contract are self-contained in this skill.
If the decision involves an AI-facing UX pattern, also load: `agentic-ux`.
If the decision involves a design system architecture, also load: `design-systems-arch`.

---

## Self-validation checklist

Before treating a GDD decision as final:
- [ ] Frame is written out (goal, non-goals, constraints, success metrics, known risks)
- [ ] At least two materially different options were generated and documented
- [ ] Comparison table uses criteria defined before scoring, not invented after
- [ ] Selected option has a written trade-off rationale tied to the criteria table
- [ ] Rejected alternatives are recorded with reasons
- [ ] Validation evidence is cited or decision is explicitly marked provisional
- [ ] GDD output contract is recorded in session output or Beads memory
