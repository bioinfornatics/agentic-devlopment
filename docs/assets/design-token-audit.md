# Design Token Architecture Audit — `docs/assets/site.css`

**Standard:** W3C Design Tokens Community Group (DTCG) three-tier model  
**File audited:** `docs/assets/site.css`  
**Date:** 2026-07-18

---

## Executive Summary

The stylesheet defines **14 custom properties** in `:root` that attempt a semantic-token layer, and it correctly uses `@media (prefers-color-scheme: dark)` overrides for theming. However, it **skips Tier 1 (primitives) entirely**, leaves **19 hardcoded color values** scattered through rules, misclassifies two component tokens as semantic globals, and has an incomplete dark-mode coverage gap. The table below gives the quick scorecard.

| Criterion | Status |
|---|---|
| Tier 1 – Primitive tokens defined | ❌ None present |
| Tier 2 – Semantic tokens reference primitives | ❌ Raw hex values embedded directly |
| Tier 3 – Component tokens isolated | ⚠️ 2 of 14 tokens are component-level; ~8 more needed |
| Hardcoded values in rules (non-token) | ❌ 19 color values, no spacing tokens |
| Token naming convention | ⚠️ Inconsistent, no namespace prefixes |
| Dark-mode token completeness | ❌ 5 colours overridden only in rules, not via tokens |
| Composite-value token anti-pattern | ⚠️ `--shadow` embeds a raw colour |

---

## Three-Tier Architecture Overview

```
Tier 1 – Primitives          Tier 2 – Semantic           Tier 3 – Component
─────────────────────        ─────────────────────        ─────────────────────
--color-indigo-600:          --color-accent:              --toc-bg:
  #4f46e5                      var(--color-indigo-600)      var(--color-surface)

--space-4: 1rem              --space-body-padding:        --code-block-padding:
                               var(--space-4)               var(--space-4)
```

The file currently has **only Tier 2**, and only partially — Tier 2 tokens point at raw values instead of Tier 1 names.

---

## Tier 1 — Primitive Tokens (Raw Primitives)

> **Definition:** Named, scale-based, context-free values. Nothing in this tier "means" anything about UI intent. These are the dictionary every other tier references.

### ❌ Finding: Primitive Tier Is Entirely Absent

All 14 `:root` variables embed raw hex/value literals. There is no palette of named primitives. Every semantic token is therefore "floating" — changing the accent colour requires hunting for every place `#4f46e5` appears instead of touching one primitive.

### Values That Should Become Primitive Tokens

#### Colour Palette

| Value in File | Appears | Suggested Primitive Name |
|---|---|---|
| `#4f46e5` / `rgb(79 70 229 /…)` | 9× (inline + `:root`) | `--color-indigo-600` |
| `#3730a3` | 1× | `--color-indigo-800` |
| `#312e81` | 2× (hardcoded in rules) | `--color-indigo-900` |
| `#eef2ff` | 1× | `--color-indigo-50` |
| `#0f172a` | 3× (hardcoded in rules) | `--color-slate-950` |
| `#172033` | 1× | `--color-slate-900` |
| `#263449` | 1× (hardcoded in rule) | `--color-slate-800` |
| `#101828` | 2× (hardcoded + `:root`) | `--color-slate-950-alt` |
| `#667085` | 1× | `--color-slate-500` |
| `#d9e2ec` | 1× | `--color-slate-200` |
| `#f0f4f8` | 1× | `--color-slate-100` |
| `#f6f8fb` | 1× | `--color-slate-50` |
| `#ffffff` | 2× (`:root` + html gradient) | `--color-white` |
| `#ecfdf5` | 1× | `--color-emerald-50` |
| `#101828` | 1× | `--color-gray-950` |

**Alpha-channel primitives** (five distinct opacities of the accent appear inline):

| Value | Suggested Primitive |
|---|---|
| `rgb(79 70 229 / 0.10)` | `--color-indigo-600-alpha-10` |
| `rgb(79 70 229 / 0.14)` | `--color-indigo-600-alpha-14` |
| `rgb(79 70 229 / 0.18)` | `--color-indigo-600-alpha-18` |
| `rgb(79 70 229 / 0.22)` | `--color-indigo-600-alpha-22` |
| `rgb(15 23 42 / 0.06)`  | `--color-slate-950-alpha-06`  |
| `rgb(15 23 42 / 0.10)`  | `--color-slate-950-alpha-10`  |
| `rgb(255 255 255 / 0.12)` | `--color-white-alpha-12`    |
| `rgb(255 255 255 / 0.72)` | `--color-white-alpha-72`    |
| `rgb(255 255 255 / 0.86)` | `--color-white-alpha-86`    |

#### Spacing Scale

No spacing primitives are defined. Every margin, padding, and gap is a raw literal. Suggested scale:

```css
--space-1:  0.25rem;
--space-2:  0.5rem;
--space-3:  0.75rem;
--space-4:  1rem;
--space-5:  1.25rem;
--space-6:  1.5rem;
--space-8:  2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
```

#### Shape / Radius Scale

```css
--radius-sm:   0.45rem;   /* inline code */
--radius-pill: 999px;     /* badge */
--radius-lg:   18px;      /* current --radius */
```

#### Typography Scale

```css
--font-weight-bold:  700;
--font-weight-black: 750;   /* th */
--font-size-xs:  0.8rem;
--font-size-sm:  0.88em;
--font-size-base: 1rem;
--font-size-lg:  1.25rem;
--line-height-tight:  0.92;
--line-height-snug:   1.2;
--line-height-relaxed: 1.75;
--letter-spacing-tight: -0.075em;
--letter-spacing-normal: -0.025em;
--letter-spacing-wide:   0.08em;
```

---

## Tier 2 — Semantic Tokens

> **Definition:** Reference primitives; convey UI intent (background, heading, danger, etc.). Dark-mode theming happens here by overriding these in a `[data-theme]` attribute or `@media` block.

### ⚠️ Finding: Correct Names, Wrong Values

The 14 `:root` variables have semantically appropriate names but embed raw hex codes instead of referencing primitives. Example:

```css
/* ❌ Current — bypasses primitive tier */
--accent: #4f46e5;

/* ✅ Correct */
--accent: var(--color-indigo-600);
```

### Current Tokens — Tier Classification

| Token | Current Value | Tier | Fix |
|---|---|---|---|
| `--bg` | `#f6f8fb` | ✅ Semantic | Point to `var(--color-slate-50)` |
| `--surface` | `#ffffff` | ✅ Semantic | Point to `var(--color-white)` |
| `--surface-muted` | `#f0f4f8` | ✅ Semantic | Point to `var(--color-slate-100)` |
| `--text` | `#172033` | ✅ Semantic | Point to `var(--color-slate-900)` |
| `--muted` | `#667085` | ✅ Semantic | Point to `var(--color-slate-500)` |
| `--border` | `#d9e2ec` | ✅ Semantic | Point to `var(--color-slate-200)` |
| `--accent` | `#4f46e5` | ✅ Semantic | Point to `var(--color-indigo-600)` |
| `--accent-strong` | `#3730a3` | ✅ Semantic | Point to `var(--color-indigo-800)` |
| `--accent-soft` | `#eef2ff` | ✅ Semantic | Point to `var(--color-indigo-50)` |
| `--shadow` | `0 18px 45px rgb(…)` | ⚠️ Composite anti-pattern | See §Shadow below |
| `--radius` | `18px` | ✅ Semantic (shape) | Point to `var(--radius-lg)` |
| `--content-width` | `78rem` | ⚠️ Layout, not semantic | Move to Tier 3 / layout group |
| `--code-bg` | `#101828` | ❌ Component | Move to Tier 3 |
| `--code-text` | `#ecfdf5` | ❌ Component | Move to Tier 3 |

### ❌ Finding: 8 Missing Semantic Tokens

These colour concepts appear repeatedly as hardcoded literals in rules but have no token:

| Hardcoded value | Used for | Missing Semantic Token |
|---|---|---|
| `#0f172a` (×3) | `h1–h4` colour, `th` colour | `--color-heading` |
| `#263449` | `p`, `li`, `dd` body text | `--color-body` |
| `#101828` | `strong` text | `--color-strong` |
| `#312e81` (×2) | `blockquote` text, inline `code` text | `--color-accent-text` |
| `rgb(79 70 229 / 0.22)` | `body::before` badge border | `--accent-border` |
| `rgb(79 70 229 / 0.14)` | inline `code` border | `--accent-border-soft` |
| `rgb(255 255 255 / 0.72)` | badge background | `--surface-glass` |
| `rgb(255 255 255 / 0.86)` | `#TOC` background | `--surface-overlay` |
| `rgb(255 255 255 / 0.12)` | `pre` border (dark) | `--border-subtle` |
| `rgb(15 23 42 / 0.06)` | `table` box-shadow | `--shadow-sm` |

### ⚠️ Finding: Composite-Value Token Anti-Pattern (`--shadow`)

```css
--shadow: 0 18px 45px rgb(15 23 42 / 0.10);
```

This composites geometry _and_ colour into one token. Tooling (Figma, Style Dictionary) cannot extract the colour channel for dark-mode swaps. The fix:

```css
/* Tier 1 */
--color-shadow: rgb(15 23 42);
--color-shadow-dark: rgb(0 0 0);

/* Tier 2 */
--shadow-color: var(--color-shadow);
--shadow:       0 18px 45px color-mix(in srgb, var(--shadow-color) 10%, transparent);
--shadow-sm:    0  8px 24px color-mix(in srgb, var(--shadow-color)  6%, transparent);
--shadow-accent: 0 8px 24px color-mix(in srgb, var(--accent) 10%, transparent);
```

### ⚠️ Finding: Token Format Inconsistency Across Themes

`--accent-soft` has **different value formats** in light vs. dark mode:

```css
/* Light — opaque colour */
--accent-soft: #eef2ff;

/* Dark — alpha colour (different CSS type!) */
--accent-soft: rgb(79 70 229 / 0.18);
```

This breaks colour mixing/interpolation and confuses Style Dictionary parsers. Both should either be opaque or both alpha. Preferred: keep opaque values at the semantic tier and use the primitive alpha tokens for borders/overlays as separate tokens.

---

## Tier 3 — Component Tokens

> **Definition:** Scoped to a single component; reference semantic tokens. Allow component re-skinning without touching the semantic layer.

### ❌ Finding: `--code-bg` and `--code-text` Are Misclassified as Semantic

These two tokens are **only** consumed by `pre` and `code` elements. They are component-level tokens accidentally placed in the global semantic tier. Moving them to a component group makes the semantic layer represent true UI-agnostic concepts.

### ❌ Finding: `--content-width` Is a Layout Token

`78rem` is a layout constraint, not a semantic design decision. It belongs in a layout or component group.

### Hardcoded Component Values That Should Become Tier-3 Tokens

#### Badge (`body::before`)

```css
/* ❌ Current — fully hardcoded */
border: 1px solid rgb(79 70 229 / 0.22);
border-radius: 999px;
background: rgb(255 255 255 / 0.72);
box-shadow: 0 8px 24px rgb(79 70 229 / 0.10);
font-size: 0.8rem;
font-weight: 700;
letter-spacing: 0.08em;

/* ✅ Should be */
--badge-border-color: var(--accent-border);
--badge-radius:       var(--radius-pill);
--badge-bg:           var(--surface-glass);
--badge-shadow:       var(--shadow-accent);
--badge-font-size:    var(--font-size-xs);
--badge-font-weight:  var(--font-weight-bold);
--badge-letter-spacing: var(--letter-spacing-wide);
```

#### Table of Contents (`#TOC`)

```css
/* Missing component tokens: */
--toc-bg:      var(--surface-overlay);   /* rgb(255 255 255 / 0.86) currently hardcoded */
--toc-border:  var(--border);
--toc-radius:  var(--radius);
--toc-shadow:  var(--shadow);
--toc-padding: var(--space-5);           /* 1.25rem currently hardcoded */
--toc-max-height: 28rem;
```

#### Blockquote

```css
/* Missing component tokens: */
--blockquote-bg:           var(--accent-soft);
--blockquote-border-color: var(--accent-border);       /* rgb(79 70 229/0.18) hardcoded */
--blockquote-accent-color: var(--accent);
--blockquote-accent-width: 0.35rem;
--blockquote-text-color:   var(--color-accent-text);   /* #312e81 hardcoded */
--blockquote-padding:      var(--space-4) var(--space-5);
```

#### Inline Code (`code`)

```css
/* Missing component tokens: */
--code-inline-bg:         var(--accent-soft);
--code-inline-border:     var(--accent-border-soft);   /* rgb(79 70 229/0.14) hardcoded */
--code-inline-color:      var(--color-accent-text);    /* #312e81 hardcoded */
--code-inline-radius:     var(--radius-sm);             /* 0.45rem hardcoded */
--code-inline-font-size:  var(--font-size-sm);
--code-inline-padding:    0.08rem 0.28rem;
```

#### Code Block (`pre`)

```css
/* Currently uses --code-bg, --code-text, --radius, --shadow — good start. Missing: */
--pre-border-color:  var(--border-subtle);   /* rgb(255 255 255 / 0.12) hardcoded */
--pre-padding:       var(--space-4) var(--space-5);
--pre-max-width:     min(100%, 58rem);
```

#### Table

```css
/* Missing component tokens: */
--table-bg:      var(--surface);
--table-border:  var(--border);
--table-radius:  var(--radius);
--table-shadow:  var(--shadow-sm);    /* 0 10px 30px rgb(15 23 42/0.06) hardcoded */
--table-cell-padding: var(--space-3) 0.85rem;
--table-head-bg: var(--surface-muted);
--table-head-color: var(--color-heading);  /* #0f172a hardcoded */
```

---

## Dark-Mode Coverage Gap

The dark-mode `:root` overrides correctly swap the 9 semantic tokens. However, **5 colour values in rules are hardcoded** and cannot be overridden by any token swap:

| Selector | Property | Light hardcode | Dark hardcode | Status |
|---|---|---|---|---|
| `h1.title, h1–h4, th` | `color` | `#0f172a` | `#f8fafc` | ❌ Should be `--color-heading` |
| `p, li, dd` | `color` | `#263449` | `#d4d9e3` | ❌ Should be `--color-body` |
| `strong` | `color` | `#101828` | (unset, inherited) | ❌ Should be `--color-strong` |
| `blockquote` | `color` | `#312e81` | `#c7d2fe` | ❌ Should be `--color-accent-text` |
| `code` | `color` | `#312e81` | `#c7d2fe` | ❌ Should be `--color-accent-text` |
| `body::before, #TOC, table` | `background` | (inline) | `rgb(17 24 39 / 0.86)` | ❌ Should be `--surface-overlay` / component token |

The dark-mode `@media` block currently patches these with additional hardcoded values in selectors — this is unsustainable as the number of overrides grows. All of these should resolve to `:root` token overrides only.

---

## Complete Remediation Map

```
site.css — Recommended Token Architecture
══════════════════════════════════════════

TIER 1 — Primitives (add to :root, prefix --p-*)
────────────────────────────────────────────────
Colour palette (indigo, slate, white, emerald)
Alpha palette  (accent × 4 opacities, slate × 2, white × 3)
Spacing scale  (--space-1 through --space-16)
Radius scale   (--radius-sm, --radius-pill, --radius-lg)
Typography     (font sizes, weights, line heights, letter spacings)
Shadow colours (--color-shadow, --color-shadow-accent)

TIER 2 — Semantic (existing :root vars → update to reference Tier 1)
──────────────────────────────────────────────────────────────────────
KEEP & fix (point to primitives):
  --bg, --surface, --surface-muted
  --text, --muted, --border
  --accent, --accent-strong, --accent-soft, --radius, --shadow

ADD (currently hardcoded in rules):
  --color-heading      ← replaces #0f172a
  --color-body         ← replaces #263449
  --color-strong       ← replaces #101828
  --color-accent-text  ← replaces #312e81 / #c7d2fe
  --surface-glass      ← replaces rgb(255 255 255 / 0.72)
  --surface-overlay    ← replaces rgb(255 255 255 / 0.86)
  --border-subtle      ← replaces rgb(255 255 255 / 0.12)
  --accent-border      ← replaces rgb(79 70 229 / 0.22)
  --accent-border-soft ← replaces rgb(79 70 229 / 0.14)
  --shadow-sm          ← replaces 0 10px 30px rgb(15 23 42/0.06)
  --shadow-accent      ← replaces 0  8px 24px rgb(79 70 229/0.10)
  --font-family-sans   ← replaces inline font-family stack
  --font-family-mono   ← replaces inline font-family stack

MOVE OUT of Tier 2 (currently misclassified):
  --code-bg, --code-text   → Tier 3 (pre/code component)
  --content-width          → Tier 3 / layout group

TIER 3 — Component (add scoped groups)
──────────────────────────────────────
--badge-*         (7 tokens)
--toc-*           (5 tokens)
--blockquote-*    (6 tokens)
--code-inline-*   (6 tokens)
--pre-*           (+ existing --code-bg, --code-text)
--table-*         (7 tokens)
--layout-content-width: 78rem
```

---

## Priority Checklist

### P0 — Prevents dark-mode from working correctly
- [ ] Add `--color-heading`, `--color-body`, `--color-strong`, `--color-accent-text` semantic tokens
- [ ] Replace all 5 hardcoded-in-rules colour pairs with those tokens
- [ ] Remove dark-mode rule overrides once token overrides cover them

### P1 — Fixes fragility and duplication
- [ ] Add Tier-1 colour primitives; update semantic tokens to reference them
- [ ] Tokenise the 5 accent alpha values (`--accent-border`, `--accent-border-soft`, `--surface-glass`, `--surface-overlay`, `--border-subtle`)
- [ ] Fix `--shadow` composite: extract colour to a primitive token
- [ ] Normalise `--accent-soft` to use the same value format in both themes

### P2 — Completes the architecture
- [ ] Add spacing and typography primitive scales
- [ ] Move `--code-bg`, `--code-text`, `--content-width` out of semantic tier
- [ ] Add full component-token groups for badge, TOC, blockquote, code, table

---

*Audit produced against the W3C Design Tokens Community Group format spec and the three-tier (primitive → semantic → component) taxonomy.*
