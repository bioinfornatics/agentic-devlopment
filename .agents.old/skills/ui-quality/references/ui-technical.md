

---

## WCAG 2.2 Level AA Checklist (from mastepanoski/wcag-accessibility-audit + phazurlabs/accessibility-inclusive-design)

WCAG 2.2 is a W3C Recommendation and ISO/IEC 40500:2025. Level AA is the target for most organizations.

### Perceivable — Critical Criteria

**1.1.1 Non-text Content (A)**
- All images, icons, graphics: meaningful `alt` text
- Decorative images: `alt=""` or `role="presentation"`
- Complex images (charts, diagrams): extended descriptions

**1.3.1 Info and Relationships (A)**
- Semantic HTML (headings, lists, tables, forms)
- Heading hierarchy h1 → h2 → h3 (no skipping)
- Form labels associated with inputs (`<label for>` or wrapping)
- Tables have proper `<th>` headers with `scope`

**1.3.2 Meaningful Sequence (A)**
- Content order logical when CSS disabled
- Reading order matches visual order
- Tab order is logical

**1.4.1 Use of Color (A)**
- Information never conveyed by color alone
- Add icons, patterns, or text as alternatives

**1.4.3 Contrast (Minimum) (AA)**
- Normal text: ≥ 4.5:1 contrast ratio
- Large text (≥18pt or 14pt bold): ≥ 3:1
- UI components: ≥ 3:1
- Tool: WebAIM Contrast Checker

**1.4.4 Resize Text (AA)**
- Text resizable to 200% without loss of content/functionality
- No horizontal scrolling at 200% zoom (1280px width)

**1.4.10 Reflow (AA) — WCAG 2.1**
- Content reflows to 320px width without horizontal scroll
- Responsive design required

**1.4.11 Non-text Contrast (AA) — WCAG 2.1**
- UI components and graphical objects: ≥ 3:1 contrast
- Focus indicators, buttons, form controls, chart elements

**1.4.12 Text Spacing (AA) — WCAG 2.1**
- No loss of content when user adjusts:
  - Line height: 1.5× font size
  - Paragraph spacing: 2× font size
  - Letter spacing: 0.12× font size
  - Word spacing: 0.16× font size

### Operable — Critical Criteria

**2.1.1 Keyboard (A)**
- All functionality via keyboard (Tab, Enter, Space, Arrow, Esc)
- No keyboard traps (can always navigate away)
- Test: navigate entire site with keyboard only

**2.1.2 No Keyboard Trap (A)**
- Modal dialogs closable with Esc
- Focus returns properly after closing

**2.1.4 Character Key Shortcuts (A) — WCAG 2.1**
- Single-character shortcuts can be turned off, remapped, or only active on focus

**2.4.1 Bypass Blocks (A)**
- "Skip to main content" link
- Landmark regions (header, nav, main, footer)

**2.4.2 Page Titled (A)**
- Unique, descriptive `<title>` on every page
- Format: "Page Name - Site Name"

**2.4.3 Focus Order (A)**
- Focus order is logical and intuitive
- Matches visual/reading order

**2.4.4 Link Purpose (In Context) (A)**
- Link text describes destination
- Avoid "click here", "read more" — use "Download Q4 Report (PDF)"

**2.4.5 Multiple Ways (AA)**
- At least 2 ways to find pages (navigation, search, sitemap, breadcrumbs)

**2.4.6 Headings and Labels (AA)**
- Descriptive headings and form labels
- Clear heading hierarchy

**2.4.7 Focus Visible (AA)**
- Visible keyboard focus indicator
- Minimum 2px outline, high contrast
- Never remove outline without replacement

**2.4.11 Focus Not Obscured (Minimum) (AA) — WCAG 2.2**
- Focused component never entirely hidden by sticky headers, overlays, or dialogs

**2.5.1 Pointer Gestures (A) — WCAG 2.1**
- Multi-point/path gestures have single-pointer alternative
- Pinch zoom → buttons; swipe → arrow buttons

**2.5.8 Target Size (Minimum) (AA) — WCAG 2.2**
- Minimum target size: 24×24px (or 44×44px for touch per 2.5.5 AAA)

### Understandable — Critical Criteria

**3.1.1 Language of Page (A)**
- `<html lang="en">` or appropriate language code

**3.1.2 Language of Parts (AA)**
- Passages in different language marked with `lang` attribute

**3.2.1 On Focus (A)**
- Focus does not trigger unexpected context change

**3.2.2 On Input (A)**
- Input does not trigger unexpected context change unless warned

**3.2.3 Consistent Navigation (AA)**
- Navigation in same order across pages

**3.2.4 Consistent Identification (AA)**
- Components with same function identified consistently

**3.3.1 Error Identification (A)**
- Errors identified in text, not just color

**3.3.2 Labels or Instructions (A)**
- Labels or instructions when input required

**3.3.3 Error Suggestion (AA)**
- Error messages explain how to fix

**3.3.4 Error Prevention (AA)**
- Legal/financial/data submissions: reversible, checked, or confirmed

**3.3.7 Redundant Entry (A) — WCAG 2.2**
- Information previously entered auto-populated or available

**3.3.8 Accessible Authentication (Minimum) (AA) — WCAG 2.2**
- Cognitive function tests (memory, puzzles) not required for login
- Alternative authentication methods available

### Robust — Critical Criteria

**4.1.2 Name, Role, Value (A)**
- Custom components have accessible name, role, state
- ARIA used correctly

**4.1.3 Status Messages (AA) — WCAG 2.1**
- Status messages announced by screen readers without focus
- Use `role="status"`, `role="alert"`, or `aria-live`

### Inclusive Design Spectrum (Microsoft)

Disability is permanent / temporary / situational:
- One arm → arm injury → holding a baby
- Blind → eye infection → distracted driver
- Deaf → ear infection → loud restaurant
Designing for permanent disability creates solutions that help everyone.

### WCAG Testing Tools

**Automated Tools**
- axe DevTools — comprehensive automated checks
- WAVE — visual accessibility checker
- Lighthouse — accessibility score in Chrome DevTools
- W3C Validator — HTML validation

**Manual Testing**
- Keyboard navigation (Tab, Enter, Space, Esc, Arrows)
- Screen reader (NVDA, VoiceOver, JAWS)
- Zoom to 200%
- Mobile reflow at 320px
- Color contrast analyzer

---

## Code-level rules (from Vercel web-design-guidelines)

### Focus states
- Never `outline: none` without an explicit focus replacement
- Use `:focus-visible` over `:focus` (avoids ring on click, shows on keyboard)
- Group focus: `:focus-within` for compound controls

### Forms
- Inputs need `autocomplete` + meaningful `name`
- Use correct `type` (email, tel, url, number) + `inputmode`
- Labels clickable (`htmlFor` or wrapping control) — no dead zones
- Errors inline next to fields; focus first error on submit
- Warn before navigation with unsaved changes

### Animation
- Honor `prefers-reduced-motion` (provide reduced variant or disable)
- Animate `transform`/`opacity` only (compositor-friendly)
- Never `transition: all` — list properties explicitly

### Typography
- Use `…` (entity) not `...` (three dots)
- Curly quotes `"`/`"` not straight `"`
- `font-variant-numeric: tabular-nums` for number columns
- `text-wrap: balance` or `text-pretty` on headings (prevents widows)

### Performance
- Large lists (>50 items): virtualise (`content-visibility: auto`)
- No layout reads (`getBoundingClientRect`, `offsetHeight`) in render path
- `<link rel="preconnect">` for CDN/asset domains
- Critical fonts: `<link rel="preload" as="font">` + `font-display: swap`

### Navigation & state
- URL reflects state (filters, tabs, pagination, expanded panels)
- Links use `<a>/<Link>` — not `<div onClick>` (Cmd/Ctrl+click support)
- Destructive actions need confirmation modal or undo — never immediate

### Touch
- `touch-action: manipulation` (prevents double-tap zoom delay)
- `overscroll-behavior: contain` in modals/drawers

---

## Web Design Guidelines — Rules (TLC/Vercel)

### Forms
- Every `<input>` needs a `<label>` (not just placeholder)
- Use `type="email"`, `type="tel"`, `type="url"` — not `type="text"` for everything
- `autocomplete` attribute mandatory on login/signup forms
- Inline validation: show errors next to the field, not in a summary at top
- Never disable the submit button to prevent submission — explain errors instead

### Animation
- All animations MUST respect `prefers-reduced-motion`
- Use `transform` and `opacity` only — avoid animating `width`, `height`, `top`, `left`
- Never use `transition: all` — enumerate properties explicitly
- Animations must be interruptible by user interaction

### Typography
- Use `font-variant-numeric: tabular-nums` for numbers in tables
- Use `text-wrap: balance` on headings
- Curly quotes (`"` `"`) not straight quotes (`"`)
- Ellipsis character `…` not three dots `...`

### Content handling
- Every list, table, feed must handle the empty state explicitly
- Truncate long text with `truncate` / `line-clamp` — never let it overflow
- `min-w-0` on flex children that contain text (prevent overflow)

### Performance
- Images below the fold: `loading="lazy"`
- Images above the fold: `fetchpriority="high"` + explicit `width`/`height` (prevents CLS)
- Lists > 50 items: virtualize
- Never read layout properties (getBoundingClientRect) in a render loop

### Touch & Mobile
- `touch-action: manipulation` on interactive elements (prevents 300ms delay)
- `overscroll-behavior: contain` inside modals/drawers
- Minimum touch target: 44×44px (WCAG 2.5.5)
