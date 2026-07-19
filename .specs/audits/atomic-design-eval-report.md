# Atomic Component Hierarchy — Eval Hub Trend Report

**Source file:** `dist/evals/report/index.html`  
**Methodology:** Brad Frost Atomic Design (extended with Quarks)  
**Target framework:** Vanilla HTML/CSS/JS (no build step; single-file progressive refactor)  
**Date:** 2026-07-18

---

## 0 · Inventory of existing structure

The current file is a monolithic `index.html` (≈ 234 KB) that bundles:

| Concern | Current form | Problem |
|---|---|---|
| Design tokens | `:root` CSS variables (partial) | Missing spacing / typography / transition tokens |
| Atoms | Inline class rules, no named abstractions | Cannot reuse independently |
| Molecules | Implicit in repeated `<div>` patterns | Duplicated markup across stat cards / chart cards |
| Organisms | Single run of markup | No slot boundary — impossible to swap |
| Data / behaviour | `<script>` inline at bottom | Mixed concerns, untestable |
| Chart.js | Embedded minified bundle (≈ 220 KB) | Prevents CDN caching |

The refactor plan below does **not** require a JS framework. It uses:

- **CSS custom properties** for quarks
- **HTML templates + `<slot>`** (Web Components v1) or simple CSS class conventions for atoms–organisms
- **JS modules** for organisms that own behaviour (table, charts)

---

## Level 1 — Quarks (Design Tokens)

> **Rule:** Pure values. No UI. No imports from any other level. Single source of truth.  
> **File:** `components/quarks/tokens.css`

All values come directly from the existing `:root` block, augmented with missing tokens identified during the audit.

```css
/* ═══════════════════════════════════════════════════════════
   quarks/tokens.css — Complete design token set
   ═══════════════════════════════════════════════════════════ */
:root {

  /* ── Colour palette ─────────────────────────────────────── */
  --q-green:      #22c55e;
  --q-green-dim:  rgba(34, 197, 94, .15);
  --q-red:        #ef4444;
  --q-red-dim:    rgba(239, 68, 68, .15);
  --q-amber:      #f59e0b;
  --q-blue:       #3b82f6;
  --q-blue-dim:   rgba(59, 130, 246, .12);
  --q-blue-focus: rgba(59, 130, 246, .35);   /* NEW – focus ring */

  /* ── Neutral scale ──────────────────────────────────────── */
  --q-gray-900:   #111827;   /* --text */
  --q-gray-700:   #374151;   /* --text-sm */
  --q-gray-500:   #6b7280;   /* --gray */
  --q-gray-100:   #f3f4f6;   /* --gray-lt */
  --q-gray-200:   #e5e7eb;   /* --gray-bdr */
  --q-gray-50:    #f8fafc;   /* --bg */
  --q-white:      #ffffff;   /* --surface */

  /* ── Semantic aliases (the old --green etc.) ────────────── */
  --color-success:      var(--q-green);
  --color-success-dim:  var(--q-green-dim);
  --color-danger:       var(--q-red);
  --color-danger-dim:   var(--q-red-dim);
  --color-warning:      var(--q-amber);
  --color-primary:      var(--q-blue);
  --color-primary-dim:  var(--q-blue-dim);
  --color-primary-ring: var(--q-blue-focus);
  --color-neutral:      var(--q-gray-500);
  --color-border:       var(--q-gray-200);
  --color-surface:      var(--q-white);
  --color-bg:           var(--q-gray-50);
  --color-text:         var(--q-gray-900);
  --color-text-muted:   var(--q-gray-700);
  --color-text-subtle:  var(--q-gray-500);

  /* ── Spacing scale ──────────────────────────────────────── */
  --space-1:  .25rem;   /* 4px  */
  --space-2:  .375rem;  /* 6px  */
  --space-3:  .5rem;    /* 8px  */
  --space-4:  .75rem;   /* 12px */
  --space-5:  1rem;     /* 16px */
  --space-6:  1.25rem;  /* 20px */
  --space-7:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */

  /* ── Typography ─────────────────────────────────────────── */
  --font-family:        system-ui, -apple-system, sans-serif;
  --font-size-2xs:      .72rem;
  --font-size-xs:       .75rem;
  --font-size-sm:       .78rem;
  --font-size-base:     .825rem;
  --font-size-md:       .875rem;
  --font-size-lg:       1.125rem;
  --font-size-xl:       1.75rem;
  --font-weight-normal: 400;
  --font-weight-semi:   600;
  --font-weight-bold:   700;
  --line-height-tight:  1.2;
  --line-height-base:   1.5;
  --letter-spacing-wide: .04em;
  --letter-spacing-wider: .05em;

  /* ── Shape ──────────────────────────────────────────────── */
  --radius-sm:   .375rem;
  --radius-md:   .5rem;
  --radius-lg:   .75rem;
  --radius-full: 999px;

  /* ── Elevation ──────────────────────────────────────────── */
  --shadow-sm:  0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05);

  /* ── Motion ─────────────────────────────────────────────── */
  --duration-fast:   120ms;
  --duration-base:   200ms;
  --easing-standard: ease-in-out;
}
```

**Tokens added vs. existing file:**

| Token group | Existing | Added |
|---|---|---|
| Colour | 11 vars | +3 (focus ring, gray-900, gray-700) |
| Spacing | 0 | +8 (--space-1 … --space-8) |
| Typography | 0 | +14 (family, sizes, weights, line-heights, tracking) |
| Shape | 1 (--radius) | +3 (sm, full, split lg) |
| Motion | 0 | +3 (durations, easing) |

---

## Level 2 — Atoms

> **Rule:** ≤ 50 lines. One visual element. One responsibility. All styling from quarks.  
> **Directory:** `components/atoms/`

### A-01 · `AppTitle`
```
@level Atom
Purpose: Primary brand heading ("📊 Eval Hub")
Props: emoji?, text
HTML: <h1 class="app-title">
Quarks: --font-size-lg, --font-weight-bold, --color-text
```

### A-02 · `SubtitleText`
```
@level Atom
Purpose: Muted secondary label beside the title ("Trend Report")
Props: text
HTML: <span class="subtitle-text">
Quarks: --color-neutral, --font-size-md
```

### A-03 · `MetaText`
```
@level Atom
Purpose: Timestamp / generated-at line in the topbar
Props: text
HTML: <span class="meta-text">
Quarks: --color-text-subtle, --font-size-xs, --space-8 (margin-left: auto)
```

### A-04 · `SectionTitle`
```
@level Atom
Purpose: Card-level heading (h2 inside stat/chart/table cards)
Props: text
HTML: <h2 class="section-title">
Quarks: --font-size-md, --font-weight-semi, --color-text-muted
```

### A-05 · `StatLabel`
```
@level Atom
Purpose: Upper small-caps label inside a stat card ("Total Runs")
Props: text
HTML: <div class="stat-label">
Quarks: --color-text-subtle, --font-size-sm, --font-weight-normal,
        text-transform:uppercase, --letter-spacing-wider
```

### A-06 · `StatValue`
```
@level Atom
Purpose: Large bold metric number in a stat card ("50")
Props: text, sentiment: 'positive' | 'negative' | 'neutral' | 'primary'
HTML: <div class="stat-value stat-value--{sentiment}">
Quarks: --font-size-xl, --font-weight-bold, --line-height-tight,
        --color-success / --color-danger / --color-text / --color-primary
```

### A-07 · `StatSub`
```
@level Atom
Purpose: Muted explanatory line below the stat value ("19 subjects evaluated")
Props: text
HTML: <div class="stat-sub">
Quarks: --color-text-subtle, --font-size-xs
```

### A-08 · `KindBadge`
```
@level Atom
Purpose: Coloured pill label for eval kind (skills / agents / recipes)
Props: kind: 'skills' | 'agents' | 'recipes'
HTML: <span class="kind-badge kind-badge--{kind}">
Quarks: --radius-full, --font-size-2xs, --font-weight-semi
        skills   → --color-primary-dim / #1d4ed8
        agents   → --color-success-dim / #15803d
        recipes  → --color-danger-dim  / #b91c1c
```

### A-09 · `DeltaPill`
```
@level Atom
Purpose: Signed % value coloured by sign (+26.8% green / −3.1% red / 0 gray)
Props: value: number   (e.g. 0.268)
HTML: <span class="delta-pill delta-pill--{pos|neg|neu}">
Quarks: --font-weight-semi, --color-success / --color-danger / --color-neutral
Derives: +XX.X% | −XX.X% formatted string from raw decimal
```

### A-10 · `PctCell`
```
@level Atom
Purpose: Pass-rate percentage in a table cell (no colouring, neutral)
Props: value: number | null
HTML: <span class="pct-cell">   (renders "—" for null)
Quarks: --font-size-base, --color-text
```

### A-11 · `FilterInput`
```
@level Atom
Purpose: Search/filter text input
Props: placeholder, value, onInput
HTML: <input type="search" class="filter-input">
Quarks: --radius-md, --space-2 (padding v) / --space-4 (padding h),
        --font-size-base, --color-border,
        focus → --color-primary border + --color-primary-ring box-shadow
```

### A-12 · `KindSelect`
```
@level Atom
Purpose: Dropdown to filter by kind (All / Skills / Agents / Recipes)
Props: value, onChange
HTML: <select class="kind-select">
Quarks: --radius-md, --space-2/--space-4, --font-size-base,
        --color-border, --color-bg
Options: hard-coded (All kinds / skills / agents / recipes)
```

### A-13 · `CountBadge`
```
@level Atom
Purpose: Pill showing current result count ("42 rows")
Props: count: number
HTML: <span class="count-badge">
Quarks: --color-neutral-100 bg, --radius-full, --space-1/--space-3,
        --font-size-xs, --color-text-subtle
```

### A-14 · `PageButton`
```
@level Atom
Purpose: Prev / Next pagination button
Props: label: '‹ Prev' | 'Next ›', disabled: boolean, onClick
HTML: <button class="pg-btn" disabled?>
Quarks: --radius-sm, --space-1/--space-3, --font-size-xs,
        --color-border, --color-surface, --color-neutral-100 (hover)
        disabled → opacity 0.4, cursor:default
```

### A-15 · `PageInfo`
```
@level Atom
Purpose: "Page N / M" label
Props: page: number, total: number
HTML: <span class="page-info">
Quarks: --font-size-xs, --color-text-subtle
```

### A-16 · `PageRange`
```
@level Atom
Purpose: "X–Y of Z" rows span
Props: start, end, total
HTML: <span class="page-range">
Quarks: --font-size-xs, --color-text-subtle
```

### A-17 · `ChartCanvas`
```
@level Atom
Purpose: Sized canvas wrapper for Chart.js
Props: id, heightPx: number
HTML: <div class="chart-wrap" style="height:{h}px"><canvas id="{id}"></canvas></div>
Quarks: position:relative (layout contract with Chart.js)
Note: No chart logic here — organism injects Chart.js instance
```

### A-18 · `EmptyState`
```
@level Atom
Purpose: Centered message when table has no results
Props: message: string
HTML: <tr class="tbl-empty"><td colspan="8">{message}</td></tr>
Quarks: --color-text-subtle, --space-8 (padding)
```

### A-19 · `SortableColumnHeader`
```
@level Atom
Purpose: Single `<th>` with sort state (▲ / ▼ indicator)
Props: label, col, sorted: 'asc' | 'desc' | null, onClick
HTML: <th class="col-header" data-col="{col}" [class sorted-asc|sorted-desc]>
Quarks: --color-neutral-100 bg, --font-size-sm, --font-weight-semi,
        text-transform:uppercase, --letter-spacing-wide, --color-primary (indicator)
        hover → #e9ebef bg
```

**Atom count: 19**

---

## Level 3 — Molecules

> **Rule:** ≤ 100 lines. One interaction pattern. Composed of atoms only.  
> **Directory:** `components/molecules/`

### M-01 · `StatCard`
```
@level   Molecule
@composition StatLabel, StatValue, StatSub
Purpose: Self-contained single-metric card
Props: label, value, sub, sentiment
HTML:
  <div class="stat-card">
    <StatLabel text={label} />
    <StatValue text={value} sentiment={sentiment} />
    <StatSub   text={sub} />
  </div>
Quarks: --color-surface bg, --color-border, --radius-lg, --shadow-sm,
        --space-5/--space-6 padding
```

### M-02 · `ChartCard`
```
@level   Molecule
@composition SectionTitle, ChartCanvas
Purpose: Titled chart panel — layout only, no Chart.js logic
Props: title, chartId, heightPx
HTML:
  <div class="chart-card">
    <SectionTitle text={title} />
    <ChartCanvas  id={chartId} heightPx={heightPx} />
  </div>
Quarks: --color-surface, --color-border, --radius-lg, --shadow-sm,
        --space-6 padding, --space-5 gap (title → canvas)
```

### M-03 · `TableToolbar`
```
@level   Molecule
@composition SectionTitle, FilterInput, KindSelect, CountBadge
Purpose: Filter bar above the runs table
Props: count, filterValue, kindValue, onFilter, onKind
HTML:
  <div class="table-toolbar">
    <SectionTitle text="All Runs" />
    <FilterInput  … />
    <KindSelect   … />
    <CountBadge   count={count} />
  </div>
Quarks: --space-4/--space-5 padding, --color-border (bottom border), flex row, wrap
Behaviour: emits onFilter(text) and onKind(kind) — no state held here
```

### M-04 · `Pagination`
```
@level   Molecule
@composition PageButton(×2), PageInfo, PageRange
Purpose: Full prev/next + position display
Props: page, totalPages, rangeStart, rangeEnd, totalRows, onPrev, onNext
HTML:
  <div class="pagination">
    <PageButton  label="‹ Prev" disabled={page<=1} onClick={onPrev} />
    <PageInfo    page={page} total={totalPages} />
    <PageButton  label="Next ›" disabled={rangeEnd>=totalRows} onClick={onNext} />
    <PageRange   start={rangeStart} end={rangeEnd} total={totalRows} />
  </div>
Quarks: --space-4/--space-5, --color-border (top border), flex row, gap --space-3
```

### M-05 · `RunsTableHead`
```
@level   Molecule
@composition SortableColumnHeader (×8)
Purpose: Complete `<thead>` with sort wiring for all 8 columns
Props: sortCol, sortDir, onSort(col)
Columns: date | kind | subject | withPct | basePct | delta | turns | maxReached
HTML:
  <thead><tr>
    <SortableColumnHeader … /> × 8
  </tr></thead>
Quarks: --color-neutral-100 bg, --color-border (bottom)
```

### M-06 · `RunsTableRow`
```
@level   Molecule
@composition KindBadge, DeltaPill, PctCell (×2)
Purpose: One data row in the runs table
Props: date, kind, subject, withPct, basePct, delta, turns, maxReached
HTML:
  <tr class="runs-row">
    <td>{date}</td>
    <td><KindBadge kind={kind} /></td>
    <td>{subject}</td>
    <td><PctCell value={withPct} /></td>
    <td><PctCell value={basePct} /></td>
    <td><DeltaPill value={delta} /></td>
    <td>{turns}</td>
    <td><PctCell value={maxReached} /></td>
  </tr>
Quarks: --space-2/--space-4 td padding, --color-border (row separator),
        hover → #fafbfc bg, --font-size-base
```

**Molecule count: 6**

---

## Level 4 — Organisms

> **Rule:** One feature area. Composed of molecules + atoms. May contain behaviour.  
> **Directory:** `components/organisms/`

### O-01 · `TopBar`
```
@level   Organism
@composition AppTitle, SubtitleText, MetaText
Purpose: Site-level header with branding + report metadata
Props: generatedAt, runCount, subjectCount
HTML:
  <header class="topbar">
    <AppTitle     text="📊 Eval Hub" />
    <SubtitleText text="Trend Report" />
    <MetaText     text="Generated: {generatedAt} UTC · {runCount} runs · {subjectCount} subjects" />
  </header>
Quarks: --color-surface bg, --color-border (bottom), --space-4/--space-8 padding,
        flex row, align-center, gap --space-7
Behaviour: none (pure display)
```

### O-02 · `StatRow`
```
@level   Organism
@composition StatCard (×4)
Purpose: KPI summary strip showing 4 headline numbers
Props: totalRuns, subjectCount, avgDelta, improvingCount, regressingCount
HTML:
  <div class="stat-row">
    <StatCard label="Total Runs"  value={totalRuns}      sub="{subjectCount} subjects evaluated" sentiment="primary" />
    <StatCard label="Avg Δ"       value="+{avgDelta}%"   sub="pass-rate delta (with − without)"  sentiment="positive" />
    <StatCard label="Improving"   value={improvingCount} sub="skills with positive Δ"             sentiment="positive" />
    <StatCard label="Regressing"  value={regressingCount}sub="skills with negative Δ"             sentiment="negative" />
  </div>
Quarks: CSS grid, auto-fill minmax(160px,1fr), gap --space-5
Behaviour: none (data computed outside, passed as props)
```

### O-03 · `ChartGrid`
```
@level   Organism
@composition ChartCard (×3)
Purpose: Three visualisations side-by-side with embedded Chart.js behaviour
Props: rows[] (all run data), subjects[]
HTML:
  <div class="chart-grid">
    <ChartCard title="Delta by Subject (latest run)"    chartId="barChart"   heightPx=320 />
    <ChartCard title="Pass-Rate Trend (last 30 runs)"  chartId="lineChart"  heightPx=320 />
    <ChartCard title="With vs Without (overall)"       chartId="donutChart" heightPx=220 />
  </div>
Quarks: CSS grid 1fr 1fr 280px (≤900px → 1fr), gap --space-5
Behaviour (JS, this organism owns it):
  - initBarChart(rows, subjects)    → Chart.js bar
  - initLineChart(rows)             → Chart.js line
  - initDonutChart(rows)            → Chart.js donut
  Called once after mount.
```

### O-04 · `RunsTable`
```
@level   Organism
@composition TableToolbar, RunsTableHead, RunsTableRow (×N), EmptyState, Pagination
Purpose: Full interactive runs table — filtering, sorting, pagination
Props: rows[] (raw data)
HTML:
  <div class="table-card">
    <TableToolbar  … />
    <table id="runsTable">
      <RunsTableHead … />
      <tbody>
        RunsTableRow × pageRows  |  EmptyState
      </tbody>
    </table>
    <Pagination … />
  </div>
Quarks: --color-surface, --color-border, --radius-lg, --shadow-sm, overflow:hidden
Behaviour (JS, this organism owns it):
  - State: filterText, kindFilter, sortCol, sortDir, page
  - applyFilters() → derives filtered[]
  - renderPage()   → slices to PAGE_SIZE (25), renders rows
  - Event listeners: filterInput, kindSelect, prev/next, th[data-col] clicks
  - Owns DOM mutation for tbody, badges, pagination text
```

**Organism count: 4**

---

## Level 5 — Templates

> **Rule:** Page-level layout with content slots. No specific data. Structure only.  
> **Directory:** `components/templates/`

### T-01 · `EvalPageTemplate`
```
@level   Template
@composition TopBar (slot), ContentArea (slot)
Purpose: Full-page shell: topbar + scrollable body below
Slots: topbar, content
HTML:
  <div class="shell">
    <slot name="topbar">   <!-- TopBar fills this -->
    <div class="body">
      <slot name="content"> <!-- StatRow + ChartGrid + RunsTable stack -->
    </div>
  </div>
Quarks: CSS grid grid-template-rows: auto 1fr, min-height:100vh
        .body → flex col, gap --space-7, padding --space-7 --space-8
Responsive: body padding collapses at ≤600px → --space-5 --space-5
Note: No data. Works equally for any report type (skill / agent / recipe detail).
```

**Template count: 1**

---

## Level 6 — Pages

> **Rule:** Template filled with real representative content. What users actually see.  
> **Directory:** `components/pages/`

### P-01 · `EvalHubTrendReport`
```
@level   Page
@composition EvalPageTemplate ← TopBar + StatRow + ChartGrid + RunsTable
Purpose: The actual rendered report for a given eval run
Data contract (injected by report generator / Python script):
  generatedAt:     "2026-07-18 13:04:35"
  runCount:        50
  subjectCount:    19
  totalRuns:       50
  avgDelta:        26.8
  improvingCount:  13
  regressingCount: 2
  rows[]:          [{date, kind, subject, withPct, basePct, delta, turns, maxReached}]
Render path:
  1. Python embeds rows[] as JSON literal in <script id="report-data">
  2. Page JS reads dataset, hydrates organisms (StatRow, ChartGrid, RunsTable)
  3. No server round-trips after initial load
URL: dist/evals/report/index.html   (file:// or served statically)
```

**Page count: 1**

---

## Summary table

| Level | Count | Components |
|---|---|---|
| **Quark** | 1 file / 40+ tokens | tokens.css |
| **Atom** | 19 | AppTitle, SubtitleText, MetaText, SectionTitle, StatLabel, StatValue, StatSub, KindBadge, DeltaPill, PctCell, FilterInput, KindSelect, CountBadge, PageButton, PageInfo, PageRange, ChartCanvas, EmptyState, SortableColumnHeader |
| **Molecule** | 6 | StatCard, ChartCard, TableToolbar, Pagination, RunsTableHead, RunsTableRow |
| **Organism** | 4 | TopBar, StatRow, ChartGrid, RunsTable |
| **Template** | 1 | EvalPageTemplate |
| **Page** | 1 | EvalHubTrendReport |
| **Total** | **32** | |

---

## Key rules applied

| Rule | Applied where |
|---|---|
| **Presentational — no data fetching** | All atoms/molecules/organisms receive props; only Page reads embedded JSON |
| **All visual properties from quarks** | Every class rule uses `var(--q-*)` or semantic alias; zero raw hex/px values in atoms+ |
| **Props flow downward, imports flow downward** | StatCard → StatLabel/Value/Sub; never reverse |
| **Composition over inheritance** | RunsTable composes TableToolbar + Head + Row + Pagination; no shared base class |
| **`@level` documented** | Every component above carries `@level` and `@composition` |
| **Behaviour at organism level** | Chart.js mounting lives in ChartGrid; table state lives in RunsTable; atoms/molecules are pure HTML |

---

## Build-order plan for implementation worker

Build **strictly bottom-up**. Each phase's output is the input of the next.

```
Phase 0 — Foundation
  [P0-1]  Create components/ directory structure (quarks/ atoms/ molecules/ organisms/ templates/ pages/)
  [P0-2]  Extract tokens.css (quarks/tokens.css) from existing :root — add missing tokens
  [P0-3]  Replace hard-coded values in existing CSS with var(--q-*) references
  [P0-4]  Smoke test: open index.html, verify visual identity unchanged

Phase 1 — Atoms (no dependencies except quarks)
  Batch A: Text atoms (no interaction)
  [P1-1]  AppTitle        (A-01) — h1.app-title
  [P1-2]  SubtitleText    (A-02) — span.subtitle-text
  [P1-3]  MetaText        (A-03) — span.meta-text
  [P1-4]  SectionTitle    (A-04) — h2.section-title
  [P1-5]  StatLabel       (A-05) — div.stat-label
  [P1-6]  StatValue       (A-06) — div.stat-value + sentiment modifiers
  [P1-7]  StatSub         (A-07) — div.stat-sub
  [P1-8]  PageInfo        (A-15) — span.page-info
  [P1-9]  PageRange       (A-16) — span.page-range
  [P1-10] EmptyState      (A-18) — tr.tbl-empty

  Batch B: Interactive / styled atoms
  [P1-11] KindBadge       (A-08) — span.kind-badge + variant modifiers
  [P1-12] DeltaPill       (A-09) — span.delta-pill + pos/neg/neu modifiers
  [P1-13] PctCell         (A-10) — span.pct-cell (null → "—")
  [P1-14] FilterInput     (A-11) — input.filter-input + focus styles
  [P1-15] KindSelect      (A-12) — select.kind-select
  [P1-16] CountBadge      (A-13) — span.count-badge
  [P1-17] PageButton      (A-14) — button.pg-btn + :disabled
  [P1-18] ChartCanvas     (A-17) — div.chart-wrap > canvas
  [P1-19] SortableColumnHeader (A-19) — th.col-header + sorted-asc/sorted-desc

Phase 2 — Molecules (depend on Phase 1 atoms only)
  [P2-1]  StatCard        (M-01) ← StatLabel + StatValue + StatSub
  [P2-2]  ChartCard       (M-02) ← SectionTitle + ChartCanvas
  [P2-3]  RunsTableRow    (M-06) ← KindBadge + DeltaPill + PctCell  [build before head]
  [P2-4]  RunsTableHead   (M-05) ← SortableColumnHeader × 8
  [P2-5]  TableToolbar    (M-03) ← SectionTitle + FilterInput + KindSelect + CountBadge
  [P2-6]  Pagination      (M-04) ← PageButton × 2 + PageInfo + PageRange

Phase 3 — Organisms (depend on Phase 2 molecules)
  [P3-1]  TopBar          (O-01) ← AppTitle + SubtitleText + MetaText
  [P3-2]  StatRow         (O-02) ← StatCard × 4  (no JS behaviour)
  [P3-3]  ChartGrid       (O-03) ← ChartCard × 3 + Chart.js init logic
  [P3-4]  RunsTable       (O-04) ← TableToolbar + RunsTableHead + RunsTableRow + EmptyState + Pagination
                                    + filter/sort/pagination JS (extracted from inline script)

Phase 4 — Templates
  [P4-1]  EvalPageTemplate (T-01) ← TopBar slot + content slot
                                     Move .shell / .body CSS here

Phase 5 — Page assembly
  [P5-1]  EvalHubTrendReport (P-01) ← EvalPageTemplate + all organisms
                                        Wire Python data injection into <script id="report-data">
                                        Move Chart.js to external CDN link (cache gain)
  [P5-2]  Regression test: compare rendered output vs. original screenshot
```

### Dependency graph (critical path)

```
tokens.css (P0)
  └── Atoms (P1) ─────────────────┐
        └── Molecules (P2) ────────┤
              └── Organisms (P3) ──┤
                    └── Template (P4) ──> Page (P5)
```

No phase can start until all tasks in the previous phase pass smoke test.

### Parallelism opportunities

- **P1 Batch A and Batch B** can be split across two workers (text atoms vs. interactive atoms) — they share no imports.
- **P2-1/P2-2** (StatCard, ChartCard) are independent of **P2-3/P2-4/P2-5/P2-6** (table molecules) — split across two workers.
- **P3-1** (TopBar) is independent of **P3-2** (StatRow) and **P3-3** (ChartGrid) — all parallel.
- **P3-4** (RunsTable) must wait for P2-3, P2-4, P2-5, P2-6.

### Validation gate per phase

```bash
# After each phase, open the report and confirm:
# 1. No visual regression vs. original (manual or screenshot diff)
# 2. All tokens resolve (no var() fallback warnings in DevTools)
# 3. Table filter/sort/pagination still works
# 4. All three charts render
# 5. Responsive layout works at 480px, 768px, 1280px
```

---

## Anti-patterns to avoid (from the existing file)

| Anti-pattern found | Rule violated | Correct approach |
|---|---|---|
| `style="color:var(--gray)"` inline on `<span>` | Should be a SubtitleText atom | Use atom class, no inline style |
| `.chart-card h2` targets child element directly | Atom leaks across molecule boundary | SectionTitle atom inside ChartCard molecule |
| `document.getElementById("countBadge").textContent` | Organism reaching into atom by raw ID | Organism owns its molecule's slot; atom re-renders via prop |
| Raw `#e9ebef` hardcoded in `:hover` rule | Violates quark-only styling | Use `--q-gray-200` (slightly darker than gray-100) |
| `margin-left: auto` inline on MetaText `<span>` | Layout rule belongs to the organism (TopBar) | TopBar sets `margin-left: auto` on the slot, not MetaText |
| Mixed Chart.js bundle + report data in one `<script>` | Single-concern violation | Separate script tags: CDN Chart.js + inline data blob + organisms JS module |
