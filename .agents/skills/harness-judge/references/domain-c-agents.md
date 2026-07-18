# Domain C — Agents Quality Checklist

**Scope:** Evaluation of `.agents/agents/*.md` files in the harness.

This checklist is used by the harness judge to audit individual Goose agent specification files. Each agent file defines a persona that can be loaded in-session (`load agent <name>`) or summoned as an isolated sub-session (`delegate <name>`). The judge evaluates both static structure (binary pass/fail) and qualitative depth (gradient scoring).

**Reference format** (canonical agent skeleton):

```markdown
---
name: agent-name
description: "One-line tight summary of role and when to invoke"
model: claude-sonnet-4-5
---

## Prompt Defense Baseline
[6 standard security bullets]

[persona introduction paragraph]

## Your Role
[role description]

## When to Invoke
**Invoke:** [conditions]
**Do NOT invoke when:** [conditions]

## Operating Process
Phase 1 — ...
Phase 2 — ...
[numbered steps per phase]

## Output Format
[concrete markdown template]

## Common False Positives
[anti-patterns to NOT report]

## Gotchas
[failure modes with remediation]

## Reference
load skill: `skill-name`
```

---

## Section C1 — Structural Well-formedness

**Mode:** Binary (PASS / FAIL per item)  
**Purpose:** Verify the agent file is syntactically complete and conforms to the harness schema. Structural failures block all downstream quality assessment.

### C1.1 — YAML Frontmatter

- [ ] `name` field is present in YAML frontmatter
- [ ] `description` field is present in YAML frontmatter
- [ ] `model` field is present in YAML frontmatter
- [ ] `name` value is a valid slug (lowercase, hyphens only, no spaces)
- [ ] `description` value is a **single line** (no embedded newlines, no multi-line block scalar)
- [ ] `description` value is enclosed in double quotes
- [ ] `model` value is a recognized model identifier (e.g., `claude-sonnet-4-5`, `claude-opus-4-5`, `gpt-4o`)
- [ ] No extra YAML keys outside `name`, `description`, `model` in frontmatter

**Failure evidence format:**
```
C1.1 FAIL — frontmatter missing `model` key
  File: .agents/agents/example.md, line 1–5
  Found: name, description only
  Expected: name, description, model
```

### C1.2 — Prompt Defense Baseline Section

- [ ] Section `## Prompt Defense Baseline` is present (exact heading)
- [ ] Section contains **exactly 6** security bullets (neither more nor fewer)
- [ ] Bullet 1 addresses: ignore / override / disregard instructions
- [ ] Bullet 2 addresses: role-play or persona-shift requests
- [ ] Bullet 3 addresses: hypothetical / "for educational purposes" framing
- [ ] Bullet 4 addresses: system prompt exfiltration attempts
- [ ] Bullet 5 addresses: indirect injection via file or tool output
- [ ] Bullet 6 addresses: claiming special authority or exemptions
- [ ] Bullets are verbatim from the canonical baseline (character-level match or substantively identical)

**Failure evidence format:**
```
C1.2 FAIL — Prompt Defense Baseline has 5 bullets, missing bullet for indirect injection
  File: .agents/agents/example.md, lines 12–18
  Found bullets: [list text of each found bullet]
  Missing: indirect injection via file/tool output
```

### C1.3 — When to Invoke Section

- [ ] Section `## When to Invoke` is present (exact heading)
- [ ] Subsection `**Invoke:**` is present within the section
- [ ] Subsection `**Do NOT invoke when:**` is present within the section
- [ ] Both subsections contain at least one list item each
- [ ] `Invoke:` subsection has ≥ 2 list items
- [ ] `Do NOT invoke when:` subsection has ≥ 2 list items

### C1.4 — Operating Process Section

- [ ] Section `## Operating Process` is present (exact heading)
- [ ] At least **2 named phases** are defined (e.g., `Phase 1 — Context Gathering`, `Phase 2 — Analysis`)
- [ ] Each phase has at least **2 numbered steps**
- [ ] Phase labels follow the pattern `Phase N — <Name>` (numeral, em dash, title)

### C1.5 — Output Format Section

- [ ] Section `## Output Format` is present (exact heading)
- [ ] Section contains a fenced code block (` ``` `) or concrete markdown template
- [ ] Template is not a prose description — it shows actual structure

### C1.6 — Gotchas Section

- [ ] Section `## Gotchas` is present (exact heading)
- [ ] Section contains **≥ 3** distinct gotcha entries
- [ ] Each entry has a failure mode description **and** a remediation or guidance note

### C1.7 — Reference Section

- [ ] Section `## Reference` is present (exact heading)
- [ ] Section contains at least one `load skill: \`skill-name\`` line
- [ ] All skill names in Reference section correspond to skills that exist on disk (`.agents/skills/<name>/SKILL.md`)

**Scoring — C1 Overall:**

| Result | Condition |
|--------|-----------|
| PASS   | All C1 items pass |
| FAIL   | Any C1 item fails |

> A C1 FAIL should be noted in the verdict but does not prevent the judge from scoring C2–C6 on available content.

---

## Section C2 — Persona Quality

**Mode:** Gradient (0–3 per item, total /15)  
**Purpose:** Assess whether the agent has a clear, useful identity distinct from "helpful AI."

### C2.1 — Role Specificity

- [ ] **3** — Role description names a precise domain (e.g., "static-analysis reviewer for harness structure"), not a generic one ("helpful assistant", "code reviewer")
- [ ] **2** — Role is domain-scoped but could overlap significantly with another agent
- [ ] **1** — Role is vague or essentially interchangeable with the base model
- [ ] **0** — No `## Your Role` section, or role is "helpful AI" verbatim

**What to look for:** Does the role sentence contain a specific artifact type, domain boundary, or decision scope?

### C2.2 — Distinguishing Trait

- [ ] **3** — One explicit characteristic distinguishes this agent from a plain LLM (e.g., "never produces implementation code", "always outputs a structured verdict", "focuses exclusively on factual accuracy")
- [ ] **2** — Distinguishing trait implied but not named
- [ ] **1** — Trait is a generic virtue ("thorough", "careful")
- [ ] **0** — No distinguishing trait identifiable

### C2.3 — Core Constraint

- [ ] **3** — At least one hard behavioral constraint is stated (what the agent will NOT do under any circumstances)
- [ ] **2** — Constraint implied or soft ("try to avoid…")
- [ ] **1** — Constraint is trivially obvious (e.g., "don't break production")
- [ ] **0** — No constraint stated

### C2.4 — WHO vs HOW Separation

- [ ] **3** — Persona body describes identity, values, and decision style; step-by-step workflow lives only in Operating Process
- [ ] **2** — Minor workflow leakage into persona (1–2 procedural sentences)
- [ ] **1** — Persona is mostly a process description with thin identity framing
- [ ] **0** — Persona section is entirely procedural (duplicates Operating Process)

### C2.5 — Persona Coherence

- [ ] **3** — All sections (role, process, output format) are consistent with the declared persona identity
- [ ] **2** — Minor inconsistency (e.g., persona says "never writes code" but output format includes code snippets)
- [ ] **1** — Notable inconsistency that could confuse the model
- [ ] **0** — Fundamental contradiction between persona and instructions

**C2 Scoring:**

| Score | Band |
|-------|------|
| 13–15 | PASS |
| 8–12  | PARTIAL |
| 0–7   | FAIL |

---

## Section C3 — When to Invoke Quality

**Mode:** Gradient (0–3 per item, total /12)  
**Purpose:** Assess whether invoke conditions precisely direct callers to the right agent.

### C3.1 — Invoke Precision

- [ ] **3** — Trigger conditions are specific enough that a caller can decide without ambiguity (artifact type + state + caller role, e.g., "After a PR is opened on a `.md` agent file")
- [ ] **2** — Conditions are specific to artifact type but not state or caller
- [ ] **1** — Conditions are domain-scoped but vague ("when reviewing code")
- [ ] **0** — "For any task involving X" or equivalent catch-all

### C3.2 — Do NOT Invoke Precision

- [ ] **3** — Anti-conditions specifically prevent the most common misuse (named pattern, e.g., "Do NOT use for runtime debugging — use verify-agent instead")
- [ ] **2** — Anti-conditions are domain-relevant but name no alternative
- [ ] **1** — Anti-conditions are generic ("when not applicable")
- [ ] **0** — Anti-conditions absent or trivially circular

### C3.3 — Mutual Exclusivity

- [ ] **3** — Invoke and Do NOT invoke lists are jointly exhaustive for the agent's domain with no overlap
- [ ] **2** — Minor overlap or edge case not covered
- [ ] **1** — Significant overlap (same input could satisfy both lists)
- [ ] **0** — Lists are identical or fully overlapping

### C3.4 — Alternative Routing

- [ ] **3** — At least one Do NOT invoke entry names a specific alternative agent or recipe to use instead
- [ ] **2** — Alternative named for some but not all anti-conditions
- [ ] **1** — "Use a different agent" without naming which one
- [ ] **0** — No alternative routing provided

**C3 Scoring:**

| Score | Band |
|-------|------|
| 10–12 | PASS |
| 6–9   | PARTIAL |
| 0–5   | FAIL |

---

## Section C4 — Operating Process Quality

**Mode:** Gradient (0–3 per item, total /15)  
**Purpose:** Assess whether the process is actionable and well-structured.

### C4.1 — Phase Structure

- [ ] **3** — Phases are named, numbered, and logically sequenced (gather → analyze → output is one valid pattern); progression is clear
- [ ] **2** — Phases exist but naming is unclear or sequencing rationale is missing
- [ ] **1** — Phases are just numbered sections with no thematic identity
- [ ] **0** — No phases; process is a flat list of steps

### C4.2 — Step Concreteness

- [ ] **3** — Steps name specific tools (`shell`, `write`, `analyze`, `read_image`) or specific artifacts ("open `spec.md`", "run `goose recipe validate`")
- [ ] **2** — Steps name tool categories ("run a validation command") without specifics
- [ ] **1** — Steps are abstract ("gather context", "verify correctness")
- [ ] **0** — Steps are entirely vague or missing

### C4.3 — Circuit Breakers

- [ ] **3** — Process defines at least one explicit halt condition (what stops the process and why) with escalation path
- [ ] **2** — Halt condition stated but no escalation path
- [ ] **1** — Implicit halt only ("stop when done")
- [ ] **0** — No halt condition defined

### C4.4 — Maker/Checker Split

- [ ] **3** — Where the agent produces an artifact AND evaluates it, the checker step is explicitly separated and the split is documented (or it's explicit that this agent is checker-only)
- [ ] **2** — Split implied but not documented
- [ ] **1** — Agent acts as both maker and checker for same artifact without acknowledgment
- [ ] **0** — Not applicable (agent is observer-only) — score as N/A, exclude from denominator

### C4.5 — Error Handling

- [ ] **3** — At least one error path is documented with recovery action (e.g., "if shell command fails, report exit code in Gotchas section and halt")
- [ ] **2** — Error handling mentioned but vague
- [ ] **1** — Errors implicitly ignored
- [ ] **0** — No error handling

**C4 Scoring:**

| Score | Band |
|-------|------|
| 13–15 | PASS |
| 8–12  | PARTIAL |
| 0–7   | FAIL |

---

## Section C5 — Output Format Quality

**Mode:** Gradient (0–3 per item, total /12)  
**Purpose:** Assess whether the output format is concrete and machine-parseable by downstream consumers.

### C5.1 — Template Concreteness

- [ ] **3** — A literal markdown template is shown (fenced block or indented example with fill-in anchors)
- [ ] **2** — Template described in prose ("include a summary section, then findings")
- [ ] **1** — Output format gestured at ("produce a report")
- [ ] **0** — No output format specified

### C5.2 — Required Sections Named

- [ ] **3** — All mandatory output sections are listed in the template with exact headings
- [ ] **2** — Most sections listed; 1–2 missing
- [ ] **1** — Sections mentioned but headings not shown
- [ ] **0** — No sections identifiable

### C5.3 — Fill-in Anchors

- [ ] **3** — Template uses bracketed placeholders for variable content (`[bead-id]`, `[PASS/FAIL]`, `[date]`, `[agent-name]`, etc.)
- [ ] **2** — Some placeholders present, others are prose descriptions
- [ ] **1** — No anchors; template looks complete but isn't a template
- [ ] **0** — No template

### C5.4 — Verdict Enumeration

- [ ] **3** — All possible verdict values are explicitly enumerated (e.g., `PASS | PARTIAL | FAIL | SKIP`)
- [ ] **2** — Some verdict values enumerated; ambiguous cases missing
- [ ] **1** — "Pass or fail" mentioned but not defined
- [ ] **0** — No verdict structure

**C5 Scoring:**

| Score | Band |
|-------|------|
| 10–12 | PASS |
| 6–9   | PARTIAL |
| 0–5   | FAIL |

---

## Section C6 — Behavioral Accuracy in Transcripts

**Mode:** Gradient (0–3 per item, total /15)  
**Purpose:** Assess whether the agent behaved consistently with its spec during actual execution. Requires session transcript.

> **Note:** Skip C6 if no transcript is available. Mark all items N/A and exclude from aggregate scoring.

### C6.1 — Role Adherence

- [ ] **3** — Agent stayed within its declared scope for the entire session; no off-role responses
- [ ] **2** — Agent stayed in role but drifted on 1–2 turns
- [ ] **1** — Agent performed tasks outside its declared role on multiple turns
- [ ] **0** — Agent fundamentally operated outside its persona

**Evidence to collect:** Identify the declared role from the spec. Highlight any turn where the agent's action doesn't match that role.

### C6.2 — Skill Loading

- [ ] **3** — All skills listed in `## Reference` were loaded in the session; no extra skills loaded
- [ ] **2** — All required skills loaded but additional unspecified skills also loaded
- [ ] **1** — 1–2 required skills not loaded; agent proceeded without them
- [ ] **0** — Skills not loaded at all or completely different set used

### C6.3 — Output Format Conformance

- [ ] **3** — Agent output matches the template in `## Output Format` exactly (all sections present, anchors filled, verdict enumerated)
- [ ] **2** — Output matches template in structure but deviates in 1–2 sections
- [ ] **1** — Output is structurally different but covers the right topics
- [ ] **0** — Output format is completely different from spec

### C6.4 — Delegation Boundary

- [ ] **3** — Agent called `delegate()` only if it is an orchestrator; no `delegate()` calls observed from specialist agents
- [ ] **2** — Delegation attempted but immediately corrected
- [ ] **1** — `delegate()` called by specialist agent without correction
- [ ] **0** — Not applicable (orchestrator agent) — score N/A

### C6.5 — Self-Approval Absence

- [ ] **3** — Agent never approved, merged, or accepted its own output without external verification step
- [ ] **2** — Agent self-reviewed but explicitly flagged the limitation
- [ ] **1** — Agent self-approved in a low-stakes context
- [ ] **0** — Agent self-approved a high-stakes artifact (PR merge, spec sign-off, bead close)

**C6 Scoring:**

| Score | Band |
|-------|------|
| 13–15 | PASS |
| 8–12  | PARTIAL |
| 0–7   | FAIL |

---

## Aggregate Scoring Rubric

### Section Weights

| Section | Weight | Max Raw |
|---------|--------|---------|
| C1 Structural Well-formedness | binary gate | N/A |
| C2 Persona Quality | 20% | 15 |
| C3 When to Invoke Quality | 20% | 12 |
| C4 Operating Process Quality | 25% | 15 |
| C5 Output Format Quality | 20% | 12 |
| C6 Behavioral Accuracy | 15% | 15 |

### Final Verdict

| Verdict | Condition |
|---------|-----------|
| **PASS** | C1 all pass AND weighted score ≥ 75% |
| **PARTIAL** | C1 all pass AND weighted score 50–74% |
| **FAIL** | Any C1 item fails OR weighted score < 50% |

### Override Rules

- Any C1 failure **automatically** caps the verdict at FAIL regardless of gradient scores.
- If C6 transcript is unavailable, reweight remaining sections proportionally (C2 25%, C3 25%, C4 30%, C5 20%).
- C4.4 (Maker/Checker) scores N/A for observer-only agents; remove from denominator.

---

## Evidence Templates

### C1 Structural Failure

```
FINDING C1.[item] — [PASS|FAIL]
File:    .agents/agents/<name>.md
Lines:   <start>–<end>
Issue:   <description of what is missing or malformed>
Found:   <verbatim excerpt or "absent">
Expected: <what the canonical format requires>
```

### C2–C5 Gradient Finding

```
FINDING C[N].[item] — Score [0|1|2|3]/3
Section: <heading in agent file>
Lines:   <start>–<end>
Score rationale: <one sentence explaining the score>
Evidence: |
  <verbatim excerpt from file>
Improvement: <one actionable suggestion>
```

### C6 Transcript Finding

```
FINDING C6.[item] — Score [0|1|2|3]/3
Session: <session-id or transcript reference>
Turn:    <turn number>
Issue:   <what the agent did vs what the spec requires>
Transcript excerpt: |
  <quoted agent action>
Spec excerpt: |
  <quoted spec requirement>
```

---

## Calibration Anchors

These anchors are concrete examples used to calibrate scoring across different evaluators.

### Anchor A — PASS Agent (score ≥ 75%)

**Agent:** `review-critic.md`

Characteristics that earn PASS:
- Frontmatter complete: `name: review-critic`, `description: "..."` (single line), `model: claude-sonnet-4-5`
- All 6 Prompt Defense Baseline bullets present verbatim
- `When to Invoke` with ≥ 3 precise trigger conditions (e.g., "After PR opened on `.md` or `.yaml` file in this repo")
- `Do NOT invoke when` with named alternatives ("use implement-agent for greenfield work")
- Phase 1 names specific tools: `analyze`, `shell`, `read_image`
- Phase 2 names specific output step: "produce structured verdict using Output Format template"
- Output template is a fenced code block with `[PASS|PARTIAL|FAIL]`, `[finding-id]`, `[severity]` anchors
- Gotchas: ≥ 3 with failure + remediation per entry
- Reference: `load skill: \`code-review\`` — skill exists on disk

### Anchor B — PARTIAL Agent (score 50–74%)

**Agent:** `generic-helper.md` (hypothetical)

Characteristics that earn PARTIAL:
- Frontmatter complete but `description` is 2 lines (C1 FAIL → but other sections score partially)
- Prompt Defense Baseline has 5 bullets (missing indirect injection)
- `When to Invoke` present but conditions are vague ("for any code-related task")
- `Do NOT invoke when` has 1 entry with no alternative named
- Operating Process has phases but steps say "review the code" without naming tools
- Output format described in prose but no concrete template
- Gotchas section has 2 entries (below ≥ 3 threshold)
- Reference section present with valid skill

### Anchor C — FAIL Agent (score < 50%)

**Agent:** `stub.md` (incomplete)

Characteristics that earn FAIL:
- `model` missing from frontmatter (C1.1 FAIL)
- Prompt Defense Baseline section absent entirely (C1.2 FAIL)
- `When to Invoke` section absent (C1.3 FAIL)
- Body is 3 sentences of prose with no structure
- No output format
- No Gotchas
- No Reference section
- → All C1 failures → automatic FAIL verdict

### Anchor D — C6 Behavioral PARTIAL (transcript scoring)

**Scenario:** Agent `architect.md` in session transcript `session-2026-07-15`

Evidence of PARTIAL:
- C6.1 Role adherence: agent stayed in scope for 18/20 turns; turns 7 and 14 included implementation code (off-role for a spec-writing agent) → score 2
- C6.2 Skill loading: `sdd` skill loaded as required; additional `code-review` skill loaded without spec justification → score 2
- C6.3 Output format: verdict section present, all anchors filled; missing `[risk-level]` anchor → score 2
- C6.4 Delegation boundary: no `delegate()` calls (correct for specialist) → score 3
- C6.5 Self-approval: agent used `bd close` on its own bead at turn 19 (self-approval of high-stakes artifact) → score 0

**Aggregate C6:** 9/12 → PARTIAL

---

## Common Judge Errors (Anti-patterns)

These are things the harness judge must NOT do:

1. **Do not penalize for extra sections.** An agent may have additional sections beyond the canonical skeleton (e.g., `## Common False Positives`). These are additive and do not cause failures.
2. **Do not score C6 without a transcript.** Mark N/A and reweight; do not infer behavior from the spec alone.
3. **Do not apply C1 failures to all sections.** A missing YAML `model` field fails C1.1 but does not automatically fail C2–C5; score those on available content.
4. **Do not treat "vague" as automatic 0.** Score 1 for anything that gestures toward the right concept; reserve 0 for truly absent items.
5. **Do not count Prompt Defense bullets by existence.** Verify each bullet covers its required topic area, not just that 6 bullets exist.
6. **Do not accept self-referential role descriptions.** "This agent reviews agents" does not satisfy C2.1 without also naming the decision scope and artifact type.

---

*Last updated: 2026-07-18 | Domain C v1.0*
