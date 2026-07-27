---
name: wcag-accessibility-audit
description: >
  Formal WCAG 2.2 conformance audit for web interfaces. Covers all four POUR
  principles (Perceivable, Operable, Understandable, Robust) with structured
  per-criterion evidence. Produces compliance reports with explicit pass/fail
  verdicts. Use for accessibility audits, compliance documentation, or pre-release
  accessibility gates.
  Do NOT use for visual design review (use ui-design), journey evaluation (use
  ux-principles), non-web interfaces, or sessions without a rendered web interface.
metadata:
  version: 1.0.0
  scope: compliance
  dependencies:
    - interface-quality
---

# WCAG Accessibility Audit

Performs **formal WCAG 2.2 conformance evaluation** for web interfaces. Produces structured evidence for each success criterion with explicit verdicts.

**Prerequisite**: This skill requires `interface-quality` for evidence labeling standards. Load it first or it will be loaded automatically.

## Critical constraint: Evidence-based verdicts only

This skill **never claims conformance without browser-verified evidence**.

| Verdict | Requires |
|---------|----------|
| PASS | Browser test or axe-core confirmation |
| FAIL | Browser test demonstrating violation |
| NOT TESTED | Criterion applicable but not evaluated |
| NOT APPLICABLE | Criterion does not apply to this content |

**Forbidden**: Claiming PASS based on code inspection alone. Code inspection produces `[ASSUMPTION]` evidence, which cannot support a PASS verdict.

## Scope boundaries

| In scope | Out of scope |
|----------|--------------|
| WCAG 2.2 Level A criteria | Visual design quality (→ ui-design) |
| WCAG 2.2 Level AA criteria | User journey flows (→ ux-principles) |
| WCAG 2.2 Level AAA criteria (when requested) | Non-web interfaces |
| Assistive technology compatibility | Backend accessibility |
| Accessibility tree structure | Performance |

## Knowledge generation (always first)

1. **Run automated scan** — axe-core, Lighthouse accessibility, or WAVE
2. **Capture accessibility tree** — Playwright `browser_snapshot` or DevTools
3. **Test keyboard navigation** — Tab through all interactive elements
4. **Test screen reader** — Verify announcements for key interactions
5. **Load context** — `bd prime` for existing accessibility issues

Only after gathering evidence: begin criterion-by-criterion evaluation.

## WCAG 2.2 structure

### The Four Principles (POUR)

| Principle | Meaning | Guidelines |
|-----------|---------|------------|
| **Perceivable** | Users can perceive content | 1.1–1.4 |
| **Operable** | Users can operate interface | 2.1–2.5 |
| **Understandable** | Users can understand content | 3.1–3.3 |
| **Robust** | Content works with assistive tech | 4.1 |

### Conformance Levels

| Level | Meaning | Typical requirement |
|-------|---------|---------------------|
| A | Minimum | Basic accessibility |
| AA | Standard | Legal compliance (ADA, EAA) |
| AAA | Enhanced | Specific user needs |

**Default target**: AA (most common legal and policy requirement)

## Level AA essential criteria

### Perceivable

| Criterion | Test method | Common failures |
|-----------|-------------|-----------------|
| 1.1.1 Non-text Content | Check all images for alt text | Decorative images with alt, informative images without |
| 1.3.1 Info and Relationships | Inspect heading structure, form labels | Headings skipped, labels not associated |
| 1.3.2 Meaningful Sequence | Tab order matches visual order | Focus jumps unexpectedly |
| 1.4.1 Use of Color | Information conveyed by color alone? | Error indicated only by red |
| 1.4.3 Contrast (Minimum) | Measure contrast ratio | Text below 4.5:1, large text below 3:1 |
| 1.4.4 Resize Text | Zoom to 200% | Content truncated or overlapping |
| 1.4.10 Reflow | 320px viewport | Horizontal scrolling required |
| 1.4.11 Non-text Contrast | UI component contrast | Icons, borders below 3:1 |

### Operable

| Criterion | Test method | Common failures |
|-----------|-------------|-----------------|
| 2.1.1 Keyboard | Tab through all functions | Mouse-only interactions |
| 2.1.2 No Keyboard Trap | Can Tab away from all elements | Modal traps focus |
| 2.4.1 Bypass Blocks | Skip link or landmarks | No way to skip navigation |
| 2.4.2 Page Titled | Check `<title>` | Generic or missing title |
| 2.4.3 Focus Order | Tab order logical? | Focus sequence illogical |
| 2.4.4 Link Purpose | Link text descriptive? | "Click here", "Read more" |
| 2.4.6 Headings and Labels | Descriptive? | Generic labels |
| 2.4.7 Focus Visible | Visible focus indicator | Focus ring removed |
| 2.4.11 Focus Not Obscured | Focus visible when shown | Sticky header covers focus |

### Understandable

| Criterion | Test method | Common failures |
|-----------|-------------|-----------------|
| 3.1.1 Language of Page | Check `lang` attribute | Missing or wrong |
| 3.2.1 On Focus | Focus triggers unexpected change? | Auto-submit on focus |
| 3.2.2 On Input | Input triggers unexpected change? | Auto-navigation on select |
| 3.3.1 Error Identification | Errors described in text | Error indicated only visually |
| 3.3.2 Labels or Instructions | Form fields have labels | Placeholder-only labels |
| 3.3.3 Error Suggestion | Suggestions provided | Generic error messages |

### Robust

| Criterion | Test method | Common failures |
|-----------|-------------|-----------------|
| 4.1.1 Parsing | HTML validator | Duplicate IDs, unclosed tags |
| 4.1.2 Name, Role, Value | Accessibility tree | Missing ARIA, wrong roles |

## WCAG 2.2 new criteria (Level AA)

| Criterion | Requirement | Test method |
|-----------|-------------|-------------|
| 2.4.11 Focus Not Obscured (Minimum) | Focused element not fully hidden | Tab with sticky elements |
| 2.5.7 Dragging Movements | Single-pointer alternative | Test drag operations |
| 2.5.8 Target Size (Minimum) | 24×24px or spacing | Measure touch targets |
| 3.2.6 Consistent Help | Help in same location | Check multiple pages |
| 3.3.7 Redundant Entry | Don't re-ask for same info | Complete multi-step form |
| 3.3.8 Accessible Authentication | No cognitive test required | Check login flow |

## Output format

```markdown
## WCAG 2.2 Accessibility Audit: [page/component name]

**Target level**: [A / AA / AAA]
**URL**: [tested URL]
**Date**: [audit date]
**Tools used**: [axe-core / Lighthouse / WAVE / manual]

### Automated Scan Results
[Summary of automated findings]

### Manual Testing Results

#### Perceivable
| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 1.1.1 Non-text Content | PASS/FAIL/NOT TESTED | [evidence with label] |
| ... | ... | ... |

#### Operable
| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 2.1.1 Keyboard | PASS/FAIL/NOT TESTED | [evidence with label] |
| ... | ... | ... |

#### Understandable
| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 3.1.1 Language of Page | PASS/FAIL/NOT TESTED | [evidence with label] |
| ... | ... | ... |

#### Robust
| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 4.1.2 Name, Role, Value | PASS/FAIL/NOT TESTED | [evidence with label] |
| ... | ... | ... |

### Findings Detail

[For each FAIL, document:]
- Criterion and level
- Element location
- Observed behavior
- Expected behavior
- Remediation recommendation
- Evidence label

### Conformance Statement

**Level A**: [X of Y criteria PASS | FAIL — criteria N, N, N not met]
**Level AA**: [X of Y criteria PASS | FAIL — criteria N, N, N not met]

**Overall**: [CONFORMS at Level X | DOES NOT CONFORM — N failures]

## Beads follow-ups
bd create "A11y: [criterion] - [issue]" --type bug -p 1 --label a11y
```

## Self-validation

Before finalizing:

- [ ] Automated scan completed and results documented
- [ ] Keyboard navigation tested by pressing Tab (not code inspection)
- [ ] Contrast measured with tool (not calculated from hex)
- [ ] All PASS verdicts have `[VERIFIED]` evidence
- [ ] No PASS verdict based on `[ASSUMPTION]` evidence
- [ ] NOT TESTED used for criteria not evaluated (not assumed PASS)
- [ ] Findings include remediation recommendations

## Gotchas

- **Code inspection ≠ accessibility test** — Seeing `alt=""` in code doesn't verify screen reader behavior
- **Lighthouse score ≠ conformance** — Automated tools catch ~30% of issues
- **ARIA ≠ accessible** — Incorrect ARIA is worse than no ARIA
- **Works for me ≠ works for users** — Test with actual assistive technology

## Maker/Checker

Accessibility audit is verified by:
- **accessibility-specialist** — Are criteria interpretations correct?
- **assistive-tech-user** — Does the interface actually work?

Do not claim conformance without evidence for every applicable criterion.

## Legal context (informational)

| Regulation | Scope | Standard |
|------------|-------|----------|
| ADA (US) | Public accommodations | WCAG 2.1 AA |
| Section 508 (US) | Federal agencies | WCAG 2.0 AA |
| EAA (EU) | Products and services | EN 301 549 (WCAG 2.1 AA) |
| AODA (Canada) | Ontario organizations | WCAG 2.0 AA |

This skill provides evaluation methodology, not legal advice.
