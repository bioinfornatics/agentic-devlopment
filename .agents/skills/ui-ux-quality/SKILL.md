---
name: ui-ux-quality
description: >
  Adaptive UI/UX quality evaluation. Detects context and loads the matching reference:
  UX research (user intent, IA, interaction states, design taste) OR UI technical audit
  (design system tokens, WCAG 2.2 AA, performance, evidence). Load both for full reviews.
metadata:
  version: 4.0.0
---

# UI/UX Quality Skill

## Detect type — load matching reference

| Context signal | Type | Load |
|---|---|---|
| User flows, personas, IA, design taste | UX Research | references/ux-research.md |
| Design system, WCAG, a11y, performance | UI Technical | references/ui-technical.md |
| Full product audit | Both | Load both, UX first then UI |

## Universal rules

- Browser first — navigate with Playwright before inspecting any code.
- No finding without evidence — every finding is [VERIFIED] or [ASSUMPTION].
- Zero findings is valid — output "PASS" with evidence checklist. Never manufacture findings.

## Knowledge generation (always before any reference)

1. Navigate with Playwright — screenshot + browser_snapshot.
2. Check console errors.
3. Run bd prime — load design decisions and past issues.
Then load the matching reference above.

## Output format

```markdown
## UI/UX Evaluation: [surface]
Type: [UX Research | UI Technical | Full]
Evidence: [Playwright / axe-core / code-inspection]

## Findings
| Severity | Dimension | Element | Issue | Evidence |

## WCAG 2.2 AA (UI Technical only)
[checklist]

## Beads follow-ups
bd create "UX: <finding>" --assignee ux-researcher -p 2
bd create "UI: <finding>" --assignee ui-designer -p 2
```

## Maker/Checker
- Automated scan (pa11y, axe-core) = first-pass maker
- Browser keyboard navigation = independent checker
- HIGH/CRITICAL findings require second-pass browser evidence

## Beads loop
  bd prime         → load UX/UI issues and design-system memories
  bd ready --json  → check for open UX/UI beads
