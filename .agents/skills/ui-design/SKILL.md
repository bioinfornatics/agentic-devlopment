---
name: ui-design
description: >
  Evaluate visual design decisions: design system token compliance, visual hierarchy,
  spacing rhythm, typography scale, and color usage. Requires browser evidence
  (Playwright screenshots or DevTools inspection). Use when reviewing implemented
  UI for design consistency, auditing design system usage, or validating visual
  specifications.
  Do NOT use for accessibility conformance (use wcag-accessibility-audit), user
  journey evaluation (use ux-principles), or code review without rendered interface.
metadata:
  version: 1.0.0
  scope: tactical
  dependencies:
    - interface-quality
---

# UI Design Evaluation

Evaluates **visual design decisions** in rendered interfaces. Focuses on whether implementation matches design intent and follows design system conventions.

**Prerequisite**: This skill requires `interface-quality` for evidence labeling standards. Load it first or it will be loaded automatically.

## Scope boundaries

| In scope | Out of scope |
|----------|--------------|
| Design token compliance | WCAG conformance (→ wcag-accessibility-audit) |
| Visual hierarchy | User journey flows (→ ux-principles) |
| Spacing and layout rhythm | Backend logic |
| Typography scale | Performance optimization |
| Color palette usage | Code architecture |
| Component variant consistency | Accessibility tree structure |

## Knowledge generation (always first)

1. **Capture evidence** — Playwright screenshot at target viewport(s)
2. **Inspect tokens** — DevTools computed styles for spacing, color, typography
3. **Load design system** — Identify token source (CSS variables, Tailwind config, theme file)
4. **Load context** — `bd prime` for existing design decisions and known issues

Only after gathering evidence: begin evaluation.

## Evaluation dimensions

### 1. Design Token Compliance

Check for proper token usage across three layers:

| Layer | Purpose | Valid usage |
|-------|---------|-------------|
| Reference | Raw values (`--color-blue-500`) | Never in components |
| Semantic | Meaning (`--color-action-primary`) | Component styles |
| Component | Specific (`--button-bg`) | That component only |

**Findings to flag:**
- Hardcoded values bypassing token system
- Reference tokens used directly in components
- Inconsistent semantic token application
- Missing component tokens for repeated patterns

**Evidence**: grep for hardcoded hex/px values; compare token definitions vs. computed styles.

### 2. Visual Hierarchy

Evaluate deliberate ordering of visual importance:

- **Size progression**: Do headings follow a clear scale (h1 > h2 > h3)?
- **Weight contrast**: Is emphasis applied consistently (bold for labels, regular for values)?
- **Color differentiation**: Do primary actions stand out from secondary?
- **Spatial grouping**: Are related elements closer than unrelated elements?

**Evidence**: Screenshot with annotated hierarchy levels; computed font-size/weight values.

### 3. Spacing Rhythm

Check for consistent spacing scale application:

- **Base unit**: Is there a clear base (4px, 8px) with multipliers?
- **Consistency**: Same spacing for same relationships across components?
- **Density**: Appropriate for the interface type (dense for data, relaxed for marketing)?

**Evidence**: Measured pixel values for margins/padding; comparison to defined scale.

### 4. Typography Scale

Evaluate type system implementation:

- **Scale**: Clear progression (12/14/16/18/24/32 or similar ratio-based)
- **Families**: Limited to 1-2 font families with clear roles
- **Line height**: Appropriate for text size (1.5 for body, tighter for headings)
- **Measure**: Line length appropriate for readability (45-75 characters)

**Evidence**: Computed font values from DevTools; character count per line.

### 5. Color Usage

Check color palette application:

- **Palette adherence**: All colors from defined palette?
- **Semantic consistency**: Same meaning = same color across interface?
- **Contrast relationships**: Foreground/background pairings intentional?
- **State indication**: Hover, active, disabled states use consistent modifications?

**Evidence**: List of computed colors; comparison to palette definition.

## Output format

```markdown
## UI Design Evaluation: [component/page name]

**Evidence**: [Playwright screenshot / DevTools inspection / Design file comparison]
**Design system**: [Token source file or "none identified"]
**Viewport**: [width × height]

### Token Compliance
[Findings with evidence labels per interface-quality standards]

### Visual Hierarchy  
[Findings with evidence labels]

### Spacing Rhythm
[Findings with evidence labels]

### Typography Scale
[Findings with evidence labels]

### Color Usage
[Findings with evidence labels]

## Summary

| Dimension | Status | Findings |
|-----------|--------|----------|
| Token compliance | PASS/FAIL | N |
| Visual hierarchy | PASS/FAIL | N |
| Spacing rhythm | PASS/FAIL | N |
| Typography scale | PASS/FAIL | N |
| Color usage | PASS/FAIL | N |

**Overall**: [PASS — design review clear | FAIL — N findings]

## Beads follow-ups
bd create "UI Design: <finding>" --type bug -p 2
```

## Self-validation

Before finalizing:

- [ ] Evidence gathered from rendered interface (not design file alone)
- [ ] Token source identified and referenced
- [ ] All findings use evidence labels from interface-quality
- [ ] No HIGH/CRITICAL findings with `[ASSUMPTION]` labels
- [ ] Findings cite specific token names and measured values
- [ ] Zero findings documented as PASS with evidence of what was checked

## Gotchas

- **Design file ≠ implementation** — Always verify in browser; design files are `[ASSUMPTION]`
- **Tailwind classes ≠ tokens** — Tailwind utilities may bypass semantic layer; check computed values
- **Dark mode** — Test both themes if applicable; token mappings may differ
- **Responsive** — Check multiple viewports; spacing/typography may adapt

## Maker/Checker

UI design evaluation is verified by:
- **design-lead** — Does evaluation match design intent?
- **frontend-developer** — Are token references accurate?

Do not self-approve findings that contradict documented design decisions without stakeholder review.
