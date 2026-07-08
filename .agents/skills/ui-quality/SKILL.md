---
name: ui-quality
description: >
  UI quality evaluation: design system token compliance, WCAG 2.2 AA accessibility,
  keyboard navigation, colour contrast, accessible names, and Core Web Vitals.
  Load after implementation or for accessibility gate checks. Do NOT load for user
  research, persona definition, usability testing, or information architecture — use
  ux-quality for those.
metadata:
  version: 1.0.0
  scope: tactical
---

# UI Quality Skill

Evaluates the *implementation layer* — whether the interface meets technical and
accessibility standards. Not the experience or intent layer (see ux-quality for that).

## Knowledge generation (always first)

1. Navigate with Playwright — take a screenshot.
2. Run `browser_snapshot` — get the full accessibility tree.
3. Run console error check.
4. Run `bd prime` — load existing design-system decisions and known a11y issues.
Only after these four steps: begin the evaluation below.

## Evaluation dimensions (in order)

### 5. Design System Compliance
- Do colour, spacing, radius, and shadow values match the design system tokens?
- Are components used with the correct variants and theming?
- Are there hardcoded values bypassing the token system?
- **Evidence:** grep CSS for hardcoded values; compare token definitions vs. observed usage.

### 6. Accessibility — WCAG 2.2 AA

**Mandatory browser tests — code inspection is NOT sufficient:**

| Check | Method |
|---|---|
| Keyboard navigation | Press Tab/Shift-Tab through every interactive element in the browser |
| Focus indicator | Observe visible outline after each Tab keypress in Playwright |
| Accessible names | Read `browser_snapshot` tree — all images, inputs, buttons must have names |
| Colour contrast | DevTools computed style or axe-core — never calculated from hex alone |
| Error announcement | Trigger form error; confirm the error text is in the accessibility tree |
| Landmark structure | `<nav>`, `<main>`, `<aside>` each have `aria-label` when >1 exists |

**Evidence labelling (mandatory for every finding):**
- **[VERIFIED — browser-tested]** : tested in Playwright or confirmed via axe-core output
- **[ASSUMPTION — code-inspection]** : inferred from code without browser interaction → must add "Needs browser verification to confirm."

**WCAG 2.2 AA gate — any FAIL = BLOCK severity:**
- [ ] All interactive elements reachable by keyboard
- [ ] Visible focus indicator on every focusable element
- [ ] Contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] All images have meaningful `alt` or `aria-label`
- [ ] All form inputs have associated `<label>` or `aria-label`

### 7. Performance
- Core Web Vitals: LCP, CLS, INP — measure, do not estimate.
- Bundle cost: heavy library imported for minor feature?
- Perceived speed: loading skeletons, optimistic UI, progressive enhancement?
- **Evidence:** Lighthouse score or network waterfall screenshot.

### 8. Evidence Quality Gate
Before any finding is reported, confirm:
- Element + location (file:line or CSS selector)
- Browser-measured value or axe-core output for WCAG items
- HIGH / CRITICAL findings must be [VERIFIED — browser-tested]; no [ASSUMPTION] at this severity.

## Gotchas

- **Keyboard test ≠ reading HTML** — pressing Tab in Playwright is the only valid method. Reading `<a>` tags in source is [ASSUMPTION].
- **Contrast ≠ hex calculation** — use axe-core or DevTools computed colour. Luminance maths on hex is [ASSUMPTION].
- **focus-visible grep ≠ visible focus** — Tab through the page to observe the rendered outline.
- **Zero issues is valid** — output "PASS — UI quality gate clear" with the evidence checklist.

## Self-validation
Before finalising:
- [ ] Keyboard navigation tested by pressing Tab in the browser
- [ ] Every a11y finding labeled [VERIFIED] or [ASSUMPTION]
- [ ] Design system deviations cite specific token names and observed values
- [ ] HIGH/CRITICAL findings have browser screenshots or axe-core output

## Maker/Checker
ui-quality evaluation is verified by:
- **qa-automation** — are the a11y issues reproducible with automated tools?
- **ux-researcher** — do the design patterns match the validated user journeys?
- Do not self-approve CRITICAL accessibility findings without second-pass browser evidence.

## Output format

```markdown
## UI Quality: [surface]

**Evidence:** [Playwright / axe-core / code-inspection]
**Keyboard tested:** [yes / no]   **axe-core run:** [yes / no]

## Findings

| Severity | Dimension | Element | Issue | Evidence label |
|---|---|---|---|---|

## WCAG 2.2 AA checklist
- [ ] Keyboard nav   - [ ] Focus indicator   - [ ] Contrast
- [ ] Accessible names   - [ ] Form labels   - [ ] Landmarks

## PASS / FAIL
[PASS — UI quality gate clear | FAIL — N findings, BLOCK items: X]

## Beads follow-ups
bd create "UI: <finding>" --assignee ui-designer -p 2 --json
```

## Beads loop

  bd prime                    → load design-system pointers and known a11y issues
  bd ready --json             → check for open UI quality beads
  bd remember "Design system: canonical source is <file>; read when auditing tokens; invariant: never hardcode values that bypass the token system." --key design-system-pointer
  bd create "UI: <finding>" --assignee ui-designer -p 2   → file issues

**Remember**: UI quality is the implementation layer — browser evidence is the only acceptable proof; code inspection alone is always [ASSUMPTION].
