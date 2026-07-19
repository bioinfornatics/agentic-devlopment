## Success Criteria Priority Matrix

Use this to prioritize issues:

| Priority | Criteria | Rationale |
|----------|----------|-----------|
| **P0** | Level A failures | Legal requirement, blocks access |
| **P1** | Level AA failures (high impact) | Legal requirement, major barriers |
| **P2** | Level AA failures (medium impact) | Legal requirement, moderate barriers |
| **P3** | Level AA failures (low impact) | Legal requirement, minor barriers |
| **P4** | Level AAA improvements | Enhanced accessibility (optional) |

---

## Common Quick Wins

These are high-impact, low-effort fixes:

1. **Add alt text** - 1.1.1 (A) - 1-2 days
2. **Fix color contrast** - 1.4.3 (AA) - 4-8 hours
3. **Add focus indicators** - 2.4.7 (AA) - 2-4 hours
4. **Add page titles** - 2.4.2 (A) - 1-2 hours
5. **Add lang attribute** - 3.1.1 (A) - 30 minutes
6. **Add form labels** - 3.3.2 (A) - 4-8 hours
7. **Fix HTML validation errors** - 4.1.1 (A) - 2-4 hours

---

## Best Practices

1. **Test with real users**: People with disabilities provide insights automation misses
2. **Start early**: Build accessibility in, don't bolt on later
3. **Educate team**: Accessibility is everyone's responsibility
4. **Use semantic HTML**: Proper HTML is 80% of accessibility
5. **Test with keyboard**: If it works with keyboard, it usually works with assistive tech
6. **Don't rely on color alone**: Use icons, patterns, text
7. **Provide alternatives**: Captions, transcripts, text descriptions
8. **Keep it simple**: Complex interfaces are harder to make accessible
9. **Stay updated**: WCAG evolves; WCAG 3 remains a working draft until W3C publishes it as a Recommendation
10. **Legal compliance ≠ great UX**: Aim higher than minimum standards

---

## WCAG 2.2 New Success Criteria Summary (2023)

WCAG 2.2 added 9 new criteria:

- **2.4.11 Focus Not Obscured (Minimum)** (AA) - Focus indicator not completely hidden
- **2.4.12 Focus Not Obscured (Enhanced)** (AAA) - Focus indicator not obscured at all
- **2.4.13 Focus Appearance** (AAA) - Focus indicator meets size/contrast requirements
- **2.5.7 Dragging Movements** (AA) - Single pointer alternative for drag operations
- **2.5.8 Target Size (Minimum)** (AA) - Touch targets at least 24×24 CSS pixels
- **3.2.6 Consistent Help** (A) - Help mechanism in same location across pages
- **3.3.7 Redundant Entry** (A) - Don't ask for same info twice in same session
- **3.3.8 Accessible Authentication (Minimum)** (AA) - No cognitive function test for auth
- **3.3.9 Accessible Authentication (Enhanced)** (AAA) - No cognitive function test (stricter)

These are integrated into the main checklist above for 2.2 audits.

---

