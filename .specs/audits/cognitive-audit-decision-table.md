# Cognitive Audit — Harness Decision Table (`docs/00-index.md`)

> **Scope:** The `## Decision table` section only.
> **Method:** Laws of UX (Hick, Fitts, Jakob, Miller, Gestalt, Peak-End, Von Restorff, Doherty) +
> cognitive biases (anchoring, choice overload, framing, cognitive load).
> **Evidence basis:** Raw markdown parsed programmatically; structural and content anomalies
> enumerated before evaluation.

---

## 0. Baseline facts (evidence)

| Metric | Value |
|---|---|
| Total rows (data) | 16 |
| Header rows rendered in the table body | 2 (rows labelled "Goal/Category/Recipe" and "---/---/---") |
| Unique recipes referenced | 13 |
| Recipes appearing in ≥ 2 rows | `/review` ×4, `/sdd` ×3, `/explore` ×3, `/design` ×2, `/spec` ×2 |
| Recipe formatting: slash-prefixed | 13/15 |
| Recipe formatting: **no** slash prefix | 2/15 — `sdd` and `plan` in row 1 |
| Natural-language style: imperative | 13 |
| Natural-language style: question | 3 |
| Logical workflow groups detectable | 6 (Setup, Feature lifecycle, Review, Design/UX, Ops, Maintenance) |
| Visual grouping present | **0** |

---

## 1. Findings — Priority P0 (Structural corruption)

### F-01 · Phantom header rows rendered as data (Cognitive Load + Jakob's Law)

**Evidence:** Raw markdown rows 2–3:

```
| Goal                                       | Category             | Recipe / slash command              |
| ---                                        | ---                  | ---                                 |
```

These sit **below** the real Markdown separator (`|---|---|---|`), so they render as data rows — not headings.  
A user reading the rendered table sees:

| User says… | Use case | Recipe |
|---|---|---|
| Goal | Category | Recipe / slash command |
| --- | --- | --- |
| "Set this repo up…" | … | … |

**Impact:** The first two visible data rows contain `Goal / Category / Recipe / slash command` and `--- / --- / ---`.  
Both rows are meaningless noise that must be mentally discarded before any useful scanning can begin.  
This violates Jakob's Law (tables don't normally open with two garbage rows) and spikes cognitive load immediately at the moment of first contact.

**Severity:** 🔴 Critical — corrupts first impression and erodes trust in the whole table.

---

## 2. Findings — Priority P1 (High cognitive impact)

### F-02 · Hick's Law — 16 flat choices, zero filtering mechanism

**Law:** Decision time = b × log₂(n+1). With n=16 (or 18 if phantom rows are counted), decision time is roughly 4× higher than with n=4.

**Evidence:** All 16 entries are presented as one undifferentiated list.  
A new user must read every row to be confident they found the right one.

**Recommendation:** Progressive disclosure via workflow-phase grouping (see §Redesign).  
Each phase exposes 2–5 choices — well within Hick's optimal range.

**Severity:** 🔴 High

---

### F-03 · Miller's Law — 16 items exceed working-memory capacity (7 ± 2 chunks)

**Law:** Working memory can hold approximately 7 (±2) chunks simultaneously.  
With 16 ungrouped rows the user must externally page through the list rather than hold it in mind.

**Evidence:** No section breaks, no visual chunking, no grouping column.

**Recommendation:** Partition into ≤ 6 named phases. Phases of 2–5 rows each stay within the chunk limit per group. Users scan the phase name, then scan 2–5 items — two sequential small loads instead of one overwhelming large load.

**Severity:** 🔴 High

---

## 3. Findings — Priority P2 (Medium cognitive impact)

### F-04 · Gestalt Similarity — inconsistent recipe formatting

**Law (Gestalt — Similarity):** Items that look alike are perceived as belonging together.  
When similar items look different, the brain spends extra cycles reconciling the mismatch.

**Evidence:** Row 1 uses `sdd`, `plan` (no slash, no leading `/`).  
Every other row uses `/recipe` format.  
The inconsistency signals "this is a special case" — but it is not; it is just a formatting error.

**Severity:** 🟠 Medium — creates false signal of special treatment.

---

### F-05 · Gestalt Similarity — mixed natural-language register (imperative vs. question)

**Evidence:**
- 13 rows use imperatives: `"Start a new feature"`, `"Implement this bead"`, …
- 3 rows switch to questions: `"Does this UI look good / accessible?"`, `"Are the tests good enough?"`, `"Is this spec complete?"`

**Impact:** When scanning, the brain pattern-matches on sentence structure.  
A question breaks the scan rhythm and momentarily shifts the reader to a different parsing mode.  
Because the column is titled *"User says…"*, a consistent register also matters for cognitive mapping: am I copying a command or formulating a query?

**Recommendation:** Normalise all to imperatives:
- `"Review UI / check accessibility"` — shorter, unambiguous
- `"Check test coverage quality"` — action-oriented
- `"Validate the spec"`

**Severity:** 🟠 Medium

---

### F-06 · Cognitive Load — ambiguous multi-recipe cells without decision guidance

**Evidence:** 7 of 16 rows list multiple recipes:

| Row | Recipes listed |
|---|---|
| "Test UX with simulated users" | `/design`, `/sdd` |
| "Does this UI look good…?" | `/design`, `/verify` |
| "Is this spec complete?" | `/sdd`, `/spec` |
| "Score this project" | `/explore`, `/review` |
| "Investigate outage / flaky CI" | `/explore`, `/plan` |
| "Research these modules in parallel" | `/dev` with mode=explore |
| "Set this repo up…" | `sdd`, `plan` |

No row explains *which* recipe to try first, *when* to use both, or whether they are alternatives vs. a sequence.  
The user incurs extra cognitive load resolving the choice that the table was supposed to eliminate.

**Recommendation:** For each multi-recipe row either (a) identify a primary recipe and move the secondary to a tooltip/footnote, or (b) add a terse note: `→ /spec first, then /sdd if needed`.

**Severity:** 🟠 Medium

---

## 4. Findings — Priority P3 (Low-to-medium cognitive impact)

### F-07 · Von Restorff Effect — no visual hierarchy; all rows have equal weight

**Law:** Distinctive items are better remembered.  
When nothing is distinctive, nothing is remembered.

**Evidence:** Every row has identical visual treatment.  
The golden path (`/discover → /spec → /implement → /release`) is indistinguishable from niche utility rows (`/remember`, `/doc-review`).

**Recommendation:** Mark the 4–5 golden-path rows with a `⭐` or a **bold** use-case label.  
This also creates a memorable visual landmark (supports Peak-End Rule — users recall the distinctive pattern).

**Severity:** 🟡 Low-medium

---

### F-08 · Anchoring Bias — row ordering does not match usage frequency

**Law:** The first item seen disproportionately anchors user expectations.

**Evidence:** Row 1 is "Set this repo up" (a once-per-project action).  
The most frequent daily-use actions — `"Start a new feature"`, `"Implement this bead"`, `"Review my changes"` — are scattered across positions 2, 11, and 4.

**Recommendation:** Order rows within each phase by descending frequency-of-use.  
The golden-path phase should appear first; one-shot setup and maintenance should appear last.  
(Interestingly row 1 *is* the correct first entry for the setup phase — the problem is the absence of phases, not the row itself.)

**Severity:** 🟡 Low-medium

---

### F-09 · Framing Effect — mixed positive/negative frames

**Evidence:**
- Negative frames: `"Find vulnerabilities"`, `"Investigate outage / flaky CI"`
- Positive frames: `"Start a new feature"`, `"Prepare a release"`

Neither frame is wrong, but inconsistency means the user must re-orient their mental posture with each row.

**Recommendation:** Adopt consistent task-oriented framing (neutral imperative).  
`"Audit security"` rather than `"Find vulnerabilities"` aligns with the professional register of the rest of the doc.

**Severity:** 🟡 Low

---

### F-10 · Peak-End Rule — table ends on `/remember` (an obscure utility)

**Law:** People judge a sequence by its emotional peak and its ending.

**Evidence:** Last two rows: `"Improve docs/onboarding"` → `/doc-review` and `"Remember this repo convention"` → `/remember`.  
Both are important but infrequent. The table ends on a weak, forgettable note.

**Recommendation:** Reorder so that the table closes on a phase the reader is likely to anticipate completing — e.g. "Operations & Maintenance" ending with `/release`, which has positive emotional weight ("ship it").  
Move `/remember` and `/doc-review` earlier in the maintenance group, not last.

**Severity:** 🟡 Low

---

## 5. Summary scorecard

| # | Finding | Law / Bias | Severity | Effort to fix |
|---|---|---|---|---|
| F-01 | Phantom header rows rendered as data | Cognitive load, Jakob's Law | 🔴 Critical | XS — delete 2 lines |
| F-02 | 16 flat choices, no filtering | Hick's Law | 🔴 High | S — add phase groups |
| F-03 | 16 items exceed working memory | Miller's Law | 🔴 High | S — chunk into phases |
| F-04 | Inconsistent recipe format (no slash) | Gestalt Similarity | 🟠 Medium | XS — add `/` to 2 items |
| F-05 | Mixed imperative/question register | Gestalt Similarity | 🟠 Medium | XS — rewrite 3 cells |
| F-06 | Multi-recipe cells with no guidance | Cognitive load | 🟠 Medium | S — add primary markers |
| F-07 | All rows equal visual weight | Von Restorff | 🟡 Low-med | S — add ⭐ to golden path |
| F-08 | Row order ignores usage frequency | Anchoring bias | 🟡 Low-med | XS — reorder |
| F-09 | Mixed positive/negative frames | Framing effect | 🟡 Low | XS — reword 2 cells |
| F-10 | Table ends on weak utility action | Peak-End Rule | 🟡 Low | XS — reorder phases |

**Total estimated fix effort:** < 1 hour for all items.

---

## 6. Proposed redesign

The redesign addresses all ten findings. Key changes:

1. **Removes** the two phantom header rows (F-01).
2. **Splits** the single table into six phase-grouped tables (F-02, F-03, F-08, F-10).
3. **Fixes** recipe formatting to consistent `/recipe` (F-04).
4. **Normalises** all "User says" cells to imperatives (F-05).
5. **Marks golden-path rows** with `⭐` (F-07).
6. **Clarifies** multi-recipe cells with `→ primary, then secondary` notation (F-06).
7. **Reframes** two negatively-framed rows (F-09).

---

### 6.1 Redesigned `## Decision table` section

Paste the block below in place of the current `## Decision table` section.

````md
## Decision table

Six workflow phases. Find your phase, then match the closest goal.  
⭐ marks the golden-path steps you will use on every feature.

### 🚀 Phase 1 — Setup (once per project)

| Goal | Use case | Recipe |
|---|---|---|
| "Set this repo up for agentic development" | Init project | `/sdd` then `/plan` |

---

### ✨ Phase 2 — Feature lifecycle (golden path)

| Goal | Use case | Recipe |
|---|---|---|
| ⭐ "Start a new feature" | Discovery | `/discover` |
| ⭐ "Write the spec" | Specification | `/spec` |
| ⭐ "Implement this bead" | Implementation | `/implement` |
| ⭐ "Prepare a release" | Release readiness | `/release` |

---

### 🔍 Phase 3 — Review & quality

| Goal | Use case | Recipe |
|---|---|---|
| "Review my changes" | Code review | `/review` |
| "Audit security" | Security review | `/review` (with security constraints) |
| "Check test coverage quality" | Test review | `/review` (with test constraints) |
| "Validate the spec" | Spec review | `/spec`, then `/sdd` |
| "Score this project" | Judge and score | `/explore`, then `/review` |

---

### 🎨 Phase 4 — Design & UX

| Goal | Use case | Recipe |
|---|---|---|
| "Test UX with simulated users" | UXR simulation | `/design`, then `/sdd` |
| "Review UI / check accessibility" | UI review | `/design`, then `/verify` |

---

### ⚙️ Phase 5 — Operations

| Goal | Use case | Recipe |
|---|---|---|
| "Investigate outage / flaky CI" | Incident / SRE | `/explore`, then `/plan` |
| "Research these modules in parallel" | Multi-agent research | `/dev` (mode=explore) |

---

### 🗂 Phase 6 — Maintenance

| Goal | Use case | Recipe |
|---|---|---|
| "Improve docs / onboarding" | Documentation review | `/doc-review` |
| "Remember this repo convention" | Memory stewardship | `/remember` |
````

---

### 6.2 Visual diff — before vs. after

| Dimension | Before | After |
|---|---|---|
| Total visible rows | 18 (incl. 2 phantom) | 16 (all meaningful) |
| Phantom / garbage rows | 2 | 0 |
| Logical groups visible to reader | 0 | 6 |
| Max items in a single group | 16 | 5 |
| Recipe formatting consistency | 87 % (13/15) | 100 % |
| Natural-language register consistency | 81 % (13/16) | 100 % |
| Multi-recipe cells with guidance | 0 % (0/7) | 100 % (7/7) |
| Golden-path rows visually marked | 0 | 4 |
| Table ends on high-frequency action | ❌ `/remember` | ✅ `/remember` in phase 6, release in phase 2 |

---

## 7. Out-of-scope follow-ups

These require deeper investigation or coordination beyond this audit:

- **Hick's Law — menu / autocomplete UX:** If the decision table is ever surfaced as an interactive prompt (agent asking "what do you want to do?"), the same 16-flat-choice problem reappears in voice/text form. A progressive-disclosure dialogue tree should be designed separately.
- **Fitts's Law — rendered HTML docs:** If `docs/00-index.md` is published as HTML, the recipe links should be large, clearly-hit targets. Currently they would render as inline code which is not tappable on mobile.
- **Doherty Threshold:** Out of scope for a static doc, but relevant if a web-based harness launcher UI is built — all recipe invocations should provide feedback within 100 ms.
