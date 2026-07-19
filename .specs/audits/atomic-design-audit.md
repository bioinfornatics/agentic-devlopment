# Atomic Design Audit — Agentic Development Harness Docs Site

> Audited: `docs/assets/site.css` (345 lines) + `dist/docs/html/agentic-development-harness.html` (3 353 lines)
> Methodology: Brad Frost Atomic Design (extended with Quarks — Level 0)
> Date: 2026-07-18

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical (P0) | 3 | Competing quark system, pseudo-element badge, dark-mode token bypass |
| 🟠 High (P1) | 5 | Missing spacing scale, missing typography scale, shadow proliferation, duplicate color drift, accent-in-raw-rgb |
| 🟡 Medium (P2) | 7 | Hard-coded heading color, body-text color mismatch, non-standard font-weight, border-radius sprawl, magic letter-spacing/underline, TOC ID lock-in, mega body-child selector |
| 🟢 Low (P3) | 4 | Blockquote left-accent pattern, grid hack `span 999`, `#ffffff` not tokened, `--font-*` missing |

**Overall health score: 38 / 100**
- Token coverage: **29 `var()` calls vs. 46 raw color values** — raw values outnumber tokens 1.6×
- Competing style layers: **2** (pandoc inline `<style>` + external `site.css`)
- Quarks defined: **15** (10 colors + 1 shadow + 1 radius + 1 width, dark overrides only re-token 10)
- Quarks needed: **~35** (missing spacing scale, typography scale, 3 shadow tiers, 3 radius tiers)

---

## Layer-by-Layer Findings

### 0. Quarks — Design Tokens

#### What exists (partial token set)

```css
/* :root — 15 tokens defined */
--bg, --surface, --surface-muted          /* 3 surface colors */
--text, --muted, --border                 /* 3 semantic colors */
--accent, --accent-strong, --accent-soft  /* 3 accent colors */
--code-bg, --code-text                    /* 2 code colors */
--shadow                                  /* 1 shadow */
--radius                                  /* 1 radius */
--content-width                           /* 1 layout */
```

Dark mode correctly reassigns these 10 of 15 tokens in `:root` — a good foundation. But the token set is critically **incomplete**.

---

#### 🔴 P0-A — Competing Quark System (Pandoc Inline `<style>`)

**Location:** `dist/docs/html/agentic-development-harness.html`, lines 8–89

Pandoc injects an **independent `<style>` block in `<head>`** containing 20+ syntax-highlight colors that form a **parallel, unrelated quark set**:

```css
/* Pandoc inline — no connection to site.css tokens */
code span.al { color: #ff0000; }        /* Alert */
code span.at { color: #7d9029; }        /* Attribute */
code span.bn { color: #40a070; }        /* BaseN */
code span.cf { color: #007020; }        /* ControlFlow */
code span.co { color: #60a0b0; }        /* Comment */
code span.fu { color: #06287e; }        /* Function */
/* ...18 more raw hex values */
pre.numberSource { border-left: 1px solid #aaaaaa; }  /* conflicts with pre styling */
```

**Violations:**
- 20+ hex literals outside any token system
- These colors **cannot be overridden by dark mode** `@media` in `site.css` — syntax highlighting stays light-mode on dark screens
- `#aaaaaa` for line-number gutter conflicts with `--border: #d9e2ec`
- `pre.numberSource` left-border color conflicts with `pre { background: var(--code-bg); }` atom
- This layer completely bypasses the composition hierarchy

**Impact:** Every `<code>` block (504 instances, the most common element in the HTML) renders with an uncontrolled quark set.

---

#### 🟠 P1-A — No Spacing Scale Tokens

**Location:** `docs/assets/site.css` — 27 unique raw spacing values, 0 tokenized

`1rem` appears **7 times** alone with no `--space-base` token. Full offenders:

```css
/* Values appearing ≥2× — immediate token candidates */
1rem    × 7   → --space-base / --space-4
1.25rem × 3   → --space-5
3rem    × 2   → --space-12
2rem    × 2   → --space-8
1.2rem  × 2   → --space-5  (conflicts with 1.25rem)
0.7rem  × 2   → --space-3  (conflicts with 0.75rem)
0.45rem × 2   → --space-2  
0.35rem × 2   → --space-1-half
```

Without a spacing scale every atom makes independent spacing decisions, making consistent density changes impossible.

---

#### 🟠 P1-B — No Typography Scale Tokens

**Location:** `docs/assets/site.css` — 7 font-size values, 0 tokenized; 2 font-weight values, 0 tokenized

```css
/* Font sizes — all magic numbers */
0.8rem                              /* badge label */
0.88em                              /* inline code */
1rem                                /* body */
1.25rem                             /* h3 */
clamp(1.45rem, 2.4vw, 2rem)        /* h2 */
clamp(2rem, 4vw, 3.1rem)           /* h1 */
clamp(2.7rem, 8vw, 6.4rem)         /* hero title */

/* Font families — duplicated in 2 places, no token */
/* body */ Inter, ui-sans-serif, system-ui ...
/* code */ "JetBrains Mono", "SFMono-Regular" ...

/* Font weights — not tokenized; one non-standard */
700    /* badge, heading */
750    /* th — NOT a standard font-weight bucket */
```

**`font-weight: 750` is a violation** — CSS spec defines weights at 100-step increments (100–900). `750` is treated as `700` by most engines; use `800` (ExtraBold) or `700` (Bold) explicitly.

---

#### 🟠 P1-C — Shadow Proliferation (3 values, 1 token)

`--shadow` token exists but three distinct shadows are deployed, only one via the token:

```css
/* Token (correct) */
--shadow: 0 18px 45px rgb(15 23 42 / 0.10);   /* #TOC, pre */

/* Raw (not tokenized) */
body::before: 0 8px 24px rgb(79 70 229 / 0.10); /* accent-tinted sm */
table:        0 10px 30px rgb(15 23 42 / 0.06);  /* neutral xs */
```

Should become: `--shadow-sm`, `--shadow-md`, `--shadow-accent-sm`.

---

#### 🟠 P1-D — Accent Color Used in Raw `rgb()` (5+ instances)

`--accent: #4f46e5` is correctly defined, but the same colour appears **5 times as raw `rgb(79 70 229 / alpha)`** instead of using CSS relative colour syntax or composited tokens:

```css
html { radial-gradient(circle at top left, rgb(79 70 229 / 0.18) ... }   /* L22 */
body::before { border: 1px solid rgb(79 70 229 / 0.22); }                /* L46 */
body::before { box-shadow: ... rgb(79 70 229 / 0.10); }                  /* L54 */
blockquote { border: 1px solid rgb(79 70 229 / 0.18); }                  /* L177 */
code { border: 1px solid rgb(79 70 229 / 0.14); }                        /* L189 */
```

If `--accent` ever changes, all 5 of these fail silently. These should be:
- `--accent-glow-18` / `--accent-glow-22` etc. derived tokens
- Or use CSS `color-mix(in srgb, var(--accent) 18%, transparent)` (modern) once baseline allows

---

#### 🟠 P1-E — Colour Drift: Three Different "Dark Text" Values

Three near-identical dark values are used for different text roles with NO token relationship:

```css
--text: #172033;          /* body text token — only consumed by: body { color } */
color: #0f172a;           /* headings h1–h4 (4 occurrences) — DIFFERENT from --text */
color: #263449;           /* p, li, dd (1 occurrence) — DIFFERENT from both */
color: #101828;           /* strong (1 occurrence) — also used for --code-bg: #101828! */
```

**Critical:** `--text: #172033` is defined but **never consumed for heading or body-text selectors**. The token exists in isolation. `#0f172a`, `#263449`, `#101828` are three undocumented colour ramps of Slate/Blue-grey that should be a single harmonised palette like:

```css
--slate-900: #0f172a;   /* headings */
--slate-800: #172033;   /* = --text  */
--slate-700: #263449;   /* body text */
--slate-600: #101828;   /* strong (and code-bg — same hex, different semantic!) */
```

Note: `#101828` is both used as a text colour (`strong`) and as `--code-bg` — **the same raw value carries two completely different semantic roles**, which will produce bugs when one is changed.

---

### 1. Atoms

#### 🔴 P0-B — Badge Pseudo-Element: Content Encoded in CSS, not HTML

**Location:** `docs/assets/site.css` lines 39–55

```css
body::before {
  content: "Goose + Beads + SDD";    /* ← hard-coded string in CSS */
  display: inline-flex;
  border: 1px solid rgb(79 70 229 / 0.22);
  background: rgb(255 255 255 / 0.72);
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 8px 24px rgb(79 70 229 / 0.10);
}
```

**Violations:**
1. **Content in CSS** — the text `"Goose + Beads + SDD"` is semantic content that belongs in HTML, not a CSS `content` property. Screen readers may not announce pseudo-element content.
2. **Untestable atom** — cannot be selected, styled with classes, or conditionally rendered without rewriting CSS.
3. **3 raw colour values** not using tokens (`rgb(79 70 229 / 0.22)`, `rgb(255 255 255 / 0.72)`, shadow).
4. **`font-size: 0.8rem`** and **`font-weight: 700`** not tokenized.
5. **`border-radius: 999px`** pill value not tokenized.
6. **`letter-spacing: 0.08em`** not tokenized.
7. **`gap: 0.5rem`** and **`padding: 0.35rem 0.7rem`** not tokenized.

**Fix:** Add to HTML `<header id="title-block-header">` as `<p class="site-badge">Goose + Beads + SDD</p>`, apply styles via `.site-badge` class consuming proper tokens.

---

#### 🟡 P2-A — Heading Color Bypasses Token

```css
h1:not(.title), h2, h3, h4 {
  color: #0f172a;   /* Should be: color: var(--color-heading) */
}
```

`--text: #172033` exists but headings use a completely different value `#0f172a`. These should both be named tokens with clear semantic separation.

---

#### 🟡 P2-B — Body Text Color Mismatch

```css
body { color: var(--text); }   /* --text: #172033 */
p, li, dd { color: #263449; }  /* OVERRIDES body color with a different value! */
```

`p` and `li` elements re-declare a *different* colour from `--text`, making `--text` meaningless for reading text. Any `p` element will be `#263449`, not `#172033`. These must be unified or split into `--color-body` and `--color-list-item` tokens.

---

#### 🟡 P2-C — Inline Code Border Radius Deviates from `--radius`

```css
code { border-radius: 0.45rem; }  /* magic number */
pre  { border-radius: var(--radius); }  /* 18px = 1.125rem */
```

`0.45rem ≈ 7px`, `var(--radius) = 18px`. Inline code uses a completely different radius with no token. Should be `--radius-sm: 0.45rem`.

---

#### 🟡 P2-D — `a` Atom Magic Decoration Values

```css
a {
  text-decoration-thickness: 0.08em;  /* no token */
  text-underline-offset: 0.18em;      /* no token */
}
```

These are micro-decisions baked into an atom with no path to systematic override.

---

#### 🟡 P2-E — `h1.title` Typography Magic Numbers

```css
h1.title {
  max-width: 15ch;            /* no token */
  margin: 0 0 0.45rem;        /* no spacing token */
  line-height: 0.92;          /* no token — tight hero ratio */
  letter-spacing: -0.075em;   /* no token — aggressive tracking */
}
```

---

### 2. Molecules

#### 🟡 P2-F — `#TOC` Locked to ID, Not Reusable

```css
#TOC { ... }          /* Cannot be reused or overridden with a class */
#TOC > ul { ... }
#TOC ul { ... }
#TOC li { ... }
#TOC a { ... }
```

The table-of-contents navigation is a **molecule** (nav links + scroll container) styled exclusively via an ID. Any second navigation block is impossible. Should be `.toc-nav`, `.toc-nav__list`, `.toc-nav__item`, `.toc-nav__link`.

The glass background `rgb(255 255 255 / 0.86)` is also not tokenized (should be `--surface-glass` or `--surface-overlay`).

---

#### 🟡 P2-G — Blockquote Hard-coded Indigo

```css
blockquote { color: #312e81; }        /* Indigo-900: no token */
blockquote p { color: inherit; }      /* correct cascade fix */
```

`#312e81` (Indigo-900) is also the value of `code { color: #312e81 }` — two semantic roles, same value, no token name.

---

### 3. Organisms

#### 🟡 P2-H — 14-Selector `body >` Max-Width Block

```css
main,
body > h1:not(.title),
body > h2, body > h3, ...
body > p, body > ul, body > ol, body > blockquote,
body > pre, body > table, body > div:not(.sourceCode),
body > dl, body > hr {
  max-width: 50rem;
}
```

This is a **template-level layout constraint** (content column width) expressed as a 14-element CSS selector targeting direct children of `body`. Problems:
- Any new element type added to the document requires updating this selector list.
- Mixing layout (template concern) and element identity (atom concern) in a single rule.
- Should be: `.content-column { max-width: var(--column-width, 50rem); }` applied to the `<main>` wrapper.

---

### 4. Templates

#### 🟢 P3-A — Grid Hack `span 999`

```css
#TOC {
  grid-row: 3 / span 999;   /* magic number to span all remaining rows */
}
```

This works by overflow but is semantically undefined. Should use `grid-row: 3 / -1` or a named grid area: `grid-area: sidebar`.

---

#### 🟢 P3-B — Hardcoded `#ffffff` in Gradient

```css
html {
  background: linear-gradient(180deg, #ffffff 0%, var(--bg) 34rem);
}
```

`#ffffff` is not `--surface: #ffffff`. If `--surface` changes, this gradient stays white. Should be `var(--surface)`.

---

### 5. Pages

The entire HTML document is a single page (pandoc flat output). No Page-level violations specific to this layer — issues all propagate from lower levels.

---

## Hierarchy Violation Map

```
Layer       Item                          Violation
──────────────────────────────────────────────────────────────────────────────
Quarks      Pandoc inline <style>         P0  Competing 20+ color quark system,
                                              no token connection, breaks dark mode
Quarks      No spacing scale              P1  27 unique raw rem values, 0 tokens
Quarks      No typography scale           P1  7 font sizes, 2 font weights, 0 tokens
Quarks      3 shadows, 1 token            P1  2 unsystematic shadow values
Quarks      rgb(79 70 229 / α) × 5        P1  accent bypassed 5 times
Quarks      3 undocumented dark-text vals P1  #0f172a / #263449 / #101828 drift
Quarks      --text never used for text    P1  token defined, not consumed
──────────────────────────────────────────────────────────────────────────────
Atoms       body::before badge            P0  HTML content in CSS pseudo-element
Atoms       heading color = #0f172a       P2  bypasses --text token
Atoms       p/li/dd = #263449            P2  different from --text: #172033
Atoms       code border-radius = 0.45rem  P2  not --radius, no --radius-sm token
Atoms       a decoration magic values     P2  0.08em / 0.18em not tokenized
Atoms       h1.title magic tracking       P2  -0.075em, 15ch, 0.92 line-height
Atoms       strong = #101828 = code-bg    P2  same hex, two semantic roles
──────────────────────────────────────────────────────────────────────────────
Molecules   #TOC ID selector              P2  not reusable; should be .toc-nav
Molecules   blockquote color = #312e81    P2  same as code, no token
Molecules   table shadow not tokenized    P2  0 10px 30px raw value
──────────────────────────────────────────────────────────────────────────────
Organisms   14-element body > selector    P2  template concern in atom selector
Organisms   dark mode hard-codes colors   P0  5 color blocks outside :root tokens
──────────────────────────────────────────────────────────────────────────────
Templates   grid-row: 3 / span 999        P3  magic overflow hack
Templates   #ffffff not var(--surface)    P3  gradient bypasses token
──────────────────────────────────────────────────────────────────────────────
```

---

## Refactor Priority List

### 🔴 P0 — Critical (Do First — System Integrity)

#### P0-1: Establish a Pandoc Syntax-Highlighting Token Bridge

**Problem:** 20+ pandoc inline colours bypass the entire quark system and break dark mode for all 504 `<code>` elements.

**Fix:** In `scripts/build-docs.sh`, use `--no-highlight` pandoc flag (to suppress inline CSS) and add a standalone highlight theme file (`docs/assets/syntax.css`) whose colour tokens consume `var(--*)` from `site.css`. Or use pandoc `--highlight-style` with a custom theme JSON that maps to the site palette.

**Files:** `scripts/build-docs.sh`, new `docs/assets/syntax.css`

---

#### P0-2: Convert `body::before` Badge to an HTML Atom

**Problem:** Semantic content encoded in CSS pseudo-element; 7+ unresolved magic values.

**Fix:**
1. In `scripts/build-docs.sh` pandoc pipeline, add `--include-before-body=docs/assets/badge.html` injecting `<p class="site-badge">Goose + Beads + SDD</p>`.
2. In `site.css`, replace `body::before { ... }` with `.site-badge { ... }` consuming tokens.

**Files:** `docs/assets/site.css`, `scripts/build-docs.sh`, new `docs/assets/badge.html`

---

#### P0-3: Migrate Dark Mode Overrides to `:root` Token Reassignment

**Problem:** 5 hard-coded colour blocks outside `:root` in dark mode. Heading, body, blockquote, code, glass surfaces all bypass token system.

**Current (wrong):**
```css
@media (prefers-color-scheme: dark) {
  h1.title, h2, h3, h4, strong, th { color: #f8fafc; }
  p, li, dd { color: #d4d9e3; }
  blockquote { color: #c7d2fe; }
  code { color: #c7d2fe; }
  body::before, #TOC, table { background: rgb(17 24 39 / 0.86); }
}
```

**Fix:** Add missing tokens and move ALL dark overrides to `:root`:
```css
:root {
  /* Add these missing tokens */
  --color-heading: #0f172a;
  --color-body: #263449;
  --color-strong: #101828;
  --color-blockquote: #312e81;
  --color-code-text-inline: #312e81;
  --surface-glass: rgb(255 255 255 / 0.86);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-heading: #f8fafc;
    --color-body: #d4d9e3;
    --color-strong: #f8fafc;
    --color-blockquote: #c7d2fe;
    --color-code-text-inline: #c7d2fe;
    --surface-glass: rgb(17 24 39 / 0.86);
  }
}
```

**Files:** `docs/assets/site.css`

---

### 🟠 P1 — High (Token Completion)

#### P1-1: Add Spacing Scale Tokens

Add to `:root` (using `1rem = 16px` base):
```css
--space-1:  0.25rem;   /*  4px */
--space-2:  0.5rem;    /*  8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
```

Replace all 27 raw rem spacing values with token references. Highest priority: `1rem × 7`, `2rem × 2`, `3rem × 2`, `1.25rem × 3`.

---

#### P1-2: Add Typography Scale Tokens

```css
:root {
  /* Font families */
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;

  /* Font sizes */
  --text-xs:   0.8rem;
  --text-sm:   0.88em;
  --text-base: 1rem;
  --text-lg:   1.25rem;
  --text-h2:   clamp(1.45rem, 2.4vw, 2rem);
  --text-h1:   clamp(2rem, 4vw, 3.1rem);
  --text-hero: clamp(2.7rem, 8vw, 6.4rem);

  /* Font weights */
  --font-bold:       700;
  --font-extrabold:  800;   /* replaces non-standard 750 */

  /* Line heights */
  --leading-tight:  0.92;
  --leading-snug:   1.2;
  --leading-normal: 1.75;

  /* Letter spacings */
  --tracking-tight:  -0.075em;
  --tracking-normal: -0.025em;
  --tracking-wide:    0.08em;
}
```

---

#### P1-3: Add Shadow Scale Tokens

```css
:root {
  --shadow-xs:     0 10px 30px rgb(15 23 42 / 0.06);   /* table */
  --shadow-sm:     0 8px 24px rgb(79 70 229 / 0.10);   /* badge accent glow */
  --shadow-md:     0 18px 45px rgb(15 23 42 / 0.10);   /* = current --shadow */
}
```

Rename `--shadow` → `--shadow-md` for clarity (breaking but simple).

---

#### P1-4: Resolve Duplicate `#101828` Semantic Collision

`#101828` is simultaneously `--code-bg` (background) and `color: #101828` for `strong` text. These look identical today but will diverge when dark mode or theming changes either. Separate:

```css
--code-bg: #101828;       /* remains */
--color-strong: #101828;  /* new, same value initially — different semantic */
```

---

#### P1-5: Tokenize Accent Alpha Variants

```css
:root {
  --accent-alpha-18: rgb(79 70 229 / 0.18);  /* gradient, blockquote border */
  --accent-alpha-22: rgb(79 70 229 / 0.22);  /* badge border */
  --accent-alpha-14: rgb(79 70 229 / 0.14);  /* code border */
  --accent-alpha-10: rgb(79 70 229 / 0.10);  /* shadows */
}
```

Modern alternative using `color-mix()`:
```css
--accent-soft-10: color-mix(in srgb, var(--accent) 10%, transparent);
```

---

### 🟡 P2 — Medium (Atom/Molecule Fixes)

#### P2-1: Unify Dark-Text Colour Ramp

Create a named scale for the Slate/Blue-grey heading-to-body range:

```css
:root {
  --color-heading: #0f172a;  /* h1–h4 */
  --color-body:    #263449;  /* p, li, dd */
  --color-strong:  #101828;  /* strong */
}
/* Remove --text: #172033 (unused) OR align it to one of the above */
```

Apply in atom selectors:
```css
h1:not(.title), h2, h3, h4 { color: var(--color-heading); }
p, li, dd { color: var(--color-body); }
strong { color: var(--color-strong); }
```

---

#### P2-2: Convert `#TOC` to `.toc-nav` Class

Replace `#TOC { }` → `.toc-nav { }` throughout `site.css`.  
Add `class="toc-nav"` alongside the existing `id="TOC"` in pandoc output via `--metadata toc-title=""` or a pandoc Lua filter.

---

#### P2-3: Fix Non-Standard `font-weight: 750`

```css
/* Before */
th { font-weight: 750; }

/* After */
th { font-weight: var(--font-extrabold); }   /* 800 */
```

---

#### P2-4: Add `--radius-sm` and `--radius-pill` Tokens

```css
:root {
  --radius-sm:   0.45rem;  /* inline code */
  --radius:      18px;     /* cards, pre, TOC (existing) */
  --radius-pill: 999px;    /* badge */
}
```

Apply: `code { border-radius: var(--radius-sm); }` — currently hardcoded `0.45rem`.

---

#### P2-5: Replace 14-Selector `body >` Block with Content Column Class

```css
/* Before — template concern in atom selector */
main, body > h1:not(.title), body > h2, ... (14 selectors) {
  max-width: 50rem;
}

/* After — template token consumed by layout wrapper */
:root { --column-width: 50rem; }
.content-column, main { max-width: var(--column-width); }
```

Apply `.content-column` to `<main>` in pandoc template.

---

#### P2-6: Add `--text-decoration-*` Tokens

```css
:root {
  --underline-thickness: 0.08em;
  --underline-offset:    0.18em;
}
a {
  text-decoration-thickness: var(--underline-thickness);
  text-underline-offset: var(--underline-offset);
}
```

---

#### P2-7: Surface Glass Token

```css
:root {
  --surface-glass: rgb(255 255 255 / 0.86);
}
/* Usage: #TOC { background: var(--surface-glass); } */
```

Dark mode reassigns `--surface-glass: rgb(17 24 39 / 0.86)` in `:root` — eliminating the current hard-coded dark override.

---

### 🟢 P3 — Low (Nice-to-Have)

#### P3-1: Replace `grid-row: 3 / span 999` with Named Grid Area

```css
body {
  grid-template-areas:
    "badge   badge"
    "title   title"
    "content toc"
    "...     toc";
}
#TOC { grid-area: toc; }
```

---

#### P3-2: Fix `#ffffff` in Gradient

```css
/* Before */
background: linear-gradient(180deg, #ffffff 0%, var(--bg) 34rem);

/* After */
background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 34rem);
```

---

#### P3-3: Add `--surface-glass-accent` for Badge Border

```css
:root {
  --surface-glass-accent-border: rgb(79 70 229 / 0.22);  /* = --accent-alpha-22 */
}
```

---

#### P3-4: Add Missing `--font-*` Tokens to Template Root

Ensure pandoc template `<head>` links a `<meta>` preconnect for Inter font and that `--font-sans` / `--font-mono` are defined, enabling font-stack changes without modifying atom rules.

---

## Refactor Sequencing (Sprint Order)

```
Sprint 1 — Quark Foundation (P0 + P1, no HTML changes)
  1. P0-3  Dark mode → :root token reassignment        (site.css only)
  2. P1-2  Typography scale tokens                     (site.css :root)
  3. P1-1  Spacing scale tokens                        (site.css :root)
  4. P1-3  Shadow scale tokens (rename --shadow)       (site.css :root + usage)
  5. P1-4  Resolve #101828 semantic collision           (site.css :root + usage)
  6. P1-5  Accent alpha tokens                         (site.css :root + 5 usages)
  7. P2-1  Unify dark-text colour ramp                 (site.css atoms)
  8. P2-4  Add --radius-sm, --radius-pill tokens       (site.css atoms)

Sprint 2 — Atom Cleanup (P2, site.css only)
  9. P2-3  Fix font-weight: 750 → var(--font-extrabold)
  10. P2-6  Add --underline-* tokens + apply to a {}
  11. P2-7  Surface glass token
  12. P3-2  Fix #ffffff in gradient

Sprint 3 — Structure Changes (P0-1, P0-2 — require build pipeline changes)
  13. P0-1  Pandoc syntax-highlight token bridge       (build-docs.sh + syntax.css)
  14. P0-2  Badge HTML atom + remove body::before      (badge.html + build-docs.sh)
  15. P2-2  TOC: add .toc-nav class via Lua filter     (pandoc filter + site.css)
  16. P2-5  Content column class                       (pandoc template + site.css)

Sprint 4 — Polish (P3)
  17. P3-1  Named grid areas (template concern)
  18. P3-4  Font preconnect meta + --font-* tokens
```

---

## Token Inventory After Full Refactor

Projected quark count: **~55 tokens** (up from 15):

| Category | Current | Target |
|----------|---------|--------|
| Color — semantic | 7 | 13 |
| Color — alpha variants | 0 | 5 |
| Shadow | 1 | 3 |
| Border radius | 1 | 3 |
| Spacing | 0 | 10 |
| Typography — size | 0 | 7 |
| Typography — weight | 0 | 2 |
| Typography — family | 0 | 2 |
| Typography — leading/tracking | 0 | 5 |
| Layout | 1 | 3 |
| Surface/glass | 0 | 2 |
| **Total** | **10** | **55** |

---

## Acceptance Criteria for "Compliant" Status

- [ ] Zero raw hex or `rgb()` literals in `site.css` outside `:root` token definitions
- [ ] Dark mode handled entirely by `:root` token reassignment — zero element-selector overrides in `@media` block
- [ ] `body::before` removed; badge exists as `.site-badge` HTML atom
- [ ] `#TOC` replaced by `.toc-nav` class throughout
- [ ] Pandoc syntax colours consume `var(--*)` tokens or live in separate overridable `syntax.css`
- [ ] `font-weight: 750` eliminated
- [ ] `grid-row: 3 / span 999` eliminated
- [ ] Spacing, typography, shadow, and radius scales complete in `:root`
- [ ] `--text` token either consumed or removed (no orphaned tokens)
- [ ] `#101828` split into semantic `--code-bg` and `--color-strong` roles
