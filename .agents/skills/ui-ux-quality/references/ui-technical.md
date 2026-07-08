# UI Technical Evaluation

**When to load:** design system token audit, WCAG 2.2 AA, performance, evidence — the tactical UI dimensions.

## Dimensions 5–8

### 5. Design System
- Tokens: do colour, spacing, radius, shadow values match the design system?
- Deviations: any hardcoded values bypassing the token system?
- Evidence: grep CSS for hardcoded values; compare token definitions vs. usage.

### 6. Accessibility — WCAG 2.2 AA

Mandatory browser tests (NOT code inspection):

| Check | How to verify |
|---|---|
| Keyboard nav | Tab/Shift-Tab through every interactive element in the browser |
| Focus indicator | Observe visible outline after each Tab keypress |
| Accessible names | browser_snapshot accessibility tree — all images, inputs, buttons named |
| Colour contrast | Browser DevTools or axe-core — not calculated from hex values |
| Error announcements | Trigger form error; confirm visible message |

Evidence labelling (mandatory for every finding):
- [VERIFIED — browser-tested]: tested in Playwright or via axe-core
- [ASSUMPTION — code-inspection]: inferred from code → add "Needs browser verification."

WCAG 2.2 AA gate — FAIL any = BLOCK severity:
- [ ] All interactive elements reachable by keyboard
- [ ] Visible focus indicator on every focusable element
- [ ] Contrast ratio >= 4.5:1 normal text, >= 3:1 large text
- [ ] All images have meaningful alt or aria-label
- [ ] All form inputs have associated labels

### 7. Performance
- Core Web Vitals: LCP, CLS, INP — measure, do not estimate.
- Bundle cost: 500KB library for minor functionality?
- Evidence: Lighthouse scores or network waterfall screenshot.

### 8. Evidence Quality
- Every finding in dimensions 5-7 must cite: element + file:line or browser-measured value.
- HIGH/CRITICAL requires browser-verified evidence.
- Summary: screenshot count, axe-core run (y/n), keyboard test (y/n).

## Self-validation (UI technical)
- [ ] Keyboard navigation tested by pressing Tab in the browser (not by reading HTML)
- [ ] Every a11y finding labeled [VERIFIED] or [ASSUMPTION]
- [ ] Design system deviations cite specific token names and observed values
- [ ] HIGH/CRITICAL findings have browser screenshots or axe output
