

---

## POUR Framework (WCAG 2.2 — from phazurlabs/accessibility-inclusive-design)

**Perceivable** — information presentable in ways all users can perceive
- Text alternatives for all non-text content (images, icons, charts)
- Captions and transcripts for audio/video
- Colour contrast ≥ 4.5:1 (normal text) / ≥ 3:1 (large text)

**Operable** — UI components and navigation must be operable
- All functionality available via keyboard
- No content that flashes >3 times/second
- Skip links for navigation; focus order logical

**Understandable** — information and UI operation must be understandable
- Language of page declared (`lang` attribute)
- Error identification: describe what is wrong and how to fix it
- Labels or instructions when input is required

**Robust** — content parseable by assistive technologies
- Valid HTML; ARIA used correctly (roles, states, properties)
- Status messages programmatically determined

### Inclusive Design Spectrum (Microsoft)
Disability is permanent / temporary / situational:
- One arm → arm injury → holding a baby
- Blind → eye infection → distracted driver
- Deaf → ear infection → loud restaurant
Designing for permanent disability creates solutions that help everyone.

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
