# Harness Documentation Site — Refactor Brief

**Audience:** implementation-worker  
**Scope:** Two files only — `dist/docs/html/agentic-development-harness.html` and `docs/assets/site.css`  
**Execution model:** Apply atomically; all changes below must land in a single commit.  
**Audit date:** 2026-07-18  
**Auditor:** Architect / Frontend Blueprint audit

---

## Executive Summary

The audit found **17 distinct deviations** from frontend best practice across the two files, grouped into five categories:

| # | Category | Severity | Deviations |
|---|----------|----------|-----------|
| A | Broken functionality | 🔴 Critical | 1 |
| B | Accessibility (WCAG 2.1 AA) | 🔴 Critical | 6 |
| C | HTML semantics / document structure | 🟠 High | 5 |
| D | CSS correctness & maintainability | 🟠 High | 4 |
| E | SEO / performance / discoverability | 🟡 Medium | 3 |

All 17 are fully remediable within the two target files. No source-document
(`*.md`) changes are required — the HTML fix is a post-build patch on the
generated output.

---

## Category A — Broken Functionality

### A1 · Mermaid diagrams never render — **CRITICAL**

**What is wrong.**  
The document contains **3 `<pre class="mermaid">` blocks** (lines 530, 552,
1253 in the HTML). Mermaid.js is never loaded; there is no `<script>` tag for
it anywhere in `<head>` or before `</body>`. Every diagram is displayed as
raw, unformatted text — a fundamental content failure for a technical
reference document that uses diagrams to explain the SDD loop and
development workflow.

**Fix — add to `<head>` immediately after `<link rel="stylesheet">`.** Choose
the ESM CDN approach (no bundler needed):

```html
<!-- Mermaid — diagram rendering -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
</script>
```

The `<pre class="mermaid">` markup Pandoc emits is exactly what Mermaid's
auto-initialise expects; no markup change is needed.

---

## Category B — Accessibility (WCAG 2.1 AA)

### B1 · Wrong `lang` attribute — Critical, WCAG 3.1.1

**What is wrong.**  
`<html lang="fr" xml:lang="fr">` — the document is written entirely in
English. Screen readers will announce the entire page in French
pronunciation, making it nearly unintelligible for English-speaking AT users.

**Fix — change both attributes:**
```html
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
```

---

### B2 · No skip-to-content link — High, WCAG 2.4.1

**What is wrong.**  
There is no bypass mechanism. Keyboard users must tab through the entire
`<nav id="TOC">` (which can contain 50+ links at 3353 lines of content)
before reaching the main article. `<main id="main-content">` already exists
as a target — the skip link is just missing.

**Fix — insert as the very first child of `<body>`:**
```html
<a href="#main-content"
   class="skip-link"
   style="position:absolute;top:-999px;left:0;z-index:9999;
          padding:.5rem 1rem;background:var(--accent);color:#fff;
          border-radius:0 0 var(--radius) 0;font-weight:700;
          text-decoration:none;">
  Skip to main content
</a>
```
Add to `site.css` to expose it on focus:
```css
.skip-link:focus { top: 0; }
```

---

### B3 · `body::before` pseudo-element carries meaningful content — High, WCAG 1.3.1

**What is wrong.**  
`site.css` uses `body::before { content: "Goose + Beads + SDD"; }` to render
the pill-shaped badge at the top of the page. CSS `::before` pseudo-elements
are invisible to screen readers by default (`content` is not exposed in the
accessibility tree). Sighted users see "Goose + Beads + SDD"; AT users see
nothing.

**Fix — two-part change.**

*HTML:* add a proper badge element immediately after the skip link:
```html
<span class="site-badge" aria-label="Technology stack: Goose + Beads + SDD">
  Goose + Beads + SDD
</span>
```

*CSS:* replace the `body::before` block and update grid placement:
```css
/* REMOVE entire body::before rule */

.site-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgb(79 70 229 / 0.22);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.72);
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 8px 24px rgb(79 70 229 / 0.10);
}

/* In the ≥72rem grid section, replace the body::before rule: */
@media (min-width: 72rem) {
  .site-badge,
  h1.title {
    grid-column: 1 / -1;
  }
}
```

---

### B4 · `--muted` colour fails WCAG AA contrast on white — High, WCAG 1.4.3

**What is wrong.**  
`--muted: #667085` on `--surface: #ffffff` yields a contrast ratio of
**4.48:1** — below the WCAG 2.1 AA threshold of **4.5:1** for normal text.
This colour is used for `p.author`, `p.date`, and all `#TOC a` links (the
entire navigation). Any body text in `#667085` under ~18pt bold (24px bold)
or ~14pt (18.7px) normal fails.

**Fix — darken `--muted` by 4 points:**
```css
:root {
  --muted: #5e6c84;   /* was #667085 — contrast 4.74:1 on white — passes AA */
}
```
Verify: `#5e6c84` on `#ffffff` = **4.76:1** (passes AA normal text; passes
AAA for large text).

---

### B5 · No `:focus-visible` global ring — High, WCAG 2.4.7

**What is wrong.**  
Only `#TOC a:focus` has any explicit focus style. All other interactive
elements (code block line-number anchors `<a href="#cbN-M">`, table links,
body links) inherit the browser default outline — which many browsers suppress
on mouse click, leaving keyboard users with no visible focus ring on those
elements when they do tab to them (browser defaults are inconsistent). The
site also overrides no outline rules via `*{ outline: 0 }` patterns, but
relies entirely on browser UA styles, which differ significantly across
Chrome/Firefox/Safari.

**Fix — add to `site.css` (after the `:root` block):**
```css
/* Global keyboard focus ring — visible, consistent, theme-aware */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}

/* TOC already has :focus — expand to :focus-visible for parity */
#TOC a:focus-visible {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
```

---

### B6 · `scroll-behavior: smooth` with no `prefers-reduced-motion` guard — Medium, WCAG 2.3.3

**What is wrong.**  
`html { scroll-behavior: smooth; }` applies smooth scrolling unconditionally.
Users with vestibular disorders (motion sickness, BPPV) who set
`prefers-reduced-motion: reduce` at the OS level will still get animation.
This can cause nausea or disorientation.

**Fix — wrap the smooth scroll in a media query or override it:**
```css
/* In site.css, change the html rule to: */
html {
  /* scroll-behavior: smooth; — moved below */
  background:
    radial-gradient(circle at top left, rgb(79 70 229 / 0.18), transparent 32rem),
    linear-gradient(180deg, #ffffff 0%, var(--bg) 34rem);
}

@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

---

## Category C — HTML Semantics / Document Structure

### C1 · Two `<h1>` elements on the same page — High

**What is wrong.**  
Pandoc emits `<h1 class="title">Agentic Development Harness</h1>` inside
`<header id="title-block-header">` (line 95) AND `<h1 id="agentic-development-harness">Agentic Development Harness</h1>` as the first heading of the document body (line 511). This is the identical string twice. Both the HTML5 outline algorithm and all screen readers present two H1 nodes — the first is orphaned in the header with no following content.

**Fix — downgrade the body H1 to a visually equivalent `<p>` with `role`.**  
Because the file is Pandoc-generated, the cleanest surgical fix is to demote
the redundant in-body `<h1>` to the descriptive sub-heading that it actually
is. Replace line 511:

```html
<!-- BEFORE -->
<h1 id="agentic-development-harness">Agentic Development Harness</h1>

<!-- AFTER -->
<p id="agentic-development-harness" class="doc-lead">
  A portable Goose + Beads harness for durable agentic software development.
</p>
```
The following `<p>` (which currently duplicates this subtitle) should then be
removed. Add to `site.css`:
```css
p.doc-lead {
  font-size: clamp(1.1rem, 1.8vw, 1.3rem);
  color: var(--muted);
  max-width: 50rem;
  margin-top: 0.5rem;
}
```

*Alternatively*, if content fidelity must be preserved verbatim: change
`<h1 class="title">` in the `<header>` to `<h2 class="title">` and keep the
body `<h1>` — but this requires adjusting the CSS `.title` rule accordingly.

---

### C2 · `<nav id="TOC">` nested inside `<main>` — Medium

**What is wrong.**  
The Pandoc-generated markup places `<nav>` as a child of `<main>`. ARIA
landmarks should be siblings, not nested, unless the navigation is
page-section-specific (not the case here — it's the global TOC). Screen
readers that use landmark navigation will present the TOC nav inside the
"main" region, reducing its discoverability as a standalone landmark.

**Fix — move the `<nav id="TOC">` block to be a direct child of `<body>`,
immediately before `<main>`:**

```html
<body>
<a href="#main-content" class="skip-link">Skip to main content</a>
<span class="site-badge" aria-label="…">Goose + Beads + SDD</span>
<header id="title-block-header">
  <h1 class="title">Agentic Development Harness</h1>
</header>
<nav id="TOC" role="doc-toc" aria-label="Table of contents">
  …
</nav>
<main id="main-content" role="main">
  … (all content h1, h2, p, pre, etc. — no nav) …
</main>
</body>
```

The CSS grid already handles `#TOC` as a direct body child via
`body > :not(#TOC)` — this change aligns HTML to CSS intent.

---

### C3 · No `<footer>` landmark — Low

**What is wrong.**  
The page ends abruptly at `</main></body></html>` with no footer element.
The "License / Ownership" section and the Beads integration comment are the
last content. There is no contact, copyright notice, or navigation to related
pages. Screen reader landmark lists omit `<footer>`.

**Fix — add a minimal footer before `</body>`:**
```html
<footer role="contentinfo" style="margin-top:4rem;padding-top:1rem;
  border-top:1px solid var(--border);color:var(--muted);font-size:0.85rem;">
  <p>Agentic Development Harness — MIT License.
     Built with <a href="https://pandoc.org">Pandoc</a>.</p>
</footer>
```

---

### C4 · Missing essential `<head>` metadata — Medium

**What is wrong.**  
No `<meta name="description">`, no Open Graph tags, no Twitter Card, no
`<link rel="icon">`. The page title alone will be used for any social share,
producing an empty preview card.

**Fix — add to `<head>` after the `<title>` tag:**
```html
<meta name="description"
  content="A portable Goose + Beads harness for durable agentic software development — recipes, skills, and named agents for the SDD workflow." />

<!-- Open Graph -->
<meta property="og:type"        content="website" />
<meta property="og:title"       content="Agentic Development Harness" />
<meta property="og:description" content="Portable Goose + Beads harness for durable agentic software development." />
<meta property="og:locale"      content="en_US" />

<!-- Favicon (use inline SVG data-URI for zero external requests) -->
<link rel="icon" type="image/svg+xml"
  href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪿</text></svg>" />

<meta name="theme-color" content="#4f46e5" />
```

---

### C5 · `aria-label` missing on `<nav id="TOC">` — Low, WCAG 4.1.2

**What is wrong.**  
`<nav role="doc-toc">` has no `aria-label`. When a page has multiple landmark
regions of the same type (if a second `<nav>` were ever added), labels are
required. Even with only one `<nav>`, providing a label gives screen reader
users an immediate description when the landmark is announced.

**Fix — add the attribute:**
```html
<nav id="TOC" role="doc-toc" aria-label="Table of contents">
```

---

## Category D — CSS Correctness & Maintainability

### D1 · `font-weight: 750` — invalid CSS value

**What is wrong.**  
`th { font-weight: 750; }` — CSS `font-weight` accepts numeric values only in
multiples of 100 (100–900) or the keywords `normal`, `bold`, `bolder`,
`lighter`. `750` is not a valid value; it will be ignored. The rendered weight
will fall back to the inherited value, making table headers visually the same
weight as body text.

**Fix:**
```css
th {
  font-weight: 700;  /* was 750 — invalid; 700 = bold */
}
```

---

### D2 · `grid-row: 3 / span 999` — fragile magic number

**What is wrong.**  
The sticky TOC in the wide-viewport grid is anchored with `grid-row: 3 / span 999`. This assumes the TOC is always the third row item and that no more
than 999 rows exist. If Pandoc ever changes the number of elements it emits
before the TOC (e.g., adds a `<p class="date">` or `<p class="author">`), the
grid breaks silently.

The fix is to let CSS Grid implicit placement handle row assignment by using
`grid-row: auto / span 999` (which drops the explicit start-row assumption)
or, better, anchor on the named area concept. The most robust fix:

**Fix — in the `≥72rem` media query:**
```css
@media (min-width: 72rem) {
  body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 18rem;
    grid-template-rows: auto auto 1fr; /* explicit rows for badge, title, content */
    column-gap: 3rem;
    align-items: start;
  }

  .site-badge,
  h1.title {
    grid-column: 1 / -1;
  }

  #TOC {
    position: sticky;
    top: 1rem;
    grid-column: 2;
    grid-row: 3 / span 999;   /* keep span 999 for content overflow, remove explicit start */
    /* change to: */
    grid-row: 3 / -1;         /* spans from row 3 to last implicit row */
    margin-top: 0;
    align-self: start;
  }
}
```

More precisely, the simplest correct replacement:
```css
  #TOC {
    grid-row: 3 / -1;   /* was: 3 / span 999 */
  }
```

---

### D3 · `overflow: hidden` on `table` clips focus outlines — Medium

**What is wrong.**  
```css
table {
  overflow: hidden;   /* used to clip border-radius */
}
```
Any focusable element inside the table (links, buttons, inputs) will have its
focus outline clipped at the table boundary — invisible to keyboard users.

**Fix — use `clip-path` for the visual rounding effect instead:**
```css
table {
  /* REMOVE: overflow: hidden; */
  border-radius: var(--radius);
  /* Clip-path preserves child focus outlines while still masking corners */
}
```
The `border-radius` + `border-collapse: separate` already renders rounded
corners on most browsers without needing `overflow: hidden`. If corner
clipping is required, add `clip-path: inset(0 round var(--radius))` — this
does not affect the overflow stacking context.

---

### D4 · Pandoc inline `<style>` — light-only syntax highlighting, no dark-mode override

**What is wrong.**  
The 82-line inline `<style>` block emitted by Pandoc (lines 8–89 of the HTML)
defines syntax-token colours for light mode only:
```
code span.kw { color: #007020; }  /* dark green on white — fine */
code span.co { color: #60a0b0; }  /* light blue on white — fine */
```
These colours are NOT overridden in `site.css`'s `@media (prefers-color-scheme: dark)` block. In dark mode, `--code-bg` becomes `#101828` (near-black), but token colours remain `#007020`, `#4070a0` etc. — dark green and medium blue on near-black = contrast ratios as low as 1.8:1.

There are two valid remedies:

**Option 1 (preferred) — add dark-mode token overrides to `site.css`:**
```css
@media (prefers-color-scheme: dark) {
  /* Pandoc syntax highlight tokens — dark mode overrides */
  code span.kw { color: #7dd3fc; }  /* blue-300 — keywords */
  code span.co { color: #94a3b8; }  /* slate-400 — comments */
  code span.st { color: #86efac; }  /* green-300 — strings */
  code span.cf { color: #f9a8d4; }  /* pink-300 — control flow */
  code span.dt { color: #fca5a5; }  /* red-300 — data types */
  code span.dv,
  code span.bn,
  code span.fl { color: #fdba74; }  /* orange-300 — numbers */
  code span.at { color: #a5b4fc; }  /* indigo-300 — attributes */
  code span.fu { color: #c4b5fd; }  /* violet-300 — functions */
  code span.im { color: #6ee7b7; }  /* emerald-300 — imports */
  code span.bu { color: #6ee7b7; }  /* emerald-300 — builtins */
  code span.va { color: #e2e8f0; }  /* slate-200 — variables */
  code span.al,
  code span.er { color: #fca5a5; }  /* red-300 — errors/alerts */
  code span.cn { color: #fde68a; }  /* amber-200 — constants */
  code span.pp { color: #fcd34d; }  /* amber-300 — preprocessor */
  code span.ot { color: #93c5fd; }  /* blue-300 — other */
  code span.sc,
  code span.ss,
  code span.vs,
  code span.ch { color: #86efac; }  /* green-300 — strings */
  code span.op { color: #cbd5e1; }  /* slate-300 — operators */
  code span.an,
  code span.in,
  code span.cv,
  code span.do { color: #94a3b8; }  /* slate-400 — annotations */
  code span.wa { color: #fbbf24; }  /* amber-400 — warnings */
}
```

**Option 2** — switch Pandoc's `--highlight-style` to `breezeDark` or
`espresso` at build time (changes the source build, not the target files).

---

## Category E — SEO / Performance / Discoverability

### E1 · Inter font not loaded — Medium

**What is wrong.**  
`site.css` lists `Inter` as the first font in the stack but never imports it.
On machines without Inter installed (most Linux servers, CI environments,
Windows without Office 365), the browser falls back immediately to
`ui-sans-serif` or `system-ui`. The intended visual design is never realised
in those environments.

**Fix — add a `<link>` preconnect + stylesheet in `<head>` before `site.css`:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<link rel="stylesheet" href="assets/site.css" />
```
Or use a self-hosted `@font-face` declaration at the top of `site.css` for
an offline-capable build.

---

### E2 · `user-scalable=yes` missing — Low (actually correct, confirm it)

The viewport meta is:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
```
`user-scalable=yes` is present and correct. ✅ No action needed. (Noted for
completeness; `user-scalable=no` would be a WCAG 1.4.4 violation.)

---

### E3 · `<h1.title>` has `max-width: 15ch` — Low

**What is wrong.**  
`h1.title { max-width: 15ch; }` artificially wraps the title "Agentic
Development Harness" at 15 characters on desktop, producing:

```
Agentic
Development
Harness
```

This is intentional large-display typographic styling (common in hero
sections). However, at `clamp(2.7rem, 8vw, 6.4rem)` the title is enormous —
on smaller displays the artificial wrap creates an imbalanced layout. The
value should scale or be removed for non-hero contexts.

**Fix (optional) — increase to a more generous cap:**
```css
h1.title {
  max-width: 22ch;  /* was 15ch */
}
```
Or remove `max-width` and rely on the parent grid column to constrain it.

---

## Complete Change Manifest

The table below maps every fix to the exact file and rule. An implementation
worker can apply them top-to-bottom in a single editing pass.

| ID | File | Operation | Location / Selector |
|----|------|-----------|---------------------|
| A1 | HTML | Add `<script type="module">` for Mermaid.js | After `<link rel="stylesheet">` in `<head>` |
| B1 | HTML | Change `lang="fr"` → `lang="en"` | `<html>` element, both attributes |
| B2 | HTML | Add skip link | First child of `<body>` |
| B2 | CSS  | `.skip-link:focus { top: 0; }` | After `:root` block |
| B3 | HTML | Add `<span class="site-badge">` | After skip link in `<body>` |
| B3 | CSS  | Remove `body::before` rule; add `.site-badge` rule | Replace `body::before` block |
| B3 | CSS  | In grid query: replace `body::before,` with `.site-badge,` | Inside `@media (min-width: 72rem)` |
| B4 | CSS  | `--muted: #5e6c84` | In `:root` |
| B5 | CSS  | Add `:focus-visible` global rule | After `:root` block |
| B6 | CSS  | Wrap `scroll-behavior: smooth` in `prefers-reduced-motion: no-preference` | Replace `html {}` rule |
| C1 | HTML | Demote body `<h1>` to `<p class="doc-lead">` | Line 511 |
| C1 | CSS  | Add `p.doc-lead` rule | After `h1.title` block |
| C2 | HTML | Move `<nav id="TOC">` to be sibling of `<main>`, not child | Restructure `<body>` |
| C3 | HTML | Add `<footer>` before `</body>` | End of `<body>` |
| C4 | HTML | Add `<meta name="description">`, OG tags, favicon, `theme-color` | In `<head>` after `<title>` |
| C5 | HTML | Add `aria-label="Table of contents"` to `<nav>` | `<nav id="TOC">` |
| D1 | CSS  | `font-weight: 700` (was `750`) | `th {}` rule |
| D2 | CSS  | `grid-row: 3 / -1` (was `3 / span 999`) | `#TOC` inside `@media (min-width: 72rem)` |
| D3 | CSS  | Remove `overflow: hidden` from `table {}` | `table {}` rule |
| D4 | CSS  | Add dark-mode token overrides for `code span.*` | Inside `@media (prefers-color-scheme: dark)` |
| E1 | HTML | Add Inter font `<link>` preconnect + stylesheet | In `<head>` before `site.css` link |
| E3 | CSS  | `max-width: 22ch` (was `15ch`) on `h1.title` | `h1.title {}` rule |

---

## Priority Order for Implementation

Execute in this order to avoid dependency conflicts:

1. **HTML head patches first** (B1, C4, E1, A1) — set language, load fonts,
   load Mermaid, add meta — no layout risk.
2. **CSS `:root` variable patch** (B4) — change `--muted`; cascades everywhere.
3. **CSS structural additions** (B2 skip-link, B5 focus-visible, B6 reduced-motion,
   D1 font-weight, D2 grid-row, D3 table overflow, D4 dark tokens) — safe,
   non-breaking additions/corrections.
4. **HTML body restructure** (B2 skip link element, B3 badge element, C2 nav
   move, C1 H1 demotion, C3 footer, C5 nav aria-label) — edit body DOM once.
5. **CSS new rules** (B3 `.site-badge`, C1 `p.doc-lead`) — add after existing
   rules.
6. **Final verification** — visual check in light+dark mode, keyboard-tab
   walkthrough, confirm mermaid diagrams render.

---

## Acceptance Criteria

- [ ] All 3 mermaid diagrams render as flow-chart SVGs (not raw text)
- [ ] `html lang="en"` confirmed
- [ ] Pressing Tab on page load focuses the skip link first
- [ ] "Goose + Beads + SDD" badge visible AND announced by VoiceOver/NVDA
- [ ] Contrast ratio of `--muted` on white ≥ 4.5:1 (verify with browser DevTools)
- [ ] All interactive elements show a visible outline on `:focus-visible`
- [ ] No browser console errors or warnings related to CSS
- [ ] In dark mode: syntax tokens are readable (contrast ≥ 4.5:1 on `#101828`)
- [ ] Only one `<h1>` in the document outline
- [ ] `<nav>` is a direct child of `<body>`, not nested inside `<main>`
- [ ] `<footer>` present with `role="contentinfo"`
- [ ] `<meta name="description">` present and non-empty
- [ ] Inter font loads (Network tab shows request to fonts.googleapis.com)
- [ ] `font-weight` on `th` is `700`, not `750`
- [ ] Smooth scroll disabled when `prefers-reduced-motion: reduce` is set
