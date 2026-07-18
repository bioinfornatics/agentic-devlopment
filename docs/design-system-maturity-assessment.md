# Design System Maturity Assessment — Harness UI

> Assessment date: 2026-07-18  
> Scope: docs site (`docs/assets/site.css`) + eval report (`dist/evals/report/index.html`)  
> Extended scope: `eval_review.html` + `viewer.html` (skill-creator tools)  
> Method: W3C design token specification + six-level maturity model (Nathan Curtis)

---

## Executive Summary

| Dimension | Finding |
|---|---|
| **Current level** | **L1 (docs site) / L0 (eval report) → system composite: L0–L1** |
| **Blocker to L2** | No shared token substrate across surfaces; components do not exist as abstractions |
| **Highest-urgency fix** | Unify the 4 surfaces under one CSS var layer; purge 97 inline hex values from eval report |
| **Governance gap** | No decision log, no semver, no contribution process, no deprecation policy |

---

## 1. Surfaces Inventoried

Four HTML/CSS surfaces were found. None share a common token layer.

| Surface | File | Token approach | Accent color | Font stack |
|---|---|---|---|---|
| **Docs site** | `docs/assets/site.css` | CSS custom props in `:root` | `#4f46e5` (indigo) | Inter / system-ui |
| **Eval report** | `dist/evals/report/index.html` | All inline `style=''` attrs | `#22c55e` / `#ef4444` (raw) | (browser default) |
| **Eval viewer** | `.agents/skills/skill-creator/eval-viewer/viewer.html` | Own `:root` block | `#d97757` (orange) | Lora / Poppins |
| **Eval review** | `.agents/skills/skill-creator/assets/eval_review.html` | All hardcoded, no vars | `#6a9bcc` (blue) | Lora / Poppins |

**Three incompatible colour palettes exist simultaneously.** The four surfaces have never shared a design token.

---

## 2. Token Architecture Analysis

The skill's three-layer W3C model requires:

```
Primitive tokens  →  Semantic tokens  →  Component tokens
(raw values)         (intent aliases)     (component overrides)
```

### Layer 1 — Primitive tokens
**Status: ABSENT**

No primitive token layer exists anywhere in the codebase. Values like `#4f46e5` appear directly as semantic definitions inside `:root`. There is no palette file, no `color.indigo.600` reference, no mapping from abstract scale to concrete value.

### Layer 2 — Semantic tokens
**Status: PARTIAL (docs site only)**

`site.css` defines 13 semantic-adjacent CSS custom properties:

```css
--bg, --surface, --surface-muted   /* surface hierarchy */
--text, --muted                    /* text roles */
--border                           /* border */
--accent, --accent-strong,         /* action colour family */
--accent-soft
--code-bg, --code-text             /* code block pair */
--shadow, --radius, --content-width /* layout */
```

**This is genuinely good naming** — it expresses intent, not raw values. Dark mode is implemented by re-assigning these vars in `@media (prefers-color-scheme: dark)`, which is a correct semantic-layer swap.

However, **29 var() references co-exist with 32 hardcoded hex values** inside the same stylesheet. Rules like:

```css
h1.title { color: #0f172a; }           /* should be var(--text) */
p, li, dd { color: #263449; }          /* undocumented "body text" colour */
strong { color: #101828; }             /* undocumented "emphasis" colour */
blockquote { color: #312e81; }         /* duplicates var(--accent-strong) value */
```

These hardcoded values defeat the dark-mode system (they do not flip) and introduce a "shadow palette" of 5–6 undeclared blue-grey values that are not exposed as tokens. Dark mode also defines overrides for these independently.

**Eval report, eval viewer, eval review: 0 semantic tokens consumed.** The eval report alone has **97 inline hex colour assignments**.

### Layer 3 — Component tokens
**Status: ABSENT**

No component-scoped custom properties exist (e.g., `--badge-bg-positive`, `--card-border`). Styling is applied via element-level rules or inline `style` attributes. There is no way to change a component's appearance without touching the rule directly.

---

## 3. Evaluation Checklist Scores

| Criterion | Score | Evidence |
|---|---|---|
| Tokens follow 3-layer architecture | ❌ FAIL | Only a partial semantic layer in one surface; no primitives, no component tokens |
| No hardcoded values in components | ❌ FAIL | 32 hex values in `site.css`; 97 inline hex values in eval report |
| Theming works by swapping semantic layer only | ⚠️ PARTIAL | Dark mode works for the 13 defined vars in `site.css`; silently breaks for the 32 hardcoded values; 0 support in other surfaces |
| Every component has documented API and usage examples | ❌ FAIL | No component abstraction exists to document |
| Breaking changes follow semver and deprecation policy | ❌ FAIL | No versioning scheme; no deprecation policy |
| Governance process documented and followed | ❌ FAIL | No governance artefacts exist |

**Score: 0/6 PASS, 1/6 PARTIAL, 5/6 FAIL**

---

## 4. Maturity Level Mapping

### Level-by-level assessment

| Level | Criteria | Status |
|---|---|---|
| **L0 — Fragmented** | Each surface builds its own; inconsistent | ✅ **Confirmed** — 4 surfaces, 3 palettes, 0 shared layer |
| **L1 — Style guide** | Shared colours and typography; no components | ⚠️ **Docs site only** — CSS vars form a proto-style-guide; not shared |
| **L2 — Component library** | Shared components; manual tokens | ❌ **Not reached** — no component abstractions exist |
| **L3 — Design tokens** | Token-first; design and code in sync | ❌ **Not reached** — no 3-layer token architecture |
| **L4 — Multi-brand** | One system, multiple brand expressions | ❌ Not applicable |
| **L5 — Self-service** | Product teams extend; governance automated | ❌ Not applicable |

### Verdict

> **Current maturity: L1 (docs site) / L0 (system-wide composite)**

The docs site has independently evolved to L1 — a proto-style-guide with intent-named CSS variables and a working dark-mode swap. This is the system's high-water mark. Every other surface is at L0: fragmented, inconsistent, and invisible to one another.

The system cannot be considered L1 at the composite level because the style guide is not shared — it serves exactly one surface and is actively contradicted by the other three.

---

## 5. Blockers to L2 (Component Library)

To reach L2, the harness UI needs: shared components with manual tokens. The following are the concrete blockers, ordered by severity.

### Blocker 1 — No shared token file (CRITICAL)
**Impact:** Every surface is its own island.  
The token layer lives inside `site.css` as a side-effect of CSS scoping. There is no source-of-truth token file (JSON, YAML, or equivalent) from which all surfaces could consume a common palette. Until a single token source exists, any component built on top of it will immediately fragment into surface-local copies.

**Fix:** Extract `:root` vars from `site.css` into a standalone `tokens.css` (or `tokens.json` consumed by Style Dictionary). All surfaces import this file.

### Blocker 2 — 32 hardcoded values defeating the semantic layer (HIGH)
**Impact:** Dark mode silently breaks for ~30% of colour rules; token adoption signal is misleading.  
The 5 undeclared blue-grey values (`#0f172a`, `#263449`, `#101828`, `#312e81`, `#172033`) represent an undocumented sub-palette. They must be named and promoted to tokens.

Missing semantic slots to define:
```css
--text-heading     /* #0f172a / #f8fafc dark */
--text-body        /* #263449 / #d4d9e3 dark */
--text-strong      /* #101828 / #f8fafc dark */
--text-accent-dark /* #312e81 / #c7d2fe dark */
```

### Blocker 3 — 97 inline hex values in eval report (HIGH)
**Impact:** The most visible output of the system (daily eval dashboard) is completely outside the design system.  
The eval report generator inlines colour decisions directly in HTML string concatenation. These are not configuration — they are hardcoded presentation logic. Moving them to CSS classes (`.badge-pos`, `.badge-neg`, `.bar-high`) that reference tokens would bring the report into the system.

### Blocker 4 — No component abstraction layer (HIGH)
**Impact:** "Component library" requires components to exist as reusable units.  
Current UI is flat element-level CSS. `.card`, `.badge`, `.spark`, `.bar` exist as class names in the eval report HTML but are not defined in any stylesheet — they are selector targets in inline `<style>` blocks inside the generated HTML. There is no component that can be imported or composed.

**Minimum viable L2 components to create:**
- `Badge` (pos / neg / neu / saturation variants) — used 300+ times in eval report
- `Card` (metric card with title, badge, sparkline) — 13 instances in report
- `Sparkline` (bar chart component) — inside each Card
- `DataTable` (shared between docs and report)

### Blocker 5 — Incompatible type stacks across surfaces (MEDIUM)
**Impact:** Brand inconsistency; each tool feels like a different product.  
- Docs site: Inter (geometric sans), system-ui fallback
- Eval viewer + review: Poppins (headings) + Lora (body) — a serif/sans pairing loaded from Google Fonts
- Eval report: browser default (no font declaration)

A single type scale decision needs to be made and tokenised.

### Blocker 6 — No primitive token layer prevents systematic theming (MEDIUM)
**Impact:** Cannot derive the semantic layer from an auditable scale.  
The colour `#4f46e5` (indigo-600 in Tailwind's scale) appears directly as the semantic token value. If the brand colour changes, every semantic token that resolves to it must be manually updated. A primitive layer (`--color-indigo-600: #4f46e5`) makes the derivation auditable and machine-processable.

---

## 6. Proposed Governance Model

Given the harness is a single-team internal tooling project (not a federated product platform), governance should be **lightweight but explicit**. The goal is L2 → L3 progression with minimal ceremony.

### 6.1 Ownership

| Role | Responsibility |
|---|---|
| **Token steward** (1 person) | Owns `tokens.css`; approves all token additions/changes; maintains decision log |
| **Surface maintainer** (per surface) | Keeps their surface in sync with token updates; flags drift |
| **Contributor** (any team member) | May propose new tokens via the contribution process |

### 6.2 Token Decision Log

Every token addition or change is recorded in `docs/design/token-decisions.md` with:

```markdown
## [DATE] — Added --text-heading token
**Problem:** `#0f172a` appears 4× hardcoded; dark mode doesn't flip it.
**Decision:** New semantic token `--text-heading` resolving to `#0f172a` (light) / `#f8fafc` (dark).
**Alternatives considered:** Map to existing `--text` — rejected because heading weight differs from body.
**Migration:** Replace 4 occurrences in `site.css`. Update `eval_review.html`.
```

### 6.3 Versioning

The token file (`tokens.css`) follows **semver**:
- **PATCH:** New tokens added (backwards-compatible; no surface changes required)
- **MINOR:** Semantic token value changed (surfaces must verify visual regressions)
- **MAJOR:** Token renamed or removed (surfaces MUST update; 2-version deprecation notice)

Deprecation notice format:
```css
/* @deprecated since 2.0.0 — use --text-heading instead. Remove in 4.0.0. */
--text-dark: var(--text-heading);
```

### 6.4 Contribution Process

```
1. PROPOSE   → Open a Beads issue: "DS: add token --<name> for <intent>"
2. REVIEW    → Token steward reviews: does the token express intent or value?
               Is it already covered by an existing token?
3. MERGE     → Token added to tokens.css with a decision log entry
4. PROPAGATE → All surfaces updated before the PR closes
5. RELEASE   → Patch/minor/major bump as appropriate
```

**Rule:** No hardcoded colour value may be introduced in any surface without a corresponding token definition. Enforced by a lint step (grep for raw hex outside `tokens.css`).

### 6.5 Immediate Action Plan (Road to L2)

**Sprint 1 — Unified token substrate**
1. Create `docs/design/tokens.css` with the 13 existing vars + 4 missing semantic slots (see Blocker 2)
2. Add a primitive layer: `--color-indigo-600: #4f46e5` etc.
3. Update `site.css` to import `tokens.css` and remove all 32 hardcoded hex values
4. Establish lint rule: `grep -rE '#[0-9a-fA-F]{3,6}' docs/ dist/ --include="*.css"` fails CI if outside `tokens.css`

**Sprint 2 — Eval report migration**
5. Create `dist/evals/report/report.css` that imports `tokens.css`
6. Replace 97 inline `style=` values in the report generator with class names (`.badge-pos`, `.badge-neg`, `.bar-high`, `.bar-low`, `.card-metric`)
7. Define those classes in `report.css` using tokens

**Sprint 3 — Align skill-creator tools**
8. Replace `eval_review.html` and `viewer.html` colour systems with `tokens.css` import
9. Resolve font-stack conflict: pick Inter (docs site) or Poppins/Lora (skill tools) — document in decision log

**Sprint 4 — Component extraction (L2 gate)**
10. Extract `Badge`, `Card`, `Sparkline`, `DataTable` as documented CSS component classes with API comments
11. Write `docs/design/components.md` with usage examples for each component
12. Tag `v2.0.0` of the design system

---

## 7. Beads Follow-Ups

```bash
bd create "DS: extract tokens.css — unified primitive + semantic layer" --assignee ui-designer -p 2
bd create "DS: purge 97 inline hex values from eval report generator" --assignee dev -p 2
bd create "DS: align eval-viewer and eval-review to shared token layer" --assignee dev -p 3
bd create "DS: define Badge, Card, Sparkline, DataTable as documented component classes" --assignee ui-designer -p 3
bd create "DS: add CI lint rule blocking raw hex outside tokens.css" --assignee dev -p 2
bd create "DS: document token decision log — initial entries for existing vars" --assignee ui-designer -p 3
bd create "DS: resolve font stack conflict (Inter vs Poppins/Lora)" --assignee ui-designer -p 3
```

---

## 8. Quick Reference — Token Gap Map

Tokens that should exist but do not:

| Missing token | Current state | Proposed value (light) | Proposed value (dark) |
|---|---|---|---|
| `--text-heading` | `#0f172a` hardcoded ×4 | `#0f172a` | `#f8fafc` |
| `--text-body` | `#263449` hardcoded ×2 | `#263449` | `#d4d9e3` |
| `--text-strong` | `#101828` hardcoded ×1 | `#101828` | `#f8fafc` |
| `--text-accent-dark` | `#312e81` hardcoded ×2 | `#312e81` | `#c7d2fe` |
| `--badge-bg-positive` | `#22c55e` inline in report | `#dcfce7` | — |
| `--badge-text-positive` | implicit white | `white` | — |
| `--badge-bg-negative` | `#ef4444` inline in report | `#fee2e2` | — |
| `--badge-bg-neutral` | `#f59e0b` inline in report | `#fef3c7` | — |
| `--bar-color-positive` | `#22c55e` inline ×N | `#22c55e` | — |
| `--bar-color-negative` | `#ef4444` inline ×N | `#ef4444` | — |
| `--bar-color-neutral` | `#f59e0b` inline ×N | `#f59e0b` | — |
| `--font-sans` | `Inter, ui-sans-serif, …` per surface | `Inter, ui-sans-serif, …` | (same) |
| `--font-mono` | `"JetBrains Mono", …` per surface | `"JetBrains Mono", …` | (same) |

**Total token gap: 13 missing tokens; 4 surfaces without token access.**
