---
name: ui-ux-quality
description: >
  Unified UI/UX quality method: research, design taste, design systems, frontend states, accessibility, and visual verification.
metadata:
  version: 1.0.0
---

# UI/UX Quality Skill

## Evaluation stack

1. **User intent** — what job is the user trying to complete?
2. **Information architecture** — clear hierarchy, labels, navigation.
3. **Interaction states** — loading, empty, error, success, disabled, focus, offline.
4. **Visual taste** — avoid generic AI gradients/cards; use deliberate spacing, contrast, rhythm, and typography.
5. **Design system** — tokens, component API, variants, theming, Storybook/docs.
6. **Accessibility** — WCAG 2.2 AA baseline, keyboard, screen reader names, focus order, contrast.
7. **Performance** — Core Web Vitals, bundle cost, perceived speed.
8. **Evidence** — screenshots, browser console, a11y notes, reproduction steps.

## Output

- UX verdict.
- Top 5 issues by user impact.
- Accessibility blockers.
- Visual/design-system recommendations.
- Beads follow-ups with priority.

## Knowledge generation

Before any UX evaluation, generate knowledge about the surface:
1. Navigate to the page with browser tooling (Playwright) — do not inspect HTML statically.
2. Take an initial screenshot at the default viewport.
3. Run `browser_snapshot` to get the accessibility tree.
4. Check console errors.
Only after these four steps: begin the 8-dimension evaluation.

## Gotchas

- **No finding without browser evidence** — "the contrast looks low" based on reading CSS hex values is an assumption, not a verified finding. Label it [ASSUMPTION — code-inspection] and mark "needs browser verification".
- **[VERIFIED] vs [ASSUMPTION]** — every finding must carry one of these labels. Findings labeled [ASSUMPTION] without browser confirmation cannot be CRITICAL or HIGH severity.
- **8 dimensions in order** — evaluate User Intent first, Evidence last. Do not skip to accessibility before checking Information Architecture.
- **Zero findings is valid** — if the surface passes all checks, output "PASS — no issues detected" with the evidence list. Never manufacture findings.
- **Static CSS inspection ≠ browser test** — reading `:focus` rules in CSS does not confirm a visible focus indicator. Tab through the page to observe actual focus.

## Self-validation loop

### Before finalising any UX report, verify:
- [ ] Every finding carries [VERIFIED — browser-tested] or [ASSUMPTION — code-inspection]
- [ ] At least one screenshot or accessibility snapshot is cited as evidence
- [ ] Findings are ranked by user impact (critical-path failures > aesthetic nits)
- [ ] WCAG 2.2 AA blockers are listed separately from recommendations
- [ ] Zero-findings output includes the evidence checklist (not just "no issues")

## Maker/Checker

UX audits follow a maker/checker pattern:
- Automated scan (pa11y, axe-core) = first pass maker
- Browser keyboard navigation = independent checker of focus/tab order
- Human (or second agent) = reviewer of high-severity findings before BLOCK verdict

Do not self-approve CRITICAL or HIGH findings — require a second pass with explicit browser evidence.

## Beads loop

Orient before auditing:
  bd prime            → load any existing UX issues and design decisions
  bd ready --json     → check for open UX beads
  bd create "UX research: <finding>" --assignee ux-researcher -p 2   → file research findings
  bd create "UI design: <finding>" --assignee ui-designer -p 2         → file design/a11y findings
  bd remember "Design system: canonical source is <file>; read when..." --key design-system-pointer
