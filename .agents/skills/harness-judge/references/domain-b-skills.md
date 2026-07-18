# Domain B — Skills Quality
## Harness Judge Reference Checklist

**Version**: 1.0.0
**Axis**: Artifact Integrity (Axis 3, sub-domain B)
**Applies to**: `.agents/skills/*/SKILL.md` files

---

## Why skills quality matters

Skills are the primary methodology delivery mechanism in the Goose harness. A recipe
can be correct yet produce low-quality sessions if the skills it loads are vague,
incomplete, or poorly engineered. Skills are loaded into every session that needs
their domain — a quality deficit in a skill multiplies across every session that loads
it.

A high-quality skill has three properties:

1. **Instructional**: Its body directly changes LLM behavior. It is not documentation
   — it is a behavioral specification written in imperative voice for an LLM executor.
2. **Self-contained**: Its methodology is complete within itself (with support files
   in `references/`). A consumer of the skill does not need to load additional
   knowledge to apply the skill.
3. **Composable**: Its scope is narrow enough to be combined with other skills without
   conflict. A skill that covers "all of software engineering" cannot be composed; a
   skill that covers "code review for agentic sessions" can.

This checklist audits `.agents/skills/*/SKILL.md` files across six dimensions:
structural well-formedness, description quality, methodology quality, prompt
engineering quality, context engineering quality, and loop engineering quality.

**Scope**:
- Apply this checklist when a skill file is added, modified, or when a recipe that
  loads it is under review.
- For a recipe review: run this checklist on all skills the recipe loads.
- For an agent review: run this checklist on all skills listed in the agent's
  "Load next" or "Reference" section.

---

## How to use this checklist

1. Locate the skill file: `.agents/skills/<name>/SKILL.md`.
2. Work through sections B1 through B6 in order.
3. For each criterion: read the file, quote the relevant text, assign PASS / PARTIAL / FAIL.
4. Apply chain-of-thought-first rule: score every criterion before writing a section verdict.
5. Aggregate section scores using the Domain B Rubric at the end of this file.

---

## Section B1 — Structural Well-formedness

**What this section measures**: Whether the file exists in the correct location,
has valid YAML frontmatter, and contains the required fields. These are binary
checks — either the structure is correct or it is not. Structural failures prevent
the skill from being loaded by the Goose runtime.

---

### B1.1 — File Location

**Type**: Binary-verbatim

**Criterion**: The skill file is located at `.agents/skills/<name>/SKILL.md` where
`<name>` is a kebab-case identifier.

**Pass condition**:
- [ ] File path matches the pattern `.agents/skills/<name>/SKILL.md` exactly.
- [ ] `SKILL.md` is uppercase (`skill.md` or `Skill.md` will not be registered).
- [ ] The directory `<name>` is the canonical skill name (kebab-case, no spaces).

**Fail condition**:
- File is named differently (e.g., `README.md`, `skill.md`, `index.md`).
- File is at `.agents/skills/SKILL.md` (not inside a named subdirectory).
- File is in any directory other than `.agents/skills/`.

**Evidence template**:
```
B1.1 File Location
  Actual path: [full path]
  Expected pattern: .agents/skills/<name>/SKILL.md
  Score: PASS | FAIL
```

---

### B1.2 — YAML Frontmatter Validity

**Type**: Binary-presence

**Criterion**: The file begins with a valid YAML frontmatter block delimited by `---`
on the first line and a closing `---` before the body.

**Pass condition**:
- [ ] File begins with `---` on line 1.
- [ ] A closing `---` appears before the first body line.
- [ ] The YAML block is valid (parseable without error).
- [ ] No content appears before the opening `---`.

**Fail condition**:
- No frontmatter block at all.
- Frontmatter block is present but not parseable (YAML syntax error).
- Content appears before the opening `---`.
- Frontmatter is not closed (missing closing `---`).

**Evidence template**:
```
B1.2 YAML Frontmatter Validity
  Frontmatter present: [yes/no]
  Opens on line 1: [yes/no]
  Parseable: [yes/no]
  Closing --- line: [N]
  Score: PASS | FAIL
```

---

### B1.3 — Required Fields: `name`

**Type**: Binary-presence

**Criterion**: The frontmatter contains a `name` field with a non-empty string value.

**Pass condition**:
- [ ] `name:` key present in frontmatter.
- [ ] Value is a non-empty string.
- [ ] Value matches the directory name (checked in B1.5).

**Fail condition**:
- `name:` absent from frontmatter.
- `name:` present but empty (`name: ""`).
- `name:` has a list or object value instead of a string.

**Evidence template**:
```
B1.3 Required Field: name
  name value: [quoted]
  Non-empty: [yes/no]
  Score: PASS | FAIL
```

---

### B1.4 — Required Fields: `description` and `metadata.version`

**Type**: Binary-presence (two sub-checks)

**Criterion**: The frontmatter contains both a `description` field and a
`metadata.version` field with appropriate values.

**Pass condition — description**:
- [ ] `description:` key present (inline or multi-line with `>`).
- [ ] Value is a non-empty string or multi-line block.
- [ ] Description is at least 10 words (trivially short descriptions are structurally
      present but content-invalid; content quality scored in B2).

**Pass condition — metadata.version**:
- [ ] `metadata:` block present.
- [ ] `metadata.version:` key present with a semver string (e.g., `1.0.0`, `0.2.1`).
- [ ] Version is not `0.0.0` (placeholder not yet versioned).

**Fail condition**:
- `description:` absent.
- `metadata:` block absent.
- `metadata.version:` absent inside an otherwise-present `metadata:` block.
- `version:` at top level (not nested under `metadata:`).

**Evidence template**:
```
B1.4 Required Fields: description + metadata.version
  description: [quoted, first 50 chars]
  metadata.version: [value]
  Score: PASS | FAIL
  (Note any partial issues: e.g., version at wrong nesting level)
```

---

### B1.5 — Name Matches Directory

**Type**: Binary-presence

**Criterion**: The `name` field value in the frontmatter matches the directory name
exactly (case-sensitive). A mismatch means the runtime may register the skill under
a different identifier than the directory, causing load-by-name to fail.

**Pass condition**:
- [ ] Directory name: `<name>` exactly equals frontmatter `name:` value.
- [ ] Case matches exactly (e.g., directory `code-review`, name `code-review` — PASS;
      directory `code-review`, name `Code-Review` — FAIL).

**Fail condition**:
- Frontmatter `name:` differs from directory name in any character.
- `name:` includes spaces or underscores where the directory uses hyphens.

**Evidence template**:
```
B1.5 Name Matches Directory
  Directory name: [value]
  Frontmatter name: [value]
  Match: [yes/no]
  Score: PASS | FAIL
```

---

### B1.6 — Body is Non-empty

**Type**: Binary-presence

**Criterion**: The file body (after the closing `---` of frontmatter) contains
at least one non-whitespace line of content.

**Pass condition**:
- [ ] At least one non-empty line after the frontmatter closing `---`.
- [ ] Body is > 10 lines (files with < 10 body lines are structurally present but
      almost certainly content-insufficient; content quality scored in B3).

**Fail condition**:
- Body is empty or whitespace-only.
- Body contains only the skill name as a heading with no content.

**Evidence template**:
```
B1.6 Body Non-empty
  Body line count: [N]
  Score: PASS | FAIL
```

---

### B1 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | All 6 criteria PASS (all are binary — no PARTIAL) |
| **FAIL** | Any criterion FAIL |

> **Note**: B1 is a hard gate. If B1 scores FAIL, the skill cannot be reliably loaded
> by the runtime. Flag immediately and do not proceed to B2–B6 until structural issues
> are fixed.

---

## Section B2 — Description Quality

**What this section measures**: Whether the `description` field answers the question
"when should I load this skill?" clearly enough for an orchestrator agent to make the
correct loading decision without reading the full body.

The description is the first signal the Goose runtime (and the orchestrator) uses to
select skills. A vague description leads to under-loading (skill not loaded when needed)
or over-loading (skill loaded when irrelevant, diluting context).

---

### B2.1 — Answers "When to Load"

**Type**: Gradient-quality

**Criterion**: The description communicates the triggering condition — when an agent
or recipe should load this skill. "Load before any evaluation session" is good.
"A skill for doing things" is not.

**Pass condition**:
- [ ] The description starts with or contains an explicit loading trigger ("Load when",
      "Load before", "Load for", "Use this skill when").
- [ ] The trigger is specific to a task type or phase, not generic.
- [ ] An agent with no domain context could decide from the description alone whether
      to load the skill for a given task.

**Partial condition**:
- Trigger implied but not stated ("Provides methodology for code review" implies
  load for code review, but does not say when explicitly).
- Trigger stated but too broad ("Load for any review task" — which type of review?).

**Fail condition**:
- No loading trigger at all.
- Description describes what the skill IS rather than when to USE it.
- "Use when needed" or equivalent non-answer.

**Evidence template**:
```
B2.1 Answers "When to Load"
  Description: [full text]
  Loading trigger: [quoted phrase]
  Specificity: [high / medium / low]
  Score: PASS | PARTIAL | FAIL
```

---

### B2.2 — Description Brevity

**Type**: Binary-presence (with gradient quality)

**Criterion**: The description is ≤ 3 sentences OR a bullet list of ≤ 5 items.
Long descriptions are better placed in the body. The description is consumed in
context by the orchestrator — conciseness is a functional requirement, not style.

**Pass condition**:
- [ ] Description is ≤ 3 sentences (prose) OR ≤ 5 bullet items (list).
- [ ] Every sentence/bullet is load-decision-relevant.

**Partial condition**:
- Description is 4–5 sentences with no redundancy.
- Description is within length but contains a sentence that is body content
  (methodology detail) rather than load-decision content.

**Fail condition**:
- Description exceeds 5 sentences or 8 bullet items.
- Description contains methodology steps or examples (belongs in body).

**Evidence template**:
```
B2.2 Description Brevity
  Description sentence/item count: [N]
  Load-decision-relevant: [all / most / some]
  Score: PASS | PARTIAL | FAIL
```

---

### B2.3 — Avoids Vague Phrases

**Type**: Binary-presence (checked by scanning for known vague patterns)

**Criterion**: The description does not contain the following vague phrases that provide
zero load-decision signal:

- "use when needed"
- "helpful for"
- "provides guidance on"
- "general purpose"
- "various tasks"
- "and more"
- "etc."
- "any kind of"

**Pass condition**:
- [ ] None of the above phrases (or close paraphrases) appear in the description.

**Fail condition**:
- Any of the above phrases appear.
- A paraphrase is used ("can be applied in many situations", "works for a variety
  of contexts").

**Evidence template**:
```
B2.3 Avoids Vague Phrases
  Description scanned: [full text]
  Vague phrases found: [none / list]
  Score: PASS | FAIL
```

---

### B2.4 — Distinguishes from Similar Skills

**Type**: Gradient-quality

**Criterion**: If similar skills exist in the harness, the description distinguishes
this skill's scope from them. An orchestrator that cannot tell `code-review` from
`harness-judge` from `review-critic` will load the wrong one.

**Pass condition**:
- [ ] The description names or implies the boundary with the most similar adjacent skill.
- [ ] A key differentiator is stated (not just "comprehensive" vs. a named skill).
- [ ] Example: "code-review provides general code quality review; harness-judge
      provides protocol compliance scoring for agentic sessions."

**Partial condition**:
- Description is specific enough that an informed reader can distinguish, but does
  not explicitly name the boundary.
- No adjacent skills exist that could be confused — then N/A (not a distinguishing
  failure, just not applicable).

**Fail condition**:
- Similar skills exist and the descriptions are indistinguishable or contradictory.
- Description explicitly says it can be used for tasks that belong to an adjacent skill.

**N/A condition**:
- No similar skills exist in the harness. Mark N/A.

**Evidence template**:
```
B2.4 Distinguishes from Similar Skills
  Similar skills in harness: [list or "none"]
  Distinguishing boundary stated: [yes/no, quoted]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### B2.5 — Lists What the Skill Provides

**Type**: Gradient-quality

**Criterion**: The description tells the consumer what they will have access to after
loading the skill (methodology, checklist, rubric, template, command reference, etc.).
This is distinct from B2.1 (when to load) — this is "what you get."

**Pass condition**:
- [ ] At least one concrete deliverable or content type is named ("scoring rubrics",
      "chain-of-thought methodology", "bead CLI command reference").
- [ ] The named deliverable is what the skill body actually provides.

**Partial condition**:
- Deliverable implied ("provides evaluation methodology") but not specific about
  what form (rubric? checklist? process steps?).

**Fail condition**:
- Description provides no indication of what the skill body contains.
- Named deliverable does not match the skill body content.

**Evidence template**:
```
B2.5 Lists What Skill Provides
  Deliverable named in description: [quoted]
  Matches body content: [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### B2 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | ≥ 4 of 5 criteria PASS (excluding N/A from denominator) |
| **PARTIAL** | 3 of 5 criteria PASS |
| **FAIL** | < 3 of 5 criteria PASS |

---

## Section B3 — Methodology Quality

**What this section measures**: Whether the skill body actually changes LLM behavior
in the target domain. A skill body that is documentation, background, or commentary
is not a skill — it is a README. A skill body that is imperative, numbered,
concrete, and self-validating is a behavioral specification.

---

### B3.1 — Imperative Voice Throughout

**Type**: Gradient-quality (same method as A1.2)

**Criterion**: ≥ 80% of step-level instructions use imperative verb forms.

**Pass condition**:
- [ ] ≥ 80% of step lines begin with: Do, Run, Emit, Write, Load, Check, Flag,
      Claim, Validate, Call, Produce, List, Score, Compute, Verify, Record, Trace.
- [ ] Explanatory paragraphs (rationale) are clearly separated from instruction
      steps and are < 20% of body line count.

**Partial condition**:
- 50–79% imperative. Critical steps are imperative; guidance sections are hedged.

**Fail condition**:
- < 50% imperative. The skill reads as documentation or background reading.

**Evidence template**:
```
B3.1 Imperative Voice
  Body line count: [N]
  Imperative step count: [M]
  Imperative %: [M/N steps, estimated]
  Hedged phrases found: [list up to 3]
  Score: PASS | PARTIAL | FAIL
```

---

### B3.2 — Steps Numbered Where Order Matters

**Type**: Binary-presence (conditional)

**Criterion**: When the skill describes a process with a required sequence, steps are
numbered. Bullet lists for ordered processes are a common error — they imply the steps
can be reordered, which produces incorrect behavior.

**Pass condition**:
- [ ] All sequential processes use numbered lists (`1.`, `2.`, `3.`…).
- [ ] Unordered choices or parallel options use bullet lists.
- [ ] The distinction between ordered and unordered steps is consistent throughout.

**Partial condition**:
- Mixed use: some sequential processes use bullets; the main process is numbered.
- Numbered steps but a secondary process uses bullets when order matters.

**Fail condition**:
- A primary sequential process uses bullet lists throughout.
- Numbered lists used for unordered options (implies false ordering).

**N/A condition**:
- The skill describes no sequential process (e.g., a reference/lookup skill).

**Evidence template**:
```
B3.2 Steps Numbered
  Sequential processes identified: [N]
  Numbered: [M]
  Bulleted (but order matters): [N-M]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### B3.3 — Concrete Examples (Code Blocks or Step-by-Step)

**Type**: Binary-presence

**Criterion**: The skill body contains ≥ 1 concrete example that demonstrates the
methodology in action. Abstract instructions without examples leave the "how" to the
model's interpretation, which introduces variance.

**Pass condition**:
- [ ] ≥ 1 code block (``` fenced) OR a filled-in step-by-step walkthrough of a
      real or realistic case.
- [ ] The example demonstrates the skill's primary use case (not a trivial edge case).
- [ ] Literal strings or command formats shown with exact syntax (not schematic).

**Partial condition**:
- Example present but highly schematic (shows placeholders rather than concrete values).
- Example present for a secondary use case only.

**Fail condition**:
- No example at all.
- Example is a counter-example only (shows what NOT to do) with no positive example.

**Evidence template**:
```
B3.3 Concrete Examples
  Code block count: [N]
  Step-by-step walkthrough: [yes/no]
  Primary use case covered: [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### B3.4 — Gotchas Section

**Type**: Gradient-quality

**Criterion**: The skill body includes a "Gotchas", "Common Mistakes", or "Pitfalls"
section with ≥ 3 entries. Gotchas document the failure modes that are most likely to
occur when an LLM applies the skill — they are the calibration mechanism against the
model's default assumptions.

**Pass condition**:
- [ ] A section explicitly labeled "Gotchas", "Common Mistakes", "Pitfalls", or
      "False Positives" is present.
- [ ] Section contains ≥ 3 entries.
- [ ] Each entry identifies: the mistake pattern AND the correct behavior.
- [ ] At least 1 entry is non-obvious (not simply "don't do the opposite of the main
      instruction").

**Partial condition**:
- Section present with only 1–2 entries.
- Section present with ≥ 3 entries but all are obvious (no calibration value).
- Gotchas scattered through the body without a dedicated section.

**Fail condition**:
- No gotchas section and no equivalent warning/caveat content anywhere.
- Section present but entries are placeholder text ("TBD", "see examples").

**Evidence template**:
```
B3.4 Gotchas Section
  Section found: [yes/no, label]
  Entry count: [N]
  Non-obvious entries: [M, quote one]
  Each entry has correct behavior: [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### B3.5 — Literal Strings with Backtick Formatting

**Type**: Binary-presence

**Criterion**: All literal strings, command names, flag values, file paths, and exact
phrases that must appear verbatim are formatted with backticks (` `` `). Unformatted
literal strings are ambiguous — the model may paraphrase rather than reproduce them
exactly.

**Pass condition**:
- [ ] All command names appear in backticks (`bd prime`, `goose recipe validate`).
- [ ] All file paths appear in backticks (`.agents/skills/code-review/SKILL.md`).
- [ ] All required verbatim phrases appear in backticks (`## Handoff`, `Scoped plan:`).
- [ ] All CLI flags appear in backticks (`--claim`, `--dry-run`).

**Partial condition**:
- Most literal strings formatted; 1–3 exceptions found.
- Commands formatted but file paths are not.

**Fail condition**:
- Multiple command names or required phrases left unformatted.
- A "binary-verbatim" criterion (one where exact string matters) is stated without
  backtick formatting.

**Evidence template**:
```
B3.5 Literal Strings Formatted
  Backtick-formatted terms: [count]
  Unformatted literals found: [list up to 5]
  Score: PASS | PARTIAL | FAIL
```

---

### B3.6 — Self-Validation Checklist

**Type**: Gradient-quality

**Criterion**: The skill includes a checklist or "verify your output" section that
tells the LLM how to confirm the skill was applied correctly before exiting. A self-
validation step is the difference between a skill that is applied once and a skill
that is applied until correct.

**Pass condition**:
- [ ] A self-check section is present (labeled "Verify", "Self-check", "Before closing",
      "Confirmation steps").
- [ ] Section lists ≥ 3 observable verification steps.
- [ ] Verification steps are distinct from the operating steps (checking, not doing).

**Partial condition**:
- Self-validation present but embedded in the Handoff or Gotchas section rather
  than as a dedicated step.
- Fewer than 3 verification steps.

**Fail condition**:
- No self-validation mechanism at all.
- Self-validation consists of "make sure you did everything above" (non-actionable).

**N/A condition**:
- Skill is a pure reference/lookup skill with no process to validate. Mark N/A.

**Evidence template**:
```
B3.6 Self-Validation Checklist
  Section found: [yes/no, label]
  Verification step count: [N]
  Distinct from operating steps: [yes/no]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### B3.7 — Verification Steps (How to Confirm Skill Applied)

**Type**: Gradient-quality

**Criterion**: Distinct from B3.6, this criterion checks for *external* verification
steps — commands or observations that confirm the skill's output is visible outside
the session (e.g., `goose skills list`, `git diff`, `pnpm test`, `bd prime` shows
the bead closed). Internal self-check is B3.6; external verification is B3.7.

**Pass condition**:
- [ ] ≥ 1 external verification command or observation stated.
- [ ] The command is runnable (not schematic) and produces observable output.
- [ ] The expected output or state is described ("should show X in the list").

**Partial condition**:
- Verification step present but schematic ("run the appropriate test command").
- Verification step present but the expected output is not described.

**Fail condition**:
- No external verification step at all.
- Verification is circular ("check that the skill file is correct" without
  a way to confirm correctness).

**N/A condition**:
- Skill is pure methodology with no artifact output that can be externally verified.
  Mark N/A.

**Evidence template**:
```
B3.7 External Verification Steps
  Verification command: [quoted, e.g., "goose skills list"]
  Expected output described: [yes/no]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### B3 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | ≥ 5 of 7 non-N/A criteria PASS; B3.1 and B3.3 must not FAIL |
| **PARTIAL** | 3–4 non-N/A criteria PASS, OR B3.1 OR B3.3 scores PARTIAL |
| **FAIL** | < 3 non-N/A criteria PASS, OR B3.1 FAIL (imperative voice absent) |

---

## Section B4 — Prompt Engineering in Skills

**What this section measures**: Whether the skill's instructional content is
engineered for LLM execution — not just correct for human readers. A skill that
reads well to a human but is ambiguous to an LLM will produce variable behavior
across sessions and models.

---

### B4.1 — Content is Instructional for LLMs

**Type**: Gradient-quality

**Criterion**: The skill body reads as a behavioral specification rather than
documentation. The test: if removed from context, would the LLM behavior change?
If no, the content is decorative, not instructional.

**Pass condition**:
- [ ] Every major section contains at least one instruction that changes LLM behavior.
- [ ] Rationale and background occupy < 25% of body.
- [ ] The skill cannot be summarized as "explains what X is" — it specifies HOW
      to DO X.

**Partial condition**:
- Mix of documentation and instruction; skill could be trimmed by 30–40% without
  behavioral loss.
- Skill explains methodology clearly but doesn't specify the exact LLM actions
  to take.

**Fail condition**:
- Skill is primarily documentation about a domain with no behavioral instructions.
- Body reads as a README or wiki article, not a prompt specification.

**Evidence template**:
```
B4.1 Instructional for LLMs
  Behavioral instruction density: [high / medium / low]
  "Would removing this change LLM behavior?": [yes/no per section]
  Score: PASS | PARTIAL | FAIL
```

---

### B4.2 — Steps are Unambiguous

**Type**: Gradient-quality

**Criterion**: Each step has exactly one valid interpretation. Steps that can be
interpreted in multiple ways produce inconsistent behavior across model runs.

**Pass condition**:
- [ ] Each step specifies: WHAT to do, WHERE to do it (if location matters),
      and WHEN to stop.
- [ ] No step uses comparative language without an anchor ("better", "more
      thoroughly", "as appropriate") — all relative language has a reference point.
- [ ] Steps do not contain "or" choices without a decision rule for which to pick.

**Partial condition**:
- Most steps are unambiguous; 1–2 steps have interpretive latitude that is
  unlikely to cause failures in practice.
- "Or" choices present but with a recommended default.

**Fail condition**:
- A core step is ambiguous in a way that would produce structurally different
  outputs depending on interpretation.
- A step uses undefined relative terms ("be thorough", "be concise",
  "as needed") without calibration.

**Evidence template**:
```
B4.2 Unambiguous Steps
  Ambiguous steps found: [N, quote examples]
  Undefined relative terms: [list]
  Score: PASS | PARTIAL | FAIL
```

---

### B4.3 — Constraint and Boundary Conditions Specified

**Type**: Gradient-quality

**Criterion**: The skill specifies the boundaries of its applicability — what inputs
it can handle and what to do when it encounters an out-of-scope input. Without
boundary conditions, the model will apply the skill to inputs it is not designed for.

**Pass condition**:
- [ ] A "Do NOT use this skill when" section (or equivalent) is present OR the scope
      is so narrowly defined that out-of-scope misuse is implausible.
- [ ] At least one constraint on input type is stated (e.g., "applies to
      `.agents/agents/*.md` files only", "for Goose session transcripts only").
- [ ] Behavior at the boundary is specified (stop, escalate, or redirect).

**Partial condition**:
- Scope implied but not stated as a constraint.
- Constraint present but no behavior specified for out-of-scope inputs.

**Fail condition**:
- No scope constraints and the skill topic is broad enough to be misapplied.
- Constraint contradicts the "When to Load" trigger in the description.

**Evidence template**:
```
B4.3 Constraint and Boundary Conditions
  "Do NOT" section: [yes/no]
  Input type constraints: [quoted]
  Boundary behavior specified: [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### B4 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | All 3 criteria PASS or at most 1 PARTIAL |
| **PARTIAL** | 2 criteria PASS and 1 PARTIAL, OR 1 criterion FAIL |
| **FAIL** | ≥ 2 criteria FAIL |

---

## Section B5 — Context Engineering in Skills

**What this section measures**: Whether the skill itself is designed as a good
context citizen — single-responsibility, correctly co-locating its references,
and not duplicating methodology from other skills.

---

### B5.1 — Single Responsibility

**Type**: Gradient-quality

**Criterion**: The skill covers a single coherent domain. A skill that covers "code
review AND bead management AND recipe authoring" cannot be composed reliably — it will
be loaded for all tasks rather than the specific ones it serves.

**Pass condition**:
- [ ] The skill has a single primary domain (code review, harness evaluation, bead
      management, etc.).
- [ ] All sections of the body support the same primary domain.
- [ ] The skill can be described in one sentence without using "and" to join two
      separate domains.

**Partial condition**:
- Primary domain clear but 1 secondary topic present that could be a separate skill.
- The secondary topic is closely related (e.g., "code review" and "code formatting"
  in the same skill — adjacent but not orthogonal).

**Fail condition**:
- Two or more primary domains in the same skill.
- Skill name matches one domain but body covers a second unrelated domain.

**Evidence template**:
```
B5.1 Single Responsibility
  Primary domain: [stated]
  Secondary topics found: [N, describe]
  Describable in one sentence without "and": [yes/no]
  Score: PASS | PARTIAL | FAIL
```

---

### B5.2 — Support Files Co-located in `references/`

**Type**: Binary-presence (conditional)

**Criterion**: If the skill references external files (checklists, templates, config,
example data), those files exist in `.agents/skills/<name>/references/`. Files
scattered elsewhere are fragile and hard to discover.

**Pass condition**:
- [ ] All external files referenced by the skill are in `.agents/skills/<name>/references/`.
- [ ] All referenced files exist on disk.
- [ ] If no external files are referenced, a `references/` directory is NOT required
      (mark N/A).

**Fail condition**:
- External files referenced but stored outside the skill's `references/` directory.
- Referenced files do not exist on disk (broken reference).

**N/A condition**:
- Skill references no external files. Mark N/A.

**Evidence template**:
```
B5.2 Support Files Co-located
  External file references: [list]
  Each in references/ subdirectory: [yes/no per file]
  All exist on disk: [yes/no]
  Score: PASS | FAIL | N/A
```

---

### B5.3 — Load Next Section (Cross-Skill References)

**Type**: Binary-presence (conditional)

**Criterion**: If the skill's methodology depends on or connects to another skill,
a "Load next" section at the end of the body names those skills and explains when
to load them. Without this, the consumer has no guidance on cross-skill composition.

**Pass condition**:
- [ ] "Load next" (or equivalent: "See also", "Related skills", "Load after") section
      is present.
- [ ] Named skills are real skills in `.agents/skills/`.
- [ ] Each cross-reference includes a reason ("for X, load skill Y").

**Partial condition**:
- Cross-references named but not explained (just a list of skill names).
- "Load next" section missing but the body body references adjacent skills by name
  in context.

**Fail condition**:
- No cross-reference guidance and the skill is known to require companion skills.
- Cross-references point to non-existent skills.

**N/A condition**:
- Skill has no dependency on other skills and is self-contained. Mark N/A.

**Evidence template**:
```
B5.3 Load Next Section
  Section found: [yes/no]
  Named skills: [list]
  All named skills exist on disk: [yes/no]
  Reasons stated: [yes/no]
  Score: PASS | PARTIAL | FAIL | N/A
```

---

### B5.4 — No Methodology Duplicated from Other Skills

**Type**: Gradient-quality

**Criterion**: The skill does not re-implement methodology that belongs to another
skill. Duplication creates two sources of truth that will drift. The canonical
example: an agent spec that contains a bead management procedure duplicated from
`agentic-devlopment`.

**Pass condition**:
- [ ] The skill body does not contain step-by-step methodology that is already
      covered by another skill.
- [ ] Methodology from adjacent skills is referenced by name, not reproduced.
- [ ] If a brief summary of an adjacent skill's methodology is included for
      context, it is labeled as a summary and the full skill is referenced.

**Partial condition**:
- Minor overlap: a summary of another skill's key step included for emphasis.
- Overlap exists but is between skills that are always loaded together (low
  divergence risk in practice).

**Fail condition**:
- Substantial duplication: the same multi-step process appears in this skill AND
  another loaded skill.
- A skill is defined but its entire methodology is already in a loaded sibling skill.

**Evidence template**:
```
B5.4 No Methodology Duplication
  Overlapping skills identified: [list]
  Overlap type: [full restatement / summary / reference only]
  Divergence risk: [high / low]
  Score: PASS | PARTIAL | FAIL
```

---

### B5 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | ≥ 3 non-N/A criteria PASS; B5.4 must not FAIL |
| **PARTIAL** | 2 non-N/A criteria PASS, OR B5.4 scores PARTIAL |
| **FAIL** | B5.4 FAIL (duplication is active), OR < 2 non-N/A criteria PASS |

---

## Section B6 — Loop Engineering in Skills

**What this section measures**: If the skill describes an iterative or looping process,
whether that process is bounded, has a circuit breaker, and recovers from per-step
failures. (Same criteria as A3; applied here at the skill level.)

---

### B6.1 — Termination Condition (if loop present)

**Type**: Binary-presence (conditional)

**Criterion**: Same as A3.1, applied to the skill body. If the skill describes
a loop ("repeat until", "for each X", "iterate over"), the termination condition is
stated explicitly.

**Pass condition**:
- [ ] Termination stated in observable terms.
- [ ] Condition is reachable (not "until perfect").

**Fail condition**:
- Loop described with no termination condition.
- "Until done" or equivalent.

**N/A condition**:
- Skill describes no iterative process. Mark N/A (expected for most skills).

**Evidence template**:
```
B6.1 Termination Condition
  Loop found: [yes/no, describe]
  Termination condition: [quoted]
  Score: PASS | FAIL | N/A
```

---

### B6.2 — Circuit Breaker for Iterative Steps

**Type**: Binary-presence (conditional)

**Criterion**: If the skill describes a loop, a maximum iteration count is specified.

**Pass condition**:
- [ ] Max count stated and escalation defined.

**Fail condition**:
- Loop present, no max count.

**N/A condition**:
- No loop in skill. Mark N/A.

**Evidence template**:
```
B6.2 Circuit Breaker
  Max count stated: [N or "none"]
  Escalation at max: [yes/no]
  Score: PASS | FAIL | N/A
```

---

### B6 Section Rubric

| Score | Condition |
|-------|-----------|
| **PASS** | Both B6.1 and B6.2 PASS (if applicable) |
| **FAIL** | Either criterion FAIL when loop is present |
| **N/A** | Both criteria N/A (no loop in skill) |

---

## Domain B Aggregate Rubric

After scoring all six sections (B1–B6):

| Section | Weight | Notes |
|---------|--------|-------|
| B1 — Structural Well-formedness | Hard gate | Must PASS; if FAIL, stop here |
| B2 — Description Quality | 20% | |
| B3 — Methodology Quality | 35% | Highest weight — this is the skill's primary value |
| B4 — Prompt Engineering | 20% | |
| B5 — Context Engineering | 15% | |
| B6 — Loop Engineering | 10% | Or 0% if all N/A |

**Domain B Score** = weighted average of B2–B6 section scores (B1 is a gate, not
weighted).

**Domain B Verdict**:

| Condition | Verdict |
|-----------|---------|
| B1 FAIL | **FAIL** — stop; structural fix required before any content scoring |
| B1 PASS + weighted average ≥ 0.80 | **PASS** |
| B1 PASS + weighted average 0.50–0.79 | **PARTIAL** |
| B1 PASS + weighted average < 0.50 | **FAIL** |

**Additional hard gates** (force FAIL regardless of weighted average):
- B3.1 (imperative voice) scores FAIL → at most PARTIAL.
- B5.4 (no duplication) scores FAIL → at most PARTIAL.
- B6.1 (termination condition) scores FAIL when a loop is present → at most PARTIAL.

---

## Evidence Templates — File Paths to Check

When auditing a specific skill, use these paths and commands:

```bash
# 1. Verify skill location and file name
ls .agents/skills/<name>/SKILL.md

# 2. Inspect frontmatter
head -20 .agents/skills/<name>/SKILL.md

# 3. Count body lines (after frontmatter)
awk '/^---$/{c++; if(c==2){p=1; next}} p{print}' .agents/skills/<name>/SKILL.md | wc -l

# 4. Check for imperative verbs (sample)
grep -E '^(Do|Run|Emit|Write|Load|Check|Flag|Claim|Validate|Call|Produce|List|Score|Compute|Verify|Record)' \
  .agents/skills/<name>/SKILL.md | head -20

# 5. Check for hedged language
grep -E '(you should|you can|try to|it is recommended|consider|you may)' \
  .agents/skills/<name>/SKILL.md

# 6. Verify references/ exists and files are real
ls .agents/skills/<name>/references/ 2>/dev/null || echo "No references/ directory"

# 7. Check for backtick formatting of key literals
grep -E '`[^`]+`' .agents/skills/<name>/SKILL.md | wc -l

# 8. Verify skill is registered
goose skills list | grep '<name>'

# 9. Check for gotchas section
grep -i 'gotcha\|pitfall\|common mistake\|false positive' .agents/skills/<name>/SKILL.md

# 10. Check name matches directory
python3 -c "
import yaml, sys
with open('.agents/skills/<name>/SKILL.md') as f:
    content = f.read()
parts = content.split('---', 2)
fm = yaml.safe_load(parts[1])
print('name:', fm.get('name'))
print('version:', fm.get('metadata', {}).get('version'))
"
```

**What to quote** in your evidence:
- The full `description:` value (for B2 criteria).
- The first 5 body steps (for B3.1 imperative voice).
- One example from the gotchas section (for B3.4).
- Any "Load next" entry (for B5.3).
- Any loop termination condition (for B6.1).

---

## Calibration Anchors — PASS / PARTIAL / FAIL Skill Examples

These anchors ground the scoring scale. Read before your first skill evaluation.

---

### Anchor 1 — Domain B PASS: `harness-judge` skill

**Why it passes**:
- B1: Located at `.agents/skills/harness-judge/SKILL.md` ✓; valid frontmatter ✓;
  `name: harness-judge` matches directory ✓; `metadata.version: 1.0.0` ✓.
- B2: Description starts with "Load before any evaluation session" (trigger explicit);
  three sentences; no vague phrases; distinguishes from `code-review` by naming
  "agentic sessions" specifically; lists "scoring rubrics", "calibration anchors",
  "bias catalog" as deliverables.
- B3: Imperative voice throughout ("Score each criterion individually",
  "Run this checklist mentally", "Flag any item that requires inference"); numbered
  process steps; code block calibration anchors; Gotchas in Section 10 with 6 entries;
  backtick-formatted verbatim strings (`Scoped plan:`, `## Handoff`, `bd prime`);
  "Load next" section.
- B4: Body is behavioral specification; steps are unambiguous (binary-verbatim vs.
  gradient-quality taxonomy explains exactly when each scoring rule applies);
  domain constrained to Goose agentic sessions.
- B5: Single domain (LLM-as-Judge methodology); references/ subdirectory for domain
  checklists; Load next section naming adjacent skills; no duplication from
  `code-review` (different evaluation target).
- B6: Evaluation loop described with termination (score all criteria first, THEN
  aggregate); chain-of-thought-first rule acts as circuit breaker.

**Verdict**: PASS — all sections ≥ PASS; weighted average > 0.90.

---

### Anchor 2 — Domain B PARTIAL: Hypothetical `deploy-helper` skill

**File contents** (illustrative):
```markdown
---
name: deploy-helper
description: Helps with deployments.
metadata:
  version: 1.0.0
---

# Deploy Helper

This skill provides guidance on deploying applications.

You should check that the build passes before deploying.
You can also run smoke tests after deployment.
It is recommended to back up the database before the deployment.

Common steps:
- Build the application
- Run tests
- Deploy
- Verify

See also: devops-practices.
```

**Why it is PARTIAL**:
- B1: PASS (structure correct, name matches).
- B2: PARTIAL — description "Helps with deployments" is vague (fails B2.1 and B2.3);
  no loading trigger; no deliverable named.
- B3: FAIL — "you should", "you can", "it is recommended" throughout (B3.1 FAIL);
  no numbered steps for an ordered process (B3.2 FAIL); no concrete example (B3.3);
  no gotchas section (B3.4); no backtick-formatted commands (B3.5).
- B4: PARTIAL — content is instructional but hedged; steps are ambiguous ("Deploy"
  with no target or method).
- B5: PARTIAL — scope is single domain; no references/; cross-reference to
  "devops-practices" which may not exist.
- B6: N/A — no loop described.

**Verdict**: PARTIAL — B3 fails hard gate (B3.1 FAIL), capping at PARTIAL.
B2 description is insufficient. Needs rewrite of methodology in imperative voice and
description improvement.

---

### Anchor 3 — Domain B FAIL: Hypothetical `general-agent` skill

**File contents** (illustrative):
```markdown
---
name: general-agent
description: >
  A general purpose skill for agentic development. Use when needed. Provides
  guidance on various tasks including code review, deployment, documentation,
  testing, and more.
metadata:
  version: 0.0.0
---

# General Agent

This skill describes the general principles of agentic development. Agents should
be helpful, accurate, and safe. Good agents follow best practices. Agents can use
tools when needed.

For code review, see the code-review skill.
For deployment, see the deploy skill.
For documentation, use good writing practices.
```

**Why it fails**:
- B1: PARTIAL on `metadata.version: 0.0.0` (placeholder); otherwise structural PASS.
  Treat as PASS for gate purposes.
- B2: FAIL — "Use when needed" and "various tasks" (B2.3 FAIL); no loading trigger
  (B2.1 FAIL); description contradicts "single responsibility" — lists 5 domains;
  no deliverable named (B2.5 FAIL).
- B3: FAIL — passive and hedged voice throughout ("Agents should be", "Agents can");
  no numbered steps; no examples; no gotchas; no backtick formatting; no
  self-validation.
- B4: FAIL — content is generic commentary, not LLM instructions (B4.1 FAIL);
  steps are completely ambiguous (B4.2 FAIL); no constraints (B4.3 FAIL).
- B5: FAIL — multiple domains (code review + deployment + docs + testing); cross-
  references to skills that may or may not exist (B5.2); methodology duplicated
  by just naming other skills without content (B5.4 edge case).
- B6: N/A.

**Verdict**: FAIL — B3.1 FAIL (hard gate), B4.1 FAIL, B2.1 FAIL. Weighted average
well below 0.50. The skill body does not change LLM behavior in any specific way.
Requires complete rewrite with a narrowed scope.

---

## Domain B Score Card Template

Use this template when writing your evaluation report for a skill file.

```
## Domain B Score Card — <skill-name>

**File**: .agents/skills/<name>/SKILL.md
**Date**: [YYYY-MM-DD]
**Judge**: [model / version]

### B1 — Structural Well-formedness
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B1.1 File Location | PASS/FAIL | [path confirmed] |
| B1.2 YAML Frontmatter | PASS/FAIL | [line ref] |
| B1.3 name field | PASS/FAIL | [value] |
| B1.4 description + version | PASS/FAIL | [values] |
| B1.5 Name matches dir | PASS/FAIL | [match confirmed] |
| B1.6 Body non-empty | PASS/FAIL | [line count] |
| **Section B1** | **PASS/FAIL** | |

> If B1 FAIL: stop here and file structural fix before proceeding.

### B2 — Description Quality
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B2.1 When to Load | | |
| B2.2 Brevity | | |
| B2.3 No Vague Phrases | | |
| B2.4 Distinguishes Adjacent | | |
| B2.5 Lists Deliverables | | |
| **Section B2** | | |

### B3 — Methodology Quality
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B3.1 Imperative Voice | | |
| B3.2 Numbered Steps | | |
| B3.3 Concrete Examples | | |
| B3.4 Gotchas Section | | |
| B3.5 Literal Strings | | |
| B3.6 Self-Validation | | |
| B3.7 External Verification | | |
| **Section B3** | | |

### B4 — Prompt Engineering
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B4.1 Instructional for LLMs | | |
| B4.2 Unambiguous Steps | | |
| B4.3 Constraints Specified | | |
| **Section B4** | | |

### B5 — Context Engineering
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B5.1 Single Responsibility | | |
| B5.2 References Co-located | | |
| B5.3 Load Next Section | | |
| B5.4 No Duplication | | |
| **Section B5** | | |

### B6 — Loop Engineering
| Criterion | Score | Evidence |
|-----------|-------|----------|
| B6.1 Termination Condition | | |
| B6.2 Circuit Breaker | | |
| **Section B6** | | |

### Domain B Aggregate
| Section | Weight | Score | Weighted |
|---------|--------|-------|---------|
| B2 Description | 20% | | |
| B3 Methodology | 35% | | |
| B4 Prompt Eng. | 20% | | |
| B5 Context Eng. | 15% | | |
| B6 Loop Eng. | 10% | | |
| **Total** | 100% | | **[weighted avg]** |

**Hard gates triggered**: [none / list]
**Domain B Verdict**: **PASS / PARTIAL / FAIL**
**Summary**: [2–3 sentences: what works, what needs fixing, priority]
```

---

## Cross-References

| Topic | Where to look |
|-------|---------------|
| Skill frontmatter schema | `.agents/skills/*/SKILL.md` examples |
| Skill registration in runtime | `goose skills list` |
| Adding a new skill (full CRUD) | `AGENTS.md` → "Skill added or removed" |
| Eval scenarios for skills | `evals/skills/<name>.json` |
| Domain A (Prompt/Context/Loop engineering for agents/recipes) | `.agents/skills/harness-judge/references/domain-a-prompt-context-loop.md` |
| Harness judge scoring aggregation | `harness-judge` SKILL.md → Section 9 |
| Consistency check after skill changes | `python3 scripts/check-consistency.py` |
| KG pipeline after structural changes | `node apps/kg/dist/cli.js pipeline` |
| Table regeneration | `python3 scripts/generate-tables.py` |
