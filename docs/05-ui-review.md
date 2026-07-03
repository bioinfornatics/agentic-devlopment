# 05 — UI Review

Review a UI for visual quality, interaction states, accessibility, and implementation evidence.

## User scenario

> "Look at this page like a product designer and accessibility reviewer. Tell me what to fix."

## Run methods

### Method A — headless recipe

```bash
goose run --recipe ui-ux-suite \
  --params target="review the settings page UI" \
  --params repo_path="$PWD"
```

### Method B — slash command in an interactive Goose session

```text
/uiux review the settings page UI
```

Browser-specific alternative:

```text
/webtest verify settings page UI at http://localhost:3000/settings
```

## Recommended command

```bash
goose run --recipe ui-ux-suite   --params target="review the settings page UI"   --params repo_path="$PWD"
```

If a browser must be used:

```bash
goose run --recipe harness-web-test   --params task="verify settings page UI at http://localhost:3000/settings"   --params repo_path="$PWD"
```

## Review dimensions

1. Visual hierarchy and spacing.
2. Typography and density.
3. Color, contrast, and theming.
4. Loading, empty, error, success, disabled states.
5. Keyboard navigation and focus order.
6. Screen reader names and ARIA correctness.
7. Responsive behavior.
8. Console/network errors.
9. Perceived performance.
10. AI-slop detection: generic gradients, meaningless cards, inconsistent icons, fake polish.

## Evidence checklist

- URL or route tested.
- Browser/device viewport.
- Screenshots if visual claims matter.
- Console errors.
- Accessibility blockers.
- Reproduction steps.

## Beads follow-ups

```bash
bd create "UI: add error state to billing form" -t task -p 2 --json
bd create "A11y: fix missing label on search input" -t bug -p 1 --json
```

## Output format

```text
UI verdict:
Top user-impact issues:
Accessibility blockers:
Visual/design-system issues:
Evidence:
Beads follow-ups:
```

## Done criteria

- Claims are backed by browser evidence or code references.
- Accessibility blockers are prioritized above cosmetic issues.
- Fixes are phrased as implementable tasks.
