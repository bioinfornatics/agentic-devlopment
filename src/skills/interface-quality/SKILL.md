---
name: interface-quality
description: >
  Shared quality floor for UI evaluation: evidence labeling, anti-generic patterns,
  and structural quality rules. Load as a dependency of ui-design, ux-principles,
  or wcag-accessibility-audit — not as a standalone skill for direct user queries.
  Do NOT use directly for user-facing queries; load specialized skills (ui-design,
  ux-principles, wcag-accessibility-audit) instead.
metadata:
  version: 1.0.0
  scope: foundation
  usage: conditional-dependency
---

# Interface Quality

Foundation skill providing shared evidence standards and quality rules for interface evaluation. This skill does not perform audits directly — it defines the quality floor that specialized skills (ui-design, ux-principles, wcag-accessibility-audit) build upon.

## Evidence labeling contract

All interface evaluation findings must use explicit evidence labels:

| Label | Meaning | When to use |
|-------|---------|-------------|
| `[VERIFIED — browser-tested]` | Observed in rendered interface via Playwright or browser DevTools | Required for HIGH/CRITICAL findings |
| `[VERIFIED — axe-core]` | Automated accessibility tool output | Accessibility-specific findings |
| `[VERIFIED — measured]` | Quantitative measurement (contrast ratio, timing, pixel values) | Performance and specification findings |
| `[ASSUMPTION — code-inspection]` | Inferred from source code without browser verification | Must note "Needs browser verification" |
| `[ASSUMPTION — design-file]` | Inferred from design mockup, not implemented UI | Must note implementation may differ |

**Rule**: No HIGH or CRITICAL finding may carry an `[ASSUMPTION]` label. Escalate to browser verification or downgrade severity.

## Anti-generic quality rules

Reject findings that are:

1. **Vague** — "improve the UI" without specific element and criterion
2. **Taste-based** — "looks dated" without reference to a violated pattern or standard
3. **Aspirational** — "could be better" without evidence of actual user or standard violation
4. **Copied** — generic checklist items not observed in this specific interface

Valid findings must cite:
- **Element**: specific selector, component name, or screenshot region
- **Criterion**: which standard, heuristic, or pattern is violated
- **Evidence**: observed behavior or measurement, with label
- **Impact**: who is affected and how

## Structural quality dimensions

Interface evaluation covers these orthogonal concerns:

| Dimension | Owner skill | This skill provides |
|-----------|-------------|---------------------|
| Visual decisions | ui-design | Evidence standards for design token and hierarchy claims |
| User journeys | ux-principles | Evidence standards for interaction state and flow claims |
| WCAG conformance | wcag-accessibility-audit | Evidence standards for accessibility claims |
| Shared floor | interface-quality | Labeling rules, anti-generic rules, finding structure |

## Finding structure

```yaml
finding:
  id: IQ-001
  severity: LOW | MEDIUM | HIGH | CRITICAL
  dimension: visual | journey | accessibility | structural
  element: CSS selector or component path
  criterion: standard or pattern violated
  observed: what was measured or seen
  expected: what the standard requires
  evidence_label: "[VERIFIED — browser-tested]"
  impact: who is affected and how
  recommendation: specific remediation
```

## Severity definitions

| Severity | Definition | Evidence requirement |
|----------|------------|---------------------|
| CRITICAL | Blocks user task completion or violates legal requirement | `[VERIFIED]` mandatory |
| HIGH | Significantly degrades experience for a user group | `[VERIFIED]` mandatory |
| MEDIUM | Noticeable friction but workaround exists | `[VERIFIED]` or `[ASSUMPTION]` with note |
| LOW | Minor polish issue | Any label acceptable |

## Self-validation checklist

Before finalizing any interface evaluation:

- [ ] Every finding has an explicit evidence label
- [ ] No HIGH/CRITICAL findings carry `[ASSUMPTION]` labels
- [ ] Findings cite specific elements, not general areas
- [ ] Findings reference violated standards or patterns
- [ ] "Zero findings" is documented as PASS with evidence of what was checked
- [ ] Findings avoid vague, taste-based, or aspirational language

## Knowledge generation

Orient before applying quality rules: identify the interface type (web/mobile/native), the project's design system token conventions, and any prior findings or constraints in the current session. This context prevents generic checklists from replacing observed evidence.

- [ ] Interface context (type, design system, prior session findings) was oriented before applying rules.

## Integration with specialized skills

This skill is loaded automatically by:
- `ui-design` — for visual decision evaluation
- `ux-principles` — for journey and interaction evaluation  
- `wcag-accessibility-audit` — for formal accessibility conformance

Do not load this skill directly for user-facing queries. Load the appropriate specialized skill instead.
